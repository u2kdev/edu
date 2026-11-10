import { getTenantDb } from "./db-tenant";
import {
  calculateAccountBalance,
  getTashkentYearMonth,
} from "./finance";

export interface FinanceReportParams {
  centerId: string;
  startDate: Date;
  endDate: Date;
  branchId?: string | null;
}

export interface CategoryBreakdownItem {
  categoryId: string | null;
  categoryName: string;
  type: "INCOME" | "EXPENSE";
  amount: number;
}

export interface MonthlyBreakdownItem {
  month: string; // YYYY-MM in Asia/Tashkent
  income: number;
  expense: number;
  net: number;
}

export interface BranchBreakdownItem {
  branchId: string | null;
  branchName: string;
  income: number;
  expense: number;
  net: number;
}

export interface CourseBreakdownItem {
  courseId: string | null;
  courseTitle: string;
  income: number;
  expense: number;
  net: number;
}

export interface GroupBreakdownItem {
  groupId: string | null;
  groupName: string;
  income: number;
  expense: number;
  net: number;
}

export interface AccountCashflowItem {
  accountId: string;
  accountName: string;
  type: "CASH" | "CARD" | "BANK";
  periodInflow: number;
  periodOutflow: number;
  currentBalance: number;
}

/**
 * Generates server-side financial reports (P&L, Cash Flow & Balances by Account,
 * and Breakdowns by Category, Month in Asia/Tashkent, Branch, Course, and Group)
 * using getTenantDb without raw SQL.
 */
export async function generateFinanceReport(params: FinanceReportParams) {
  const tenantDb = getTenantDb(params.centerId);

  const whereBase: Record<string, unknown> = {
    date: {
      gte: params.startDate,
      lte: params.endDate,
    },
  };
  if (params.branchId) {
    whereBase.branchId = params.branchId;
  }

  const [transactions, accounts, categories, branches, courses, groups] = await Promise.all([
    tenantDb.financeTransaction.findMany({
      where: whereBase,
      select: {
        id: true,
        type: true,
        amount: true,
        accountId: true,
        targetAccountId: true,
        transferDirection: true,
        categoryId: true,
        branchId: true,
        courseId: true,
        groupId: true,
        date: true,
        isReversal: true,
      },
      orderBy: { date: "asc" },
    }),
    tenantDb.account.findMany({
      where: { isActive: true },
      select: { id: true, name: true, type: true },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    }),
    tenantDb.financeCategory.findMany({
      select: { id: true, name: true, type: true },
    }),
    tenantDb.branch.findMany({
      select: { id: true, name: true },
    }),
    tenantDb.course.findMany({
      select: { id: true, title: true },
    }),
    tenantDb.group.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  const branchMap = new Map(branches.map((b) => [b.id, b.name]));
  const courseMap = new Map(courses.map((c) => [c.id, c.title]));
  const groupMap = new Map(groups.map((g) => [g.id, g.name]));

  let totalIncome = 0;
  let totalExpense = 0;
  let totalTransferVolume = 0;

  const byCategoryMap = new Map<string, CategoryBreakdownItem>();
  const byMonthMap = new Map<string, MonthlyBreakdownItem>();
  const byBranchMap = new Map<string, BranchBreakdownItem>();
  const byCourseMap = new Map<string, CourseBreakdownItem>();
  const byGroupMap = new Map<string, GroupBreakdownItem>();
  const accountFlowMap = new Map<string, { inflow: number; outflow: number }>();

  for (const acc of accounts) {
    accountFlowMap.set(acc.id, { inflow: 0, outflow: 0 });
  }

  for (const tx of transactions) {
    const sign = tx.isReversal ? -1 : 1;
    const signedAmount = tx.amount * sign;

    const { year, month } = getTashkentYearMonth(tx.date);
    const ymKey = `${year}-${String(month).padStart(2, "0")}`;
    if (!byMonthMap.has(ymKey)) {
      byMonthMap.set(ymKey, { month: ymKey, income: 0, expense: 0, net: 0 });
    }
    const monthEntry = byMonthMap.get(ymKey)!;

    if (tx.type === "INCOME") {
      totalIncome += signedAmount;
      monthEntry.income += signedAmount;
      monthEntry.net += signedAmount;

      const accFlow = accountFlowMap.get(tx.accountId);
      if (accFlow) accFlow.inflow += signedAmount;

      const catKey = `INCOME:${tx.categoryId ?? "uncategorized"}`;
      const catInfo = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      const existingCat = byCategoryMap.get(catKey) ?? {
        categoryId: tx.categoryId ?? null,
        categoryName: catInfo?.name ?? "Без категории",
        type: "INCOME" as const,
        amount: 0,
      };
      existingCat.amount += signedAmount;
      byCategoryMap.set(catKey, existingCat);
    } else if (tx.type === "EXPENSE") {
      totalExpense += signedAmount;
      monthEntry.expense += signedAmount;
      monthEntry.net -= signedAmount;

      const accFlow = accountFlowMap.get(tx.accountId);
      if (accFlow) accFlow.outflow += signedAmount;

      const catKey = `EXPENSE:${tx.categoryId ?? "uncategorized"}`;
      const catInfo = tx.categoryId ? categoryMap.get(tx.categoryId) : undefined;
      const existingCat = byCategoryMap.get(catKey) ?? {
        categoryId: tx.categoryId ?? null,
        categoryName: catInfo?.name ?? "Без категории",
        type: "EXPENSE" as const,
        amount: 0,
      };
      existingCat.amount += signedAmount;
      byCategoryMap.set(catKey, existingCat);
    } else if (tx.type === "TRANSFER") {
      if (tx.transferDirection === "OUT") {
        totalTransferVolume += signedAmount;
        const srcFlow = accountFlowMap.get(tx.accountId);
        if (srcFlow) srcFlow.outflow += signedAmount;
      } else if (tx.transferDirection === "IN") {
        const dstFlow = accountFlowMap.get(tx.accountId);
        if (dstFlow) dstFlow.inflow += signedAmount;
      } else {
        totalTransferVolume += signedAmount;
        const srcFlow = accountFlowMap.get(tx.accountId);
        if (srcFlow) srcFlow.outflow += signedAmount;
        if (tx.targetAccountId) {
          const dstFlow = accountFlowMap.get(tx.targetAccountId);
          if (dstFlow) dstFlow.inflow += signedAmount;
        }
      }
    }

    if (tx.type === "INCOME" || tx.type === "EXPENSE") {
      // Branch breakdown
      const bKey = tx.branchId ?? "unassigned";
      const bEntry = byBranchMap.get(bKey) ?? {
        branchId: tx.branchId ?? null,
        branchName: (tx.branchId ? branchMap.get(tx.branchId) : null) ?? "Общий (без филиала)",
        income: 0,
        expense: 0,
        net: 0,
      };
      if (tx.type === "INCOME") {
        bEntry.income += signedAmount;
        bEntry.net += signedAmount;
      } else {
        bEntry.expense += signedAmount;
        bEntry.net -= signedAmount;
      }
      byBranchMap.set(bKey, bEntry);

      // Course breakdown
      const cKey = tx.courseId ?? "unassigned";
      const cEntry = byCourseMap.get(cKey) ?? {
        courseId: tx.courseId ?? null,
        courseTitle: (tx.courseId ? courseMap.get(tx.courseId) : null) ?? "Вне курса",
        income: 0,
        expense: 0,
        net: 0,
      };
      if (tx.type === "INCOME") {
        cEntry.income += signedAmount;
        cEntry.net += signedAmount;
      } else {
        cEntry.expense += signedAmount;
        cEntry.net -= signedAmount;
      }
      byCourseMap.set(cKey, cEntry);

      // Group breakdown
      const gKey = tx.groupId ?? "unassigned";
      const gEntry = byGroupMap.get(gKey) ?? {
        groupId: tx.groupId ?? null,
        groupName: (tx.groupId ? groupMap.get(tx.groupId) : null) ?? "Вне группы",
        income: 0,
        expense: 0,
        net: 0,
      };
      if (tx.type === "INCOME") {
        gEntry.income += signedAmount;
        gEntry.net += signedAmount;
      } else {
        gEntry.expense += signedAmount;
        gEntry.net -= signedAmount;
      }
      byGroupMap.set(gKey, gEntry);
    }
  }

  const accountsCashflow: AccountCashflowItem[] = await Promise.all(
    accounts.map(async (acc) => {
      const currentBalance = await calculateAccountBalance(params.centerId, acc.id);
      const flow = accountFlowMap.get(acc.id) ?? { inflow: 0, outflow: 0 };
      return {
        accountId: acc.id,
        accountName: acc.name,
        type: acc.type,
        periodInflow: flow.inflow,
        periodOutflow: flow.outflow,
        currentBalance,
      };
    })
  );

  return {
    pnl: {
      totalIncome,
      totalExpense,
      netProfit: totalIncome - totalExpense,
      totalTransferVolume,
      currency: "UZS",
    },
    accountsCashflow,
    byCategory: Array.from(byCategoryMap.values()).filter((c) => c.amount !== 0),
    byMonth: Array.from(byMonthMap.values()).sort((a, b) => a.month.localeCompare(b.month)),
    byBranch: Array.from(byBranchMap.values()),
    byCourse: Array.from(byCourseMap.values()),
    byGroup: Array.from(byGroupMap.values()),
  };
}

export interface DebtorRow {
  paymentId: string;
  studentMembershipId: string;
  studentName: string;
  studentPhone: string | null;
  groupId: string | null;
  groupName: string | null;
  originalAmount: number;
  paidAmount: number;
  discountAmount: number;
  debtAmount: number;
  daysOverdue: number;
  agingBucket: "0-30" | "31-60" | "61+";
  createdAt: Date;
}

/**
 * Calculates Debtors report with aging buckets: 0-30, 31-60, and 61+ days.
 */
export async function calculateDebtorsReport(params: {
  centerId: string;
  asOfDate?: Date;
  groupId?: string | null;
}) {
  const tenantDb = getTenantDb(params.centerId);
  const asOf = params.asOfDate ?? new Date();

  const where: Record<string, unknown> = {
    deletedAt: null,
    status: { in: ["PENDING", "PARTIALLY_PAID"] },
  };
  if (params.groupId) {
    where.groupId = params.groupId;
  }

  const unpaidPayments = await tenantDb.centerPayment.findMany({
    where,
    include: {
      student: {
        include: {
          user: { select: { fullName: true, phone: true, email: true } },
        },
      },
      group: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  let totalDebt = 0;
  let aging0to30 = 0;
  let aging31to60 = 0;
  let aging61plus = 0;

  const debtors: DebtorRow[] = [];

  for (const p of unpaidPayments) {
    const orig = Math.round(p.originalAmount ?? p.amount);
    const disc = Math.round(p.discountAmount ?? 0);
    const paid = p.status === "PARTIALLY_PAID" ? Math.round(p.amount) : 0;
    const debtAmount = Math.max(0, orig - disc - paid);
    if (debtAmount <= 0) continue;

    const diffMs = Math.max(0, asOf.getTime() - p.createdAt.getTime());
    const daysOverdue = Math.floor(diffMs / (24 * 3600 * 1000));

    let agingBucket: "0-30" | "31-60" | "61+" = "0-30";
    if (daysOverdue > 60) {
      agingBucket = "61+";
      aging61plus += debtAmount;
    } else if (daysOverdue > 30) {
      agingBucket = "31-60";
      aging31to60 += debtAmount;
    } else {
      aging0to30 += debtAmount;
    }

    totalDebt += debtAmount;

    debtors.push({
      paymentId: p.id,
      studentMembershipId: p.studentMembershipId,
      studentName: p.student?.user?.fullName ?? "Студент",
      studentPhone: p.student?.user?.phone ?? null,
      groupId: p.groupId,
      groupName: p.group?.name ?? null,
      originalAmount: orig,
      paidAmount: paid,
      discountAmount: disc,
      debtAmount,
      daysOverdue,
      agingBucket,
      createdAt: p.createdAt,
    });
  }

  return {
    summary: {
      totalDebt,
      aging0to30,
      aging31to60,
      aging61plus,
      debtorsCount: debtors.length,
      currency: "UZS",
    },
    debtors,
  };
}

export interface TeacherSalaryRow {
  rateId: string;
  teacherMembershipId: string;
  teacherName: string;
  groupId: string | null;
  groupName: string | null;
  rateType: "HOURLY" | "PERCENTAGE" | "FIXED";
  rateAmount: number;
  conductedLessonsCount: number;
  conductedMinutes: number;
  groupIncomeInPeriod: number;
  calculatedSalary: number;
}

/**
 * Calculates teacher salaries for a period from conducted (ACTIVE) lessons and group income.
 * Uses integer arithmetic with Math.round() for UZS.
 */
export async function calculateTeacherSalariesReport(params: {
  centerId: string;
  startDate: Date;
  endDate: Date;
}) {
  const tenantDb = getTenantDb(params.centerId);

  const [rates, lessons, groupIncomeTxs] = await Promise.all([
    tenantDb.teacherSalaryRate.findMany({
      where: { isActive: true },
      include: {
        teacher: {
          include: { user: { select: { fullName: true } } },
        },
        group: { select: { id: true, name: true } },
      },
    }),
    tenantDb.lesson.findMany({
      where: {
        status: "ACTIVE",
        scheduledAt: {
          gte: params.startDate,
          lte: params.endDate,
        },
      },
      include: {
        scheduleSlot: {
          select: {
            groupId: true,
            teacherMembershipId: true,
          },
        },
      },
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        type: "INCOME",
        date: {
          gte: params.startDate,
          lte: params.endDate,
        },
      },
      select: {
        groupId: true,
        amount: true,
        isReversal: true,
      },
    }),
  ]);

  const groupIncomeMap = new Map<string, number>();
  for (const tx of groupIncomeTxs) {
    if (!tx.groupId) continue;
    const signed = tx.isReversal ? -tx.amount : tx.amount;
    groupIncomeMap.set(tx.groupId, (groupIncomeMap.get(tx.groupId) ?? 0) + signed);
  }

  let totalCalculatedSalary = 0;
  const teachers: TeacherSalaryRow[] = [];

  for (const rate of rates) {
    const matchingLessons = lessons.filter((l) => {
      const effectiveTeacherId =
        l.substituteTeacherMembershipId ?? l.scheduleSlot?.teacherMembershipId;
      if (effectiveTeacherId !== rate.teacherMembershipId) return false;
      if (rate.groupId && l.scheduleSlot?.groupId !== rate.groupId) return false;
      return true;
    });

    const conductedLessonsCount = matchingLessons.length;
    const conductedMinutes = matchingLessons.reduce(
      (sum, l) => sum + (l.durationMinutes || 60),
      0
    );

    const groupIncomeInPeriod = rate.groupId
      ? Math.max(0, groupIncomeMap.get(rate.groupId) ?? 0)
      : 0;

    let calculatedSalary = 0;
    if (rate.rateType === "HOURLY") {
      // rate.amount is UZS per 60 minutes
      calculatedSalary = Math.round((conductedMinutes * rate.amount) / 60);
    } else if (rate.rateType === "PERCENTAGE") {
      calculatedSalary = Math.round((groupIncomeInPeriod * rate.amount) / 100);
    } else if (rate.rateType === "FIXED") {
      calculatedSalary = rate.amount;
    }

    totalCalculatedSalary += calculatedSalary;

    teachers.push({
      rateId: rate.id,
      teacherMembershipId: rate.teacherMembershipId,
      teacherName: rate.teacher?.user?.fullName ?? "Преподаватель",
      groupId: rate.groupId,
      groupName: rate.group?.name ?? null,
      rateType: rate.rateType,
      rateAmount: rate.amount,
      conductedLessonsCount,
      conductedMinutes,
      groupIncomeInPeriod,
      calculatedSalary,
    });
  }

  return {
    totalCalculatedSalary,
    currency: "UZS",
    teachers,
  };
}
