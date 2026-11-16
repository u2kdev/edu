import { describe, it, expect, vi, beforeEach } from "vitest";
import { t } from "@/i18n";

/**
 * `src/app/center/page.tsx` — role-driven center dashboard server page.
 */

const {
  redirectMock,
  getAuthSessionMock,
  requireTenantPageAccessMock,
  getDirectorDashboardDataMock,
  getTeacherDashboardDataMock,
  getStudentPerformanceDataMock,
  getCenterFinanceAnalyticsMock,
} = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthSessionMock: vi.fn(),
  requireTenantPageAccessMock: vi.fn(),
  getDirectorDashboardDataMock: vi.fn(),
  getTeacherDashboardDataMock: vi.fn(),
  getStudentPerformanceDataMock: vi.fn(),
  getCenterFinanceAnalyticsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));
vi.mock("@/lib/dashboard-analytics", () => ({
  getDirectorDashboardData: getDirectorDashboardDataMock,
  getTeacherDashboardData: getTeacherDashboardDataMock,
  getStudentPerformanceData: getStudentPerformanceDataMock,
}));
vi.mock("@/lib/finance-analytics", () => ({
  getCenterFinanceAnalytics: getCenterFinanceAnalyticsMock,
}));

function makeDb() {
  return {
    learningCenter: {
      findUnique: vi.fn().mockResolvedValue({
        id: "center-1",
        name: "Bright Center",
        slug: "bright",
        status: "ACTIVE",
      }),
    },
    centerMembership: { count: vi.fn().mockResolvedValue(0) },
    course: { count: vi.fn().mockResolvedValue(0) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValue([]) },
    parentLink: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

type Db = ReturnType<typeof makeDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: { id: "u-1", preferredLanguage: "ru", fullName: "Ivan Petrov" },
    ...overrides,
  };
}

function setUp(db: Db, sess: unknown) {
  requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
  getAuthSessionMock.mockResolvedValue(sess);
}

async function loadPage() {
  return (await import("@/app/center/page")).default;
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && (node as { props?: Record<string, unknown> }).props !== undefined) {
    const props = (node as { props: Record<string, unknown> }).props;
    const parts = [props.title, props.description, props.label, props.value, props.hint]
      .filter((v): v is string | number => typeof v === "string" || typeof v === "number")
      .map(String);
    return [...parts, collectText(props.children)].join(" ");
  }
  return "";
}

function findElementByName(node: unknown, name: string): { props: Record<string, unknown> } | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByName(child, name);
      if (found) return found;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (
    typeof el.type === "function" &&
    (el.type as { name?: string }).name === name
  ) {
    return el as { props: Record<string, unknown> };
  }
  if (el.props !== undefined) {
    return findElementByName(el.props.children, name);
  }
  return null;
}

function samplePerformance(id: string) {
  return {
    studentMembershipId: id,
    studentName: "Ali",
    studentEmail: "ali@example.uz",
    period: "30d",
    calendarMonth: "2026-11",
    canViewPayments: true,
    canViewGroupAverage: true,
    summary: {
      attendanceRate: 92,
      presentCount: 11,
      lateCount: 1,
      excusedCount: 0,
      absentCount: 0,
      homeworkCompletionRate: 80,
      avgGradePercent: 85,
      courseProgressPercent: 60,
    },
    attendanceDonut: [],
    attendanceHeatmap: [],
    homeworkWeekly: [],
    gradesTrajectory: [],
    courseProgress: [],
    lessons: [],
    payment: null,
    attentionAlerts: [],
  };
}

describe("CenterDashboardPage (UI3 server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
    getDirectorDashboardDataMock.mockReset().mockResolvedValue({ period: "30d" });
    getTeacherDashboardDataMock.mockReset().mockResolvedValue({ period: "30d" });
    getStudentPerformanceDataMock.mockReset().mockResolvedValue(samplePerformance("m-stu"));
    getCenterFinanceAnalyticsMock.mockReset().mockResolvedValue({ period: "30d" });
  });

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await loadPage();
    await expect(Page({})).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the center row is missing", async () => {
    const db = makeDb();
    db.learningCenter.findUnique.mockResolvedValue(null);
    setUp(db, session());
    const Page = await loadPage();
    await expect(Page({})).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders a select-center notice when no center is active (no db lookup)", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterId: null, memberships: [] }));

    const Page = await loadPage();
    const element = await Page({});
    const text = collectText(element);

    expect(text).toContain(t("ru", "dashboard.selectCenter"));
    expect(db.learningCenter.findUnique).not.toHaveBeenCalled();
    expect(db.centerMembership.count).not.toHaveBeenCalled();
  });

  it("renders DirectorDashboardView for DIRECTOR and CENTER_ADMIN with validated period", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "DIRECTOR" }));
    const Page = await loadPage();
    const element = await Page({ searchParams: { period: "90d" } });

    expect(getDirectorDashboardDataMock).toHaveBeenCalledWith({
      centerId: "center-1",
      period: "90d",
    });
    const view = findElementByName(element, "DirectorDashboardView");
    expect(view).not.toBeNull();
    expect(view!.props.centerSlug).toBe("bright");
    expect(view!.props.locale).toBe("ru");

    vi.resetModules();
    getDirectorDashboardDataMock.mockClear();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));
    const Page2 = await loadPage();
    await Page2({ searchParams: { period: "invalid-period" } });
    expect(getDirectorDashboardDataMock).toHaveBeenCalledWith({
      centerId: "center-1",
      period: "30d",
    });
  });

  it("renders CenterFinanceAnalytics for ACCOUNTANT", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "ACCOUNTANT" }));
    const Page = await loadPage();
    const element = await Page({ searchParams: { period: "12m" } });

    expect(getCenterFinanceAnalyticsMock).toHaveBeenCalledWith({
      centerId: "center-1",
      period: "12m",
    });
    expect(findElementByName(element, "CenterFinanceAnalytics")).not.toBeNull();
    expect(collectText(element)).toContain(t("ru", "ui3.accountantOverviewTitle"));
  });

  it("renders TeacherDashboardView for TEACHER and TEACHER_ASSISTANT", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      })
    );
    const Page = await loadPage();
    const element = await Page({ searchParams: { period: "7d" } });

    expect(getTeacherDashboardDataMock).toHaveBeenCalledWith({
      centerId: "center-1",
      membershipId: "m-teacher",
      role: "TEACHER",
      period: "7d",
    });
    expect(findElementByName(element, "TeacherDashboardView")).not.toBeNull();

    // Missing membership falls back to empty teacher data cleanly without throwing
    vi.resetModules();
    getTeacherDashboardDataMock.mockClear();
    setUp(db, session({ activeCenterRole: "TEACHER_ASSISTANT", memberships: [] }));
    const Page2 = await loadPage();
    const element2 = await Page2({});
    expect(getTeacherDashboardDataMock).not.toHaveBeenCalled();
    expect(findElementByName(element2, "TeacherDashboardView")).not.toBeNull();
  });

  it("renders StudentDashboardView for STUDENT with schedule slots when enrolled", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([{ groupId: "g-1" }]);
    db.scheduleSlot.findMany.mockResolvedValue([
      {
        id: "slot-1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:30",
        roomName: "101",
        group: { name: "Group A", course: { title: "Math" } },
        teacher: { user: { fullName: "Teacher X" } },
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-stu", centerId: "center-1" }],
      })
    );

    const Page = await loadPage();
    const element = await Page({});

    expect(db.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentMembershipId: "m-stu", status: "ACTIVE" },
      select: { groupId: true },
    });
    expect(getStudentPerformanceDataMock).toHaveBeenCalledWith({
      centerId: "center-1",
      studentMembershipId: "m-stu",
      viewerRole: "STUDENT",
      viewerMembershipId: "m-stu",
      period: "30d",
    });
    const view = findElementByName(element, "StudentDashboardView");
    expect(view).not.toBeNull();
    expect(view!.props.enrollmentsCount).toBe(1);
    expect((view!.props.scheduleSlots as unknown[]).length).toBe(1);
  });

  it("skips performance and schedule queries when STUDENT has no enrollments", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-stu", centerId: "center-1" }],
      })
    );

    const Page = await loadPage();
    const element = await Page({});

    expect(getStudentPerformanceDataMock).not.toHaveBeenCalled();
    expect(db.scheduleSlot.findMany).not.toHaveBeenCalled();
    const view = findElementByName(element, "StudentDashboardView");
    expect(view).not.toBeNull();
    expect(view!.props.performance).toBeNull();
  });

  it("renders ParentDashboardView scoped strictly to CONFIRMED parent links", async () => {
    const db = makeDb();
    db.parentLink.findMany.mockResolvedValue([
      {
        student: {
          id: "m-child-1",
          user: { fullName: "Child One", email: "c1@example.uz" },
        },
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-parent", centerId: "center-1" }],
      })
    );

    const Page = await loadPage();
    const element = await Page({ searchParams: { childId: "m-child-1" } });

    expect(db.parentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      })
    );
    expect(getStudentPerformanceDataMock).toHaveBeenCalledWith({
      centerId: "center-1",
      studentMembershipId: "m-child-1",
      viewerRole: "PARENT",
      viewerMembershipId: "m-parent",
      period: "30d",
    });
    const view = findElementByName(element, "ParentDashboardView");
    expect(view).not.toBeNull();
    expect(view!.props.initialSelectedChildId).toBe("m-child-1");
  });

  it("renders safe support fallback metrics for CENTER_SUPPORT", async () => {
    const db = makeDb();
    db.centerMembership.count
      .mockResolvedValueOnce(14)
      .mockResolvedValueOnce(4);
    db.course.count.mockResolvedValueOnce(6);
    setUp(db, session({ activeCenterRole: "CENTER_SUPPORT" }));

    const Page = await loadPage();
    const element = await Page({});
    const text = collectText(element);

    expect(text).toContain(t("ru", "ui3.supportOverviewTitle"));
    expect(text).toContain("14");
    expect(text).toContain("4");
    expect(text).toContain("6");
  });
});
