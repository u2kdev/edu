// Reason: Exception: Platform analytics aggregate global subscription and billing models.
// eslint-disable-next-line no-restricted-imports
import { db } from "./db";
import { getTashkentMonthBounds, getTashkentYearMonth } from "./finance";
import { roundUzs } from "./money";

export type PlatformPeriodKey = "7d" | "30d" | "90d" | "12m" | "year";

export interface PlatformRevenueMrrPoint {
  month: string; // YYYY-MM
  label: string;
  revenue: number;
  mrr: number;
}

export interface PlatformPlanDistributionItem {
  planId: string;
  planName: string;
  count: number;
  monthlyValue: number;
}

export interface PlatformStatusDistributionItem {
  status: string;
  count: number;
}

export interface PlatformDeltas {
  revenueDeltaPercent: number;
  prevPeriodRevenue: number;
  currentPeriodRevenue: number;
  centersDeltaPercent: number;
  prevPeriodCenters: number;
  currentPeriodCenters: number;
  usersDeltaPercent: number;
  prevPeriodUsers: number;
  currentPeriodUsers: number;
}

export function resolvePlatformPeriodDays(period: string): number {
  if (period === "7d") return 7;
  if (period === "90d") return 90;
  if (period === "12m" || period === "year") return 365;
  return 30;
}

function calcDeltaPercent(current: number, prev: number): number {
  if (prev > 0) return Math.round(((current - prev) / prev) * 100);
  if (current > 0) return 100;
  return 0;
}

/**
 * Builds 12-month Revenue & MRR series, tariff distribution, status breakdown,
 * and period-over-period growth deltas in Asia/Tashkent.
 */
export async function buildPlatformAnalyticsExtension(period: string, now: Date = new Date()) {
  const periodDays = resolvePlatformPeriodDays(period);
  const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
  const prevPeriodStart = new Date(periodStart.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const nowYm = getTashkentYearMonth(now);
  const monthSpecs: Array<{ year: number; month: number; key: string; startDate: Date; endDate: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    let m = nowYm.month - i;
    let y = nowYm.year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const bounds = getTashkentMonthBounds(y, m);
    monthSpecs.push({
      year: y,
      month: m,
      key: `${y}-${String(m).padStart(2, "0")}`,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    });
  }

  const twelveMonthsStart = monthSpecs[0].startDate;

  const [
    payments12m,
    subscriptionsAll,
    centersStatusGroups,
    currRevAgg,
    prevRevAgg,
    currCentersCount,
    prevCentersCount,
    currUsersCount,
    prevUsersCount,
  ] = await Promise.all([
    db.platformPayment.findMany({
      where: {
        status: { in: ["PAID", "REFUNDED"] },
        OR: [
          { paidAt: { gte: twelveMonthsStart } },
          { paidAt: null, createdAt: { gte: twelveMonthsStart } },
        ],
      },
      select: { amount: true, refundAmount: true, paidAt: true, createdAt: true },
    }),
    db.subscription.findMany({
      include: {
        plan: { select: { id: true, name: true, priceMonthly: true } },
      },
    }),
    db.learningCenter.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    db.platformPayment.aggregate({
      where: {
        status: { in: ["PAID", "REFUNDED"] },
        paidAt: { gte: periodStart, lte: now },
      },
      _sum: { amount: true, refundAmount: true },
    }),
    db.platformPayment.aggregate({
      where: {
        status: { in: ["PAID", "REFUNDED"] },
        paidAt: { gte: prevPeriodStart, lt: periodStart },
      },
      _sum: { amount: true, refundAmount: true },
    }),
    db.learningCenter.count({ where: { createdAt: { gte: periodStart, lte: now } } }),
    db.learningCenter.count({ where: { createdAt: { gte: prevPeriodStart, lt: periodStart } } }),
    db.platformUser.count({ where: { createdAt: { gte: periodStart, lte: now } } }),
    db.platformUser.count({ where: { createdAt: { gte: prevPeriodStart, lt: periodStart } } }),
  ]);

  const monthRevMap = new Map<string, number>();
  for (const spec of monthSpecs) {
    monthRevMap.set(spec.key, 0);
  }
  for (const p of payments12m) {
    const dt = p.paidAt ?? p.createdAt;
    const ym = getTashkentYearMonth(dt);
    const key = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
    if (monthRevMap.has(key)) {
      const net = Math.max(0, roundUzs(p.amount) - roundUzs(p.refundAmount));
      monthRevMap.set(key, (monthRevMap.get(key) ?? 0) + net);
    }
  }

  const revenueMrr12Months: PlatformRevenueMrrPoint[] = monthSpecs.map((spec) => {
    // Active recurring MRR snapshot overlapping this Tashkent month
    let monthMrr = 0;
    for (const sub of subscriptionsAll) {
      if (sub.status === "CANCELLED" && sub.updatedAt < spec.startDate) continue;
      if (sub.createdAt <= spec.endDate && sub.currentPeriodEndsAt >= spec.startDate) {
        if (sub.status === "ACTIVE" || sub.status === "TRIAL" || sub.status === "PAST_DUE") {
          monthMrr += roundUzs(sub.plan.priceMonthly);
        }
      }
    }
    return {
      month: spec.key,
      label: spec.key,
      revenue: monthRevMap.get(spec.key) ?? 0,
      mrr: monthMrr,
    };
  });

  // Distribution of active/trial centers by plan
  const planMap = new Map<string, PlatformPlanDistributionItem>();
  for (const sub of subscriptionsAll) {
    if (sub.status !== "ACTIVE" && sub.status !== "TRIAL") continue;
    const existing = planMap.get(sub.plan.id) ?? {
      planId: sub.plan.id,
      planName: sub.plan.name,
      count: 0,
      monthlyValue: 0,
    };
    existing.count += 1;
    existing.monthlyValue += roundUzs(sub.plan.priceMonthly);
    planMap.set(sub.plan.id, existing);
  }
  const centersByPlan = Array.from(planMap.values()).sort((a, b) => b.count - a.count);

  // Full center status distribution
  const statusOrder = ["ACTIVE", "TRIAL", "PAUSED", "OVERDUE", "BLOCKED", "CANCELLED"];
  const statusMap = new Map(centersStatusGroups.map((g) => [String(g.status), g._count.id]));
  const centersByStatus: PlatformStatusDistributionItem[] = statusOrder
    .map((st) => ({ status: st, count: statusMap.get(st) ?? 0 }))
    .filter((item) => item.count > 0);

  const currentPeriodRevenue = Math.max(
    0,
    roundUzs(currRevAgg._sum.amount) - roundUzs(currRevAgg._sum.refundAmount)
  );
  const prevPeriodRevenue = Math.max(
    0,
    roundUzs(prevRevAgg._sum.amount) - roundUzs(prevRevAgg._sum.refundAmount)
  );

  const deltas: PlatformDeltas = {
    revenueDeltaPercent: calcDeltaPercent(currentPeriodRevenue, prevPeriodRevenue),
    prevPeriodRevenue,
    currentPeriodRevenue,
    centersDeltaPercent: calcDeltaPercent(currCentersCount, prevCentersCount),
    prevPeriodCenters: prevCentersCount,
    currentPeriodCenters: currCentersCount,
    usersDeltaPercent: calcDeltaPercent(currUsersCount, prevUsersCount),
    prevPeriodUsers: prevUsersCount,
    currentPeriodUsers: currUsersCount,
  };

  return {
    revenueMrr12Months,
    centersByPlan,
    centersByStatus,
    deltas,
  };
}
