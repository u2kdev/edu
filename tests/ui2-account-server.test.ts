import { describe, it, expect, vi, beforeEach } from "vitest";
import { getSelectedParentChildIds } from "@/lib/parent-child";

const { redirectMock, getAuthSessionMock, cookiesGetMock, dbMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthSessionMock: vi.fn(),
  cookiesGetMock: vi.fn(),
  dbMock: {
    platformUser: { findUnique: vi.fn(), update: vi.fn() },
    learningCenter: { findUnique: vi.fn() },
    centerMembership: { findFirst: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/headers", () => ({
  cookies: () => ({ get: cookiesGetMock }),
}));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

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
  if (el.props !== undefined) return findElementByName(el.props.children, name);
  return null;
}

function makeUser() {
  return {
    id: "u-1",
    fullName: "Ivan Petrov",
    email: "ivan@x.uz",
    phone: "+998900000000",
    username: "ivan",
    avatarUrl: null,
    preferredLanguage: "ru",
    twoFactorEnabled: false,
    notificationPrefsJson: null,
    createdAt: new Date("2025-01-15T00:00:00.000Z"),
  };
}

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-1", centerId: "center-1" }],
    user: {
      id: "u-1",
      preferredLanguage: "ru",
      platformRole: "NONE",
      mustChangePassword: false,
    },
    ...overrides,
  };
}

describe("Unified /account page server loader, parent child IDOR guard & standalone account APIs", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    cookiesGetMock.mockReset();
    dbMock.platformUser.findUnique.mockReset();
    dbMock.learningCenter.findUnique.mockReset();
    dbMock.centerMembership.findFirst.mockReset();
    dbMock.platformUser.update.mockReset();
  });

  it("redirects /account to /login without session and renders across center and platform roles", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = (await import("@/app/account/page")).default;
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");

    dbMock.platformUser.findUnique.mockResolvedValue(makeUser());
    getAuthSessionMock.mockResolvedValue(
      makeSession({
        activeCenterId: null,
        activeCenterRole: undefined,
        user: {
          id: "u-1",
          preferredLanguage: "ru",
          platformRole: "SUPERADMIN",
          mustChangePassword: false,
        },
      }),
    );

    const el = await Page();
    const tabs = findElementByName(el, "AccountSettingsTabs");
    expect(tabs).not.toBeNull();
    expect((tabs!.props.profile as { role: string }).role).toBe("SUPERADMIN");
    expect((tabs!.props.centerSettings as { hasCenter: boolean }).hasCenter).toBe(false);
  });

  it("forwards student groups, parent children and null membership safely", async () => {
    dbMock.platformUser.findUnique.mockResolvedValue(makeUser());
    dbMock.learningCenter.findUnique.mockResolvedValue({
      smsEnabled: false,
      smsDailyLimit: 100,
      quietHoursStart: 21,
      quietHoursEnd: 8,
      defaultNotificationPrefsJson: null,
    });
    dbMock.centerMembership.findFirst.mockResolvedValue({
      id: "m-1",
      enrollments: [{ id: "e-1", status: "ACTIVE", group: { name: "A1" } }],
      parentLinksAsParent: [
        { id: "p-1", student: { user: { fullName: "Child One" } } },
      ],
    });
    getAuthSessionMock.mockResolvedValue(makeSession({ activeCenterRole: "PARENT" }));

    const Page = (await import("@/app/account/page")).default;
    const el = await Page();
    const tabs = findElementByName(el, "AccountSettingsTabs");
    expect(tabs!.props.studentEnrollments).toEqual([
      { id: "e-1", status: "ACTIVE", groupName: "A1" },
    ]);
    expect(tabs!.props.parentChildren).toEqual([{ id: "p-1", fullName: "Child One" }]);
  });

  it("getSelectedParentChildIds enforces confirmed children allow-list (anti-IDOR)", () => {
    cookiesGetMock.mockReturnValue({ value: "foreign-student-id" });
    expect(getSelectedParentChildIds(["child-1", "child-2"])).toEqual(["child-1", "child-2"]);

    cookiesGetMock.mockReturnValue({ value: "child-2" });
    expect(getSelectedParentChildIds(["child-1", "child-2"])).toEqual(["child-2"]);
  });

  it("allows platform user without center to read/update notification preferences + quietHours and blocks PLATFORM_SUPPORT", async () => {
    const { GET, PATCH } = await import("@/app/api/account/notification-preferences/route");

    getAuthSessionMock.mockResolvedValue(
      makeSession({
        activeCenterId: undefined,
        activeCenterRole: undefined,
        user: { id: "u-1", preferredLanguage: "ru", platformRole: "SUPERADMIN" },
      }),
    );
    dbMock.platformUser.findUnique.mockResolvedValue({
      id: "u-1",
      notificationPrefsJson: null,
    });

    const getRes = await GET(new Request("http://localhost/api/account/notification-preferences"));
    expect(getRes.status).toBe(200);
    const getBody = await getRes.json();
    expect(getBody.quietHours).toEqual({ enabled: true, start: 21, end: 8 });

    // Strict Zod rejects unexpected fields
    const badRes = await PATCH(
      new Request("http://localhost/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unknownField: 123 }),
      }),
    );
    expect(badRes.status).toBe(400);

    // Valid quietHours update succeeds
    dbMock.platformUser.update.mockResolvedValue({});
    const okRes = await PATCH(
      new Request("http://localhost/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quietHours: { enabled: true, start: 22, end: 7 } }),
      }),
    );
    expect(okRes.status).toBe(200);

    // PLATFORM_SUPPORT is read-only (403)
    getAuthSessionMock.mockResolvedValue(
      makeSession({
        activeCenterId: undefined,
        user: { id: "u-sup", preferredLanguage: "ru", platformRole: "PLATFORM_SUPPORT" },
      }),
    );
    const forbiddenRes = await PATCH(
      new Request("http://localhost/api/account/notification-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quietHours: { enabled: false, start: 22, end: 7 } }),
      }),
    );
    expect(forbiddenRes.status).toBe(403);
  });
});
