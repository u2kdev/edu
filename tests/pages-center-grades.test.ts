import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `src/app/center/grades/page.tsx` — plain async server component.
 * Follows the pattern of tests/pages-center-schedule.test.ts.
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
    parentLink: { findMany: vi.fn().mockResolvedValue([]) },
    homeworkSubmission: { findMany: vi.fn().mockResolvedValue([]) },
    testAttempt: { findMany: vi.fn().mockResolvedValue([]) },
    group: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

type Db = ReturnType<typeof makeDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: { id: "u-1", preferredLanguage: "ru" },
    ...overrides,
  };
}

function setUp(db: Db, sess: unknown) {
  requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
  getAuthSessionMock.mockResolvedValue(sess);
}

async function loadPage() {
  return (await import("@/app/center/grades/page")).default;
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
  const type = el.type;
  if (typeof type === "function" && (type as { name?: string }).name === name) {
    return el as { props: Record<string, unknown> };
  }
  if (type && typeof type === "object" && (type as { name?: string }).name === name) {
    return el as { props: Record<string, unknown> };
  }
  if (el.props !== undefined) return findElementByName(el.props.children, name);
  return null;
}

/** First `where` argument passed to a prisma mock method. */
function whereOf(mock: { mock: { calls: unknown[][] } }): Record<string, unknown> {
  return (mock.mock.calls[0][0] as { where: Record<string, unknown> }).where;
}

// ---------------------------------------------------------------------------

describe("CenterGradesPage (server page)", () => {
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

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("renders the full-center report for a DIRECTOR", async () => {
    const db = makeDb();
    db.homeworkSubmission.findMany.mockResolvedValue([
      {
        id: "sub-1",
        grade: 90,
        gradedAt: new Date("2026-04-02T10:00:00.000Z"),
        feedback: "Great",
        homework: { title: "Essay" },
        student: { user: { fullName: "Anna", email: "anna@x.uz" } },
      },
      {
        id: "sub-2",
        grade: 70,
        gradedAt: new Date("2026-04-01T10:00:00.000Z"),
        feedback: null,
        homework: { title: "Quiz" },
        student: { user: { fullName: "Bob", email: "bob@x.uz" } },
      },
    ]);
    db.testAttempt.findMany.mockResolvedValue([
      {
        id: "att-1",
        scorePercent: 80,
        scorePoints: 8,
        maxPoints: 10,
        completedAt: new Date("2026-04-03T10:00:00.000Z"),
        test: { passingScorePercent: 60, material: { title: "Unit test" } },
        student: { user: { fullName: "Anna", email: "anna@x.uz" } },
      },
      {
        id: "att-2",
        scorePercent: 40,
        scorePoints: 4,
        maxPoints: 10,
        completedAt: new Date("2026-04-04T10:00:00.000Z"),
        test: { passingScorePercent: 60, material: { title: "Hard test" } },
        student: { user: { fullName: "Bob", email: "bob@x.uz" } },
      },
    ]);
    db.group.findMany.mockResolvedValue([
      { id: "g-1", name: "A1" },
      { id: "g-2", name: "B2" },
    ]);
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page();
    const text = flatText(element);
    const compact = text.replace(/\s+/g, "");

    // unscoped where for staff
    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({
      homework: { lesson: { module: { course: { centerId: "center-1" } } } },
      grade: { not: null },
    });
    expect(whereOf(db.testAttempt.findMany)).toEqual({
      test: { material: { centerId: "center-1" } },
    });

    expect(db.homeworkSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { gradedAt: "desc" }, take: 50 }),
    );
    expect(db.testAttempt.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { completedAt: "desc" }, take: 50 }),
    );

    // staff -> groups loaded + gradebook rendered
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    const gradebook = findElementByName(element, "GradebookManager");
    expect(gradebook).not.toBeNull();
    expect(gradebook!.props.groups).toEqual([
      { id: "g-1", name: "A1" },
      { id: "g-2", name: "B2" },
    ]);
    expect(gradebook!.props.userRole).toBe("DIRECTOR");
    expect(gradebook!.props.locale).toBe("ru");

    // average of graded submissions (90 + 70) / 2 = 80
    expect(compact).toContain("80%");
    expect(text).toContain("Anna");
    expect(text).toContain("Essay");
    expect(text).toContain("Great");
    expect(text).toContain("—"); // null feedback
    expect(text).toContain("Unit test");
    expect(compact).toContain("80%(8/10)");
    expect(compact).toContain("40%(4/10)");
    expect(compact).toContain("✓Сдан");
    expect(compact).toContain("✗Несдан");
  });

  it("ignores ungraded submissions when computing the average", async () => {
    const db = makeDb();
    db.homeworkSubmission.findMany.mockResolvedValue([
      { id: "s1", grade: 80, gradedAt: new Date(), feedback: null, homework: { title: "A" }, student: { user: { fullName: "A", email: "a@x" } } },
      { id: "s2", grade: null, gradedAt: null, feedback: null, homework: { title: "B" }, student: { user: { fullName: "B", email: "b@x" } } },
    ]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await loadPage();
    const text = flatText(await Page());
    const compact = text.replace(/\s+/g, "");

    expect(compact).toContain("80%");
    expect(compact).not.toContain("40%");
  });

  it("scopes a TEACHER to their own groups", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({
      homework: { lesson: { module: { course: { centerId: "center-1" } } } },
      grade: { not: null },
      student: {
        enrollments: { some: { group: { teacherMembershipId: "m-teacher" } } },
      },
    });
    expect(whereOf(db.testAttempt.findMany)).toEqual({
      test: { material: { centerId: "center-1" } },
      student: {
        enrollments: { some: { group: { teacherMembershipId: "m-teacher" } } },
      },
    });
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1", teacherMembershipId: "m-teacher" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  it("returns an empty scope when a TEACHER has no membership (no center-wide fallback)", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "TEACHER", memberships: [] }));

    const Page = await loadPage();
    await Page();

    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({ id: { in: [] } });
    expect(whereOf(db.testAttempt.findMany)).toEqual({ id: { in: [] } });
    // no groups / gradebook without a membership
    expect(db.group.findMany).not.toHaveBeenCalled();
  });

  it("scopes a TEACHER_ASSISTANT to their assisted groups", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER_ASSISTANT",
        memberships: [{ id: "m-assistant", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({
      homework: { lesson: { module: { course: { centerId: "center-1" } } } },
      grade: { not: null },
      student: {
        enrollments: { some: { group: { assistantMembershipId: "m-assistant" } } },
      },
    });
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1", assistantMembershipId: "m-assistant" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  it("scopes a STUDENT to their own membership and skips loading groups", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    const element = await Page();

    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({
      homework: { lesson: { module: { course: { centerId: "center-1" } } } },
      grade: { not: null },
      studentMembershipId: "m-student",
    });
    expect(whereOf(db.testAttempt.findMany)).toEqual({
      test: { material: { centerId: "center-1" } },
      studentMembershipId: "m-student",
    });
    expect(db.group.findMany).not.toHaveBeenCalled();
    expect(findElementByName(element, "GradebookManager")).toBeNull();
    expect(flatText(element)).toContain("Ваши оценки");
  });

  it("scopes a PARENT to their confirmed children", async () => {
    const db = makeDb();
    db.parentLink.findMany.mockResolvedValue([
      { studentMembershipId: "s-1" },
      { studentMembershipId: "s-2" },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-parent", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(db.parentLink.findMany).toHaveBeenCalledWith({
      where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({
      homework: { lesson: { module: { course: { centerId: "center-1" } } } },
      grade: { not: null },
      studentMembershipId: { in: ["s-1", "s-2"] },
    });
    expect(whereOf(db.testAttempt.findMany)).toEqual({
      test: { material: { centerId: "center-1" } },
      studentMembershipId: { in: ["s-1", "s-2"] },
    });
    expect(db.group.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty scope for a PARENT without a membership (no center-wide fallback)", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "PARENT", memberships: [] }));

    const Page = await loadPage();
    await Page();

    expect(db.parentLink.findMany).not.toHaveBeenCalled();
    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({ id: { in: [] } });
    expect(whereOf(db.testAttempt.findMany)).toEqual({ id: { in: [] } });
    expect(db.group.findMany).not.toHaveBeenCalled();
  });

  it("returns an empty scope for an unsupported center role", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "CENTER_SUPPORT",
        memberships: [{ id: "m-support", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(whereOf(db.homeworkSubmission.findMany)).toEqual({ id: { in: [] } });
    expect(whereOf(db.testAttempt.findMany)).toEqual({ id: { in: [] } });
    expect(db.group.findMany).not.toHaveBeenCalled();
  });

  it("treats a platform SUPERADMIN as staff even with a non-staff center role", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([{ id: "g-1", name: "A1" }]);
    setUp(
      db,
      session({
        activeCenterRole: "CENTER_SUPPORT",
        memberships: [{ id: "m-support", centerId: "center-1" }],
        user: { id: "u-1", preferredLanguage: "ru", platformRole: "SUPERADMIN" },
      }),
    );

    const Page = await loadPage();
    const element = await Page();

    expect(db.group.findMany).toHaveBeenCalled();
    const gradebook = findElementByName(element, "GradebookManager");
    expect(gradebook).not.toBeNull();
    expect(gradebook!.props.userRole).toBe("CENTER_SUPPORT");
  });

  it("renders empty tables and hides the gradebook / average badge without data", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await loadPage();
    const element = await Page();
    const text = flatText(element);

    // no gradebook because groups is empty
    expect(findElementByName(element, "GradebookManager")).toBeNull();
    // no average badge because totalGraded === 0
    expect(text).not.toContain("Средний балл");
    expect(text).toContain("Нет данных");
    expect(text).toContain("0 записей");
    expect(text).toContain("Все оценки учебного центра");
  });
});
