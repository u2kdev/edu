import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server-component pages under `src/app/dashboard/**` (6 pages).
 *
 * Same harness pattern as tests/pages-center-server.test.ts:
 *  - `vi.hoisted` spies for redirect / getAuthSession / requireTenantPageAccess
 *  - a fake tenant db returned by `requireTenantPageAccess().getTenantDb()`
 *  - a fake platform db (mock of `@/lib/db`) for the SaaS overview page
 *  - `vi.resetModules()` + a fresh dynamic import before every page call
 *
 * Notes on the pages themselves:
 *  - `/dashboard` is only a router redirect (login / platform-admin / center).
 *  - `/dashboard/{courses,groups,invites,payments}` render an inline "pick a
 *    center" panel instead of redirecting when `activeCenterId` is missing.
 *  - `/dashboard/platform` (overview) uses the *platform* db, not the tenant db.
 */

const { redirectMock, getAuthSessionMock, requireTenantPageAccessMock, dbMock } = vi.hoisted(() => {
  const model = (...methods: string[]) => {
    const obj: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of methods) obj[method] = vi.fn();
    return obj;
  };
  return {
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    getAuthSessionMock: vi.fn(),
    requireTenantPageAccessMock: vi.fn(),
    dbMock: {
      learningCenter: model("count", "findMany", "findUnique"),
      subscriptionPlan: model("findMany"),
    },
  };
});

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTenantDb() {
  return {
    course: { findMany: vi.fn().mockResolvedValue([]) },
    group: { findMany: vi.fn().mockResolvedValue([]) },
    inviteCode: { findMany: vi.fn().mockResolvedValue([]) },
    centerMembership: { findMany: vi.fn().mockResolvedValue([]) },
    centerPayment: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

type TenantDb = ReturnType<typeof makeTenantDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: {
      id: "u-1",
      preferredLanguage: "ru",
      fullName: "Ivan Petrov",
      platformRole: "NONE" as string | undefined,
    },
    ...overrides,
  };
}

function setUp(db: TenantDb, sess: unknown) {
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

function flatText(node: unknown): string {
  return collectText(node).replace(/\s+/g, " ").trim();
}

/** Find the first nested element whose component type is named `name`. */
function findElementByName(
  node: unknown,
  name: string,
): { props: Record<string, unknown> } | null {
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

type PageName = "dashboard" | "courses" | "groups" | "invites" | "payments" | "platform";

async function loadPage(name: PageName): Promise<(...args: never[]) => unknown> {
  switch (name) {
    case "dashboard":
      return (await import("@/app/dashboard/page")).default;
    case "courses":
      return (await import("@/app/dashboard/courses/page")).default;
    case "groups":
      return (await import("@/app/dashboard/groups/page")).default;
    case "invites":
      return (await import("@/app/dashboard/invites/page")).default;
    case "payments":
      return (await import("@/app/dashboard/payments/page")).default;
    case "platform":
      return (await import("@/app/dashboard/platform/page")).default;
  }
}

beforeEach(() => {
  vi.resetModules();
  redirectMock.mockClear();
  getAuthSessionMock.mockReset();
  requireTenantPageAccessMock.mockReset();
  dbMock.learningCenter.count.mockReset();
  dbMock.learningCenter.findMany.mockReset().mockResolvedValue([]);
  dbMock.learningCenter.findUnique.mockReset();
  dbMock.subscriptionPlan.findMany.mockReset().mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// 1. /dashboard — legacy router
// ---------------------------------------------------------------------------

describe("dashboard/redirect page", () => {
  const load = () => loadPage("dashboard");

  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("sends platform staff without memberships to /platform-admin", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({
        memberships: [],
        user: { id: "u-1", platformRole: "SUPERADMIN", preferredLanguage: "ru", fullName: "Root" },
      }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/platform-admin");
  });

  it("sends a platform admin to /center when they still belong to a center", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({
        user: { id: "u-1", platformRole: "PLATFORM_ADMIN", preferredLanguage: "ru", fullName: "Admin" },
      }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("sends a plain center user to /center", async () => {
    getAuthSessionMock.mockResolvedValue(session());
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });
});

// ---------------------------------------------------------------------------
// 2. /dashboard/courses
// ---------------------------------------------------------------------------

describe("dashboard/courses page", () => {
  const load = () => loadPage("courses");

  it("redirects to /login when there is no session", async () => {
    setUp(makeTenantDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    // The auth guard must run *before* the tenant boundary; otherwise the
    // redirect is unreachable because requireTenantAccess throws instead.
    expect(requireTenantPageAccessMock).not.toHaveBeenCalled();
  });

  it("shows the select-center panel without querying courses when no center is active", async () => {
    const db = makeTenantDb();
    setUp(db, session({ activeCenterId: null }));

    const Page = await load();
    const element = await Page();

    expect(flatText(element)).toContain("Выберите или создайте учебный центр для управления курсами.");
    expect(db.course.findMany).not.toHaveBeenCalled();
  });

  it("loads courses with modules, lessons and groups and forwards role + locale", async () => {
    const db = makeTenantDb();
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
            teacher: { id: "t-1", user: { fullName: "Ivan" } },
            enrollments: [{ id: "e-1" }],
          },
        ],
      },
    ]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "CourseManager");

    expect(manager).not.toBeNull();
    const courses = manager!.props.initialCourses as Array<Record<string, unknown>>;
    expect(courses).toHaveLength(1);
    expect((courses[0].modules as Array<Record<string, unknown>>)[0]).toMatchObject({ id: "mod-1" });
    expect(
      ((courses[0].groups as Array<Record<string, unknown>>)[0].teacher as {
        user: { fullName: string };
      }).user.fullName,
    ).toBe("Ivan");
    expect(manager!.props.role).toBe("CENTER_ADMIN");
    expect(manager!.props.locale).toBe("ru");
    expect(db.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1" },
        orderBy: { createdAt: "desc" },
      }),
    );
  });

  it("renders with an empty list and a fallback locale", async () => {
    const db = makeTenantDb();
    setUp(db, session({ user: { id: "u-1", fullName: "Ivan" } }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "CourseManager");

    expect(manager!.props.initialCourses).toEqual([]);
    expect(manager!.props.locale).toBe("ru");
  });
});

// ---------------------------------------------------------------------------
// 3. /dashboard/groups
// ---------------------------------------------------------------------------

describe("dashboard/groups page", () => {
  const load = () => loadPage("groups");

  it("redirects to /login when there is no session", async () => {
    setUp(makeTenantDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    // The auth guard must run *before* the tenant boundary; otherwise the
    // redirect is unreachable because requireTenantAccess throws instead.
    expect(requireTenantPageAccessMock).not.toHaveBeenCalled();
  });

  it("shows the select-center panel when no center is active", async () => {
    const db = makeTenantDb();
    setUp(db, session({ activeCenterId: null }));

    const Page = await load();
    const element = await Page();

    expect(flatText(element)).toContain("Выберите учебный центр для управления группами.");
    expect(db.group.findMany).not.toHaveBeenCalled();
  });

  it("loads groups, courses and teachers for GroupsManager", async () => {
    const db = makeTenantDb();
    db.group.findMany.mockResolvedValue([
      {
        id: "g-1",
        name: "A1",
        course: { title: "English" },
        teacher: { id: "t-1", user: { fullName: "Ivan" } },
        enrollments: [
          { student: { user: { fullName: "Anna", email: "a@x.uz", phone: "+998" } } },
        ],
      },
    ]);
    db.course.findMany.mockResolvedValue([{ id: "c-1", title: "English" }]);
    db.centerMembership.findMany.mockResolvedValue([{ id: "t-1", user: { fullName: "Ivan" } }]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "GroupsManager");

    expect(manager).not.toBeNull();
    expect((manager!.props.initialGroups as Array<Record<string, unknown>>)[0].id).toBe("g-1");
    expect(manager!.props.courses).toEqual([{ id: "c-1", title: "English" }]);
    expect(manager!.props.teachers).toEqual([{ id: "t-1", user: { fullName: "Ivan" } }]);
    expect(manager!.props.role).toBe("DIRECTOR");
    expect(db.group.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { course: { centerId: "center-1" } } }),
    );
    expect(db.centerMembership.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1", role: "TEACHER" },
      include: { user: { select: { fullName: true } } },
    });
  });

  it("survives empty groups/courses/teachers", async () => {
    const db = makeTenantDb();
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "GroupsManager");

    expect(manager!.props.initialGroups).toEqual([]);
    expect(manager!.props.courses).toEqual([]);
    expect(manager!.props.teachers).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 4. /dashboard/invites
// ---------------------------------------------------------------------------

describe("dashboard/invites page", () => {
  const load = () => loadPage("invites");

  it("redirects to /login when there is no session", async () => {
    setUp(makeTenantDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    // The auth guard must run *before* the tenant boundary; otherwise the
    // redirect is unreachable because requireTenantAccess throws instead.
    expect(requireTenantPageAccessMock).not.toHaveBeenCalled();
  });

  it("shows the select-center panel when no center is active", async () => {
    const db = makeTenantDb();
    setUp(db, session({ activeCenterId: null }));

    const Page = await load();
    const element = await Page();

    expect(flatText(element)).toContain("Выберите учебный центр для управления инвайтами.");
    expect(db.inviteCode.findMany).not.toHaveBeenCalled();
  });

  it("loads invite codes, courses and groups for InvitesManager", async () => {
    const db = makeTenantDb();
    db.inviteCode.findMany.mockResolvedValue([
      { id: "inv-1", code: "ABC123", course: { title: "English" }, group: { name: "A1" } },
    ]);
    db.course.findMany.mockResolvedValue([{ id: "c-1", title: "English" }]);
    db.group.findMany.mockResolvedValue([{ id: "g-1", name: "A1", courseId: "c-1" }]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "InvitesManager");

    expect(manager).not.toBeNull();
    expect((manager!.props.initialInvites as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "inv-1",
      code: "ABC123",
    });
    expect(manager!.props.courses).toEqual([{ id: "c-1", title: "English" }]);
    expect(manager!.props.groups).toEqual([{ id: "g-1", name: "A1", courseId: "c-1" }]);
    expect(manager!.props.role).toBe("CENTER_ADMIN");
    expect(db.inviteCode.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(db.group.findMany).toHaveBeenCalledWith({
      where: { course: { centerId: "center-1" } },
      select: { id: true, name: true, courseId: true },
    });
  });

  it("handles empty invites/courses/groups", async () => {
    const db = makeTenantDb();
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "InvitesManager");

    expect(manager!.props.initialInvites).toEqual([]);
    expect(manager!.props.courses).toEqual([]);
    expect(manager!.props.groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 5. /dashboard/payments
// ---------------------------------------------------------------------------

describe("dashboard/payments page", () => {
  const load = () => loadPage("payments");

  it("redirects to /login when there is no session", async () => {
    setUp(makeTenantDb(), null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    // The auth guard must run *before* the tenant boundary; otherwise the
    // redirect is unreachable because requireTenantAccess throws instead.
    expect(requireTenantPageAccessMock).not.toHaveBeenCalled();
  });

  it("shows the select-center panel when no center is active", async () => {
    const db = makeTenantDb();
    setUp(db, session({ activeCenterId: null }));

    const Page = await load();
    const element = await Page();

    expect(flatText(element)).toContain("Выберите учебный центр для управления платежами.");
    expect(db.centerPayment.findMany).not.toHaveBeenCalled();
  });

  it("loads payments and students for PaymentsManager", async () => {
    const db = makeTenantDb();
    db.centerPayment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 100,
        student: { user: { fullName: "Anna", email: "a@x.uz" } },
        group: { name: "A1", course: { title: "English" } },
      },
    ]);
    db.centerMembership.findMany.mockResolvedValue([{ id: "s-1", user: { fullName: "Anna" } }]);
    setUp(db, session());

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "PaymentsManager");

    expect(manager).not.toBeNull();
    expect((manager!.props.initialPayments as Array<Record<string, unknown>>)[0]).toMatchObject({
      id: "p-1",
      amount: 100,
    });
    expect(manager!.props.students).toEqual([{ id: "s-1", user: { fullName: "Anna" } }]);
    expect(manager!.props.role).toBe("DIRECTOR");
    expect(db.centerPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1" } }),
    );
    expect(db.centerMembership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { centerId: "center-1", role: "STUDENT" } }),
    );
  });

  it("does not crash when nothing is returned", async () => {
    const db = makeTenantDb();
    setUp(db, session({ activeCenterRole: "STUDENT" }));

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "PaymentsManager");

    expect(manager!.props.initialPayments).toEqual([]);
    expect(manager!.props.students).toEqual([]);
    expect(manager!.props.role).toBe("STUDENT");
  });
});

// ---------------------------------------------------------------------------
// 6. /dashboard/platform (SaaS overview)
// ---------------------------------------------------------------------------

describe("dashboard/platform overview page", () => {
  const load = () => loadPage("platform");

  const centerRow = (id: string, status: string) => ({
    id,
    name: `Center ${id}`,
    slug: `center-${id}`,
    status,
    owner: { fullName: "Owner", email: "owner@x.uz" },
    subscriptions: [{ plan: { name: "Pro" } }],
    memberships: [{ id: "m-1" }, { id: "m-2" }],
  });

  it("redirects to /dashboard when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("redirects to /dashboard when the platform role is NONE", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({ user: { id: "u-1", platformRole: "NONE", preferredLanguage: "ru", fullName: "X" } }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/dashboard");
  });

  it("renders centers, plans and computed metrics for platform staff", async () => {
    dbMock.learningCenter.findMany.mockResolvedValue([
      centerRow("a", "ACTIVE"),
      centerRow("b", "ACTIVE"),
      centerRow("c", "PAUSED"),
    ]);
    dbMock.subscriptionPlan.findMany.mockResolvedValue([{ id: "plan-1", name: "Basic" }]);
    getAuthSessionMock.mockResolvedValue(
      session({
        memberships: [],
        user: { id: "u-1", platformRole: "SUPERADMIN", preferredLanguage: "ru", fullName: "Root" },
      }),
    );

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "PlatformAdminManager");

    expect(manager).not.toBeNull();
    expect((manager!.props.initialCenters as unknown[]).length).toBe(3);
    expect(manager!.props.plans).toEqual([{ id: "plan-1", name: "Basic" }]);
    expect(manager!.props.metrics).toEqual({ totalCenters: 3, activeCenters: 2, pausedCenters: 1 });
    expect(dbMock.learningCenter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
    expect(dbMock.subscriptionPlan.findMany).toHaveBeenCalledWith({
      orderBy: { priceMonthly: "asc" },
    });
  });

  it("computes zero metrics when there are no centers", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({
        memberships: [],
        user: { id: "u-1", platformRole: "FULL_ACCESS", preferredLanguage: "ru", fullName: "Root" },
      }),
    );

    const Page = await load();
    const element = await Page();
    const manager = findElementByName(element, "PlatformAdminManager");

    expect(manager!.props.metrics).toEqual({ totalCenters: 0, activeCenters: 0, pausedCenters: 0 });
    expect(manager!.props.plans).toEqual([]);
  });
});
