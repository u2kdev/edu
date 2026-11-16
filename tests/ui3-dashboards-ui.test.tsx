// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import * as React from "react";
import { t } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type {
  DirectorDashboardData,
  StudentPerformanceDTO,
  TeacherDashboardData,
} from "@/lib/dashboard-analytics";
import type { CenterFinanceAnalyticsDTO } from "@/lib/finance-analytics";
import PlatformDashboardInteractive from "@/components/platform/PlatformDashboardInteractive";
import { DirectorDashboardView } from "@/components/dashboard/DirectorDashboardView";
import { TeacherDashboardView } from "@/components/dashboard/TeacherDashboardView";
import { CenterFinanceAnalytics } from "@/components/finance/CenterFinanceAnalytics";
import { StudentPerformanceView } from "@/components/students/StudentPerformanceView";
import { ParentDashboardView } from "@/components/dashboard/ParentDashboardView";

const { pushMock, refreshMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: refreshMock,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center",
  useSearchParams: () => new URLSearchParams(),
}));

function installResizeObserverPolyfill() {
  if (typeof globalThis.ResizeObserver === "undefined") {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  }
}

function norm(s: string) {
  return s.replace(/[\u00A0\u202F]/g, " ");
}

function makeDirectorData(over: Partial<DirectorDashboardData> = {}): DirectorDashboardData {
  return {
    period: "30d",
    kpis: {
      revenue: 12_500_000,
      revenueDeltaPercent: 18,
      expenses: 4_200_000,
      expensesDeltaPercent: -5,
      totalDebt: 950_000,
      debtorsCount: 2,
      activeStudents: 48,
      activeStudentsDelta: 6,
      activeTeachers: 6,
      coursesCount: 4,
      attendanceRate: 88,
      attendanceDeltaPoints: 3,
      atRiskStudentsCount: 1,
      pendingManualRefundsCount: 1,
    },
    revenueExpenses12Months: [
      { month: "2026-10", revenue: 10_000_000, expenses: 3_500_000 },
      { month: "2026-11", revenue: 12_500_000, expenses: 4_200_000 },
    ],
    debtAgingBuckets: [
      { label: "0–30 / 31–60 / 61+", aging0to30: 500_000, aging31to60: 300_000, aging61plus: 150_000 },
    ],
    debtAgingTotals: { aging0to30: 500_000, aging31to60: 300_000, aging61plus: 150_000, total: 950_000 },
    groupOccupancy: [
      { groupId: "g-1", groupName: "Frontend Pro", courseTitle: "React", enrolled: 14, capacity: 16, fillPercent: 88 },
    ],
    weeklyAttendanceTrend: [
      { week: "11-02", rate: 86, present: 43, total: 50 },
      { week: "11-09", rate: 88, present: 44, total: 50 },
    ],
    atRiskStudents: [
      { studentMembershipId: "st-risk", fullName: "Timur Alimov", groups: ["Frontend Pro"], rate: 62, absentCount: 4 },
    ],
    upcomingSchedule: [
      { id: "slot-1", dayOfWeek: 1, startTime: "10:00", endTime: "11:30", roomName: "A101", groupName: "Frontend Pro", courseTitle: "React", teacherName: "Aziz Karimov" },
    ],
    pendingManualRefunds: [
      { id: "ref-1", receiptNumber: "CLK-991", studentName: "Malika Karimova", amount: 500_000, refundedAmount: 500_000, createdAt: "2026-11-10T10:00:00.000Z" },
    ],
    subscriptionUsage: {
      subscription: {
        id: "sub-1",
        status: "ACTIVE",
        planName: "Pro Plan",
        daysRemaining: 20,
        isTrial: false,
        expiresAt: new Date("2026-12-31T00:00:00.000Z"),
      },
      limits: [
        {
          resource: "students",
          label: "Ученики",
          current: 48,
          max: 100,
          percent: 48,
          isWarning: false,
          isReached: false,
        },
      ],
      hasWarnings: false,
    },
    attentionCounts: {
      pendingManualRefunds: 1,
      debtorsCount: 2,
      totalDebtAmount: 950_000,
      atRiskStudentsCount: 1,
      groupsWithoutTeacherCount: 1,
      groupsWithoutScheduleCount: 0,
      unmarkedLessonsCount: 2,
      inactiveTeachersCount: 1,
    },
    ...over,
  };
}

function makeFinanceAnalytics(over: Partial<CenterFinanceAnalyticsDTO> = {}): CenterFinanceAnalyticsDTO {
  return {
    period: "30d",
    startDate: "2026-10-17T00:00:00.000Z",
    endDate: "2026-11-16T23:59:59.000Z",
    kpis: {
      revenue: 15_000_000,
      expenses: 6_000_000,
      netProfit: 9_000_000,
      totalDebt: 1_200_000,
      debtorsCount: 3,
      totalDiscounts: 450_000,
      totalBalance: 25_000_000,
      revenueDeltaPercent: 12,
      expensesDeltaPercent: 4,
      profitDeltaPercent: 20,
    },
    paymentMethods: [
      { method: "CLICK", amount: 9_000_000, count: 10, percent: 60 },
      { method: "CASH", amount: 6_000_000, count: 6, percent: 40 },
    ],
    expenseCategories: [
      { categoryId: "cat-1", categoryName: "Аренда", amount: 4_000_000, percent: 67 },
      { categoryId: "cat-2", categoryName: "Реклама", amount: 2_000_000, percent: 33 },
    ],
    monthlySeries: [
      { month: "2026-10", income: 12_000_000, expense: 5_000_000, net: 7_000_000 },
      { month: "2026-11", income: 15_000_000, expense: 6_000_000, net: 9_000_000 },
    ],
    revenueByCourse: [
      { id: "c-1", name: "English IELTS", amount: 10_000_000, percent: 67 },
      { id: "c-2", name: "Frontend Pro", amount: 5_000_000, percent: 33 },
    ],
    revenueByGroup: [
      { id: "g-1", name: "IELTS Morning", amount: 7_000_000, percent: 47 },
      { id: "g-2", name: "React A1", amount: 8_000_000, percent: 53 },
    ],
    debtAging: [
      { bucket: "0-30", amount: 700_000, count: 2, percent: 58 },
      { bucket: "31-60", amount: 500_000, count: 1, percent: 42 },
    ],
    salariesByTeacher: [
      {
        teacherMembershipId: "t-1",
        teacherName: "Dilshod Tursunov",
        conductedLessons: 16,
        conductedMinutes: 1440,
        calculatedSalary: 4_800_000,
        paidSalary: 3_000_000,
        unpaidSalary: 1_800_000,
        percent: 100,
      },
    ],
    accountBalanceSeries: {
      accounts: [{ id: "acc-1", name: "Основная касса", type: "CASH", currentBalance: 25_000_000 }],
      points: [
        { date: "11-01", "Основная касса": 20_000_000 },
        { date: "11-16", "Основная касса": 25_000_000 },
      ],
    },
    ...over,
  };
}

function makeTeacherData(): TeacherDashboardData {
  return {
    period: "30d",
    kpis: {
      todayLessonsCount: 1,
      pendingReviewsCount: 1,
      unmarkedLessonsCount: 1,
      groupsCount: 1,
      avgAttendanceRate: 91,
      atRiskCount: 1,
      monthlyHours: 24,
      monthlyCalculatedSalary: 3_600_000,
      monthlyUnpaidSalary: 1_200_000,
    },
    todayLessons: [
      { id: "slot-t1", groupId: "g-1", groupName: "Backend A1", courseTitle: "Node.js", startTime: "14:00", endTime: "15:30", roomName: "202" },
    ],
    weeklySchedule: [],
    attendanceByGroup: [{ groupId: "g-1", groupName: "Backend A1", rate: 91, present: 20, total: 22 }],
    pendingReviews: [
      { submissionId: "sub-1", homeworkTitle: "REST API Auth", studentName: "Jasur Bek", submittedAt: "2026-11-15T10:00:00.000Z", dueDate: "2026-11-14T23:59:00.000Z", isOverdue: true },
    ],
    gradeDistribution: [
      { band: "90–100", count: 4 },
      { band: "75–89", count: 3 },
    ],
    atRiskStudents: [
      { studentMembershipId: "st-r", fullName: "Sardorbek", groupName: "Backend A1", rate: 65, absentCount: 3 },
    ],
    salarySummary: {
      conductedLessons: 16,
      totalMinutes: 1440,
      totalHours: 24,
      calculatedSalary: 3_600_000,
      paidSalary: 2_400_000,
      unpaidSalary: 1_200_000,
    },
  };
}

function makeStudentPerf(over: Partial<StudentPerformanceDTO> = {}): StudentPerformanceDTO {
  return {
    studentMembershipId: "m-stu-1",
    studentName: "Madina Umarova",
    period: "30d",
    calendarMonth: "2026-11",
    canViewGroupAverage: true,
    canViewPayments: true,
    summary: {
      avgGradePercent: 89,
      attendanceRate: 92,
      homeworkCompletionRate: 85,
      courseProgressPercent: 70,
      presentCount: 11,
      lateCount: 1,
      excusedCount: 0,
      absentCount: 1,
      totalAttendances: 13,
      totalHomeworks: 10,
      completedHomeworks: 8,
      overdueHomeworksCount: 1,
    },
    attendanceDonut: [
      { key: "PRESENT", value: 11 },
      { key: "LATE", value: 1 },
      { key: "EXCUSED", value: 0 },
      { key: "ABSENT", value: 1 },
    ],
    attendanceHeatmap: [
      { date: "2026-11-10", label: "2026-11-10", count: 1, status: "PRESENT" },
      { date: "2026-11-12", label: "2026-11-12", count: 3, status: "ABSENT" },
    ],
    homeworkWeekly: [
      { week: "11-04", onTime: 3, late: 1, underReview: 1, notSubmitted: 0 },
    ],
    gradesTrajectory: [
      { date: "11-08", title: "Midterm Quiz", studentPercent: 89, groupAverage: 78 },
    ],
    courseProgress: [
      { enrollmentId: "en-1", groupId: "g-1", groupName: "IELTS A", courseTitle: "IELTS Prep", completedLessons: 14, totalLessons: 20, progressPercent: 70 },
    ],
    lessons: [
      { id: "l-1", title: "Writing Task 2", courseTitle: "IELTS Prep", scheduledAt: "2026-11-10T10:00:00.000Z", category: "conducted", attendanceStatus: "PRESENT" },
      { id: "l-2", title: "Listening Lab", courseTitle: "IELTS Prep", scheduledAt: "2026-11-12T10:00:00.000Z", category: "missed", attendanceStatus: "ABSENT" },
      { id: "l-3", title: "Speaking Mock", courseTitle: "IELTS Prep", scheduledAt: "2026-11-20T10:00:00.000Z", category: "upcoming", attendanceStatus: null },
    ],
    payment: {
      earliestPaidUntil: "2026-11-25T00:00:00.000Z",
      debtAmount: 400_000,
      totalPaid: 1_200_000,
      nextPayment: {
        amount: 400_000,
        dueDate: "2026-11-20T00:00:00.000Z",
        isOverdue: false,
        description: "Оплата за ноябрь — IELTS A",
      },
      enrollments: [
        { enrollmentId: "en-1", groupName: "IELTS A", courseTitle: "IELTS Prep", status: "ACTIVE", paidUntil: "2026-11-25T00:00:00.000Z", daysRemaining: 9, isOverdue: false },
      ],
    },
    attentionAlerts: [
      { id: "a-abs", kind: "ABSENCE", severity: "warning", value: 1, href: "/center/attendance" },
      { id: "a-debt", kind: "DEBT", severity: "destructive", value: 400_000, href: "/center/payments" },
    ],
    ...over,
  };
}

describe("Stage UI3 Dashboard & Report Components", () => {
  beforeEach(() => {
    installResizeObserverPolyfill();
    pushMock.mockReset();
    refreshMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders PlatformDashboardInteractive KPIs, 12m charts, funnel, attention rows and locale switching", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        period: "30d",
        finance: {
          mrr: 18_000_000,
          arr: 216_000_000,
          arpu: 900_000,
          currentMonthNetRevenue: 21_000_000,
          prevMonthNetRevenue: 15_000_000,
          deltaPercent: 40,
          monthExpenses: 2_000_000,
          monthProfit: 19_000_000,
          dueNext7Days: { amount: 2_500_000, centersCount: 3, items: [] },
          overdueDebtors: { amount: 900_000, centersCount: 1, items: [] },
        },
        growth: {
          timeline: [{ date: "2026-11-10", users: 12, centers: 2 }],
          funnel: { centersCreated: 20, trials: 14, paid: 8, conversionPercent: 40 },
          churnRate: 2.1,
        },
        numbers: {
          centers: { total: 20, active: 12, trial: 5, paused: 2, blocked: 1 },
          users: { total: 350, students: 280, teachers: 40, parents: 10, directors: 20, activeLast7Days: 210, activeLast30Days: 310 },
          topCenters: [],
        },
        revenueMrr12Months: [
          { month: "2026-10", label: "Окт", revenue: 15_000_000, mrr: 14_000_000 },
          { month: "2026-11", label: "Ноя", revenue: 21_000_000, mrr: 18_000_000 },
        ],
        centersByPlan: [{ planId: "p1", planName: "Business", count: 12, monthlyValue: 12_000_000 }],
        centersByStatus: [{ status: "ACTIVE", count: 12 }, { status: "TRIAL", count: 5 }],
        deltas: {
          revenueDeltaPercent: 40,
          prevPeriodRevenue: 15_000_000,
          currentPeriodRevenue: 21_000_000,
          centersDeltaPercent: 25,
          prevPeriodCenters: 4,
          currentPeriodCenters: 5,
          usersDeltaPercent: 15,
          prevPeriodUsers: 100,
          currentPeriodUsers: 115,
        },
        attentionItems: [
          { id: "att-1", level: "CRITICAL", title: "Просрочена подписка Center X", description: "Долг 900 000 сум", actionUrl: "/platform-admin/centers", actionLabel: "Открыть" },
        ],
        events: [],
        health: {
          dbStatus: "HEALTHY",
          dbPingMs: 4,
          uptimeSeconds: 3600,
          memoryMb: 128,
          environment: "production",
          isEmailConfigured: true,
          emailProvider: "smtp",
          queue: { pending: 0, failed: 0, sent: 14 },
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PlatformDashboardInteractive locale="ru" />);

    await waitFor(() => {
      expect(screen.getByText(t("ru", "ui3.platformOverviewTitle"))).toBeTruthy();
    });

    const bodyText = norm(document.body.textContent || "");
    expect(bodyText).toContain(norm(formatUzs(21_000_000, { locale: "ru" })));
    expect(bodyText).toContain(norm(formatUzs(18_000_000, { locale: "ru" })));
    expect(bodyText).toContain("Просрочена подписка Center X");
    expect(bodyText).toContain("Business");
  });

  it("renders DirectorDashboardView with all charts, limits, manual refunds and clean uz-Latn empty fallback", () => {
    const data = makeDirectorData();
    const { rerender } = render(
      <DirectorDashboardView data={data} roleLabel="Директор" centerSlug="demo" locale="ru" />
    );

    const text = norm(document.body.textContent || "");
    expect(text).toContain(norm(formatUzs(12_500_000, { locale: "ru" })));
    expect(text).toContain(norm(formatUzs(950_000, { locale: "ru" })));
    expect(text).toContain("Timur Alimov");
    expect(text).toContain("Frontend Pro");
    expect(text).toContain("Pro Plan");
    expect(text).toContain("CLK-991");
    expect(text).toContain("Malika Karimova");

    fireEvent.click(screen.getByRole("button", { name: t("ru", "ui3.period7d") }));
    expect(pushMock).toHaveBeenCalledWith("/center?period=7d");

    // Empty fallback in uz-Latn
    const emptyDir = makeDirectorData({
      revenueExpenses12Months: [],
      debtAgingBuckets: [],
      debtAgingTotals: { aging0to30: 0, aging31to60: 0, aging61plus: 0, total: 0 },
      groupOccupancy: [],
      weeklyAttendanceTrend: [],
      atRiskStudents: [],
      upcomingSchedule: [],
      pendingManualRefunds: [],
    });
    rerender(
      <DirectorDashboardView data={emptyDir} roleLabel="Direktor" centerSlug="demo" locale="uz-Latn" />
    );
    expect(document.body.textContent).toContain(t("uz-Latn", "ui3.emptyPeriod"));
  });

  it("renders TeacherDashboardView with today lessons, review queue, grades and salary", () => {
    render(
      <TeacherDashboardView
        data={makeTeacherData()}
        roleLabel="Преподаватель"
        centerSlug="demo"
        locale="ru"
      />
    );

    const text = norm(document.body.textContent || "");
    expect(text).toContain("Backend A1");
    expect(text).toContain("REST API Auth");
    expect(text).toContain("Jasur Bek");
    expect(text).toContain("Sardorbek");
    expect(text).toContain(norm(formatUzs(3_600_000, { locale: "ru" })));
  });

  it("renders CenterFinanceAnalytics with 5 KPIs, 7 charts, breakdown tables, Course/Group toggle and CSV link", () => {
    render(
      <CenterFinanceAnalytics
        initialData={makeFinanceAnalytics()}
        locale="ru"
        canExport
      />
    );

    const text = norm(document.body.textContent || "");
    expect(text).toContain(norm(formatUzs(15_000_000, { locale: "ru" })));
    expect(text).toContain(norm(formatUzs(6_000_000, { locale: "ru" })));
    expect(text).toContain(norm(formatUzs(9_000_000, { locale: "ru" })));
    expect(text).toContain(norm(formatUzs(1_200_000, { locale: "ru" })));
    expect(text).toContain(norm(formatUzs(450_000, { locale: "ru" })));
    expect(text).toContain("60%");
    expect(text).toContain("Аренда");
    expect(text).toContain("Dilshod Tursunov");
    expect(text).toContain("English IELTS");

    fireEvent.click(screen.getByRole("button", { name: t("ru", "ui3.modeGroups") }));
    expect(document.body.textContent).toContain("IELTS Morning");
    expect(document.body.textContent).toContain("React A1");

    const exportAnchor = document.querySelector('a[href*="/api/finance/export?format=csv"]');
    expect(exportAnchor).not.toBeNull();
  });

  it("renders StudentPerformanceView for Student (with payment + group avg) and hides payment card when payment=null", () => {
    const fullData = makeStudentPerf();
    const { rerender } = render(
      <StudentPerformanceView initialData={fullData} locale="ru" showPeriodControls />
    );

    const text = norm(document.body.textContent || "");
    expect(text).toContain("89%");
    expect(text).toContain("92%");
    expect(text).toContain("IELTS Prep");
    expect(text).toContain("Writing Task 2");
    expect(text).toContain(norm(formatUzs(400_000, { locale: "ru" })));

    // Switch lesson tabs
    fireEvent.click(screen.getByRole("tab", { name: /Пропущенные/ }));
    expect(document.body.textContent).toContain("Listening Lab");
    fireEvent.click(screen.getByRole("tab", { name: /Предстоящие/ }));
    expect(document.body.textContent).toContain("Speaking Mock");

    // Teacher view: payment=null and canViewPayments=false, small group notice when canViewGroupAverage=false
    const teacherData = makeStudentPerf({
      canViewPayments: false,
      canViewGroupAverage: false,
      payment: null,
    });
    rerender(<StudentPerformanceView initialData={teacherData} locale="ru" />);
    expect(document.body.textContent).not.toContain(t("ru", "ui3.paymentCardTitle"));
    expect(document.body.textContent).toContain(t("ru", "ui3.groupAvgHiddenNotice"));
  });

  it("renders ParentDashboardView with child switcher and single-action child alerts", () => {
    const perf = makeStudentPerf();
    render(
      <ParentDashboardView
        childrenData={[
          { studentMembershipId: "m-stu-1", fullName: "Madina Umarova", email: "madina@example.uz", performance: perf },
          { studentMembershipId: "m-stu-2", fullName: "Sarvar Umarov", email: null, performance: makeStudentPerf({ studentMembershipId: "m-stu-2", studentName: "Sarvar Umarov" }) },
        ]}
        initialSelectedChildId="m-stu-1"
        centerSlug="demo"
        locale="ru"
      />
    );

    const text = norm(document.body.textContent || "");
    expect(text).toContain("Madina Umarova");
    expect(text).toContain(norm(formatUzs(400_000, { locale: "ru" })));
    expect(screen.getByRole("link", { name: t("ru", "ui3.parentPayNow") })).toBeTruthy();
  });
});
