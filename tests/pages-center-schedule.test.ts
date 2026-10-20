import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Server-component pages are plain `async` functions, so they can be exercised
 * directly: mock the auth/tenant boundary, call the default export and inspect
 * the element it returns. This keeps the test dependency-free (no DOM needed)
 * while still running every line of the page's own logic.
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

function makeDb() {
  return {
    scheduleSlot: { findMany: vi.fn().mockResolvedValue([]) },
    lesson: { findMany: vi.fn().mockResolvedValue([]) },
    group: { findMany: vi.fn().mockResolvedValue([]) },
    centerMembership: { findMany: vi.fn().mockResolvedValue([]) },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
    parentLink: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: { preferredLanguage: "ru" },
    ...overrides,
  };
}

async function loadPage() {
  const mod = await import("@/app/center/schedule/page");
  return mod.default;
}

describe("CenterSchedulePage (server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    const db = makeDb();
    requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
    getAuthSessionMock.mockResolvedValue(null);

    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when the session has no active center", async () => {
    const db = makeDb();
    requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
    getAuthSessionMock.mockResolvedValue(session({ activeCenterId: null }));

    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("maps slots, upcoming lessons, groups and teachers for a director", async () => {
    const db = makeDb();
    db.scheduleSlot.findMany.mockResolvedValue([
      {
        id: "slot-1",
        groupId: "g-1",
        teacherMembershipId: "t-1",
        branchId: "b-1",
        subjectId: "s-1",
        roomName: "101",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:30",
        status: "ACTIVE",
        cancelledReason: null,
        group: { id: "g-1", name: "A1", course: { title: "English" }, subject: { name: "Grammar", color: "#fff" } },
        teacher: { id: "t-1", user: { fullName: "Ivan", email: "i@x.uz" } },
        branch: { id: "b-1", name: "Main" },
      },
    ]);
    db.lesson.findMany.mockResolvedValue([
      {
        id: "l-1",
        title: "Trial",
        lessonType: "ONLINE",
        status: "ACTIVE",
        scheduledAt: new Date("2026-04-01T09:00:00.000Z"),
        durationMinutes: 60,
        onlineMeetingUrl: "https://meet",
        location: null,
        cancelledReason: null,
        module: { course: { title: "English" } },
        substituteTeacher: { id: "t-2", user: { fullName: "Petr" } },
      },
    ]);
    db.group.findMany.mockResolvedValue([{ id: "g-1", name: "A1" }]);
    db.centerMembership.findMany.mockResolvedValue([{ id: "t-1", user: { fullName: "Ivan" } }]);

    requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
    getAuthSessionMock.mockResolvedValue(session());

    const Page = await loadPage();
    const element = await Page();

    expect(element.props.initialSlots).toHaveLength(1);
    expect(element.props.initialSlots[0]).toMatchObject({
      id: "slot-1",
      group: { id: "g-1", name: "A1", course: { title: "English" } },
      branch: { id: "b-1", name: "Main" },
    });
    expect(element.props.upcomingLessons[0]).toMatchObject({
      id: "l-1",
      scheduledAt: "2026-04-01T09:00:00.000Z",
      substituteTeacher: { id: "t-2" },
    });
    expect(element.props.groups).toEqual([{ id: "g-1", name: "A1" }]);
    expect(element.props.teachers).toEqual([{ id: "t-1", user: { fullName: "Ivan" } }]);
    expect(element.props.userRole).toBe("DIRECTOR");
    expect(element.props.locale).toBe("ru");
  });

  it("scopes a teacher's schedule to their own membership", async () => {
    const db = makeDb();
    requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
    getAuthSessionMock.mockResolvedValue(
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-teacher", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(db.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ teacherMembershipId: "m-teacher" }),
      }),
    );
  });

  it("scopes a student's schedule to their active enrollments", async () => {
    const db = makeDb();
    db.enrollment.findMany.mockResolvedValue([{ groupId: "g-9" }]);
    requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
    getAuthSessionMock.mockResolvedValue(
      session({
        activeCenterRole: "STUDENT",
        memberships: [{ id: "m-student", centerId: "center-1" }],
      }),
    );

    const Page = await loadPage();
    await Page();

    expect(db.scheduleSlot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ groupId: { in: ["g-9"] } }) }),
    );
  });
});
