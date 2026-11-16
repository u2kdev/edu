import { getTenantDb } from "./db-tenant";
import { getCenterSubscriptionUsage } from "./limits";
import { calculateStudentBalances } from "./student-balance";
import { getTashkentMonthBounds, getTashkentYearMonth, TASHKENT_OFFSET_MS } from "./finance";
import { calculateDebtorsReport, calculateTeacherSalariesReport, generateFinanceReport } from "./finance-reports";
import { calculateStudentDebtsSummary } from "./billing";
import { type AnalyticsPeriodPreset, resolveTashkentPeriodWindow } from "./finance-analytics";
import { roundUzs } from "./money";

export class DashboardAccessError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "FORBIDDEN") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function calcDelta(current: number, previous: number): number {
  if (previous > 0) return Math.round(((current - previous) / previous) * 100);
  if (current > 0) return 100;
  return 0;
}

function getTashkentIsoWeekday(date: Date): number {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const d = shifted.getUTCDay();
  return d === 0 ? 7 : d;
}

function toTashkentYmd(date: Date): string {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

function getTashkentWeekKey(date: Date): string {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  const day = shifted.getUTCDay(); // 0=Sun..6=Sat
  const diffToMon = (day + 6) % 7;
  const monday = new Date(shifted.getTime() - diffToMon * 24 * 3600 * 1000);
  return monday.toISOString().slice(0, 10);
}

function buildLast12MonthSpecs(now: Date) {
  const nowYm = getTashkentYearMonth(now);
  const specs: Array<{ key: string; startDate: Date; endDate: Date }> = [];
  for (let i = 11; i >= 0; i--) {
    let m = nowYm.month - i;
    let y = nowYm.year;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const bounds = getTashkentMonthBounds(y, m);
    specs.push({
      key: `${y}-${String(m).padStart(2, "0")}`,
      startDate: bounds.startDate,
      endDate: bounds.endDate,
    });
  }
  return specs;
}

// ============================================================================
// B. DIRECTOR & CENTER ADMIN DASHBOARD ANALYTICS
// ============================================================================

export interface DirectorDashboardData {
  period: AnalyticsPeriodPreset;
  kpis: {
    revenue: number;
    revenueDeltaPercent: number;
    expenses: number;
    expensesDeltaPercent: number;
    totalDebt: number;
    debtorsCount: number;
    activeStudents: number;
    activeStudentsDelta: number;
    activeTeachers: number;
    coursesCount: number;
    attendanceRate: number | null;
    attendanceDeltaPoints: number | null;
    atRiskStudentsCount: number;
    pendingManualRefundsCount: number;
  };
  revenueExpenses12Months: Array<{ month: string; revenue: number; expenses: number }>;
  debtAgingBuckets: Array<{ label: string; aging0to30: number; aging31to60: number; aging61plus: number }>;
  debtAgingTotals: {
    aging0to30: number;
    aging31to60: number;
    aging61plus: number;
    total: number;
  };
  groupOccupancy: Array<{
    groupId: string;
    groupName: string;
    courseTitle: string;
    enrolled: number;
    capacity: number;
    fillPercent: number;
  }>;
  weeklyAttendanceTrend: Array<{
    week: string;
    rate: number;
    present: number;
    total: number;
  }>;
  atRiskStudents: Array<{
    studentMembershipId: string;
    fullName: string;
    groups: string[];
    rate: number;
    absentCount: number;
  }>;
  upcomingSchedule: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string | null;
    groupName: string;
    courseTitle: string;
    teacherName: string;
  }>;
  pendingManualRefunds: Array<{
    id: string;
    receiptNumber: string | null;
    studentName: string;
    amount: number;
    refundedAmount: number;
    createdAt: string;
  }>;
  subscriptionUsage: Awaited<ReturnType<typeof getCenterSubscriptionUsage>>;
  attentionCounts: {
    pendingManualRefunds: number;
    debtorsCount: number;
    totalDebtAmount: number;
    atRiskStudentsCount: number;
    groupsWithoutTeacherCount: number;
    groupsWithoutScheduleCount: number;
    unmarkedLessonsCount: number;
    inactiveTeachersCount: number;
  };
}

export async function getDirectorDashboardData(params: {
  centerId: string;
  period?: AnalyticsPeriodPreset;
  now?: Date;
}): Promise<DirectorDashboardData> {
  const now = params.now ?? new Date();
  const window = resolveTashkentPeriodWindow(params.period, now);
  const tenantDb = getTenantDb(params.centerId);
  const monthSpecs = buildLast12MonthSpecs(now);
  const annualStart = monthSpecs[0].startDate;
  const twelveWeeksAgo = new Date(now.getTime() - 84 * 24 * 3600 * 1000);
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 3600 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 3600 * 1000);

  const [
    activeStudents,
    activeTeachers,
    coursesCount,
    newEnrollmentsCurr,
    newEnrollmentsPrev,
    currPayments,
    prevPayments,
    annualReport,
    currReport,
    prevReport,
    debtorsReport,
    debtsSummary,
    allAttendancesForRisk,
    weeklyAttRecords,
    groupsRaw,
    scheduleSlots,
    pendingManualRefundsRaw,
    groupsWithoutTeacherCount,
    groupsWithoutScheduleCount,
    unmarkedLessonsCount,
    inactiveTeachersCount,
    subscriptionUsage,
  ] = await Promise.all([
    tenantDb.centerMembership.count({
      where: { centerId: params.centerId, role: "STUDENT", status: "ACTIVE" },
    }),
    tenantDb.centerMembership.count({
      where: { centerId: params.centerId, role: "TEACHER", status: "ACTIVE" },
    }),
    tenantDb.course.count({ where: { centerId: params.centerId } }),
    tenantDb.enrollment.count({
      where: {
        status: "ACTIVE",
        enrolledAt: { gte: window.startDate, lte: window.endDate },
      },
    }),
    tenantDb.enrollment.count({
      where: {
        status: "ACTIVE",
        enrolledAt: { gte: window.prevStartDate, lte: window.prevEndDate },
      },
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
      select: { amount: true, refundedAmount: true },
    }),
    tenantDb.centerPayment.findMany({
      where: {
        deletedAt: null,
        status: { in: ["PAID", "PARTIALLY_PAID"] },
        OR: [
          { paidAt: { gte: window.prevStartDate, lte: window.prevEndDate } },
          { paidAt: null, createdAt: { gte: window.prevStartDate, lte: window.prevEndDate } },
        ],
      },
      select: { amount: true, refundedAmount: true },
    }),
    generateFinanceReport({
      centerId: params.centerId,
      startDate: annualStart,
      endDate: now,
    }),
    generateFinanceReport({
      centerId: params.centerId,
      startDate: window.startDate,
      endDate: window.endDate,
    }),
    generateFinanceReport({
      centerId: params.centerId,
      startDate: window.prevStartDate,
      endDate: window.prevEndDate,
    }),
    calculateDebtorsReport({ centerId: params.centerId, asOfDate: now }),
    calculateStudentDebtsSummary(params.centerId),
    tenantDb.attendance.findMany({
      where: { lesson: { module: { course: { centerId: params.centerId } } } },
      select: {
        studentMembershipId: true,
        status: true,
        markedAt: true,
        student: {
          select: {
            user: { select: { fullName: true } },
            enrollments: {
              where: { status: "ACTIVE" },
              select: { group: { select: { name: true } } },
            },
          },
        },
      },
    }),
    tenantDb.attendance.findMany({
      where: {
        lesson: { module: { course: { centerId: params.centerId } } },
        markedAt: { gte: twelveWeeksAgo },
      },
      select: { status: true, markedAt: true },
      orderBy: { markedAt: "asc" },
    }),
    tenantDb.group.findMany({
      where: { centerId: params.centerId },
      select: {
        id: true,
        name: true,
        maxStudents: true,
        course: { select: { title: true } },
        _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
      },
    }),
    tenantDb.scheduleSlot.findMany({
      where: { centerId: params.centerId, status: "ACTIVE" },
      include: {
        group: { include: { course: { select: { title: true } } } },
        teacher: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 8,
    }),
    tenantDb.centerPayment.findMany({
      where: {
        centerId: params.centerId,
        paymentMethod: "ONLINE",
        manualRefundStatus: "PENDING_MANUAL",
        deletedAt: null,
      },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
      },
      orderBy: { refundedAt: "desc" },
      take: 8,
    }),
    tenantDb.group.count({ where: { centerId: params.centerId, teacherMembershipId: null } }),
    tenantDb.group.count({
      where: { centerId: params.centerId, scheduleSlots: { none: { status: "ACTIVE" } } },
    }),
    tenantDb.lesson.count({
      where: {
        centerId: params.centerId,
        scheduledAt: { gte: threeDaysAgo, lte: now },
        attendances: { none: {} },
      },
    }),
    tenantDb.centerMembership.count({
      where: {
        centerId: params.centerId,
        role: "TEACHER",
        status: "ACTIVE",
        OR: [
          { user: { lastLoginAt: null } },
          { user: { lastLoginAt: { lt: fourteenDaysAgo } } },
        ],
      },
    }),
    getCenterSubscriptionUsage(params.centerId),
  ]);

  // Fallback for centers that have CenterPayment PAID/PARTIALLY_PAID rows without FinanceTransaction synced
  const currPaymentsSum = currPayments.reduce(
    (s, p) => s + Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount)),
    0
  );
  const prevPaymentsSum = prevPayments.reduce(
    (s, p) => s + Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount)),
    0
  );
  const periodRevenue = currReport.pnl.totalIncome > 0 ? currReport.pnl.totalIncome : currPaymentsSum;
  const prevRevenue = prevReport.pnl.totalIncome > 0 ? prevReport.pnl.totalIncome : prevPaymentsSum;

  // 12-month Revenue & Expenses series
  const annualByMonthMap = new Map(annualReport.byMonth.map((m) => [m.month, m]));
  // Supplement months with CenterPayments if FinanceTransaction has 0 income
  const fallbackPayments12m =
    annualReport.pnl.totalIncome > 0
      ? []
      : await tenantDb.centerPayment.findMany({
          where: {
            deletedAt: null,
            status: { in: ["PAID", "PARTIALLY_PAID"] },
            OR: [
              { paidAt: { gte: annualStart } },
              { paidAt: null, createdAt: { gte: annualStart } },
            ],
          },
          select: { amount: true, refundedAmount: true, paidAt: true, createdAt: true },
        });

  const fallbackMonthIncome = new Map<string, number>();
  for (const p of fallbackPayments12m) {
    const dt = p.paidAt ?? p.createdAt;
    const ym = getTashkentYearMonth(dt);
    const k = `${ym.year}-${String(ym.month).padStart(2, "0")}`;
    fallbackMonthIncome.set(
      k,
      (fallbackMonthIncome.get(k) ?? 0) + Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount))
    );
  }

  const revenueExpenses12Months = monthSpecs.map((spec) => {
    const entry = annualByMonthMap.get(spec.key);
    const txInc = roundUzs(entry?.income ?? 0);
    return {
      month: spec.key,
      revenue: txInc > 0 ? txInc : roundUzs(fallbackMonthIncome.get(spec.key) ?? 0),
      expenses: roundUzs(entry?.expense ?? 0),
    };
  });

  // Attendance overall + period delta + at-risk table
  const studentRiskMap = new Map<
    string,
    { fullName: string; groups: string[]; total: number; present: number; absentCount: number }
  >();
  let currAttTotal = 0;
  let currAttPresent = 0;
  let prevAttTotal = 0;
  let prevAttPresent = 0;
  let allAttTotal = 0;
  let allAttPresent = 0;

  for (const a of allAttendancesForRisk) {
    const isPresent = a.status === "PRESENT" || a.status === "LATE";
    allAttTotal++;
    if (isPresent) allAttPresent++;

    if (a.markedAt >= window.startDate && a.markedAt <= window.endDate) {
      currAttTotal++;
      if (isPresent) currAttPresent++;
    } else if (a.markedAt >= window.prevStartDate && a.markedAt <= window.prevEndDate) {
      prevAttTotal++;
      if (isPresent) prevAttPresent++;
    }

    const cur = studentRiskMap.get(a.studentMembershipId) ?? {
      fullName: a.student?.user?.fullName ?? "Student",
      groups: a.student?.enrollments?.map((e) => e.group.name) ?? [],
      total: 0,
      present: 0,
      absentCount: 0,
    };
    cur.total++;
    if (isPresent) cur.present++;
    if (a.status === "ABSENT") cur.absentCount++;
    studentRiskMap.set(a.studentMembershipId, cur);
  }

  const periodAttRate = currAttTotal > 0 ? Math.round((currAttPresent / currAttTotal) * 100) : null;
  const prevAttRate = prevAttTotal > 0 ? Math.round((prevAttPresent / prevAttTotal) * 100) : null;
  const overallAttRate = allAttTotal > 0 ? Math.round((allAttPresent / allAttTotal) * 100) : null;

  const atRiskStudents = Array.from(studentRiskMap.entries())
    .map(([studentMembershipId, s]) => ({
      studentMembershipId,
      fullName: s.fullName,
      groups: Array.from(new Set(s.groups)),
      rate: s.total > 0 ? Math.round((s.present / s.total) * 100) : 100,
      absentCount: s.absentCount,
    }))
    .filter((s) => s.rate < 80)
    .sort((a, b) => a.rate - b.rate);

  // Weekly attendance line
  const weekMap = new Map<string, { present: number; total: number }>();
  for (const a of weeklyAttRecords) {
    const wk = getTashkentWeekKey(a.markedAt);
    const entry = weekMap.get(wk) ?? { present: 0, total: 0 };
    entry.total++;
    if (a.status === "PRESENT" || a.status === "LATE") entry.present++;
    weekMap.set(wk, entry);
  }
  const weeklyAttendanceTrend = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, w]) => ({
      week: week.slice(5), // MM-DD
      rate: w.total > 0 ? Math.round((w.present / w.total) * 100) : 0,
      present: w.present,
      total: w.total,
    }));

  // Group occupancy bars
  const groupOccupancy = groupsRaw
    .map((g) => {
      const cap = Math.max(1, g.maxStudents || 30);
      const enrolled = g._count.enrollments;
      return {
        groupId: g.id,
        groupName: g.name,
        courseTitle: g.course?.title ?? "",
        enrolled,
        capacity: cap,
        fillPercent: Math.min(100, Math.round((enrolled / cap) * 100)),
      };
    })
    .sort((a, b) => b.fillPercent - a.fillPercent)
    .slice(0, 10);

  return {
    period: window.key,
    kpis: {
      revenue: roundUzs(periodRevenue),
      revenueDeltaPercent: calcDelta(periodRevenue, prevRevenue),
      expenses: roundUzs(currReport.pnl.totalExpense),
      expensesDeltaPercent: calcDelta(currReport.pnl.totalExpense, prevReport.pnl.totalExpense),
      totalDebt: roundUzs(debtsSummary.summary.totalDebt),
      debtorsCount: debtsSummary.summary.debtorsCount,
      activeStudents,
      activeStudentsDelta: newEnrollmentsCurr - newEnrollmentsPrev,
      activeTeachers,
      coursesCount,
      attendanceRate: periodAttRate ?? overallAttRate,
      attendanceDeltaPoints:
        periodAttRate !== null && prevAttRate !== null ? periodAttRate - prevAttRate : null,
      atRiskStudentsCount: atRiskStudents.length,
      pendingManualRefundsCount: pendingManualRefundsRaw.length,
    },
    revenueExpenses12Months,
    debtAgingBuckets:
      debtorsReport.summary.totalDebt > 0
        ? [
            {
              label: "UZS",
              aging0to30: roundUzs(debtorsReport.summary.aging0to30),
              aging31to60: roundUzs(debtorsReport.summary.aging31to60),
              aging61plus: roundUzs(debtorsReport.summary.aging61plus),
            },
          ]
        : [],
    debtAgingTotals: {
      aging0to30: roundUzs(debtorsReport.summary.aging0to30),
      aging31to60: roundUzs(debtorsReport.summary.aging31to60),
      aging61plus: roundUzs(debtorsReport.summary.aging61plus),
      total: roundUzs(debtorsReport.summary.totalDebt),
    },
    groupOccupancy,
    weeklyAttendanceTrend,
    atRiskStudents: atRiskStudents.slice(0, 10),
    upcomingSchedule: scheduleSlots.map((s) => ({
      id: s.id,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      roomName: s.roomName ?? null,
      groupName: s.group.name,
      courseTitle: s.group.course.title,
      teacherName: s.teacher.user.fullName,
    })),
    pendingManualRefunds: pendingManualRefundsRaw.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber ?? null,
      studentName: p.student?.user?.fullName ?? "Student",
      amount: roundUzs(p.amount),
      refundedAmount: roundUzs(p.refundedAmount),
      createdAt: p.createdAt.toISOString(),
    })),
    subscriptionUsage,
    attentionCounts: {
      pendingManualRefunds: pendingManualRefundsRaw.length,
      debtorsCount: debtsSummary.summary.debtorsCount,
      totalDebtAmount: roundUzs(debtsSummary.summary.totalDebt),
      atRiskStudentsCount: atRiskStudents.length,
      groupsWithoutTeacherCount,
      groupsWithoutScheduleCount,
      unmarkedLessonsCount,
      inactiveTeachersCount,
    },
  };
}

// ============================================================================
// D. TEACHER & TEACHER ASSISTANT DASHBOARD ANALYTICS
// ============================================================================

export interface TeacherDashboardData {
  period: AnalyticsPeriodPreset;
  kpis: {
    todayLessonsCount: number;
    pendingReviewsCount: number;
    unmarkedLessonsCount: number;
    groupsCount: number;
    avgAttendanceRate: number | null;
    atRiskCount: number;
    monthlyHours: number;
    monthlyCalculatedSalary: number;
    monthlyUnpaidSalary: number;
  };
  todayLessons: Array<{
    id: string;
    groupId: string;
    groupName: string;
    courseTitle: string;
    startTime: string;
    endTime: string;
    roomName: string | null;
  }>;
  weeklySchedule: Array<{
    id: string;
    dayOfWeek: number;
    groupId: string;
    groupName: string;
    courseTitle: string;
    startTime: string;
    endTime: string;
    roomName: string | null;
  }>;
  attendanceByGroup: Array<{
    groupId: string;
    groupName: string;
    rate: number;
    present: number;
    total: number;
  }>;
  pendingReviews: Array<{
    submissionId: string;
    homeworkTitle: string;
    studentName: string;
    submittedAt: string;
    dueDate: string | null;
    isOverdue: boolean;
  }>;
  gradeDistribution: Array<{
    band: string;
    count: number;
  }>;
  atRiskStudents: Array<{
    studentMembershipId: string;
    fullName: string;
    groupName: string;
    rate: number;
    absentCount: number;
  }>;
  salarySummary: {
    conductedLessons: number;
    totalMinutes: number;
    totalHours: number;
    calculatedSalary: number;
    paidSalary: number;
    unpaidSalary: number;
  };
}

export async function getTeacherDashboardData(params: {
  centerId: string;
  membershipId: string;
  role: "TEACHER" | "TEACHER_ASSISTANT" | string;
  period?: AnalyticsPeriodPreset;
  now?: Date;
}): Promise<TeacherDashboardData> {
  const now = params.now ?? new Date();
  const window = resolveTashkentPeriodWindow(params.period, now);
  const tenantDb = getTenantDb(params.centerId);
  const todayIsoWeekday = getTashkentIsoWeekday(now);

  const memberGroups = await tenantDb.group.findMany({
    where: {
      centerId: params.centerId,
      OR: [
        { teacherMembershipId: params.membershipId },
        { assistantMembershipId: params.membershipId },
      ],
    },
    select: {
      id: true,
      name: true,
      courseId: true,
      course: { select: { title: true } },
    },
  });

  const groupIds = memberGroups.map((g) => g.id);
  const courseIds = Array.from(new Set(memberGroups.map((g) => g.courseId)));

  if (groupIds.length === 0) {
    return {
      period: window.key,
      kpis: {
        todayLessonsCount: 0,
        pendingReviewsCount: 0,
        unmarkedLessonsCount: 0,
        groupsCount: 0,
        avgAttendanceRate: null,
        atRiskCount: 0,
        monthlyHours: 0,
        monthlyCalculatedSalary: 0,
        monthlyUnpaidSalary: 0,
      },
      todayLessons: [],
      weeklySchedule: [],
      attendanceByGroup: [],
      pendingReviews: [],
      gradeDistribution: [],
      atRiskStudents: [],
      salarySummary: {
        conductedLessons: 0,
        totalMinutes: 0,
        totalHours: 0,
        calculatedSalary: 0,
        paidSalary: 0,
        unpaidSalary: 0,
      },
    };
  }

  const nowYm = getTashkentYearMonth(now);
  const monthBounds = getTashkentMonthBounds(nowYm.year, nowYm.month);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [
    scheduleSlots,
    enrollments,
    pendingSubmissions,
    pendingCount,
    unmarkedLessonsCount,
    gradesRaw,
    gradedSubRaw,
    salaryReport,
  ] = await Promise.all([
    tenantDb.scheduleSlot.findMany({
      where: {
        centerId: params.centerId,
        groupId: { in: groupIds },
        status: "ACTIVE",
      },
      include: {
        group: { include: { course: { select: { title: true } } } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    }),
    tenantDb.enrollment.findMany({
      where: {
        groupId: { in: groupIds },
        status: "ACTIVE",
      },
      include: {
        group: { select: { id: true, name: true } },
        student: {
          select: {
            id: true,
            user: { select: { fullName: true } },
            attendances: {
              where: {
                lesson: { module: { courseId: { in: courseIds } } },
                markedAt: { gte: window.startDate, lte: window.endDate },
              },
              select: { status: true },
            },
          },
        },
      },
    }),
    tenantDb.homeworkSubmission.findMany({
      where: {
        homework: { lesson: { module: { course: { centerId: params.centerId } } } },
        grade: null,
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        student: {
          enrollments: {
            some: { groupId: { in: groupIds }, status: "ACTIVE" },
          },
        },
      },
      include: {
        student: { include: { user: { select: { fullName: true, email: true } } } },
        homework: { select: { title: true, dueDate: true } },
      },
      orderBy: { submittedAt: "asc" },
      take: 10,
    }),
    tenantDb.homeworkSubmission.count({
      where: {
        homework: { lesson: { module: { course: { centerId: params.centerId } } } },
        grade: null,
        status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
        student: {
          enrollments: {
            some: { groupId: { in: groupIds }, status: "ACTIVE" },
          },
        },
      },
    }),
    tenantDb.lesson.count({
      where: {
        centerId: params.centerId,
        status: "ACTIVE",
        scheduledAt: { gte: thirtyDaysAgo, lt: now },
        attendances: { none: {} },
        module: { course: { groups: { some: { id: { in: groupIds } } } } },
      },
    }),
    tenantDb.grade.findMany({
      where: {
        centerId: params.centerId,
        deletedAt: null,
        createdAt: { gte: window.startDate, lte: window.endDate },
        OR: [
          { groupId: { in: groupIds } },
          { teacherMembershipId: params.membershipId },
        ],
      },
      select: { value: true, maxValue: true },
    }),
    tenantDb.homeworkSubmission.findMany({
      where: {
        grade: { not: null },
        gradedAt: { gte: window.startDate, lte: window.endDate },
        student: {
          enrollments: {
            some: { groupId: { in: groupIds }, status: "ACTIVE" },
          },
        },
      },
      select: { grade: true },
    }),
    calculateTeacherSalariesReport({
      centerId: params.centerId,
      startDate: monthBounds.startDate,
      endDate: monthBounds.endDate,
    }),
  ]);

  const weeklySchedule = scheduleSlots.map((s) => ({
    id: s.id,
    dayOfWeek: s.dayOfWeek,
    groupId: s.groupId,
    groupName: s.group.name,
    courseTitle: s.group.course.title,
    startTime: s.startTime,
    endTime: s.endTime,
    roomName: s.roomName ?? null,
  }));

  const todayLessons = weeklySchedule.filter((s) => s.dayOfWeek === todayIsoWeekday);

  // Attendance per teacher's group + at-risk students in my groups
  const groupAttMap = new Map<string, { groupName: string; present: number; total: number }>();
  for (const g of memberGroups) {
    groupAttMap.set(g.id, { groupName: g.name, present: 0, total: 0 });
  }

  let totAttAll = 0;
  let presAttAll = 0;
  const atRiskStudents: TeacherDashboardData["atRiskStudents"] = [];

  for (const en of enrollments) {
    const atts = en.student.attendances || [];
    const total = atts.length;
    const present = atts.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
    const absentCount = atts.filter((a) => a.status === "ABSENT").length;

    totAttAll += total;
    presAttAll += present;

    const gEntry = groupAttMap.get(en.group.id);
    if (gEntry) {
      gEntry.total += total;
      gEntry.present += present;
    }

    if (total > 0) {
      const rate = Math.round((present / total) * 100);
      if (rate < 80) {
        atRiskStudents.push({
          studentMembershipId: en.student.id,
          fullName: en.student.user.fullName,
          groupName: en.group.name,
          rate,
          absentCount,
        });
      }
    }
  }

  const attendanceByGroup = Array.from(groupAttMap.entries())
    .map(([groupId, g]) => ({
      groupId,
      groupName: g.groupName,
      rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
      present: g.present,
      total: g.total,
    }))
    .filter((g) => g.total > 0);

  // Grade distribution histogram (0-49, 50-69, 70-89, 90-100)
  const bands = { "0-49": 0, "50-69": 0, "70-89": 0, "90-100": 0 };
  const bucketScore = (pct: number) => {
    if (pct >= 90) bands["90-100"]++;
    else if (pct >= 70) bands["70-89"]++;
    else if (pct >= 50) bands["50-69"]++;
    else bands["0-49"]++;
  };
  for (const g of gradesRaw) {
    const pct = g.maxValue > 0 ? (g.value / g.maxValue) * 100 : 0;
    bucketScore(pct);
  }
  if (gradesRaw.length === 0) {
    for (const s of gradedSubRaw) {
      if (s.grade !== null) bucketScore(s.grade);
    }
  }
  const hasAnyGrade = Object.values(bands).some((c) => c > 0);
  const gradeDistribution = hasAnyGrade
    ? (Object.entries(bands) as Array<[string, number]>).map(([band, count]) => ({ band, count }))
    : [];

  // Teacher's own salary ONLY (filtered strictly by teacherMembershipId)
  const mySalaryRows = salaryReport.teachers.filter(
    (r) => r.teacherMembershipId === params.membershipId
  );
  const conductedLessons = mySalaryRows.reduce((s, r) => s + r.conductedLessonsCount, 0);
  const totalMinutes = mySalaryRows.reduce((s, r) => s + r.conductedMinutes, 0);
  const calculatedSalary = mySalaryRows.reduce((s, r) => s + r.calculatedSalary, 0);
  const paidSalary = mySalaryRows.reduce((s, r) => s + r.paidSalaryAmount, 0);
  const unpaidSalary = mySalaryRows.reduce((s, r) => s + r.unpaidSalaryAmount, 0);
  const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

  return {
    period: window.key,
    kpis: {
      todayLessonsCount: todayLessons.length,
      pendingReviewsCount: pendingCount,
      unmarkedLessonsCount,
      groupsCount: groupIds.length,
      avgAttendanceRate: totAttAll > 0 ? Math.round((presAttAll / totAttAll) * 100) : null,
      atRiskCount: atRiskStudents.length,
      monthlyHours: totalHours,
      monthlyCalculatedSalary: roundUzs(calculatedSalary),
      monthlyUnpaidSalary: roundUzs(unpaidSalary),
    },
    todayLessons,
    weeklySchedule,
    attendanceByGroup,
    pendingReviews: pendingSubmissions.map((s) => ({
      submissionId: s.id,
      homeworkTitle: s.homework.title,
      studentName: s.student.user.fullName || s.student.user.email,
      submittedAt: s.submittedAt.toISOString(),
      dueDate: s.homework.dueDate ? s.homework.dueDate.toISOString() : null,
      isOverdue: Boolean(s.homework.dueDate && s.submittedAt > s.homework.dueDate),
    })),
    gradeDistribution,
    atRiskStudents: atRiskStudents.sort((a, b) => a.rate - b.rate).slice(0, 10),
    salarySummary: {
      conductedLessons,
      totalMinutes,
      totalHours,
      calculatedSalary: roundUzs(calculatedSalary),
      paidSalary: roundUzs(paidSalary),
      unpaidSalary: roundUzs(unpaidSalary),
    },
  };
}

// ============================================================================
// E & F. STUDENT PERFORMANCE & PARENT SUMMARY ANALYTICS
// ============================================================================

export interface StudentPerformanceDTO {
  studentMembershipId: string;
  studentName: string;
  period: AnalyticsPeriodPreset;
  calendarMonth: string; // YYYY-MM
  canViewGroupAverage: boolean;
  canViewPayments: boolean;
  summary: {
    avgGradePercent: number | null;
    attendanceRate: number | null;
    homeworkCompletionRate: number | null;
    courseProgressPercent: number;
    presentCount: number;
    lateCount: number;
    excusedCount: number;
    absentCount: number;
    totalAttendances: number;
    totalHomeworks: number;
    completedHomeworks: number;
    overdueHomeworksCount: number;
  };
  attendanceDonut: Array<{ key: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT"; value: number }>;
  attendanceHeatmap: Array<{ date: string; label: string; count: number; status: string | null }>;
  homeworkWeekly: Array<{
    week: string;
    onTime: number;
    late: number;
    underReview: number;
    notSubmitted: number;
  }>;
  gradesTrajectory: Array<{
    date: string;
    title: string;
    studentPercent: number;
    groupAverage?: number;
  }>;
  courseProgress: Array<{
    enrollmentId: string;
    groupId: string;
    groupName: string;
    courseTitle: string;
    completedLessons: number;
    totalLessons: number;
    progressPercent: number;
  }>;
  lessons: Array<{
    id: string;
    title: string;
    courseTitle: string;
    scheduledAt: string | null;
    category: "conducted" | "missed" | "upcoming";
    attendanceStatus: string | null;
  }>;
  payment: {
    earliestPaidUntil: string | null;
    debtAmount: number;
    totalPaid: number;
    nextPayment: {
      amount: number;
      dueDate: string;
      isOverdue: boolean;
      description: string;
    } | null;
    enrollments: Array<{
      enrollmentId: string;
      groupName: string;
      courseTitle: string;
      status: string;
      paidUntil: string | null;
      daysRemaining: number | null;
      isOverdue: boolean;
    }>;
  } | null;
  attentionAlerts: Array<{
    id: string;
    kind: "ABSENCE" | "HOMEWORK_OVERDUE" | "DEBT" | "EXPIRING";
    severity: "warning" | "destructive";
    value: number;
    href: string;
  }>;
}

/**
 * Computes full academic & billing overview for one student with strict RBAC + IDOR enforcement.
 * - STUDENT: own record only
 * - PARENT: confirmed linked child only
 * - TEACHER / TEACHER_ASSISTANT: enrolled in viewer's assigned group only; billing/payments strictly omitted (payment = null)
 * - DIRECTOR / CENTER_ADMIN / platform staff: any student in centerId
 */
export async function getStudentPerformanceData(params: {
  centerId: string;
  studentMembershipId: string;
  viewerRole: string;
  viewerMembershipId?: string | null;
  isPlatformStaff?: boolean;
  period?: AnalyticsPeriodPreset;
  calendarMonth?: string | null;
  now?: Date;
}): Promise<StudentPerformanceDTO> {
  const now = params.now ?? new Date();
  const window = resolveTashkentPeriodWindow(params.period, now);
  const tenantDb = getTenantDb(params.centerId);
  const role = params.viewerRole;
  const isStaffPrivileged =
    Boolean(params.isPlatformStaff) || role === "DIRECTOR" || role === "CENTER_ADMIN";

  // 1. Verify target student belongs to this center
  const student = await tenantDb.centerMembership.findFirst({
    where: {
      id: params.studentMembershipId,
      centerId: params.centerId,
      role: "STUDENT",
    },
    select: {
      id: true,
      user: { select: { fullName: true, email: true } },
    },
  });
  if (!student) {
    throw new DashboardAccessError(404, "Student not found in this learning center", "NOT_FOUND");
  }

  // 2. Enforce strict role authorization
  let teacherScopedCourseIds: string[] | null = null;
  if (!isStaffPrivileged) {
    if (role === "STUDENT") {
      if (!params.viewerMembershipId || params.viewerMembershipId !== student.id) {
        throw new DashboardAccessError(403, "Forbidden: You can only view your own performance");
      }
    } else if (role === "PARENT") {
      if (!params.viewerMembershipId) {
        throw new DashboardAccessError(403, "Forbidden: No parent membership");
      }
      const link = await tenantDb.parentLink.findFirst({
        where: {
          parentMembershipId: params.viewerMembershipId,
          studentMembershipId: student.id,
          status: "CONFIRMED",
        },
        select: { id: true },
      });
      if (!link) {
        throw new DashboardAccessError(
          403,
          "Forbidden: You can only view confirmed linked children"
        );
      }
    } else if (role === "TEACHER" || role === "TEACHER_ASSISTANT") {
      if (!params.viewerMembershipId) {
        throw new DashboardAccessError(403, "Forbidden: No teacher membership");
      }
      const sharedEnrollments = await tenantDb.enrollment.findMany({
        where: {
          studentMembershipId: student.id,
          group:
            role === "TEACHER_ASSISTANT"
              ? { assistantMembershipId: params.viewerMembershipId }
              : { teacherMembershipId: params.viewerMembershipId },
        },
        select: { group: { select: { courseId: true } } },
      });
      if (sharedEnrollments.length === 0) {
        throw new DashboardAccessError(
          403,
          "Forbidden: You can only view students in your assigned groups"
        );
      }
      teacherScopedCourseIds = sharedEnrollments.map((e) => e.group.courseId);
    } else {
      throw new DashboardAccessError(403, "Forbidden: Access to student performance denied");
    }
  }

  // Teachers NEVER see student payments/debt
  const canViewPayments =
    isStaffPrivileged || role === "STUDENT" || role === "PARENT" || role === "ACCOUNTANT";

  // Month for attendance heatmap (Asia/Tashkent YYYY-MM)
  const nowYm = getTashkentYearMonth(now);
  let heatYear = nowYm.year;
  let heatMonth = nowYm.month;
  if (params.calendarMonth && /^\d{4}-\d{2}$/.test(params.calendarMonth)) {
    const [yStr, mStr] = params.calendarMonth.split("-");
    const yNum = Number(yStr);
    const mNum = Number(mStr);
    if (yNum >= 2020 && yNum <= 2100 && mNum >= 1 && mNum <= 12) {
      heatYear = yNum;
      heatMonth = mNum;
    }
  }
  const calendarMonthKey = `${heatYear}-${String(heatMonth).padStart(2, "0")}`;
  const heatBounds = getTashkentMonthBounds(heatYear, heatMonth);

  const enrollments = await tenantDb.enrollment.findMany({
    where: {
      studentMembershipId: student.id,
      status: { in: ["ACTIVE", "FROZEN"] },
      ...(teacherScopedCourseIds ? { group: { courseId: { in: teacherScopedCourseIds } } } : {}),
    },
    include: {
      group: {
        select: {
          id: true,
          name: true,
          courseId: true,
          course: { select: { id: true, title: true } },
        },
      },
    },
  });

  const groupIds = enrollments.map((e) => e.groupId);
  const courseIds = Array.from(new Set(enrollments.map((e) => e.group.courseId)));

  const [
    attendancesPeriod,
    attendancesHeatmapRaw,
    homeworksRaw,
    gradesRaw,
    groupGradesRaw,
    lessonsRaw,
    balanceList,
  ] = await Promise.all([
    tenantDb.attendance.findMany({
      where: {
        studentMembershipId: student.id,
        markedAt: { gte: window.startDate, lte: window.endDate },
      },
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            module: { select: { course: { select: { title: true } } } },
          },
        },
      },
      orderBy: { markedAt: "desc" },
    }),
    tenantDb.attendance.findMany({
      where: {
        studentMembershipId: student.id,
        markedAt: { gte: heatBounds.startDate, lte: heatBounds.endDate },
      },
      select: { markedAt: true, status: true },
    }),
    courseIds.length > 0
      ? tenantDb.homework.findMany({
          where: {
            lesson: { module: { courseId: { in: courseIds } } },
          },
          include: {
            lesson: {
              select: {
                module: { select: { courseId: true, course: { select: { title: true } } } },
              },
            },
            submissions: {
              where: { studentMembershipId: student.id },
              take: 1,
            },
          },
          orderBy: { dueDate: "asc" },
        })
      : Promise.resolve([]),
    tenantDb.grade.findMany({
      where: {
        centerId: params.centerId,
        studentMembershipId: student.id,
        deletedAt: null,
        createdAt: { gte: window.startDate, lte: window.endDate },
      },
      include: {
        lesson: { select: { title: true } },
        homeworkSubmission: { include: { homework: { select: { title: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    // Only read anonymized group numeric aggregates for group mean comparison
    groupIds.length > 0
      ? tenantDb.grade.findMany({
          where: {
            centerId: params.centerId,
            groupId: { in: groupIds },
            deletedAt: null,
            createdAt: { gte: window.startDate, lte: window.endDate },
          },
          select: {
            studentMembershipId: true,
            lessonId: true,
            value: true,
            maxValue: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
    courseIds.length > 0
      ? tenantDb.lesson.findMany({
          where: {
            centerId: params.centerId,
            status: "ACTIVE",
            module: { courseId: { in: courseIds } },
          },
          include: {
            module: { select: { courseId: true, course: { select: { title: true } } } },
            attendances: {
              where: { studentMembershipId: student.id },
              select: { status: true },
              take: 1,
            },
          },
          orderBy: { scheduledAt: "asc" },
        })
      : Promise.resolve([]),
    canViewPayments
      ? calculateStudentBalances({
          centerId: params.centerId,
          studentMembershipIds: [student.id],
        }).catch(() => [])
      : Promise.resolve([]),
  ]);

  // Attendance counts & donut
  let presentCount = 0;
  let lateCount = 0;
  let excusedCount = 0;
  let absentCount = 0;
  for (const a of attendancesPeriod) {
    if (a.status === "PRESENT") presentCount++;
    else if (a.status === "LATE") lateCount++;
    else if (a.status === "EXCUSED") excusedCount++;
    else if (a.status === "ABSENT") absentCount++;
  }
  const totalAttendances = presentCount + lateCount + excusedCount + absentCount;
  const attendanceRate =
    totalAttendances > 0
      ? Math.round(((presentCount + lateCount) / totalAttendances) * 100)
      : null;

  // Calendar Heatmap cells across every day in selected Tashkent month
  const heatDayScore = new Map<string, { score: number; status: string }>();
  for (const a of attendancesHeatmapRaw) {
    const key = toTashkentYmd(a.markedAt);
    const val = a.status === "PRESENT" ? 4 : a.status === "LATE" ? 3 : a.status === "EXCUSED" ? 2 : 1;
    const prev = heatDayScore.get(key);
    if (!prev || val > prev.score) {
      heatDayScore.set(key, { score: val, status: a.status });
    }
  }
  const daysInHeatMonth = new Date(Date.UTC(heatYear, heatMonth, 0)).getUTCDate();
  const attendanceHeatmap: StudentPerformanceDTO["attendanceHeatmap"] = [];
  for (let d = 1; d <= daysInHeatMonth; d++) {
    const ymd = `${calendarMonthKey}-${String(d).padStart(2, "0")}`;
    const info = heatDayScore.get(ymd);
    attendanceHeatmap.push({
      date: ymd,
      label: String(d),
      count: info?.score ?? 0,
      status: info?.status ?? null,
    });
  }

  // Homeworks weekly stacked bar + overall completion %
  const hwWeekMap = new Map<
    string,
    { onTime: number; late: number; underReview: number; notSubmitted: number }
  >();
  let completedHomeworks = 0;
  let overdueHomeworksCount = 0;

  for (const hw of homeworksRaw) {
    const refDate = hw.dueDate ?? hw.createdAt;
    const wkKey = getTashkentWeekKey(refDate);
    const bucket = hwWeekMap.get(wkKey) ?? {
      onTime: 0,
      late: 0,
      underReview: 0,
      notSubmitted: 0,
    };

    const sub = hw.submissions[0];
    if (!sub || sub.status === "NOT_SUBMITTED") {
      bucket.notSubmitted++;
      if (hw.dueDate && hw.dueDate < now) overdueHomeworksCount++;
    } else if (sub.status === "SUBMITTED" || sub.status === "UNDER_REVIEW") {
      bucket.underReview++;
      completedHomeworks++;
    } else if (hw.dueDate && sub.submittedAt > hw.dueDate) {
      bucket.late++;
      completedHomeworks++;
    } else {
      bucket.onTime++;
      completedHomeworks++;
    }
    hwWeekMap.set(wkKey, bucket);
  }

  const totalHomeworks = homeworksRaw.length;
  const homeworkCompletionRate =
    totalHomeworks > 0 ? Math.round((completedHomeworks / totalHomeworks) * 100) : null;
  const homeworkWeekly = Array.from(hwWeekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, b]) => ({
      week: week.slice(5),
      ...b,
    }));

  // Grades trajectory + privacy-safe group average
  const distinctGroupStudents = new Set(groupGradesRaw.map((g) => g.studentMembershipId)).size;
  // Privacy rule: students/parents only see group average when at least 3 peers have grades (prevents inferring another student's grade in pairs)
  const canViewGroupAverage = isStaffPrivileged || role === "TEACHER" || distinctGroupStudents >= 3;

  const groupLessonMeanMap = new Map<string, { sum: number; count: number }>();
  const groupOverallAcc = { sum: 0, count: 0 };
  if (canViewGroupAverage) {
    for (const gg of groupGradesRaw) {
      const pct = gg.maxValue > 0 ? (gg.value / gg.maxValue) * 100 : 0;
      groupOverallAcc.sum += pct;
      groupOverallAcc.count++;
      if (gg.lessonId) {
        const cur = groupLessonMeanMap.get(gg.lessonId) ?? { sum: 0, count: 0 };
        cur.sum += pct;
        cur.count++;
        groupLessonMeanMap.set(gg.lessonId, cur);
      }
    }
  }
  const groupOverallAvg =
    canViewGroupAverage && groupOverallAcc.count > 0
      ? Math.round(groupOverallAcc.sum / groupOverallAcc.count)
      : undefined;

  const gradesTrajectory = gradesRaw.map((g) => {
    const pct = g.maxValue > 0 ? Math.round((g.value / g.maxValue) * 100) : 0;
    const lessonMean =
      g.lessonId && groupLessonMeanMap.has(g.lessonId)
        ? Math.round(
            groupLessonMeanMap.get(g.lessonId)!.sum / groupLessonMeanMap.get(g.lessonId)!.count
          )
        : groupOverallAvg;
    return {
      date: toTashkentYmd(g.createdAt).slice(5),
      title: g.homeworkSubmission?.homework?.title || g.lesson?.title || "—",
      studentPercent: pct,
      ...(canViewGroupAverage && lessonMean !== undefined ? { groupAverage: lessonMean } : {}),
    };
  });

  const avgGradePercent =
    gradesTrajectory.length > 0
      ? Math.round(
          gradesTrajectory.reduce((s, g) => s + g.studentPercent, 0) / gradesTrajectory.length
        )
      : null;

  // Course progress (completed lessons / total lessons per course)
  const lessonsByCourse = new Map<string, Array<(typeof lessonsRaw)[number]>>();
  for (const l of lessonsRaw) {
    const cid = l.module.courseId;
    if (!lessonsByCourse.has(cid)) lessonsByCourse.set(cid, []);
    lessonsByCourse.get(cid)!.push(l);
  }

  const courseProgress = enrollments.map((en) => {
    const cLessons = lessonsByCourse.get(en.group.courseId) ?? [];
    const totalLessons = cLessons.length;
    const completedLessons = cLessons.filter(
      (l) => l.attendances.length > 0 || (l.scheduledAt !== null && l.scheduledAt <= now)
    ).length;
    const progressPercent =
      totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    return {
      enrollmentId: en.id,
      groupId: en.groupId,
      groupName: en.group.name,
      courseTitle: en.group.course.title,
      completedLessons,
      totalLessons,
      progressPercent,
    };
  });

  const avgCourseProgress =
    courseProgress.length > 0
      ? Math.round(
          courseProgress.reduce((s, c) => s + c.progressPercent, 0) / courseProgress.length
        )
      : 0;

  // Categorized lessons list
  const lessons: StudentPerformanceDTO["lessons"] = lessonsRaw.map((l) => {
    const attStatus = l.attendances[0]?.status ?? null;
    let category: "conducted" | "missed" | "upcoming";
    if (attStatus === "ABSENT") {
      category = "missed";
    } else if (attStatus !== null || (l.scheduledAt !== null && l.scheduledAt <= now)) {
      category = "conducted";
    } else {
      category = "upcoming";
    }
    return {
      id: l.id,
      title: l.title,
      courseTitle: l.module.course.title,
      scheduledAt: l.scheduledAt ? l.scheduledAt.toISOString() : null,
      category,
      attendanceStatus: attStatus,
    };
  });

  // Payment block (omitted for Teacher/Assistant)
  let payment: StudentPerformanceDTO["payment"] = null;
  if (canViewPayments) {
    const bal = balanceList[0];
    payment = {
      earliestPaidUntil: bal?.earliestPaidUntil ?? null,
      debtAmount: roundUzs(bal?.debtAmount ?? 0),
      totalPaid: roundUzs(bal?.totalPaid ?? 0),
      nextPayment: bal?.nextPayment
        ? {
            amount: roundUzs(bal.nextPayment.amount),
            dueDate: bal.nextPayment.dueDate,
            isOverdue: bal.nextPayment.isOverdue,
            description: bal.nextPayment.description,
          }
        : null,
      enrollments: (bal?.enrollments ?? []).map((en) => ({
        enrollmentId: en.enrollmentId,
        groupName: en.groupName,
        courseTitle: en.courseTitle,
        status: en.status,
        paidUntil: en.paidUntil,
        daysRemaining: en.daysRemaining,
        isOverdue: en.isOverdue,
      })),
    };
  }

  // Actionable attention alerts (used primarily for Parent & Student)
  const attentionAlerts: StudentPerformanceDTO["attentionAlerts"] = [];
  if (absentCount > 0) {
    attentionAlerts.push({
      id: "absences",
      kind: "ABSENCE",
      severity: attendanceRate !== null && attendanceRate < 80 ? "destructive" : "warning",
      value: absentCount,
      href: "/center/attendance",
    });
  }
  if (overdueHomeworksCount > 0) {
    attentionAlerts.push({
      id: "hw-overdue",
      kind: "HOMEWORK_OVERDUE",
      severity: "warning",
      value: overdueHomeworksCount,
      href: "/center/homework",
    });
  }
  if (payment && payment.debtAmount > 0) {
    attentionAlerts.push({
      id: "debt",
      kind: "DEBT",
      severity: "destructive",
      value: payment.debtAmount,
      href: "/center/payments",
    });
  } else if (
    payment &&
    payment.enrollments.some((e) => e.daysRemaining !== null && e.daysRemaining <= 7)
  ) {
    const minDays = Math.min(
      ...payment.enrollments
        .map((e) => e.daysRemaining)
        .filter((d): d is number => d !== null)
    );
    attentionAlerts.push({
      id: "expiring",
      kind: "EXPIRING",
      severity: "warning",
      value: Math.max(0, minDays),
      href: "/center/payments",
    });
  }

  return {
    studentMembershipId: student.id,
    studentName: student.user.fullName || student.user.email,
    period: window.key,
    calendarMonth: calendarMonthKey,
    canViewGroupAverage,
    canViewPayments,
    summary: {
      avgGradePercent,
      attendanceRate,
      homeworkCompletionRate,
      courseProgressPercent: avgCourseProgress,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      totalAttendances,
      totalHomeworks,
      completedHomeworks,
      overdueHomeworksCount,
    },
    attendanceDonut: [
      { key: "PRESENT", value: presentCount },
      { key: "LATE", value: lateCount },
      { key: "EXCUSED", value: excusedCount },
      { key: "ABSENT", value: absentCount },
    ],
    attendanceHeatmap,
    homeworkWeekly,
    gradesTrajectory,
    courseProgress,
    lessons,
    payment,
    attentionAlerts,
  };
}
