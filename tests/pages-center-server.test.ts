import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server-component pages for the center area are plain `async` functions, so they
 * can be exercised directly: mock the auth/tenant boundary, call the default export
 * and inspect the element it returns. No DOM / testing-library needed.
 *
 * Follows the exact pattern of tests/pages-center-schedule.test.ts:
 *  - `vi.hoisted` spies for redirect / getAuthSession / requireTenantPageAccess
 *  - fake tenant db returned by `requireTenantPageAccess().getTenantDb()`
 *  - `vi.resetModules()` + a fresh dynamic import before every page call so mocks
 *    and module state never leak between pages.
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
    group: { findMany: vi.fn().mockResolvedValue([]) },
    course: { findMany: vi.fn().mockResolvedValue([]) },
    inviteCode: { findMany: vi.fn().mockResolvedValue([]) },
    centerMembership: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn() },
    centerPayment: { findMany: vi.fn().mockResolvedValue([]) },
    supportTicket: { findMany: vi.fn().mockResolvedValue([]) },
    homework: { findMany: vi.fn().mockResolvedValue([]) },
    platformUser: { findUnique: vi.fn() },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
    branch: { findMany: vi.fn().mockResolvedValue([]) },
    announcement: { findMany: vi.fn().mockResolvedValue([]) },
    parentLink: { findMany: vi.fn().mockResolvedValue([]) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

type Db = ReturnType<typeof makeDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: {
      id: "u-1",
      preferredLanguage: "ru",
      platformRole: undefined as string | undefined,
    },
    ...overrides,
  };
}

/** Attach a fake tenant db + session and return the db for assertions. */
function setUp(db: Db, sess: unknown) {
  requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
  getAuthSessionMock.mockResolvedValue(sess);
}

/** Recursively flatten every rendered text node of an element tree. */
function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && (node as { props?: unknown }).props !== undefined) {
    return collectText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

/** Like collectText, but collapses the whitespace JSX interpolation introduces. */
function flatText(node: unknown): string {
  return collectText(node).replace(/\s+/g, " ").trim();
}

/** Find the first nested element whose component/type is named `name`. */
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

/**
 * Static dynamic-imports (one literal per page) so Vite can resolve the "@" alias
 * for every target — a variable path would not be analysed by the bundler.
 */
type PageName =
  | "staff"
  | "students"
  | "courses"
  | "invites"
  | "groups"
  | "payments"
  | "support"
  | "homework"
  | "profile"
  | "attendance"
  | "branches"
  | "announcements";

async function loadPage(name: PageName): Promise<() => Promise<unknown>> {
  switch (name) {
    case "staff":
      return (await import("@/app/center/staff/page")).default;
    case "students":
      return (await import("@/app/center/students/page")).default;
    case "courses":
      return (await import("@/app/center/courses/page")).default;
    case "invites":
      return (await import("@/app/center/invites/page")).default;
    case "groups":
      return (await import("@/app/center/groups/page")).default;
    case "payments":
      return (await import("@/app/center/payments/page")).default;
    case "support":
      return (await import("@/app/center/support/page")).default;
    case "homework":
      return (await import("@/app/center/homework/page")).default;
    case "profile":
      return (await import("@/app/center/profile/page")).default;
    case "attendance":
      return (await import("@/app/center/attendance/page")).default;
    case "branches":
      return (await import("@/app/center/branches/page")).default;
    case "announcements":
      return (await import("@/app/center/announcements/page")).default;
  }
}

beforeEach(() => {
  vi.resetModules();
  redirectMock.mockClear();
  getAuthSessionMock.mockReset();
  requireTenantPageAccessMock.mockReset();
});

// ---------------------------------------------------------------------------
// 1. /center/staff
// ---------------------------------------------------------------------------

describe("center/staff page", () => {
  const load = () => loadPage("staff");

  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center for roles without staff-management rights", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({ activeCenterRole: "TEACHER", user: { id: "u-1", preferredLanguage: "ru" } }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("renders StaffManager with role + locale for a DIRECTOR", async () => {
    getAuthSessionMock.mockResolvedValue(session());
    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("StaffManager");
    expect(element.props.currentRole).toBe("DIRECTOR");
    expect(element.props.locale).toBe("ru");
  });

  it("renders StaffManager for CENTER_ADMIN and passes the locale through", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({ activeCenterRole: "CENTER_ADMIN", user: { id: "u-1", preferredLanguage: "uz-Latn" } }),
    );
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.currentRole).toBe("CENTER_ADMIN");
    expect(element.props.locale).toBe("uz-Latn");
  });
});

// ---------------------------------------------------------------------------
// 2. /center/students
// ---------------------------------------------------------------------------

describe("center/students page", () => {
  const load = () => loadPage("students");

  it("redirects to /login when there is no session", async () => {
    const db = makeDb();
    setUp(db, null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterId: null, memberships: [] }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("loads the center groups and forwards them to StudentsManager", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([
      { id: "g-1", name: "A1" },
      { id: "g-2", name: "B2" },
    ]);
    setUp(db, session());

    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("StudentsManager");
    expect(element.props.initialGroups).toEqual([
      { id: "g-1", name: "A1" },
      { id: "g-2", name: "B2" },
    ]);
    expect(element.props.role).toBe("DIRECTOR");
    expect(element.props.locale).toBe("ru");
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  });

  it("falls back to ru locale and survives an empty group list", async () => {
    const db = makeDb();
    setUp(db, session({ user: { id: "u-1" } }));
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.initialGroups).toEqual([]);
    expect(element.props.locale).toBe("ru");
    expect(element.props.role).toBe("DIRECTOR");
  });
});

// ---------------------------------------------------------------------------
// 3. /center/courses
// ---------------------------------------------------------------------------

describe("center/courses page", () => {
  const load = () => loadPage("courses");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("passes courses (with modules/lessons/groups) to CourseManager", async () => {
    const db = makeDb();
    db.course.findMany.mockResolvedValue([
      {
        id: "c-1",
        title: "English",
        modules: [
          {
            id: "mod-1",
            title: "Basics",
            orderIndex: 0,
            lessons: [{ id: "l-1", title: "Intro" }],
          },
        ],
        groups: [
          {
            id: "g-1",
            name: "A1",
            teacher: { id: "t-1", user: { fullName: "Ivan", email: "i@x.uz" } },
            enrollments: [{ id: "e-1" }],
          },
        ],
      },
    ]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("CourseManager");
    const courses = element.props.initialCourses as Array<Record<string, unknown>>;
    expect(courses).toHaveLength(1);
    expect((courses[0].modules as Array<Record<string, unknown>>)[0]).toMatchObject({ id: "mod-1" });
    expect(
      ((courses[0].groups as Array<Record<string, unknown>>)[0].teacher as {
        user: { fullName: string };
      }).user.fullName,
    ).toBe("Ivan");
    expect(element.props.role).toBe("CENTER_ADMIN");
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
  });

  it("renders with an empty course list and default locale", async () => {
    const db = makeDb();
    setUp(db, session({ user: { id: "u-1" } }));
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.initialCourses).toEqual([]);
    expect(element.props.locale).toBe("ru");
  });
});

// ---------------------------------------------------------------------------
// 4. /center/invites
// ---------------------------------------------------------------------------

describe("center/invites page", () => {
  const load = () => loadPage("invites");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("loads invites, courses and groups for InvitesManager", async () => {
    const db = makeDb();
    db.inviteCode.findMany.mockResolvedValue([
      { id: "inv-1", code: "ABC123", course: { title: "English" }, group: { name: "A1" } },
    ]);
    db.course.findMany.mockResolvedValue([{ id: "c-1", title: "English" }]);
    db.group.findMany.mockResolvedValue([{ id: "g-1", name: "A1" }]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("InvitesManager");
    expect((element.props.initialInvites as unknown[])[0]).toMatchObject({ id: "inv-1", code: "ABC123" });
    expect(element.props.courses).toEqual([{ id: "c-1", title: "English" }]);
    expect(element.props.groups).toEqual([{ id: "g-1", name: "A1" }]);
    expect(element.props.role).toBe("CENTER_ADMIN");
    expect(db.inviteCode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { course: { centerId: "center-1" } },
      select: { id: true, name: true },
    });
  });

  it("handles empty invites/courses/groups", async () => {
    const db = makeDb();
    setUp(db, session());
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.initialInvites).toEqual([]);
    expect(element.props.courses).toEqual([]);
    expect(element.props.groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. /center/groups
// ---------------------------------------------------------------------------

describe("center/groups page", () => {
  const load = () => loadPage("groups");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("loads groups, courses and teachers for GroupsManager", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([
      {
        id: "g-1",
        name: "A1",
        course: { id: "c-1", title: "English" },
        teacher: { id: "t-1", user: { fullName: "Ivan", email: "i@x.uz" } },
        enrollments: [
          { id: "e-1", student: { id: "s-1", user: { fullName: "Anna", email: "a@x.uz" } } },
        ],
      },
    ]);
    db.course.findMany.mockResolvedValue([{ id: "c-1", title: "English" }]);
    db.centerMembership.findMany.mockResolvedValue([
      { id: "t-1", user: { fullName: "Ivan", email: "i@x.uz" } },
    ]);
    setUp(db, session({ user: { id: "u-1", preferredLanguage: "uz-Latn" } }));

    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("GroupsManager");
    expect((element.props.initialGroups as Array<Record<string, unknown>>)[0].id).toBe("g-1");
    expect(element.props.courses).toEqual([{ id: "c-1", title: "English" }]);
    expect(element.props.teachers).toEqual([
      { id: "t-1", user: { fullName: "Ivan", email: "i@x.uz" } },
    ]);
    expect(element.props.locale).toBe("uz-Latn");
    expect(db.centerMembership.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1", role: "TEACHER" },
      include: { user: { select: { fullName: true, email: true } } },
    });
  });

  it("does not crash with empty groups/courses/teachers", async () => {
    const db = makeDb();
    setUp(db, session());
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.initialGroups).toEqual([]);
    expect(element.props.teachers).toEqual([]);
    expect(element.props.locale).toBe("ru");
  });
});

// ---------------------------------------------------------------------------
// 6. /center/payments
// ---------------------------------------------------------------------------

describe("center/payments page", () => {
  const load = () => loadPage("payments");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("blocks a plain TEACHER from all-center payments", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("allows a TEACHER who is also platform staff", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
        user: { id: "u-1", preferredLanguage: "ru", platformRole: "SUPERADMIN" },
      }),
    );
    const Page = await load();
    await Page();
    expect(db.centerPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
  });

  it("scopes payments to their own membership for a STUDENT", async () => {
    const db = makeDb();
    db.centerPayment.findMany.mockResolvedValue([
      { id: "p-1", amount: 500000, student: { user: { fullName: "Anna", email: "a@x.uz" } }, group: { name: "A1" } },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(db.centerPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", studentMembershipId: "m-student" },
      }),
    );
    expect(db.centerMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", role: "STUDENT", id: "m-student" },
      }),
    );
    expect((element.props.initialPayments as unknown[])[0]).toMatchObject({ id: "p-1", amount: 500000 });
    expect(element.props.role).toBe("STUDENT");
  });

  it("scopes payments to confirmed children for a PARENT", async () => {
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
    const Page = await load();
    await Page();

    expect(db.parentLink.findMany).toHaveBeenCalledWith({
      where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    expect(db.centerPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", studentMembershipId: { in: ["s-1", "s-2"] } },
      }),
    );
    expect(db.centerMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", role: "STUDENT", id: { in: ["s-1", "s-2"] } },
      }),
    );
  });

  it("renders all payments for a DIRECTOR and forwards students/groups", async () => {
    const db = makeDb();
    db.centerPayment.findMany.mockResolvedValue([
      { id: "p-1", amount: 100, student: { user: { fullName: "Anna", email: "a@x.uz" } }, group: { name: "A1" } },
      { id: "p-2", amount: 200, student: { user: { fullName: "Bob", email: "b@x.uz" } }, group: null },
    ]);
    db.centerMembership.findMany.mockResolvedValue([{ id: "s-1", user: { fullName: "Anna", email: "a@x.uz" } }]);
    db.group.findMany.mockResolvedValue([{ id: "g-1", name: "A1" }]);
    setUp(db, session());

    const Page = await load();
    const element = (await Page()) as { type: { name: string }; props: Record<string, unknown> };

    expect(element.type.name).toBe("PaymentsManager");
    expect((element.props.initialPayments as unknown[]).length).toBe(2);
    expect(element.props.students).toEqual([{ id: "s-1", user: { fullName: "Anna", email: "a@x.uz" } }]);
    expect(element.props.groups).toEqual([{ id: "g-1", name: "A1" }]);
    expect(element.props.role).toBe("DIRECTOR");
  });

  it("does not crash when nothing is returned", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));
    const Page = await load();
    const element = (await Page()) as { props: Record<string, unknown> };

    expect(element.props.initialPayments).toEqual([]);
    expect(element.props.role).toBe("CENTER_ADMIN");
  });
});

// ---------------------------------------------------------------------------
// 7. /center/support
// ---------------------------------------------------------------------------

describe("center/support page", () => {
  const load = () => loadPage("support");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders the ticket list with subjects and messages", async () => {
    const db = makeDb();
    db.supportTicket.findMany.mockResolvedValue([
      {
        id: "t-1",
        scope: "CENTER",
        subject: "Broken login",
        status: "OPEN",
        messages: [
          { id: "msg-1", message: "Cannot sign in", createdAt: new Date("2026-04-01T10:00:00.000Z") },
        ],
      },
    ]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const text = collectText(element);

    expect(text).toContain("Broken login");
    expect(text).toContain("Cannot sign in");
    expect(text).toContain("CENTER");
    expect(db.supportTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { OR: [{ creatorUserId: "u-1" }, { centerId: "center-1" }] },
      }),
    );
  });

  it("redirects to /center when there is no active center", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterId: null, memberships: [] }));

    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
    expect(db.supportTicket.findMany).not.toHaveBeenCalled();
  });

  it("renders every ticket status through the catalog, including multi-word ones", async () => {
    const db = makeDb();
    db.supportTicket.findMany.mockResolvedValue([
      { id: "t-1", scope: "CENTER", subject: "A", status: "OPEN", messages: [] },
      { id: "t-2", scope: "CENTER", subject: "B", status: "IN_PROGRESS", messages: [] },
      { id: "t-3", scope: "CENTER", subject: "C", status: "RESOLVED", messages: [] },
      { id: "t-4", scope: "CENTER", subject: "D", status: "CLOSED", messages: [] },
    ]);
    setUp(db, session());

    const Page = await load();
    const text = collectText(await Page());

    expect(text).toContain("Открыт");
    expect(text).toContain("В работе");
    expect(text).toContain("Решён");
    expect(text).toContain("Закрыт");
    // No raw key such as `support.statusIn_progress` may leak into the UI.
    expect(text).not.toContain("support.status");
  });
});

// ---------------------------------------------------------------------------
// 8. /center/homework
// ---------------------------------------------------------------------------

describe("center/homework page", () => {
  const load = () => loadPage("homework");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("maps raw homework rows (materials, submissions, dates) into HomeworkManager", async () => {
    const db = makeDb();
    db.homework.findMany.mockResolvedValue([
      {
        id: "hw-1",
        lessonId: "l-1",
        title: "Essay",
        description: "Write it",
        dueDate: new Date("2026-05-01T00:00:00.000Z"),
        lesson: { title: "Intro" },
        materials: [{ id: "m-1", material: { id: "mat-1", title: "Guide", materialType: "PDF" } }],
        submissions: [
          {
            id: "sub-1",
            studentMembershipId: "sm-1",
            submissionText: "done",
            filesJson: null,
            status: "SUBMITTED",
            grade: null,
            feedback: null,
            submittedAt: new Date("2026-04-02T10:00:00.000Z"),
            student: { user: { fullName: "Anna", email: "a@x.uz" } },
          },
        ],
      },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "HomeworkManager");

    expect(manager).not.toBeNull();
    const homeworks = manager!.props.homeworks as Array<Record<string, unknown>>;
    expect(homeworks).toHaveLength(1);
    expect(homeworks[0]).toMatchObject({
      id: "hw-1",
      lessonTitle: "Intro",
      title: "Essay",
      dueDate: "2026-05-01T00:00:00.000Z",
    });
    expect(homeworks[0].materials).toEqual([{ id: "mat-1", title: "Guide", materialType: "PDF" }]);
    expect((homeworks[0].submissions as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "sub-1",
      studentName: "Anna",
      studentEmail: "a@x.uz",
      submittedAt: "2026-04-02T10:00:00.000Z",
    });
    expect(manager!.props.userRole).toBe("TEACHER");
    expect(manager!.props.userMembershipId).toBe("m-teacher");
    expect(manager!.props.locale).toBe("ru");
  });

  it("falls back to email when a student has no full name and handles empty homeworks", async () => {
    const db = makeDb();
    db.homework.findMany.mockResolvedValue([
      {
        id: "hw-2",
        lessonId: "l-2",
        title: "Quiz",
        description: null,
        dueDate: null,
        lesson: { title: "Unit 2" },
        materials: [],
        submissions: [
          {
            id: "sub-2",
            studentMembershipId: null as unknown as string,
            submissionText: "x",
            filesJson: "[]",
            status: "GRADED",
            grade: 5,
            feedback: "ok",
            submittedAt: new Date("2026-04-03T10:00:00.000Z"),
            student: { user: { fullName: "", email: "student@x.uz" } },
          },
        ],
      },
    ]);
    setUp(db, session({ memberships: [] }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "HomeworkManager");
    const homeworks = manager!.props.homeworks as Array<Record<string, unknown>>;

    expect(homeworks[0].dueDate).toBeNull();
    expect((homeworks[0].submissions as Array<Record<string, unknown>>)[0].studentName).toBe("student@x.uz");
    // no membership matched the active center
    expect(manager!.props.userMembershipId).toBeUndefined();
  });

  it("returns an empty scope for a STUDENT without a membership", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "STUDENT", memberships: [] }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "HomeworkManager");

    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } }),
    );
    expect(manager!.props.homeworks).toEqual([]);
    expect(manager!.props.userMembershipId).toBeUndefined();
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

    const Page = await load();
    await Page();

    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } }),
    );
  });

  it("scopes a STUDENT to the courses of their enrolled groups", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([
      { group: { courseId: "c-1" } },
      { group: { courseId: "c-1" } },
      { group: { courseId: "c-2" } },
    ]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    await Page();

    expect(db.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentMembershipId: "m-student" },
      select: { group: { select: { courseId: true } } },
    });
    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lesson: { module: { course: { centerId: "center-1", id: { in: ["c-1", "c-2"] } } } },
        },
      }),
    );
  });

  it("scopes a PARENT to their confirmed children's group courses", async () => {
    const db = makeDb();
    db.parentLink.findMany.mockResolvedValue([
      { studentMembershipId: "s-1" },
      { studentMembershipId: "s-2" },
    ]);
    db.enrollment.findMany.mockResolvedValue([{ group: { courseId: "c-9" } }]);
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-parent", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    await Page();

    expect(db.parentLink.findMany).toHaveBeenCalledWith({
      where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    expect(db.enrollment.findMany).toHaveBeenCalledWith({
      where: { studentMembershipId: { in: ["s-1", "s-2"] } },
      select: { group: { select: { courseId: true } } },
    });
    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lesson: { module: { course: { centerId: "center-1", id: { in: ["c-9"] } } } },
        },
      }),
    );
  });

  it("gives platform staff the center-wide homework scope", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "CENTER_SUPPORT",
        memberships: [{ id: "m-support", centerId: "center-1" }],
        user: { id: "u-1", preferredLanguage: "ru", platformRole: "SUPERADMIN" },
      }),
    );

    const Page = await load();
    await Page();

    expect(db.homework.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lesson: { module: { course: { centerId: "center-1" } } } },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 9. /center/profile
// ---------------------------------------------------------------------------

describe("center/profile page", () => {
  const load = () => loadPage("profile");

  function user() {
    return {
      id: "u-1",
      fullName: "Ivan Petrov",
      email: "ivan@x.uz",
      phone: "+998900000000",
      createdAt: new Date("2025-01-15T00:00:00.000Z"),
    };
  }

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("redirects to /login when the user record is missing", async () => {
    const db = makeDb();
    db.platformUser.findUnique.mockResolvedValue(null);
    setUp(db, session());
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders the base profile card for a staff member", async () => {
    const db = makeDb();
    db.platformUser.findUnique.mockResolvedValue(user());
    db.centerMembership.findFirst.mockResolvedValue({
      id: "m-1",
      center: { id: "center-1", name: "Center" },
      enrollments: [],
      parentLinksAsParent: [],
    });
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const text = collectText(await Page());

    expect(text).toContain("Ivan Petrov");
    expect(text).toContain("ivan@x.uz");
    expect(text).toContain("+998900000000");
    expect(text).toContain("CENTER_ADMIN");
    expect(db.platformUser.findUnique).toHaveBeenCalledWith({ where: { id: "u-1" } });
    expect(db.centerMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u-1", centerId: "center-1" } }),
    );
  });

  it("shows a student's groups and an empty-state fallback", async () => {
    const db = makeDb();
    db.platformUser.findUnique.mockResolvedValue(user());
    db.centerMembership.findFirst.mockResolvedValue({
      id: "m-1",
      center: { id: "center-1" },
      enrollments: [{ id: "e-1", status: "ACTIVE", group: { name: "A1" } }],
      parentLinksAsParent: [],
    });
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-1", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    const text = collectText(await Page());
    expect(text).toContain("A1");
    expect(text).toContain("ACTIVE");
    expect(text).toContain("Мои группы");
  });

  it("shows a parent's children", async () => {
    const db = makeDb();
    db.platformUser.findUnique.mockResolvedValue(user());
    db.centerMembership.findFirst.mockResolvedValue({
      id: "m-1",
      center: { id: "center-1" },
      enrollments: [],
      parentLinksAsParent: [
        { id: "p-1", status: "CONFIRMED", student: { user: { fullName: "Child One" } } },
      ],
    });
    setUp(
      db,
      session({
        activeCenterRole: "PARENT",
        memberships: [{ id: "m-1", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    const text = collectText(await Page());
    expect(text).toContain("Child One");
    expect(text).toContain("Мои дети");
  });

  it("does not crash when membership is null", async () => {
    const db = makeDb();
    db.platformUser.findUnique.mockResolvedValue(user());
    db.centerMembership.findFirst.mockResolvedValue(null);
    setUp(db, session({ activeCenterRole: "STUDENT" }));

    const Page = await load();
    const text = collectText(await Page());
    expect(text).toContain("Ivan Petrov");
  });
});

// ---------------------------------------------------------------------------
// 10. /center/attendance
// ---------------------------------------------------------------------------

describe("center/attendance page", () => {
  const load = () => loadPage("attendance");

  const staffGroup = {
    id: "g-1",
    name: "A1",
    course: {
      modules: [
        {
          lessons: [{ id: "l-1", title: "Intro", scheduledAt: new Date("2026-04-01T09:00:00.000Z") }],
        },
      ],
    },
    enrollments: [{ student: { id: "s-1", user: { fullName: "Anna", email: "a@x.uz" } } }],
  };

  const attendanceRow = {
    id: "att-1",
    status: "PRESENT",
    markedAt: new Date("2026-04-01T09:30:00.000Z"),
    lesson: { title: "Intro", scheduledAt: new Date("2026-04-01T09:00:00.000Z") },
    student: { id: "s-1", user: { fullName: "Anna", email: "a@x.uz" } },
  };

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("builds lessons/students maps for staff and renders AttendanceManager", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([staffGroup]);
    db.attendance.findMany.mockResolvedValue([attendanceRow]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "AttendanceManager");

    expect(manager).not.toBeNull();
    expect(manager!.props.groups).toEqual([{ id: "g-1", name: "A1" }]);
    expect(manager!.props.lessonsByGroup).toEqual({
      "g-1": [{ id: "l-1", title: "Intro", scheduledAt: "2026-04-01T09:00:00.000Z" }],
    });
    expect(manager!.props.studentsByGroup).toEqual({
      "g-1": [{ id: "s-1", fullName: "Anna", email: "a@x.uz" }],
    });
    expect(manager!.props.userRole).toBe("DIRECTOR");
    expect(db.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
  });

  it("scopes a TEACHER's groups and attendance to their own membership", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([]);
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    await Page();

    expect(db.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", teacherMembershipId: "m-teacher" },
      }),
    );
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lesson: { module: { course: { centerId: "center-1" } } },
          student: {
            enrollments: { some: { group: { teacherMembershipId: "m-teacher" } } },
          },
        },
      }),
    );
  });

  it("scopes a STUDENT's attendance to their own membership and skips group loading", async () => {
    const db = makeDb();
    db.attendance.findMany.mockResolvedValue([]);
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    const element = await Page();

    expect(db.group.findMany).not.toHaveBeenCalled();
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lesson: { module: { course: { centerId: "center-1" } } },
          studentMembershipId: "m-student",
        },
        take: 50,
      }),
    );
    expect(findElementByName(element, "AttendanceManager")).toBeNull();
    expect(collectText(element).length).toBeGreaterThan(0);
  });

  it("scopes a PARENT's attendance to confirmed children", async () => {
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

    const Page = await load();
    await Page();

    expect(db.parentLink.findMany).toHaveBeenCalledWith({
      where: { parentMembershipId: "m-parent", status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ studentMembershipId: { in: ["s-1", "s-2"] } }),
      }),
    );
  });

  it("returns an empty scope and no manager for an unsupported center role", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "CENTER_SUPPORT",
        memberships: [{ id: "m-support", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    const element = await Page();

    expect(db.group.findMany).not.toHaveBeenCalled();
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } }, take: 50 }),
    );
    expect(findElementByName(element, "AttendanceManager")).toBeNull();
  });

  it("returns an empty scope for a TEACHER without a membership", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "TEACHER", memberships: [] }));

    const Page = await load();
    await Page();

    expect(db.group.findMany).not.toHaveBeenCalled();
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } }),
    );
  });

  it("scopes a TEACHER_ASSISTANT's attendance to their assisted groups", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "TEACHER_ASSISTANT",
        memberships: [{ id: "m-assistant", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    await Page();

    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          lesson: { module: { course: { centerId: "center-1" } } },
          student: {
            enrollments: { some: { group: { assistantMembershipId: "m-assistant" } } },
          },
        },
      }),
    );
  });

  it("gives platform staff the center-wide attendance scope", async () => {
    const db = makeDb();
    db.group.findMany.mockResolvedValue([staffGroup]);
    setUp(
      db,
      session({
        activeCenterRole: "CENTER_SUPPORT",
        memberships: [{ id: "m-support", centerId: "center-1" }],
        user: { id: "u-1", preferredLanguage: "ru", platformRole: "SUPERADMIN" },
      }),
    );

    const Page = await load();
    await Page();

    expect(db.group.findMany).toHaveBeenCalled();
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lesson: { module: { course: { centerId: "center-1" } } } },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 11. /center/branches
// ---------------------------------------------------------------------------

describe("center/branches page", () => {
  const load = () => loadPage("branches");

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("redirects non-management roles to /center", async () => {
    setUp(makeDb(), session({ activeCenterRole: "TEACHER" }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("renders branch stats, contacts and per-branch group counts", async () => {
    const db = makeDb();
    db.branch.findMany.mockResolvedValue([
      {
        id: "b-1",
        name: "Main",
        isActive: true,
        address: "Tashkent",
        phone: "+998900000001",
        email: "main@x.uz",
        _count: { groups: 3 },
      },
      {
        id: "b-2",
        name: "Closed",
        isActive: false,
        address: null,
        phone: null,
        email: null,
        _count: { groups: 0 },
      },
    ]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const text = collectText(element);

    expect(text).toContain("Main");
    expect(text).toContain("Closed");
    expect(text).toContain("Tashkent");
    expect(text).toContain("main@x.uz");
    expect(text).toContain("Нет групп");
    expect(flatText(element)).toContain("1 активных · 1 неактивных");
    expect(db.branch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
  });

  it("renders the empty state when there are no branches", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const text = collectText(await Page());

    expect(text).toContain("Нет филиалов");
  });
});

// ---------------------------------------------------------------------------
// 12. /center/announcements
// ---------------------------------------------------------------------------

describe("center/announcements page", () => {
  const load = () => loadPage("announcements");

  const announcement = {
    id: "a-1",
    title: "Holiday",
    body: "Closed on Sunday",
    targetRole: "STUDENT",
    isPinned: true,
    publishAt: new Date("2026-04-01T08:00:00.000Z"),
    expiresAt: null,
    author: { user: { fullName: "Admin" } },
    group: { id: "g-1", name: "A1" },
  };

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when there is no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("renders all announcements for a DIRECTOR without role scoping", async () => {
    const db = makeDb();
    db.announcement.findMany.mockResolvedValue([announcement]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const text = collectText(element);
    const card = findElementByName(element, "AnnouncementCard");

    // The card is a nested component, so its text only exists in its props.
    expect(text).toContain("Закреплённые");
    expect(card).not.toBeNull();
    expect(card!.props.isPinned).toBe(true);
    const ann = card!.props.announcement as {
      title: string;
      body: string;
      group: { name: string };
      author: { user: { fullName: string } };
    };
    expect(ann.title).toBe("Holiday");
    expect(ann.body).toBe("Closed on Sunday");
    expect(ann.author.user.fullName).toBe("Admin");
    expect(ann.group.name).toBe("A1");
    expect(card!.props.locale).toBe("ru");
    expect((card!.props.roleLabels as Record<string, string>).STUDENT).toBe("Ученики");
    expect(db.announcement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ centerId: "center-1" }) }),
    );
    const where = db.announcement.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.AND).toBeUndefined();
  });

  it("adds a role filter for a STUDENT", async () => {
    const db = makeDb();
    setUp(
      db,
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await load();
    await Page();

    const where = db.announcement.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.AND).toEqual([{ OR: [{ targetRole: null }, { targetRole: "STUDENT" }] }]);
  });

  it("only keeps targetRole null for a non-center role", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "" }));

    const Page = await load();
    await Page();

    const where = db.announcement.findMany.mock.calls[0][0].where as Record<string, unknown>;
    expect(where.AND).toEqual([{ OR: [{ targetRole: null }] }]);
  });

  it("renders the empty state when there are no announcements", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "TEACHER" }));

    const Page = await load();
    const text = collectText(await Page());

    expect(text).toContain("Нет объявлений");
    expect(text).toContain("Нет актуальных объявлений");
  });
});
