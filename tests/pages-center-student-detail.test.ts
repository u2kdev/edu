import { describe, it, expect, vi, beforeEach } from "vitest";
import { t } from "@/i18n";

/**
 * `src/app/center/students/[id]/page.tsx` — dynamic server component.
 * Invoked via `Page({ params: { id } })` exactly like Next.js would.
 */

const { redirectMock, notFoundMock, getAuthSessionMock, requireTenantPageAccessMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    getAuthSessionMock: vi.fn(),
    requireTenantPageAccessMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    centerMembership: { findFirst: vi.fn().mockResolvedValue(null) },
    parentLink: { findFirst: vi.fn().mockResolvedValue(null) },
    enrollment: { findFirst: vi.fn().mockResolvedValue(null) },
    attendance: { findMany: vi.fn().mockResolvedValue([]) },
    grade: { findMany: vi.fn().mockResolvedValue([]) },
    auditLog: { findMany: vi.fn().mockResolvedValue([]) },
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

function setUp(db: Db, sess: unknown, ctx: Record<string, unknown> = {}) {
  requireTenantPageAccessMock.mockResolvedValue({
    center: { id: "center-1", name: "Center" },
    membership: { id: "m-director" },
    isPlatformStaff: false,
    getTenantDb: () => db,
    ...ctx,
  });
  getAuthSessionMock.mockResolvedValue(sess);
}

async function loadPage() {
  return (await import("@/app/center/students/[id]/page")).default;
}

function callPage(Page: (args: { params: { id: string } }) => Promise<unknown>, id = "sm-1") {
  return Page({ params: { id } });
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

function student(overrides: Record<string, unknown> = {}) {
  return {
    id: "sm-1",
    status: "ACTIVE",
    joinedAt: new Date("2025-01-15T00:00:00.000Z"),
    user: { fullName: "Anna Smith", email: "anna@x.uz", phone: "+998900000000" },
    enrollments: [],
    parentLinksAsStudent: [],
    payments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------

describe("StudentProfilePage (server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    notFoundMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center/students when the student cannot be found", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(null);
    setUp(db, session());
    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/center/students");
  });

  it("renders a full profile for a DIRECTOR and forwards the right queries", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(
      student({
        enrollments: [
          {
            id: "e-1",
            status: "ACTIVE",
            group: {
              name: "A1",
              course: { title: "English" },
              teacher: { user: { fullName: "Ivan" } },
            },
          },
          {
            id: "e-2",
            status: "ARCHIVED",
            group: { name: "B1", course: { title: "Math" }, teacher: null },
          },
        ],
        parentLinksAsStudent: [
          {
            id: "pl-1",
            parent: { user: { fullName: "Parent One", email: "p@x.uz", phone: "+998111111111" } },
          },
        ],
        payments: [
          {
            id: "pay-1",
            amount: 100000,
            currency: "UZS",
            paymentMethod: "CASH",
            status: "PAID",
            createdAt: new Date("2026-04-01T00:00:00.000Z"),
          },
          {
            id: "pay-2",
            amount: 50000,
            currency: "UZS",
            paymentMethod: "CARD",
            status: "PENDING",
            createdAt: new Date("2026-04-02T00:00:00.000Z"),
          },
        ],
      }),
    );
    db.attendance.findMany.mockResolvedValue([
      { id: "a-1", status: "PRESENT", markedAt: new Date("2026-04-01T09:00:00.000Z"), lesson: { title: "L1", scheduledAt: new Date() } },
      { id: "a-2", status: "LATE", markedAt: new Date("2026-04-02T09:00:00.000Z"), lesson: { title: "L2", scheduledAt: new Date() } },
      { id: "a-3", status: "ABSENT", markedAt: new Date("2026-04-03T09:00:00.000Z"), lesson: { title: "L3", scheduledAt: new Date() } },
    ]);
    db.grade.findMany.mockResolvedValue([
      {
        id: "g-1",
        value: 90,
        maxValue: 100,
        createdAt: new Date("2026-04-01T00:00:00.000Z"),
        lesson: { title: "L1" },
        teacher: { user: { fullName: "Ivan" } },
      },
      {
        id: "g-2",
        value: 5,
        maxValue: 10,
        createdAt: new Date("2026-04-02T00:00:00.000Z"),
        lesson: null,
        teacher: null,
      },
    ]);
    db.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: "STUDENT_TRANSFER",
        detailsJson: JSON.stringify({ fromGroupName: "A1", toGroupName: "B1", reason: "moved" }),
        createdAt: new Date("2026-04-05T10:00:00.000Z"),
      },
      { id: "log-2", action: "STUDENT_ENROLL", detailsJson: "{bad json", createdAt: new Date("2026-04-06T10:00:00.000Z") },
    ]);
    setUp(db, session());

    const Page = await loadPage();
    const element = await callPage(Page);
    const text = flatText(element);

    // Query shape
    expect(db.centerMembership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sm-1", centerId: "center-1", role: "STUDENT" },
        include: expect.objectContaining({
          user: true,
          enrollments: expect.objectContaining({ orderBy: { enrolledAt: "desc" } }),
          parentLinksAsStudent: expect.objectContaining({ where: { status: "CONFIRMED" } }),
          payments: expect.objectContaining({ take: 30 }),
        }),
      }),
    );
    expect(db.attendance.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentMembershipId: "sm-1" }, take: 30 }),
    );
    expect(db.grade.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { studentMembershipId: "sm-1" }, take: 30 }),
    );
    expect(db.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", resource: "Student", resourceId: "sm-1" },
        take: 20,
      }),
    );

    // Header
    expect(text).toContain("Anna Smith");
    expect(text).toContain("anna@x.uz");
    expect(text).toContain("+998900000000");
    expect(text).toContain(t("ru", "students.statusActive"));

    // Groups + teacher label + raw enrollment status
    expect(text).toContain("A1");
    expect(text).toContain("English");
    expect(text).toContain("Учитель: Ivan");
    expect(text).toContain("ACTIVE");
    expect(text).toContain("ARCHIVED");
    expect(text).toContain("B1");

    // Parents
    expect(text).toContain("Parent One");
    expect(text).toContain("p@x.uz");
    expect(text).toContain("+998111111111");
    expect(text).toContain(t("ru", "common.yes"));

    // Attendance + grades + payments
    expect(text).toContain("PRESENT");
    expect(text).toContain("LATE");
    expect(text).toContain("ABSENT");
    expect(text).toContain("90 / 100");
    expect(text).toContain("5 / 10");
    expect(text).toContain("UZS");
    expect(text).toContain("PAID");
    expect(text).toContain("PENDING");
    expect(text).toContain("CASH");

    // Audit history: valid JSON parsed, invalid JSON swallowed
    expect(text).toContain("STUDENT_TRANSFER");
    expect(text).toContain("Из «A1» в «B1»");
    expect(text).toContain("Причина: moved");
    expect(text).toContain("STUDENT_ENROLL");
  });

  it("falls back to the lesson fallback title and hides optional phone", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(
      student({ user: { fullName: "NoPhone", email: "np@x.uz", phone: null } }),
    );
    db.grade.findMany.mockResolvedValue([
      { id: "g-1", value: 1, maxValue: 2, createdAt: new Date(), lesson: null, teacher: null },
    ]);
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await loadPage();
    const text = flatText(await callPage(Page));

    expect(text).toContain(t("ru", "students.lessonFallback"));
    expect(text).toContain(t("ru", "students.noGroups"));
    expect(text).toContain(t("ru", "students.noParents"));
    expect(text).toContain(t("ru", "students.noPayments"));
    expect(text).toContain(t("ru", "students.noHistory"));
  });

  it("shows the archived status label for a non-active student", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student({ status: "ARCHIVED" }));
    setUp(db, session());

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain(t("ru", "students.statusArchived"));
  });

  // --- STUDENT -------------------------------------------------------------

  it("lets a STUDENT view their own profile", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(
      db,
      session({ activeCenterRole: "STUDENT", memberships: [{ id: "sm-1", centerId: "center-1" }] }),
      { membership: { id: "sm-1" } },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  it("blocks a STUDENT from another student's profile", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(
      db,
      session({ activeCenterRole: "STUDENT", memberships: [{ id: "m-other", centerId: "center-1" }] }),
      { membership: { id: "m-other" } },
    );

    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("lets platform staff STUDENT bypass the ownership check", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(
      db,
      session({ activeCenterRole: "STUDENT", memberships: [{ id: "m-other", centerId: "center-1" }] }),
      { membership: { id: "m-other" }, isPlatformStaff: true },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  // --- PARENT --------------------------------------------------------------

  it("lets a PARENT view a confirmed child", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.parentLink.findFirst.mockResolvedValue({ id: "pl-1" });
    setUp(
      db,
      session({ activeCenterRole: "PARENT", memberships: [{ id: "m-parent", centerId: "center-1" }] }),
      { membership: { id: "m-parent" } },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
    expect(db.parentLink.findFirst).toHaveBeenCalledWith({
      where: {
        parentMembershipId: "m-parent",
        studentMembershipId: "sm-1",
        status: "CONFIRMED",
      },
    });
  });

  it("blocks a PARENT without a confirmed link", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.parentLink.findFirst.mockResolvedValue(null);
    setUp(
      db,
      session({ activeCenterRole: "PARENT", memberships: [{ id: "m-parent", centerId: "center-1" }] }),
      { membership: { id: "m-parent" } },
    );

    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("lets platform staff PARENT bypass the link check", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.parentLink.findFirst.mockResolvedValue(null);
    setUp(
      db,
      session({ activeCenterRole: "PARENT", memberships: [{ id: "m-parent", centerId: "center-1" }] }),
      { membership: { id: "m-parent" }, isPlatformStaff: true },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  // --- TEACHER -------------------------------------------------------------

  it("lets a TEACHER view a student of their own group", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.enrollment.findFirst.mockResolvedValue({ id: "e-1" });
    setUp(
      db,
      session({ activeCenterRole: "TEACHER", memberships: [{ id: "m-teacher", centerId: "center-1" }] }),
      { membership: { id: "m-teacher" } },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
    expect(db.enrollment.findFirst).toHaveBeenCalledWith({
      where: {
        studentMembershipId: "sm-1",
        group: { teacherMembershipId: "m-teacher" },
      },
    });
  });

  it("blocks a TEACHER whose group does not contain the student", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.enrollment.findFirst.mockResolvedValue(null);
    setUp(
      db,
      session({ activeCenterRole: "TEACHER", memberships: [{ id: "m-teacher", centerId: "center-1" }] }),
      { membership: { id: "m-teacher" } },
    );

    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("lets platform staff TEACHER bypass the enrollment check", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    db.enrollment.findFirst.mockResolvedValue(null);
    setUp(
      db,
      session({ activeCenterRole: "TEACHER", memberships: [{ id: "m-teacher", centerId: "center-1" }] }),
      { membership: { id: "m-teacher" }, isPlatformStaff: true },
    );

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  // --- other roles ---------------------------------------------------------

  it("blocks a non-management center role", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(db, session({ activeCenterRole: "CENTER_SUPPORT" }));

    const Page = await loadPage();
    await expect(callPage(Page)).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("lets platform staff with an unexpected role through", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(db, session({ activeCenterRole: "CENTER_SUPPORT" }), { isPlatformStaff: true });

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  it("lets a CENTER_ADMIN view any student", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Anna Smith");
  });

  it("defaults the locale to ru when the user has no preferred language", async () => {
    const db = makeDb();
    db.centerMembership.findFirst.mockResolvedValue(student());
    setUp(db, session({ user: { id: "u-1" } }));

    const Page = await loadPage();
    const text = flatText(await callPage(Page));
    expect(text).toContain("Назад");
  });
});
