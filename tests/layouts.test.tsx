// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { t } from "@/i18n";
import RootLayout, { metadata } from "@/app/layout";
import CenterLayout from "@/app/center/layout";
import PlatformAdminLayout from "@/app/platform-admin/layout";
import DeveloperLayout from "@/app/developer/layout";
import { getVisibleNavigation } from "@/config/navigation";

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

vi.mock("next/font/google", () => ({
  Wix_Madefor_Text: () => ({ variable: "--font-wix-text" }),
  Wix_Madefor_Display: () => ({ variable: "--font-wix-display" }),
  Inter: () => ({ variable: "--font-inter-fallback" }),
  JetBrains_Mono: () => ({ variable: "--font-jetbrains-mono" }),
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

  it("renders the html shell with self-hosted font variables, lang and body classes", () => {
    const element = RootLayout({ children: "CHILD" }) as {
      type: string;
      props: Record<string, unknown>;
    };

    expect(element.type).toBe("html");
    expect(element.props.lang).toBe("ru");
    const htmlClasses = String(element.props.className ?? "");
    expect(htmlClasses).toContain("--font-wix-text");
    expect(htmlClasses).toContain("--font-wix-display");
    expect(htmlClasses).toContain("--font-inter-fallback");
    expect(htmlClasses).toContain("--font-jetbrains-mono");

    const hrefs = collectPropValues(element, "href");
    expect(hrefs.some((h) => String(h).includes("fonts.googleapis.com"))).toBe(false);
    expect(hrefs.some((h) => String(h).includes("fonts.gstatic.com"))).toBe(false);

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
    "renders the unified AppShell in platform scope for role %s",
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
      const shell = findElementByName(element, "AppShell");

      expect(shell).not.toBeNull();
      expect(shell!.props.scope).toBe("platform");
      expect(shell!.props.showReturnToCenterLink).toBe(true);
      expect(shell!.props.user).toMatchObject({
        fullName: "Platform Bot",
        email: "bot@x.uz",
        platformRole: role,
      });
      expect(shell!.props.locale).toBe("uz-Latn");
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

  it.each(["SUPERADMIN", "DEVELOPER"])("renders the dev console shell for %s", async (role) => {
    getAuthSessionMock.mockResolvedValue(
      session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", email: "x@x.uz", platformRole: role } }),
    );

    const element = await callLayout(DeveloperLayout, "DEV_CHILD");
    const shell = findElementByName(element, "AppShell");

    expect(shell).not.toBeNull();
    expect(shell!.props.scope).toBe("developer");
    expect(shell!.props.showReturnToPlatformUi).toBe(true);
    const groups = getVisibleNavigation(shell!.props.navContext as Parameters<typeof getVisibleNavigation>[0]);
    const labels = groups.flatMap((g) => g.items.map((i) => t("ru", i.labelKey)));
    expect(labels).toContain(t("ru", "nav.systemHealth"));
    expect(labels).toContain(t("ru", "nav.globalAudit"));
    expect(labels).toContain(t("ru", "nav.platformOwners"));
    expect(collectText(element)).toContain("DEV_CHILD");
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
    const shell = findElementByName(element, "AppShell");

    expect(shell).not.toBeNull();
    expect(shell!.props.scope).toBe("center");
    expect(shell!.props.center).toMatchObject({ id: "center-1", name: "Bright Center" });
    expect(shell!.props.user).toMatchObject({
      fullName: "Ivan Petrov",
      email: "ivan@x.uz",
      centerRole: "DIRECTOR",
    });
    expect(shell!.props.showPlatformAdminShortcut).toBe(false);
    expect(collectText(element)).toContain("CENTER_CHILD");

    const groups = getVisibleNavigation(shell!.props.navContext as Parameters<typeof getVisibleNavigation>[0]);
    const labelKeys = groups.flatMap((g) => g.items.map((i) => i.labelKey));
    expect(labelKeys).toContain("nav.branches");
    expect(labelKeys).toContain("nav.staff");
    expect(labelKeys).toContain("nav.invites");
    expect(labelKeys).toContain("nav.payments");
    expect(labelKeys).toContain("nav.reports");

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
    const shell = findElementByName(element, "AppShell");
    expect(shell).not.toBeNull();

    const groups = getVisibleNavigation(shell!.props.navContext as Parameters<typeof getVisibleNavigation>[0]);
    const labelKeys = groups.flatMap((g) => g.items.map((i) => i.labelKey));
    // teacher-visible items
    expect(labelKeys).toContain("nav.courses");
    expect(labelKeys).toContain("nav.attendance");
    expect(labelKeys).toContain("nav.homework");
    expect(labelKeys).toContain("nav.myGroups");
    expect(labelKeys).toContain("nav.substitutions");
    expect(labelKeys).toContain("nav.mySalary");
    expect(labelKeys).toContain("nav.support");
    // management-only items are filtered out
    expect(labelKeys).not.toContain("nav.branches");
    expect(labelKeys).not.toContain("nav.staff");
    expect(labelKeys).not.toContain("nav.invites");
    expect(labelKeys).not.toContain("nav.payments");
    expect(labelKeys).not.toContain("nav.reports");
    // platform staff shortcut + unread badge
    expect(shell!.props.showPlatformAdminShortcut).toBe(true);
    expect(shell!.props.unreadNotificationsCount).toBe(5);
  });

  it("passes unread notification count and multiple memberships to AppShell", async () => {
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
    const shell = findElementByName(element, "AppShell");
    expect(shell).not.toBeNull();
    expect(shell!.props.unreadNotificationsCount).toBe(42);
    expect(shell!.props.memberships as unknown[]).toHaveLength(2);
    // the notification query includes the center-scoped OR only once (active center)
    const notifWhere = db.notification.count.mock.calls[0][0].where as Record<string, unknown>;
    expect(notifWhere.OR).toEqual([{ centerId: "center-1" }, { centerId: null }]);
  });

  it("passes center logoUrl to AppShell when present", async () => {
    const db = makeDb();
    db.learningCenter.findUnique.mockResolvedValue({
      id: "center-1",
      name: "Bright Center",
      logoUrl: "https://cdn/logo.png",
    });
    setUp(session(), db);

    const element = await callLayout(CenterLayout);
    const shell = findElementByName(element, "AppShell");
    expect(shell).not.toBeNull();
    expect((shell!.props.center as { logoUrl?: string }).logoUrl).toBe("https://cdn/logo.png");
  });
});
