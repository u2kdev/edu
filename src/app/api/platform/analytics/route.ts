import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePlatformOwner, handlePlatformError } from "@/lib/platformAuth";

export async function GET() {
  try {
    await requirePlatformOwner();

    // 1. Center Metrics
    const centersCount = await db.learningCenter.count();
    const activeCenters = await db.learningCenter.count({ where: { status: "ACTIVE" } });
    const trialCenters = await db.learningCenter.count({ where: { status: "TRIAL" } });
    const pausedCenters = await db.learningCenter.count({ where: { status: "PAUSED" } });
    const blockedCenters = await db.learningCenter.count({ where: { status: "BLOCKED" } });

    // 2. User Metrics
    const totalUsers = await db.platformUser.count();
    const students = await db.centerMembership.count({ where: { role: "STUDENT", status: "ACTIVE" } });
    const teachers = await db.centerMembership.count({ where: { role: "TEACHER", status: "ACTIVE" } });

    // 3. Subscription & Financial Metrics (MRR / ARR based on active plans)
    const activeSubscriptions = await db.subscription.findMany({
      where: { status: "ACTIVE" },
      include: { plan: true },
    });

    let mrr = 0;
    const revenueByPlan: Record<string, number> = {};

    for (const sub of activeSubscriptions) {
      if (sub.plan) {
        mrr += sub.plan.priceMonthly;
        revenueByPlan[sub.plan.name] = (revenueByPlan[sub.plan.name] || 0) + sub.plan.priceMonthly;
      }
    }

    const arr = mrr * 12;

    // 4. Growth (New centers this month)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const newCentersThisMonth = await db.learningCenter.count({
      where: { createdAt: { gte: thirtyDaysAgo } },
    });
    
    // 5. Recent Activity
    const recentActivity = await db.auditLog.findMany({
      where: { centerId: null }, // Platform-level logs
      include: { actor: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({
      centers: {
        total: centersCount,
        active: activeCenters,
        trial: trialCenters,
        paused: pausedCenters,
        blocked: blockedCenters,
        newThisMonth: newCentersThisMonth,
      },
      users: {
        total: totalUsers,
        students,
        teachers,
      },
      revenue: {
        activeSubscriptions: activeSubscriptions.length,
        mrr,
        arr,
        byPlan: revenueByPlan,
      },
      recentActivity,
    });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
