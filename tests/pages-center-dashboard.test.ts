import { describe, it, expect, vi, beforeEach } from "vitest";
import { t, formatCurrencyLocalized } from "@/i18n";

/**
 * `src/app/center/page.tsx` (center dashboard) — big role-driven server component.
 * Same harness pattern as tests/pages-center-schedule.test.ts.
 */

const { redirectMock, getAuthSessionMock, requireTenantPageAccessMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthSessionMock: vi.fn(),
  requireTenantPageAccessMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    learningCenter: {
      findUnique: vi.fn().mockResolvedValue({
        id: "center-1",
        name: "Bright Center",
        slug: "bright",
        subscriptions: [],
      }),
    },
    centerMembership: { count: vi.fn().mockResolvedValue(0) },
    course: { count: vi.fn().mockResolvedValue(0) },
    centerPayment: { aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }) },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
    scheduleSlot: { findMany: vi.fn().mockResolvedValue([]) },
    homeworkSubmission: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    homework: { findMany: vi.fn().mockResolvedValue([]) },
    grade: { findMany: vi.fn().mockResolvedValue([]) },
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
  if (typeof node === "object" && (node as { props?: unknown }).props !== undefined) {
    return collectText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function flatText(node: unknown): string {
  return collectText(node).replace(/\s+/g, " ").trim();
}

function cur(n: number, locale = "ru") {
  return formatCurrencyLocalized(n, locale, "UZS").replace(/\s+/g, " ");
}

/** Count how often prisma mock method was called. */
function called(mock: { mock: { calls: unknown[][] } }): number {
  return mock.mock.calls.length;
}

const attendanceRow = (studentMembershipId: string, status: string) => ({
  studentMembershipId,
  status,
});

const scheduleSlot = (over: Record<string, unknown> = {}) => ({
  id: "slot-1",
  dayOfWeek: 1,
  startTime: "09:00",
  endTime: "10:00",
  roomName: "101",
  groupId: "g-1",
  group: { id: "g-1", name: "A1", course: { id: "c-1", title: "English" } },
  teacher: { user: { fullName: "Teacher X" } },
  ...over,
});

// ---------------------------------------------------------------------------

describe("CenterDashboardPage (server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /login when the center row is missing", async () => {
    const db = makeDb();
    db.learningCenter.findUnique.mockResolvedValue(null);
    setUp(db, session());
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders a select-center notice when no center is active (no db lookup)", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterId: null, memberships: [] }));

    const Page = await loadPage();
    const element = await Page();
    const text = flatText(element);

    expect(text).toContain(t("ru", "dashboard.selectCenter"));
    expect(called(db.learningCenter.findUnique)).toBe(0);
    expect(called(db.centerMembership.count)).toBe(0);
  });

  // --- DIRECTOR / CENTER_ADMIN --------------------------------------------

  it("renders the director dashboard with KPIs, attendance analytics and schedule", async () => {
    const db = makeDb();
    db.centerMembership.count.mockImplementation((args: { where: { role: string } }) =>
      Promise.resolve(args.where.role === "STUDENT" ? 10 : 3),
    );
    db.course.count.mockResolvedValue(2);
    db.centerPayment.aggregate.mockResolvedValue({ _sum: { amount: 5_000_000 } });
    db.attendance.findMany.mockResolvedValue([
      attendanceRow("s-A", "PRESENT"),
      attendanceRow("s-A", "ABSENT"), // 1/2 = 50% -> at risk
      attendanceRow("s-B", "PRESENT"),
      attendanceRow("s-B", "LATE"),
      attendanceRow("s-B", "PRESENT"),
      attendanceRow("s-B", "PRESENT"),
      attendanceRow("s-B", "ABSENT"), // 4/5 = 80% -> not at risk
    ]);
    db.scheduleSlot.findMany.mockResolvedValue([scheduleSlot()]);
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page();
    const text = flatText(element);

    // KPI queries
    expect(db.centerMembership.count).toHaveBeenNthCalledWith(1, {
      where: { centerId: "center-1", role: "STUDENT", status: "ACTIVE" },
    });
    expect(db.centerMembership.count).toHaveBeenNthCalledWith(2, {
      where: { centerId: "center-1", role: "TEACHER", status: "ACTIVE" },
    });
    expect(db.course.count).toHaveBeenCalledWith({ where: { centerId: "center-1" } });
    expect(db.centerPayment.aggregate).toHaveBeenCalledWith({
      where: { centerId: "center-1", status: "PAID" },
      _sum: { amount: true },
    });
    expect(db.learningCenter.findUnique).toHaveBeenCalledWith({
      where: { id: "center-1" },
      include: { subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 } },
    });

    // Attendance analytics query + derived numbers
    expect(db.attendance.findMany).toHaveBeenCalledWith({
      where: { lesson: { module: { course: { centerId: "center-1" } } } },
      select: { studentMembershipId: true, status: true },
    });
    expect(db.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", status: "ACTIVE" },
        orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
        take: 6,
      }),
    );

    expect(text).toContain(t("ru", "dashboard.directorCabinet"));
    expect(text).toContain(`${t("ru", "dashboard.activeStudents")} 10`);
    expect(text).toContain(`${t("ru", "dashboard.teachers")} 3`);
    expect(text).toContain(`${t("ru", "dashboard.totalCourses")} 2`);
    expect(text).toContain(cur(5_000_000));
    // overall rate = 5/7 -> 71%; one student at risk
    expect(text).toContain("71%");
    expect(text).toContain(t("ru", "dashboard.attendanceLowWarning"));
    // schedule card
    expect(text).toContain("English");
    expect(text).toContain("Teacher X");
    expect(text).toContain("101");
    expect(text).toContain("Пн");
    // no onboarding banners because counts > 0
    expect(text).not.toContain(t("ru", "dashboard.noCoursesYet"));
    expect(text).not.toContain(t("ru", "dashboard.noActiveStudents"));
    // role-specific other-branch sections must not render
    expect(text).not.toContain(t("ru", "dashboard.mySchedule"));
    expect(text).not.toContain(t("ru", "dashboard.childrenOverview"));
  });

  it("renders director empty states and onboarding banners", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.adminCabinet"));
    expect(text).toContain("—"); // null attendance rate
    expect(text).toContain(t("ru", "dashboard.attendanceSatisfactory"));
    expect(text).toContain(t("ru", "dashboard.setupSchedulePrompt"));
    expect(text).toContain(t("ru", "dashboard.noCoursesYet"));
    expect(text).toContain(t("ru", "dashboard.noActiveStudents"));
    expect(text).toContain(cur(0));
  });

  // --- TEACHER -------------------------------------------------------------

  it("renders a teacher's schedule and pending reviews", async () => {
    const db = makeDb();
    db.scheduleSlot.findMany.mockResolvedValue([scheduleSlot()]);
    db.homeworkSubmission.count.mockResolvedValue(4);
    db.homeworkSubmission.findMany.mockResolvedValue([
      {
        id: "sub-1",
        submittedAt: new Date("2026-04-02T10:00:00.000Z"),
        student: { user: { fullName: "", email: "student@x.uz" } },
        homework: { title: "Essay" },
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.teacherCabinet"));
    expect(text).toContain(`${t("ru", "dashboard.pendingHomeworks")} ${t("ru", "dashboard.homeworksCount", { count: 4 })}`);
    expect(text).toContain("Essay");
    expect(text).toContain("student@x.uz"); // fullName empty -> email fallback
    expect(text).toContain(t("ru", "dashboard.submissionFrom", { name: "student@x.uz" }));

    expect(db.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          centerId: "center-1",
          teacherMembershipId: "m-teacher",
          status: "ACTIVE",
        },
      }),
    );
    expect(db.homeworkSubmission.count).toHaveBeenCalledWith({
      where: {
        homework: { lesson: { module: { course: { centerId: "center-1" } } } },
        grade: null,
        status: "SUBMITTED",
      },
    });
    expect(db.homeworkSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { submittedAt: "desc" }, take: 5 }),
    );
  });

  it("renders teacher empty states when the teacher has no membership", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "TEACHER", memberships: [] }));

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.noTeacherSchedule"));
    expect(text).toContain(t("ru", "dashboard.noPendingReviews"));
    expect(text).toContain(t("ru", "dashboard.homeworksCount", { count: 0 }));
    expect(called(db.scheduleSlot.findMany)).toBe(0);
    expect(called(db.homeworkSubmission.findMany)).toBe(0);
    expect(called(db.homeworkSubmission.count)).toBe(0);
  });

  // --- STUDENT -------------------------------------------------------------

  it("renders a student's performance, schedule, deadlines and courses", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([
      {
        id: "e-1",
        status: "ACTIVE",
        group: {
          id: "g-1",
          name: "A1",
          course: { id: "c-1", title: "English" },
          teacher: { user: { fullName: "Teacher X" } },
        },
      },
    ]);
    db.scheduleSlot.findMany.mockResolvedValue([scheduleSlot()]);
    db.homework.findMany.mockResolvedValue([
      {
        id: "hw-1",
        title: "HW graded",
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
        lesson: { module: { course: { title: "English" } } },
        submissions: [{ id: "s1", grade: 90, status: "GRADED" }],
      },
      {
        id: "hw-2",
        title: "HW revision",
        dueDate: null,
        lesson: { module: { course: { title: "English" } } },
        submissions: [{ id: "s2", grade: null, status: "REVISION_REQUESTED" }],
      },
      {
        id: "hw-3",
        title: "HW submitted",
        dueDate: null,
        lesson: { module: { course: { title: "English" } } },
        submissions: [{ id: "s3", grade: null, status: "SUBMITTED" }],
      },
      {
        id: "hw-4",
        title: "HW overdue",
        dueDate: new Date("2020-01-01T00:00:00.000Z"),
        lesson: { module: { course: { title: "English" } } },
        submissions: [],
      },
      {
        id: "hw-5",
        title: "HW pending",
        dueDate: new Date("2999-01-01T00:00:00.000Z"),
        lesson: { module: { course: { title: "English" } } },
        submissions: [],
      },
    ]);
    db.attendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "LATE" },
      { status: "PRESENT" },
      { status: "ABSENT" }, // 3/4 = 75% -> warning
    ]);
    db.grade.findMany.mockResolvedValue([
      {
        id: "g-1",
        value: 90,
        maxValue: 100,
        comment: "good",
        lesson: { title: "L1" },
        homeworkSubmission: { homework: { title: "HW1" } },
      },
      {
        id: "g-2",
        value: 50,
        maxValue: 100,
        comment: null,
        lesson: null,
        homeworkSubmission: null,
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.studentCabinet"));
    // attendance 75% + warning
    expect(text).toContain("75%");
    expect(text).toContain(t("ru", "dashboard.inRiskZoneWarning"));
    // average grade = 70 -> "C"
    expect(text).toContain("70%");
    expect(text).toContain(t("ru", "grades.gradeSatisfactory"));
    // recent grades + letter grades + fallback title
    expect(text).toContain("90 / 100 A");
    expect(text).toContain("50 / 100 F");
    expect(text).toContain("HW1");
    expect(text).toContain("good");
    expect(text).toContain(t("ru", "homework.assignmentFallback"));

    // deadline statuses
    expect(text).toContain(`${t("ru", "homework.graded")}: 90 ${t("ru", "grades.points")}`);
    expect(text).toContain(t("ru", "homework.submitted"));
    expect(text).toContain(t("ru", "homework.revisionRequested"));
    expect(text).toContain(t("ru", "homework.overdue"));
    expect(text).toContain(t("ru", "homework.notStarted"));

    // courses + schedule
    expect(text).toContain(t("ru", "student.myCourses"));
    expect(text).toContain("English");
    expect(text).toContain("A1");
    expect(text).toContain("Teacher X");

    // query shapes
    expect(db.enrollment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentMembershipId: "m-student", status: "ACTIVE" } }),
    );
    expect(db.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", groupId: { in: ["g-1"] }, status: "ACTIVE" },
      }),
    );
    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lesson: { module: { courseId: { in: ["c-1"] } } } },
        take: 6,
      }),
    );
    expect(db.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentMembershipId: "m-student" } }),
    );
  });

  it("renders a student's good-attendance / excellent-grade badge", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([
      { id: "e-1", status: "ACTIVE", group: { id: "g-1", name: "A1", course: { id: "c-1", title: "English" }, teacher: null } },
    ]);
    db.attendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "PRESENT" },
    ]);
    db.grade.findMany.mockResolvedValue([
      { id: "g-1", value: 95, maxValue: 100, comment: null, lesson: { title: "L1" }, homeworkSubmission: null },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain("100%");
    expect(text).toContain(t("ru", "grades.gradeExcellent"));
    expect(text).not.toContain(t("ru", "dashboard.inRiskZoneWarning"));
    // no teacher on the course -> "assigning teacher"
    expect(text).toContain(t("ru", "student.assigningTeacher"));
  });

  it("renders student empty states when there are no enrollments", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "student.noCourses"));
    expect(text).toContain(t("ru", "student.useInviteCode"));
    expect(text).toContain(t("ru", "dashboard.noUpcomingClasses"));
    expect(text).toContain(t("ru", "dashboard.noHomeworkDeadlines"));
    expect(text).toContain(t("ru", "dashboard.noGradesYet"));
    expect(called(db.scheduleSlot.findMany)).toBe(0);
    expect(called(db.homework.findMany)).toBe(0);
  });

  it("renders student empty states when there is no membership for the center", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "STUDENT", memberships: [] }));

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "student.noCourses"));
    expect(called(db.enrollment.findMany)).toBe(0);
  });

  // --- PARENT --------------------------------------------------------------

  it("renders the parent multi-child overview", async () => {
    const db = makeDb();
    db.parentLink.findMany.mockResolvedValue([
      {
        id: "pl-1",
        student: {
          id: "s-1",
          user: { fullName: "Child One", email: "child@x.uz" },
          enrollments: [
            { id: "e-1", status: "ACTIVE", group: { id: "g-1", name: "A1", course: { title: "English" } } },
          ],
          payments: [{ id: "p-1", amount: 100_000, status: "PAID", createdAt: new Date() }],
        },
      },
    ]);
    db.scheduleSlot.findMany.mockResolvedValue([scheduleSlot()]);
    db.attendance.findMany.mockResolvedValue([
      { status: "PRESENT" },
      { status: "PRESENT" },
      { status: "ABSENT" },
      { status: "ABSENT" }, // 2/4 = 50%, 2 absences
    ]);
    db.grade.findMany.mockResolvedValue([
      {
        id: "g-1",
        value: 80,
        maxValue: 100,
        comment: null,
        lesson: { title: "L1" },
        homeworkSubmission: { homework: { title: "HW1" } },
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-parent", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.parentCabinet"));
    expect(text).toContain(t("ru", "dashboard.childrenOverview"));
    expect(text).toContain("Child One");
    expect(text).toContain("child@x.uz");
    expect(text).toContain("50%");
    expect(text).toContain(t("ru", "attendance.classesCount", { attended: 2, total: 4 }));
    expect(text).toContain(t("ru", "dashboard.childAbsences", { count: 2 }));
    expect(text).toContain("80%");
    expect(text).toContain("B");
    expect(text).toContain("HW1");
    expect(text).toContain("English");
    expect(text).toContain("A1");
    expect(text).toContain("Teacher X");
    expect(text).toContain(cur(100_000));
    expect(text).toContain("PAID");
    expect(text).toContain(t("ru", "dashboard.parentPayNext"));

    expect(db.parentLink.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      }),
    );
  });

  it("renders the parent empty state when no children are linked", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-parent", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.parentNoChildrenLinked"));
    expect(text).toContain(t("ru", "dashboard.parentLinkHint"));
    expect(called(db.attendance.findMany)).toBe(0);
  });

  it("skips parent data when there is no membership for the center", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "PARENT", memberships: [] }));

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("ru", "dashboard.parentNoChildrenLinked"));
    expect(called(db.parentLink.findMany)).toBe(0);
  });

  // --- other roles ---------------------------------------------------------

  it("renders only the header + center KPIs for an unsupported center role", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_SUPPORT" }));

    const Page = await loadPage();
    const text = flatText(await Page());

    // header still renders slug + welcome
    expect(text).toContain("bright");
    expect(text).toContain(t("ru", "dashboard.welcome", { name: "Ivan Petrov" }));
    // no role cabinet badge, no role sections
    expect(text).not.toContain(t("ru", "dashboard.directorCabinet"));
    expect(text).not.toContain(t("ru", "dashboard.mySchedule"));
    expect(text).not.toContain(t("ru", "dashboard.childrenOverview"));
    expect(text).not.toContain(t("ru", "dashboard.centerAttendanceRate"));
    // only the always-on KPIs are queried
    expect(called(db.centerMembership.count)).toBe(2);
    expect(called(db.attendance.findMany)).toBe(0);
    expect(called(db.scheduleSlot.findMany)).toBe(0);
    expect(called(db.enrollment.findMany)).toBe(0);
    expect(called(db.parentLink.findMany)).toBe(0);
  });

  it("uses the user's preferred locale", async () => {
    const db = makeDb();
    setUp(db, session({ user: { id: "u-1", preferredLanguage: "uz-Latn", fullName: "Ivan" } }));

    const Page = await loadPage();
    const text = flatText(await Page());

    expect(text).toContain(t("uz-Latn", "dashboard.directorCabinet"));
  });
});
