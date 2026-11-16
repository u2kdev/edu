import { getTenantDb } from "./db-tenant";
import {
  calculateAccountBalance,
  getTashkentMonthBounds,
  getTashkentYearMonth,
  TASHKENT_OFFSET_MS,
} from "./finance";
import {
  calculateDebtorsReport,
  calculateTeacherSalariesReport,
  generateFinanceReport,
} from "./finance-reports";
import { calculateStudentDebtsSummary } from "./billing";
import { roundUzs } from "./money";

export type AnalyticsPeriodPreset = "7d" | "30d" | "90d" | "12m";

export interface PeriodWindow {
  key: AnalyticsPeriodPreset;
  startDate: Date;
  endDate: Date;
  prevStartDate: Date;
  prevEndDate: Date;
}

export function resolveTashkentPeriodWindow(
  periodParam: string | null | undefined,
  now: Date = new Date()
): PeriodWindow {
  let key: AnalyticsPeriodPreset = "30d";
  if (periodParam === "7d" || periodParam === "30d" || periodParam === "90d" || periodParam === "12m") {
    key = periodParam;
  }

  let startDate: Date;
  if (key === "12m") {
    const nowYm = getTashkentYearMonth(now);
    let m = nowYm.month - 11;
    let y = nowYm.year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    startDate = getTashkentMonthBounds(y, m).startDate;
  } else {
    const days = key === "7d" ? 7 : key === "90d" ? 90 : 30;
    const shiftedStart = new Date(now.getTime() + TASHKENT_OFFSET_MS - (days - 1) * 24 * 3600 * 1000);
    shiftedStart.setUTCHours(0, 0, 0, 0);
    startDate = new Date(shiftedStart.getTime() - TASHKENT_OFFSET_MS);
  }

  const endDate = now;
  const durationMs = Math.max(24 * 3600 * 1000, endDate.getTime() - startDate.getTime());
  const prevEndDate = new Date(startDate.getTime() - 1);
  const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

  return {
    key,
    startDate,
    endDate,
    prevStartDate,
    prevEndDate,
  };
}

function calcDelta(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  if (current > 0) return 100;
  return 0;
}

function toTashkentDateKey(date: Date): string {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

export interface PaymentMethodBreakdownRow {
  method: "CASH" | "TRANSFER" | "CLICK" | "TERMINAL";
  amount: number;
  count: number;
  percent: number;
}

export interface ExpenseCategoryBreakdownRow {
  categoryId: string | null;
  categoryName: string;
  amount: number;
  percent: number;
}

export interface CenterFinanceAnalyticsDTO {
  period: AnalyticsPeriodPreset;
  startDate: string;
  endDate: string;
  kpis: {
    revenue: number;
    expenses: number;
    netProfit: number;
    totalDebt: number;
    debtorsCount: number;
    totalDiscounts: number;
    totalBalance: number;
    revenueDeltaPercent: number;
    expensesDeltaPercent: number;
    profitDeltaPercent: number;
  };
  paymentMethods: PaymentMethodBreakdownRow[];
  expenseCategories: ExpenseCategoryBreakdownRow[];
  monthlySeries: Array<{ month: string; income: number; expense: number; net: number }>;
  revenueByCourse: Array<{ id: string | null; name: string; amount: number; percent: number }>;
  revenueByGroup: Array<{ id: string | null; name: string; amount: number; percent: number }>;
  debtAging: Array<{
    bucket: "0-30" | "31-60" | "61+";
    amount: number;
    count: number;
    percent: number;
  }>;
  salariesByTeacher: Array<{
    teacherMembershipId: string;
    teacherName: string;
    conductedLessons: number;
    conductedMinutes: number;
    calculatedSalary: number;
    paidSalary: number;
    unpaidSalary: number;
    percent: number;
  }>;
  accountBalanceSeries: {
    accounts: Array<{ id: string; name: string; type: string; currentBalance: number }>;
    points: Array<Record<string, string | number>>;
  };
}

/**
 * Generates comprehensive financial analytics for /center/reports and /center/finance
 * strictly isolated by centerId via getTenantDb.
 */
export async function getCenterFinanceAnalytics(params: {
  centerId: string;
  period?: AnalyticsPeriodPreset;
  branchId?: string | null;
  now?: Date;
}): Promise<CenterFinanceAnalyticsDTO> {
  const now = params.now ?? new Date();
  const window = resolveTashkentPeriodWindow(params.period, now);
  const tenantDb = getTenantDb(params.centerId);

  // Build 12-month window in Asia/Tashkent for consistent annual trend series
  const nowYm = getTashkentYearMonth(now);
  const monthSpecs: Array<{ key: string; startDate: Date; endDate: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    let m = nowYm.month - i;
    let y = nowYm.year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const bounds = getTashkentMonthBounds(y, m);
    monthSpecs.push({
      key: `${y}-${String(m).padStart(2, "0")}`,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    });
  }
  const annualStart = monthSpecs[0].startDate;

  const [
    currentReport,
    prevReport,
    annualReport,
    debtorsReport,
    debtsSummary,
    salariesReport,
    periodPayments,
    standaloneIncomeTxs,
    accounts,
    periodTxsForBalances,
  ] = await Promise.all([
    generateFinanceReport({
      centerId: params.centerId,
      startDate: window.startDate,
      endDate: window.endDate,
      branchId: params.branchId,
    }),
    generateFinanceReport({
      centerId: params.centerId,
      startDate: window.prevStartDate,
      endDate: window.prevEndDate,
      branchId: params.branchId,
    }),
    generateFinanceReport({
      centerId: params.centerId,
      startDate: annualStart,
      endDate: now,
      branchId: params.branchId,
    }),
    calculateDebtorsReport({
      centerId: params.centerId,
      asOfDate: now,
    }),
    calculateStudentDebtsSummary(params.centerId),
    calculateTeacherSalariesReport({
      centerId: params.centerId,
      startDate: window.startDate,
      endDate: window.endDate,
    }),
    tenantDb.centerPayment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PAID", "PARTIALLY_PAID"] },
        OR: [
          { paidAt: { gte: window.startDate, lte: window.endDate } },
          { paidAt: null, createdAt: { gte: window.startDate, lte: window.endDate } },
        ],
      },
      select: {
        id: true,
        amount: true,
        refundedAmount: true,
        paymentMethod: true,
        paymentIntentId: true,
        externalTxId: true,
        financeTransactions: {
          where: { type: "INCOME", isReversal: false },
          select: { account: { select: { type: true } } },
          take: 1,
        },
      },
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        type: "INCOME",
        isReversal: false,
        centerPaymentId: null,
        date: { gte: window.startDate, lte: window.endDate },
      },
      select: {
        amount: true,
        account: { select: { type: true } },
      },
    }),
    tenantDb.account.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        date: { gte: window.startDate, lte: window.endDate },
      },
      select: {
        type: true,
        amount: true,
        accountId: true,
        targetAccountId: true,
        transferDirection: true,
        date: true,
        isReversal: true,
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // 1. Payment methods breakdown: CASH, TRANSFER, CLICK, TERMINAL
  const methodTotals: Record<"CASH" | "TRANSFER" | "CLICK" | "TERMINAL", { amount: number; count: number }> = {
    CASH: { amount: 0, count: 0 },
    TRANSFER: { amount: 0, count: 0 },
    CLICK: { amount: 0, count: 0 },
    TERMINAL: { amount: 0, count: 0 },
  };

  for (const p of periodPayments) {
    const net = Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount));
    if (net <= 0) continue;
    const accType = p.financeTransactions[0]?.account?.type;
    let bucket: "CASH" | "TRANSFER" | "CLICK" | "TERMINAL";
    if (p.paymentMethod === "ONLINE") {
      bucket = p.paymentIntentId || p.externalTxId ? "CLICK" : "TERMINAL";
    } else if (p.paymentMethod === "BANK_TRANSFER") {
      bucket = "TRANSFER";
    } else if (accType === "CARD") {
      bucket = "TERMINAL";
    } else {
      bucket = "CASH";
    }
    methodTotals[bucket].amount += net;
    methodTotals[bucket].count += 1;
  }

  for (const tx of standaloneIncomeTxs) {
    const amt = Math.max(0, roundUzs(tx.amount));
    if (amt <= 0) continue;
    const bucket: "CASH" | "TRANSFER" | "TERMINAL" =
      tx.account?.type === "CARD"
        ? "TERMINAL"
        : tx.account?.type === "BANK"
        ? "TRANSFER"
        : "CASH";
    methodTotals[bucket].amount += amt;
    methodTotals[bucket].count += 1;
  }

  const totalMethodsAmount = Object.values(methodTotals).reduce((s, m) => s + m.amount, 0);
  const paymentMethods: PaymentMethodBreakdownRow[] = (
    ["CASH", "TRANSFER", "CLICK", "TERMINAL"] as const
  )
    .map((method) => ({
      method,
      amount: methodTotals[method].amount,
      count: methodTotals[method].count,
      percent:
        totalMethodsAmount > 0
          ? Math.round((methodTotals[method].amount / totalMethodsAmount) * 1000) / 10
          : 0,
    }))
    .filter((m) => m.amount > 0);

  // 2. Expenses by category (Donut)
  const rawExpenseCats = currentReport.byCategory.filter((c) => c.type === "EXPENSE" && c.amount > 0);
  const totalExpCat = rawExpenseCats.reduce((s, c) => s + c.amount, 0);
  const expenseCategories: ExpenseCategoryBreakdownRow[] = rawExpenseCats
    .map((c) => ({
      categoryId: c.categoryId,
      categoryName: c.categoryName,
      amount: roundUzs(c.amount),
      percent: totalExpCat > 0 ? Math.round((c.amount / totalExpCat) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 3. Monthly Income & Expenses (12 months zero-filled in Asia/Tashkent)
  const annualMonthMap = new Map(annualReport.byMonth.map((m) => [m.month, m]));
  const monthlySeries = monthSpecs.map((spec) => {
    const entry = annualMonthMap.get(spec.key);
    return {
      month: spec.key,
      income: roundUzs(entry?.income ?? 0),
      expense: roundUzs(entry?.expense ?? 0),
      net: roundUzs(entry?.net ?? 0),
    };
  });

  // 4. Revenue by course and by group (sorted descending, with % shares)
  const courseIncomeItems = currentReport.byCourse.filter((c) => c.income > 0);
  const courseTotal = courseIncomeItems.reduce((s, c) => s + c.income, 0);
  const revenueByCourse = courseIncomeItems
    .map((c) => ({
      id: c.courseId,
      name: c.courseTitle,
      amount: roundUzs(c.income),
      percent: courseTotal > 0 ? Math.round((c.income / courseTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const groupIncomeItems = currentReport.byGroup.filter((g) => g.income > 0);
  const groupTotal = groupIncomeItems.reduce((s, g) => s + g.income, 0);
  const revenueByGroup = groupIncomeItems
    .map((g) => ({
      id: g.groupId,
      name: g.groupName,
      amount: roundUzs(g.income),
      percent: groupTotal > 0 ? Math.round((g.income / groupTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  // 5. Debt aging buckets (0-30, 31-60, 61+)
  const bucketCounts: Record<"0-30" | "31-60" | "61+", number> = {
    "0-30": 0,
    "31-60": 0,
    "61+": 0,
  };
  for (const row of debtorsReport.debtors) {
    bucketCounts[row.agingBucket] += 1;
  }
  const debtSum = debtorsReport.summary.totalDebt;
  const debtAging: CenterFinanceAnalyticsDTO["debtAging"] = (["0-30", "31-60", "61+"] as const).map(
    (bucket) => {
      const amt =
        bucket === "0-30"
          ? debtorsReport.summary.aging0to30
          : bucket === "31-60"
          ? debtorsReport.summary.aging31to60
          : debtorsReport.summary.aging61plus;
      return {
        bucket,
        amount: roundUzs(amt),
        count: bucketCounts[bucket],
        percent: debtSum > 0 ? Math.round((amt / debtSum) * 1000) / 10 : 0,
      };
    }
  );

  // 6. Teacher salaries grouped by teacher
  const teacherSalaryMap = new Map<
    string,
    {
      teacherMembershipId: string;
      teacherName: string;
      conductedLessons: number;
      conductedMinutes: number;
      calculatedSalary: number;
      paidSalary: number;
      unpaidSalary: number;
    }
  >();
  for (const row of salariesReport.teachers) {
    const existing = teacherSalaryMap.get(row.teacherMembershipId) ?? {
      teacherMembershipId: row.teacherMembershipId,
      teacherName: row.teacherName,
      conductedLessons: 0,
      conductedMinutes: 0,
      calculatedSalary: 0,
      paidSalary: 0,
      unpaidSalary: 0,
    };
    existing.conductedLessons += row.conductedLessonsCount;
    existing.conductedMinutes += row.conductedMinutes;
    existing.calculatedSalary += row.calculatedSalary;
    existing.paidSalary += row.paidSalaryAmount;
    existing.unpaidSalary += row.unpaidSalaryAmount;
    teacherSalaryMap.set(row.teacherMembershipId, existing);
  }
  const salaryTotal = Array.from(teacherSalaryMap.values()).reduce(
    (s, r) => s + r.calculatedSalary,
    0
  );
  const salariesByTeacher = Array.from(teacherSalaryMap.values())
    .map((r) => ({
      ...r,
      percent:
        salaryTotal > 0 ? Math.round((r.calculatedSalary / salaryTotal) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.calculatedSalary - a.calculatedSalary);

  // 7. Account balance trajectory line across selected period
  const beforeStartDate = new Date(window.startDate.getTime() - 1);
  const initialAccBalances = await Promise.all(
    accounts.map(async (acc) => {
      const startBal = await calculateAccountBalance(params.centerId, acc.id, beforeStartDate);
      const currEntry = currentReport.accountsCashflow.find((a) => a.accountId === acc.id);
      return {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        startBalance: roundUzs(startBal),
        currentBalance: roundUzs(currEntry?.currentBalance ?? startBal),
      };
    })
  );

  const runningBal = new Map(initialAccBalances.map((a) => [a.id, a.startBalance]));
  const useMonthlyBuckets = window.key === "12m" || window.key === "90d";
  const bucketMap = new Map<string, Record<string, string | number>>();

  if (accounts.length > 0 && (periodTxsForBalances.length > 0 || initialAccBalances.some((a) => a.currentBalance !== 0))) {
    const startPoint: Record<string, string | number> = {
      period: useMonthlyBuckets
        ? `${getTashkentYearMonth(window.startDate).year}-${String(getTashkentYearMonth(window.startDate).month).padStart(2, "0")}`
        : toTashkentDateKey(window.startDate),
    };
    for (const acc of initialAccBalances) {
      startPoint[acc.id] = acc.startBalance;
    }
    bucketMap.set(String(startPoint.period), startPoint);

    for (const tx of periodTxsForBalances) {
      const sign = tx.isReversal ? -1 : 1;
      const amt = roundUzs(tx.amount) * sign;
      if (tx.type === "INCOME") {
        runningBal.set(tx.accountId, (runningBal.get(tx.accountId) ?? 0) + amt);
      } else if (tx.type === "EXPENSE") {
        runningBal.set(tx.accountId, (runningBal.get(tx.accountId) ?? 0) - amt);
      } else if (tx.type === "TRANSFER") {
        if (tx.transferDirection === "OUT") {
          runningBal.set(tx.accountId, (runningBal.get(tx.accountId) ?? 0) - amt);
        } else if (tx.transferDirection === "IN") {
          runningBal.set(tx.accountId, (runningBal.get(tx.accountId) ?? 0) + amt);
        } else {
          runningBal.set(tx.accountId, (runningBal.get(tx.accountId) ?? 0) - amt);
          if (tx.targetAccountId) {
            runningBal.set(tx.targetAccountId, (runningBal.get(tx.targetAccountId) ?? 0) + amt);
          }
        }
      }

      const ym = getTashkentYearMonth(tx.date);
      const bucketKey = useMonthlyBuckets
        ? `${ym.year}-${String(ym.month).padStart(2, "0")}`
        : toTashkentDateKey(tx.date);
      const snapshot: Record<string, string | number> = { period: bucketKey };
      for (const acc of initialAccBalances) {
        snapshot[acc.id] = runningBal.get(acc.id) ?? 0;
      }
      bucketMap.set(bucketKey, snapshot);
    }
  }

  const totalBalance = currentReport.accountsCashflow.reduce(
    (s, a) => s + roundUzs(a.currentBalance),
    0
  );

  // If no FinanceTransactions exist in period yet but CenterPayments exist, ensure KPI revenue reflects collected CenterPayments cleanly
  const periodRevenue =
    currentReport.pnl.totalIncome > 0 ? currentReport.pnl.totalIncome : totalMethodsAmount;
  const periodExpenses = currentReport.pnl.totalExpense;
  const periodProfit = periodRevenue - periodExpenses;

  return {
    period: window.key,
    startDate: window.startDate.toISOString(),
    endDate: window.endDate.toISOString(),
    kpis: {
      revenue: roundUzs(periodRevenue),
      expenses: roundUzs(periodExpenses),
      netProfit: roundUzs(periodProfit),
      totalDebt: roundUzs(debtsSummary.summary.totalDebt),
      debtorsCount: debtsSummary.summary.debtorsCount,
      totalDiscounts: roundUzs(currentReport.pnl.totalDiscounts),
      totalBalance: roundUzs(totalBalance),
      revenueDeltaPercent: calcDelta(periodRevenue, prevReport.pnl.totalIncome),
      expensesDeltaPercent: calcDelta(periodExpenses, prevReport.pnl.totalExpense),
      profitDeltaPercent: calcDelta(periodProfit, prevReport.pnl.netProfit),
    },
    paymentMethods,
    expenseCategories,
    monthlySeries,
    revenueByCourse,
    revenueByGroup,
    debtAging,
    salariesByTeacher,
    accountBalanceSeries: {
      accounts: initialAccBalances.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        currentBalance: a.currentBalance,
      })),
      points: Array.from(bucketMap.values()),
    },
  };
}
