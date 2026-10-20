// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { t } from "@/i18n";
import RootLayout, { metadata } from "@/app/layout";
import CenterLayout from "@/app/center/layout";
import PlatformAdminLayout from "@/app/platform-admin/layout";
import DeveloperLayout from "@/app/developer/layout";

/**
 * Application layouts.
 *
 * `src/app/layout.tsx` is pure markup and is rendered normally. The three
 * section layouts (`center`, `platform-admin`, `developer`) are `async` server
 * components that read the session first, so they are invoked directly with the
 * auth/tenant boundary mocked (same technique as tests/pages-center-server.test.ts)
 * and their returned element tree is inspected through `props`.
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
      findUnique: vi.fn().mockResolvedValue({ id: "center-1", name: "Bright Center", logoUrl: null }),
    },
    notification: { count: vi.fn().mockResolvedValue(0) },
  };
}

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-1", centerId: "center-1" }],
    user: {
      id: "u-1",
      preferredLanguage: "ru",
      fullName: "Ivan Petrov",
      email: "ivan@x.uz",
      platformRole: "NONE" as string | undefined,
    },
    ...overrides,
  };
}

function setUp(sess: unknown, db = makeDb()) {
  requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
  getAuthSessionMock.mockResolvedValue(sess);
  return db;
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
  if (typeof type === "string" && type === name) {
    return el as { props: Record<string, unknown> };
  }
  if (el.props !== undefined) return findElementByName(el.props.children, name);
  return null;
}

function collectPropValues(node: unknown, prop: string, out: unknown[] = []): unknown[] {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectPropValues(child, prop, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props !== undefined) {
    if (prop in el.props) out.push(el.props[prop]);
    collectPropValues(el.props.children, prop, out);
  }
  return out;
}

function callLayout(Page: unknown, children: unknown = "PAGE_CONTENT") {
  return (Page as (props: { children: unknown }) => unknown)({ children }) as Promise<unknown>;
}

beforeEach(() => {
  redirectMock.mockClear();
  getAuthSessionMock.mockReset();
  requireTenantPageAccessMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. src/app/layout.tsx (root, pure markup)
// ---------------------------------------------------------------------------

describe("root layout", () => {
  it("exposes the page metadata", () => {
    expect(metadata.title).toContain("e-darischi");
    expect(String(metadata.description)).toContain("Закрытая образовательная экосистема");
  });

  it("renders the html shell with fonts, lang and body classes", () => {
    const element = RootLayout({ children: "CHILD" }) as {
      type: string;
      props: Record<string, unknown>;
    };

    expect(element.type).toBe("html");
    expect(element.props.lang).toBe("ru");
    const hrefs = collectPropValues(element, "href");
    expect(hrefs).toContain("https://fonts.googleapis.com");
    expect(hrefs).toContain("https://fonts.gstatic.com");
    expect(hrefs.some((h) => String(h).includes("fonts.googleapis.com/css2"))).toBe(true);

    const body = findElementByName(element, "body");
    expect(body).not.toBeNull();
    expect(String((body!.props as { className?: string }).className)).toContain("bg-slate-50");
    expect(collectText(element)).toContain("CHILD");
  });

  it("passes children through when rendered", () => {
    render(
      <RootLayout>
        <span data-testid="child">HELLO ROOT</span>
      </RootLayout>,
    );
    expect(screen.getByText("HELLO ROOT")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 2. src/app/platform-admin/layout.tsx
// ---------------------------------------------------------------------------

describe("platform-admin layout", () => {
  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    await expect(callLayout(PlatformAdminLayout)).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it.each(["NONE", "DIRECTOR", "DEVELOPER"])(
    "redirects platform role %s to /center",
    async (role) => {
      getAuthSessionMock.mockResolvedValue(
        session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", email: "x@x.uz", platformRole: role } }),
      );
      await expect(callLayout(PlatformAdminLayout)).rejects.toThrow("NEXT_REDIRECT:/center");
    },
  );

  it.each(["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT", "SEO_ADMIN"])(
    "renders the sidebar for platform role %s",
    async (role) => {
      getAuthSessionMock.mockResolvedValue(
        session({
          user: {
            id: "u-1",
            preferredLanguage: "uz-Latn",
            fullName: "Platform Bot",
            email: "bot@x.uz",
            platformRole: role,
          },
        }),
      );

      const element = await callLayout(PlatformAdminLayout, "ADMIN_CHILD");
      const sidebar = findElementByName(element, "PlatformSidebar");

      expect(sidebar).not.toBeNull();
      expect(sidebar!.props.user).toEqual({
        fullName: "Platform Bot",
        email: "bot@x.uz",
        platformRole: role,
      });
      expect(sidebar!.props.locale).toBe("uz-Latn");
      expect(collectText(element)).toContain("ADMIN_CHILD");
    },
  );
});

// ---------------------------------------------------------------------------
// 3. src/app/developer/layout.tsx
// ---------------------------------------------------------------------------

describe("developer layout", () => {
  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    await expect(callLayout(DeveloperLayout)).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it.each(["NONE", "PLATFORM_ADMIN", "SEO_ADMIN", "DIRECTOR"])(
    "redirects platform role %s to /platform",
    async (role) => {
      getAuthSessionMock.mockResolvedValue(
        session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", email: "x@x.uz", platformRole: role } }),
      );
      await expect(callLayout(DeveloperLayout)).rejects.toThrow("NEXT_REDIRECT:/platform");
    },
  );

  it.each(["SUPERADMIN", "DEVELOPER"])("renders the dev console for %s", async (role) => {
    getAuthSessionMock.mockResolvedValue(
      session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", email: "x@x.uz", platformRole: role } }),
    );

    const element = await callLayout(DeveloperLayout, "DEV_CHILD");
    const text = flatText(element);

    expect(text).toContain("DEV_PANEL");
    expect(text).toContain("System Health");
    expect(text).toContain("Global Audit Logs");
    expect(text).toContain("Platform Admins");
    expect(text).toContain("Return to Platform UI");
    expect(text).toContain("~/developer/control-panel");
    expect(text).toContain("SYS_ONLINE");
    expect(text).toContain("DEV_CHILD");
  });
});

// ---------------------------------------------------------------------------
// 4. src/app/center/layout.tsx
// ---------------------------------------------------------------------------

describe("center layout", () => {
  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    await expect(callLayout(CenterLayout)).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects platform-only users without memberships to /platform-admin", async () => {
    setUp(
      session({
        activeCenterId: null,
        memberships: [],
        user: { id: "u-1", preferredLanguage: "ru", fullName: "X", email: "x@x.uz", platformRole: "SEO_ADMIN" },
      }),
    );
    await expect(callLayout(CenterLayout)).rejects.toThrow("NEXT_REDIRECT:/platform-admin");
  });

  it("renders the pick-a-center panel when there is no active center", async () => {
    setUp(session({ activeCenterId: null, memberships: [] }));

    const element = await callLayout(CenterLayout, "CENTER_CHILD");
    const text = flatText(element);

    expect(text).toContain(t("ru", "dashboard.selectCenter"));
    expect(text).toContain(t("ru", "student.useInviteCode"));
    expect(text).toContain(t("ru", "landing.enterInviteCode"));
    // tenant db is never touched in this branch
    expect(requireTenantPageAccessMock).not.toHaveBeenCalled();
  });

  it("renders the pick-a-center panel when memberships are empty", async () => {
    setUp(session({ activeCenterId: "center-1", memberships: [] }));
    const text = flatText(await callLayout(CenterLayout));
    expect(text).toContain(t("ru", "dashboard.selectCenter"));
  });

  it("redirects to /login when the active center cannot be found", async () => {
    const db = makeDb();
    db.learningCenter.findUnique.mockResolvedValue(null);
    setUp(session(), db);

    await expect(callLayout(CenterLayout)).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders the DIRECTOR shell, loads the unread count and hides the platform link", async () => {
    const db = makeDb();
    db.notification.count.mockResolvedValue(0);
    setUp(session(), db);

    const element = await callLayout(CenterLayout, "CENTER_CHILD");
    const text = flatText(element);

    expect(text).toContain("Bright Center");
    expect(text).toContain(t("ru", "dashboard.directorCabinet"));
    expect(text).toContain("Ivan Petrov");
    expect(text).toContain("ivan@x.uz");
    expect(text).toContain("CENTER_CHILD");
    // DIRECTOR sees management navigation
    expect(text).toContain(t("ru", "nav.branches"));
    expect(text).toContain(t("ru", "nav.staff"));
    expect(text).toContain(t("ru", "nav.invites"));
    expect(text).toContain(t("ru", "nav.payments"));
    expect(text).toContain(t("ru", "nav.reports"));
    // platformRole "NONE" -> no platform-admin shortcut
    expect(text).not.toContain(t("ru", "nav.platformAdmin"));

    expect(db.learningCenter.findUnique).toHaveBeenCalledWith({ where: { id: "center-1" } });
    expect(db.notification.count).toHaveBeenCalledWith({
      where: {
        userId: "u-1",
        isRead: false,
        OR: [{ centerId: "center-1" }, { centerId: null }],
      },
    });
  });

  it("scopes the navigation to a TEACHER and shows the platform link for platform staff", async () => {
    const db = makeDb();
    db.notification.count.mockResolvedValue(5);
    setUp(
      session({
        activeCenterRole: "TEACHER",
        memberships: [{ id: "m-t", centerId: "center-1" }],
        user: {
          id: "u-1",
          preferredLanguage: "ru",
          fullName: "Teacher T",
          email: "t@x.uz",
          platformRole: "SUPERADMIN",
        },
      }),
      db,
    );

    const element = await callLayout(CenterLayout);
    const text = flatText(element);

    expect(text).toContain(t("ru", "dashboard.teacherCabinet"));
    // teacher-visible items
    expect(text).toContain(t("ru", "nav.courses"));
    expect(text).toContain(t("ru", "nav.attendance"));
    expect(text).toContain(t("ru", "nav.homework"));
    // management-only items are filtered out
    expect(text).not.toContain(t("ru", "nav.branches"));
    expect(text).not.toContain(t("ru", "nav.staff"));
    expect(text).not.toContain(t("ru", "nav.invites"));
    expect(text).not.toContain(t("ru", "nav.payments"));
    expect(text).not.toContain(t("ru", "nav.reports"));
    expect(text).not.toContain(t("ru", "nav.support"));
    // platform staff shortcut + unread badge
    expect(text).toContain(t("ru", "nav.platformAdmin"));
    expect(text).toContain("5");
  });

  it("caps the unread notification badge at 9+ and mounts the workspace switcher", async () => {
    const db = makeDb();
    db.notification.count.mockResolvedValue(42);
    setUp(
      session({
        memberships: [
          { id: "m-1", centerId: "center-1" },
          { id: "m-2", centerId: "center-2" },
        ],
      }),
      db,
    );

    const element = await callLayout(CenterLayout);
    const text = flatText(element);

    expect(text).toContain("9+");
    expect(findElementByName(element, "WorkspaceSwitcher")).not.toBeNull();
    // the notification query includes the center-scoped OR only once (active center)
    const notifWhere = db.notification.count.mock.calls[0][0].where as Record<string, unknown>;
    expect(notifWhere.OR).toEqual([{ centerId: "center-1" }, { centerId: null }]);
  });

  it("renders a logo image when the center has one", async () => {
    const db = makeDb();
    db.learningCenter.findUnique.mockResolvedValue({
      id: "center-1",
      name: "Bright Center",
      logoUrl: "https://cdn/logo.png",
    });
    setUp(session(), db);

    const element = await callLayout(CenterLayout);
    const srcs = collectPropValues(element, "src");
    expect(srcs).toContain("https://cdn/logo.png");
  });
});
