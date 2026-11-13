import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { calculatePlatformMRR } from "@/lib/platform-finance";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const startOfQuarter = new Date(now.getFullYear(), quarterMonth, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. MRR, ARR, ARPU
    const mrrStats = await calculatePlatformMRR();

    // 2. Revenue and Expenses aggregations
    const [
      monthPayments,
      quarterPayments,
      yearPayments,
      monthExpenses,
      quarterExpenses,
      yearExpenses,
      monthReversals,
      quarterReversals,
      yearReversals,
    ] = await Promise.all([
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfMonth }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfQuarter }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfYear }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfMonth }, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfQuarter }, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfYear }, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfMonth }, isReversal: true },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfQuarter }, isReversal: true },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfYear }, isReversal: true },
        _sum: { amount: true },
      }),
    ]);

    const monthNetRev = (monthPayments._sum.amount || 0) - (monthPayments._sum.refundAmount || 0);
    const quarterNetRev = (quarterPayments._sum.amount || 0) - (quarterPayments._sum.refundAmount || 0);
    const yearNetRev = (yearPayments._sum.amount || 0) - (yearPayments._sum.refundAmount || 0);

    const monthNetExp = (monthExpenses._sum.amount || 0) - (monthReversals._sum.amount || 0);
    const quarterNetExp = (quarterExpenses._sum.amount || 0) - (quarterReversals._sum.amount || 0);
    const yearNetExp = (yearExpenses._sum.amount || 0) - (yearReversals._sum.amount || 0);

    // 3. Revenue by plan
    const allPlans = await db.subscriptionPlan.findMany({
      include: {
        platformPayments: {
          where: { status: { in: ["PAID", "REFUNDED"] } },
          select: { amount: true, refundAmount: true },
        },
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          select: { id: true },
        },
      },
    });

    const revenueByPlan = allPlans.map((plan) => {
      const net = plan.platformPayments.reduce((acc, p) => acc + (p.amount - (p.refundAmount || 0)), 0);
      return {
        planId: plan.id,
        planName: plan.name,
        priceMonthly: plan.priceMonthly,
        activeSubscriptions: plan.subscriptions.length,
        totalRevenue: net,
      };
    });

    // 4. Revenue by center (Top 10)
    const centersRevenueAgg = await db.platformPayment.groupBy({
      by: ["centerId"],
      where: { status: { in: ["PAID", "REFUNDED"] } },
      _sum: { amount: true, refundAmount: true },
      _count: { id: true },
      orderBy: {
        _sum: { amount: "desc" },
      },
      take: 10,
    });

    const centerIds = centersRevenueAgg.map((c) => c.centerId);
    const centersMap = await db.learningCenter.findMany({
      where: { id: { in: centerIds } },
      select: { id: true, name: true, slug: true, status: true },
    });

    const revenueByCenter = centersRevenueAgg.map((c) => {
      const centerObj = centersMap.find((item) => item.id === c.centerId);
      const net = (c._sum.amount || 0) - (c._sum.refundAmount || 0);
      return {
        centerId: c.centerId,
        centerName: centerObj?.name || "Неизвестный центр",
        status: centerObj?.status || "ACTIVE",
        paymentsCount: c._count.id,
        totalRevenue: net,
      };
    });

    // 5. Debtors list (status PAST_DUE or center OVERDUE or expired)
    const overdueSubscriptions = await db.subscription.findMany({
      where: {
        OR: [
          { status: "PAST_DUE" },
          { center: { status: { in: ["OVERDUE", "PAUSED"] } } },
          { currentPeriodEndsAt: { lt: now }, status: { in: ["ACTIVE", "TRIAL"] } },
        ],
      },
      include: {
        center: { select: { id: true, name: true, phone: true, email: true, status: true } },
        plan: { select: { id: true, name: true, priceMonthly: true } },
      },
      take: 50,
    });

    const debtors = overdueSubscriptions.map((sub) => {
      const daysOverdue = Math.max(0, Math.floor((now.getTime() - sub.currentPeriodEndsAt.getTime()) / (1000 * 60 * 60 * 24)));
      return {
        subscriptionId: sub.id,
        centerId: sub.center.id,
        centerName: sub.center.name,
        centerPhone: sub.center.phone,
        centerEmail: sub.center.email,
        centerStatus: sub.center.status,
        planName: sub.plan.name,
        dueAmount: Math.round(sub.plan.priceMonthly),
        currentPeriodEndsAt: sub.currentPeriodEndsAt,
        daysOverdue,
      };
    });

    // 6. Churn rate (centres cancelled or paused in last 30 days)
    const cancelledCount = await db.learningCenter.count({
      where: {
        status: { in: ["CANCELLED", "PAUSED", "BLOCKED"] },
        updatedAt: { gte: thirtyDaysAgo },
      },
    });
    const totalCenters = await db.learningCenter.count();
    const churnRate = totalCenters > 0 ? Number(((cancelledCount / totalCenters) * 100).toFixed(1)) : 0;

    // 7. 30-day forecast based on upcoming expiration dates of active subscriptions
    const upcomingRenewals = await db.subscription.findMany({
      where: {
        status: { in: ["ACTIVE", "TRIAL"] },
        currentPeriodEndsAt: {
          gte: now,
          lte: thirtyDaysAhead,
        },
      },
      include: {
        plan: { select: { priceMonthly: true } },
      },
    });

    const forecast30Days = upcomingRenewals.reduce((sum, s) => sum + Math.round(s.plan.priceMonthly || 0), 0);

    // 8. Monthly historical revenue (last 6 months)
    const monthlyHistory: { month: string; revenue: number; expenses: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthLabel = d.toLocaleString("ru", { month: "short", year: "2-digit" });

      const [pAgg, eAgg, rAgg] = await Promise.all([
        db.platformPayment.aggregate({
          where: { paidAt: { gte: d, lt: nextD }, status: { in: ["PAID", "REFUNDED"] } },
          _sum: { amount: true, refundAmount: true },
        }),
        db.platformExpense.aggregate({
          where: { date: { gte: d, lt: nextD }, isReversal: false },
          _sum: { amount: true },
        }),
        db.platformExpense.aggregate({
          where: { date: { gte: d, lt: nextD }, isReversal: true },
          _sum: { amount: true },
        }),
      ]);

      const rev = (pAgg._sum.amount || 0) - (pAgg._sum.refundAmount || 0);
      const exp = (eAgg._sum.amount || 0) - (rAgg._sum.amount || 0);

      monthlyHistory.push({
        month: monthLabel,
        revenue: rev,
        expenses: exp,
      });
    }

    return NextResponse.json({
      success: true,
      stats: {
        mrr: mrrStats.mrr,
        arr: mrrStats.arr,
        arpu: mrrStats.arpu,
        activeSubscriptionsCount: mrrStats.activeSubscriptionsCount,
        forecast30Days,
        churnRate,
        periods: {
          month: {
            revenue: monthNetRev,
            expenses: monthNetExp,
            profit: monthNetRev - monthNetExp,
          },
          quarter: {
            revenue: quarterNetRev,
            expenses: quarterNetExp,
            profit: quarterNetRev - quarterNetExp,
          },
          year: {
            revenue: yearNetRev,
            expenses: yearNetExp,
            profit: yearNetRev - yearNetExp,
          },
        },
        revenueByPlan,
        revenueByCenter,
        debtors,
        monthlyHistory,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
