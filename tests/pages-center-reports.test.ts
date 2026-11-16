import { describe, it, expect, vi, beforeEach } from "vitest";
import { t } from "@/i18n";
import { formatUzs } from "@/lib/money";

/**
 * `src/app/center/reports/page.tsx` — financial & academic reports server page.
 */

const {
  redirectMock,
  getAuthSessionMock,
  requireTenantPageAccessMock,
  calculateCenterExpectedMRRMock,
  calculateStudentDebtsSummaryMock,
  calculateTeacherSalariesReportMock,
  getCenterFinanceAnalyticsMock,
  getCenterPlanFeaturesMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthSessionMock: vi.fn(),
  requireTenantPageAccessMock: vi.fn(),
  calculateCenterExpectedMRRMock: vi.fn(),
  calculateStudentDebtsSummaryMock: vi.fn(),
  calculateTeacherSalariesReportMock: vi.fn(),
  getCenterFinanceAnalyticsMock: vi.fn(),
  getCenterPlanFeaturesMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));
vi.mock("@/lib/billing", () => ({
  calculateCenterExpectedMRR: calculateCenterExpectedMRRMock,
  calculateStudentDebtsSummary: calculateStudentDebtsSummaryMock,
}));
vi.mock("@/lib/finance-reports", () => ({
  calculateTeacherSalariesReport: calculateTeacherSalariesReportMock,
}));
vi.mock("@/lib/finance-analytics", () => ({
  getCenterFinanceAnalytics: getCenterFinanceAnalyticsMock,
}));
vi.mock("@/lib/plan-features", () => ({
  getCenterPlanFeatures: getCenterPlanFeaturesMock,
}));

function makeDb() {
  return {
    centerPayment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    charge: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null, paidAmount: null }, _count: 0 }),
    },
    centerMembership: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: { id: "u-1", preferredLanguage: "ru", platformRole: "USER" },
    ...overrides,
  };
}

function setUp(db: Db, sess: unknown, extraCtx: Record<string, unknown> = {}) {
  requireTenantPageAccessMock.mockResolvedValue({
    getTenantDb: () => db,
    isPlatformStaff: false,
    membership: { permissions: null },
    ...extraCtx,
  });
  getAuthSessionMock.mockResolvedValue(sess);
}

async function loadPage() {
  return (await import("@/app/center/reports/page")).default;
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && (node as { props?: Record<string, unknown> }).props !== undefined) {
    const props = (node as { props: Record<string, unknown> }).props;
    const parts = [
      props.title,
      props.description,
      props.label,
      props.value,
      props.hint,
    ]
      .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
      .map(String);
    return [...parts, collectText(props.children)].join(" ");
  }
  return "";
}

function walk(node: unknown, out: Array<{ props: Record<string, unknown> }> = []) {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props !== undefined) {
    out.push(el as { props: Record<string, unknown> });
    walk(el.props.actions, out);
    walk(el.props.children, out);
  }
  return out;
}

function allHrefs(node: unknown): string[] {
  return walk(node)
    .map((el) => el.props.href)
    .filter((href): href is string => typeof href === "string");
}

function emptyAnalytics() {
  return {
    period: "30d",
    startDate: "2026-10-01T00:00:00.000Z",
    endDate: "2026-10-31T23:59:59.000Z",
    kpis: {
      revenue: 0,
      expenses: 0,
      netProfit: 0,
      totalDebt: 0,
      debtorsCount: 0,
      totalDiscounts: 0,
      totalBalance: 0,
      revenueDeltaPercent: 0,
      expensesDeltaPercent: 0,
      profitDeltaPercent: 0,
    },
    paymentMethods: [],
    expenseCategories: [],
    monthlySeries: [],
    revenueByCourse: [],
    revenueByGroup: [],
    debtAging: [],
    salariesByTeacher: [],
    accountBalanceSeries: {
      accounts: [],
      points: [],
    },
  };
}

describe("CenterReportsPage (server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
    calculateCenterExpectedMRRMock.mockReset().mockResolvedValue(0);
    calculateStudentDebtsSummaryMock.mockReset().mockResolvedValue({
      debts: [],
      summary: { totalDebt: 0, debtorsCount: 0, paidStudentsCount: 0, totalStudents: 0 },
    });
    calculateTeacherSalariesReportMock.mockReset().mockResolvedValue({ teachers: [] });
    getCenterFinanceAnalyticsMock.mockReset().mockResolvedValue(emptyAnalytics());
    getCenterPlanFeaturesMock.mockReset().mockResolvedValue({
      features: { advancedReports: true },
    });
  });

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await loadPage();
    await expect(Page({})).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when the session has no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await loadPage();
    await expect(Page({})).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("redirects teachers / students to /center", async () => {
    setUp(makeDb(), session({ activeCenterRole: "TEACHER" }));
    const Page = await loadPage();
    await expect(Page({})).rejects.toThrow("NEXT_REDIRECT:/center");

    vi.resetModules();
    redirectMock.mockClear();
    setUp(makeDb(), session({ activeCenterRole: "STUDENT" }));
    const Page2 = await loadPage();
    await expect(Page2({})).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("allows ACCOUNTANT alongside DIRECTOR and CENTER_ADMIN", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "ACCOUNTANT" }));
    const Page = await loadPage();
    const element = await Page({ searchParams: { period: "90d" } });

    expect(collectText(element).length).toBeGreaterThan(0);
    expect(getCenterFinanceAnalyticsMock).toHaveBeenCalledWith({
      centerId: "center-1",
      period: "90d",
    });
  });

  it("renders financial + teacher-hours report for a DIRECTOR using formatUzs", async () => {
    const db = makeDb();
    db.centerPayment.aggregate.mockResolvedValueOnce({ _sum: { amount: 1_000_000 }, _count: 4 });
    db.charge.aggregate.mockResolvedValueOnce({ _sum: { amount: 250_000, paidAmount: 50_000 }, _count: 2 });
    db.centerMembership.count.mockResolvedValue(20);
    calculateCenterExpectedMRRMock.mockResolvedValueOnce(5_000_000);
    calculateStudentDebtsSummaryMock.mockResolvedValueOnce({
      debts: [
        {
          studentId: "s-1",
          fullName: "Anna Smith",
          phone: "+998 90 123-45-67",
          email: "anna@x.uz",
          monthlyTuition: 300_000,
          totalDue: 300_000,
          totalPaid: 0,
          debtAmount: 300_000,
          status: "DEBT",
          enrollments: [{ groupName: "A1" }],
        },
        {
          studentId: "s-2",
          fullName: "Bob Jones",
          phone: null,
          email: "bob@x.uz",
          monthlyTuition: 150_000,
          totalDue: 150_000,
          totalPaid: 0,
          debtAmount: 150_000,
          status: "DEBT",
          enrollments: [],
        },
      ],
      summary: { totalDebt: 450_000, debtorsCount: 2, paidStudentsCount: 0, totalStudents: 2 },
    });
    calculateTeacherSalariesReportMock.mockResolvedValueOnce({
      teachers: [
        {
          teacherMembershipId: "teach-1",
          teacherName: "Ivan Petrov",
          conductedLessonsCount: 12,
          conductedMinutes: 1080,
          calculatedSalary: 2_400_000,
          unpaidSalaryAmount: 2_400_000,
        },
      ],
    });
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page({});
    const text = collectText(element).replace(/\s+/g, " ");
    const cur = (n: number, l: string) => formatUzs(n, { locale: l }).replace(/\s+/g, " ");

    expect(db.centerPayment.aggregate).toHaveBeenCalledWith({
      where: { centerId: "center-1", status: { in: ["PAID", "PARTIALLY_PAID"] }, deletedAt: null },
      _sum: { amount: true },
      _count: true,
    });
    expect(db.charge.aggregate).toHaveBeenCalledWith({
      where: { centerId: "center-1", status: { in: ["PENDING", "PARTIAL"] } },
      _sum: { amount: true, paidAmount: true },
      _count: true,
    });
    expect(db.centerMembership.count).toHaveBeenCalledWith({
      where: { centerId: "center-1", role: "STUDENT", status: "ACTIVE" },
    });
    expect(calculateCenterExpectedMRRMock).toHaveBeenCalledWith("center-1");

    expect(text).toContain(cur(1_000_000, "ru"));
    expect(text).toContain(cur(450_000, "ru"));
    expect(text).toContain(cur(5_000_000, "ru"));
    expect(text).toContain(`20 · ${t("ru", "ui3.kpiActiveStudents")}`);

    expect(text).toContain("Anna Smith");
    expect(text).toContain("Bob Jones");
    expect(text).toContain("bob@x.uz");
    expect(text).toContain("A1");
    expect(text).toContain("—");

    const hrefs = allHrefs(element);
    expect(hrefs.some((h) => h.startsWith("https://wa.me/998901234567?"))).toBe(true);
    expect(hrefs.some((h) => h.includes(encodeURIComponent("Anna Smith")))).toBe(true);
    expect(hrefs.some((h) => h.startsWith("/api/finance/export?format=csv"))).toBe(true);

    expect(text).toContain("Ivan Petrov");
    expect(text).toContain(t("ru", "lessons.duration", { minutes: 1080 }));
    expect(text).toContain(cur(2_400_000, "ru"));
  });

  it("allows a CENTER_ADMIN", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));
    const Page = await loadPage();
    const element = await Page({});

    expect(collectText(element).length).toBeGreaterThan(0);
    expect(db.centerMembership.count).toHaveBeenCalled();
  });

  it("renders empty states without hardcoded MRR fallback", async () => {
    const db = makeDb();
    db.centerMembership.count.mockResolvedValue(0);
    setUp(db, session({ user: { id: "u-1", preferredLanguage: "uz-Latn", platformRole: "USER" } }));

    const Page = await loadPage();
    const element = await Page({});
    const text = collectText(element).replace(/\s+/g, " ");

    expect(text).toContain(formatUzs(0, { locale: "uz-Latn" }).replace(/\s+/g, " "));
    expect(text).toContain(t("uz-Latn", "common.noData"));
    expect(text).toContain(`0 · ${t("uz-Latn", "ui3.kpiActiveStudents")}`);
  });

  it("renders a dashed placeholder when a debtor has no phone", async () => {
    const db = makeDb();
    calculateStudentDebtsSummaryMock.mockResolvedValueOnce({
      debts: [
        {
          studentId: "s-9",
          fullName: "NoPhone",
          phone: "",
          email: "np@x.uz",
          monthlyTuition: 100_000,
          totalDue: 100_000,
          totalPaid: 0,
          debtAmount: 100_000,
          status: "DEBT",
          enrollments: [{ groupName: "B1" }],
        },
      ],
      summary: { totalDebt: 100_000, debtorsCount: 1, paidStudentsCount: 0, totalStudents: 1 },
    });
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page({});

    expect(allHrefs(element).some((h) => h.startsWith("https://wa.me/"))).toBe(false);
    expect(collectText(element)).toContain("np@x.uz");
  });
});
