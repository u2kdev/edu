// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { NextResponse } from "next/server";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { AppShell } from "@/components/shell/AppShell";
import { AccountSettingsTabs } from "@/components/account/AccountSettingsTabs";
import AccountSecurityRedirectPage from "@/app/account/security/page";
import { DEFAULT_NOTIFICATION_PREFS } from "@/lib/notifications";
import { PLAN_PRESETS } from "@/lib/plan-features";
import { t } from "@/i18n";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

const { pushMock, replaceMock, refreshMock, pathnameRef, searchParamsRef, redirectMock } =
  vi.hoisted(() => ({
    pushMock: vi.fn(),
    replaceMock: vi.fn(),
    refreshMock: vi.fn(),
    pathnameRef: { current: "/center" },
    searchParamsRef: { current: "" },
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
  }));

const reloadMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/reload", () => ({ reloadPage: reloadMock }));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue("data:image/png;base64,FAKEQR"),
  },
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    refresh: refreshMock,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => new URLSearchParams(searchParamsRef.current),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: (props: unknown) => {
      const { href, children, onClick, ...rest } = props as {
        href?: string;
        children?: import("react").ReactNode;
        onClick?: (e: { preventDefault: () => void }) => void;
      } & Record<string, unknown>;
      return React.createElement(
        "a",
        {
          href: typeof href === "string" ? href : "",
          onClick: (e: { preventDefault: () => void }) => {
            e.preventDefault();
            onClick?.(e);
          },
          ...rest,
        },
        children,
      );
    },
  };
});

beforeEach(() => {
  pushMock.mockReset();
  replaceMock.mockReset();
  refreshMock.mockReset();
  redirectMock.mockClear();
  reloadMock.mockReset();
  pathnameRef.current = "/center";
  searchParamsRef.current = "";
  window.localStorage.clear();
  document.cookie = "edarschi_sidebar_collapsed=; path=/; max-age=0";
  document.cookie = "edarschi_parent_child=; path=/; max-age=0";
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AppShell unified layout chrome", () => {
  it("persists collapsed sidebar state in localStorage and cookie", () => {
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Директор Тест",
            email: "dir@example.uz",
            platformRole: "NONE",
            centerRole: "DIRECTOR",
          }}
          navContext={{
            scope: "center",
            platformRole: "NONE",
            centerRole: "DIRECTOR",
            planFeatures: PLAN_PRESETS.pro,
            centerStatus: "ACTIVE",
          }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
        >
          <div>MAIN_BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    const collapseBtn = screen.getByRole("button", { name: t("ru", "shell.collapseSidebar") });
    fireEvent.click(collapseBtn);

    expect(window.localStorage.getItem("edarschi_sidebar_collapsed")).toBe("1");
    expect(document.cookie).toContain("edarschi_sidebar_collapsed=1");

    const expandBtn = screen.getByRole("button", { name: t("ru", "shell.expandSidebar") });
    fireEvent.click(expandBtn);
    expect(window.localStorage.getItem("edarschi_sidebar_collapsed")).toBe("0");
  });

  it("opens the user popover upward with account items, language, theme and support", async () => {
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Саида Учителя",
            email: "saida@example.uz",
            platformRole: "NONE",
            centerRole: "TEACHER",
          }}
          navContext={{
            scope: "center",
            platformRole: "NONE",
            centerRole: "TEACHER",
            planFeatures: PLAN_PRESETS.pro,
            centerStatus: "ACTIVE",
          }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
        >
          <div>CHILD</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: t("ru", "shell.userMenuAria") }));
    await waitFor(() => expect(screen.getByText("saida@example.uz")).toBeTruthy());

    expect(screen.getByText(t("ru", "account.tabProfile"))).toBeTruthy();
    expect(screen.getByText(t("ru", "shell.accountSettings"))).toBeTruthy();
    expect(screen.getByText(t("ru", "shell.security"))).toBeTruthy();
    expect(screen.getAllByText(t("ru", "nav.notifications")).length).toBeGreaterThan(0);
    expect(screen.getAllByText(t("ru", "nav.support")).length).toBeGreaterThan(0);
    expect(screen.getByText(t("ru", "common.logout"))).toBeTruthy();
  });

  it("shows return links only in allowed scopes", () => {
    const { rerender } = render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Director",
            email: "d@x.uz",
            platformRole: "NONE",
            centerRole: "DIRECTOR",
          }}
          navContext={{ scope: "center", platformRole: "NONE", centerRole: "DIRECTOR" }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
          showPlatformAdminShortcut={false}
          showReturnToCenterLink={false}
        >
          <div>CENTER</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    expect(screen.queryByText(t("ru", "nav.returnToCenter"))).toBeNull();
    expect(screen.queryByText(t("ru", "nav.platformAdmin"))).toBeNull();

    rerender(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="platform"
          locale="ru"
          user={{ fullName: "Admin", email: "a@x.uz", platformRole: "SUPERADMIN" }}
          navContext={{ scope: "platform", platformRole: "SUPERADMIN" }}
          showReturnToCenterLink
        >
          <div>PLATFORM</div>
        </AppShell>
      </PanelThemeProvider>,
    );
    expect(screen.getByText(t("ru", "nav.returnToCenter"))).toBeTruthy();
  });

  it("renders parent child switcher in the header for PARENT and persists cookie + childId query", () => {
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Parent User",
            email: "p@x.uz",
            platformRole: "NONE",
            centerRole: "PARENT",
          }}
          navContext={{ scope: "center", platformRole: "NONE", centerRole: "PARENT" }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
          parentChildren={[
            { studentMembershipId: "st-1", fullName: "Алишер" },
            { studentMembershipId: "st-2", fullName: "Мадина" },
          ]}
        >
          <div>PARENT_BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    const select = screen.getByRole("combobox", { name: t("ru", "shell.parentChildLabel") }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "st-2" } });

    expect(document.cookie).toContain("edarschi_parent_child=st-2");
    expect(replaceMock).toHaveBeenCalledWith("/center?childId=st-2");
    expect(refreshMock).toHaveBeenCalled();
  });

  it("opens CommandPalette with Ctrl+K and queries students/groups only when permitted", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/students",
        reply: jsonResponse({
          students: [{ id: "st-9", user: { fullName: "Азизбек Ученик", email: "az@x.uz" } }],
        }),
      },
      {
        match: "/api/groups",
        reply: jsonResponse({
          groups: [{ id: "g-9", name: "Frontend Pro", course: { title: "Web" } }],
        }),
      },
    ]);

    const { unmount } = render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Director",
            email: "d@x.uz",
            platformRole: "NONE",
            centerRole: "DIRECTOR",
          }}
          navContext={{
            scope: "center",
            platformRole: "NONE",
            centerRole: "DIRECTOR",
            planFeatures: PLAN_PRESETS.pro,
          }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
        >
          <div>BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput = await screen.findByPlaceholderText(t("ru", "shell.commandPlaceholder"));
    fireEvent.change(searchInput, { target: { value: "Аз" } });

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("/api/students?search="))).toBe(true),
    );
    await waitFor(() => expect(screen.getByText("Азизбек Ученик")).toBeTruthy());

    unmount();

    // STUDENT role without students.read should never fetch /api/students
    const { calls: studentCalls } = installFetchMock([]);
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Student",
            email: "s@x.uz",
            platformRole: "NONE",
            centerRole: "STUDENT",
          }}
          navContext={{
            scope: "center",
            platformRole: "NONE",
            centerRole: "STUDENT",
            planFeatures: PLAN_PRESETS.pro,
          }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
        >
          <div>BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const searchInput2 = await screen.findByPlaceholderText(t("ru", "shell.commandPlaceholder"));
    fireEvent.change(searchInput2, { target: { value: "Расписание" } });

    await new Promise((r) => setTimeout(r, 300));
    expect(studentCalls.some((c) => c.url.includes("/api/students"))).toBe(false);
    expect(screen.getAllByText(t("ru", "nav.schedule")).length).toBeGreaterThan(0);
  });

  it("loads notifications in NotificationBell popover and marks all read", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/notifications",
        method: "GET",
        reply: jsonResponse({
          notifications: [
            {
              id: "n-1",
              type: "NEW_HOMEWORK",
              titleKey: "notifications.title",
              bodyKey: "notifications.newHomework",
              bodyParams: { title: "Физика" },
              isRead: false,
              createdAt: "2026-11-16T00:00:00.000Z",
            },
          ],
          unreadCount: 1,
        }),
      },
      { match: "/api/notifications", method: "PATCH", reply: jsonResponse({ success: true }) },
    ]);

    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          unreadNotificationsCount={1}
          user={{
            fullName: "Student",
            email: "s@x.uz",
            platformRole: "NONE",
            centerRole: "STUDENT",
          }}
          navContext={{ scope: "center", platformRole: "NONE", centerRole: "STUDENT" }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
        >
          <div>BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: t("ru", "nav.notifications") }));
    await waitFor(() => expect(screen.getByText("Физика", { exact: false })).toBeTruthy());

    fireEvent.click(screen.getByText(t("ru", "notifications.markAllRead")));
    await waitFor(() =>
      expect(sentBody(calls.find((c) => c.init?.method === "PATCH")!)).toEqual({
        markAllRead: true,
      }),
    );
  });

  it("renders impersonation + read-only badges without changing stop behavior", () => {
    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AppShell
          scope="center"
          locale="ru"
          user={{
            fullName: "Support User",
            email: "sup@x.uz",
            platformRole: "NONE",
            centerRole: "CENTER_SUPPORT",
          }}
          navContext={{ scope: "center", platformRole: "NONE", centerRole: "CENTER_SUPPORT" }}
          center={{ id: "c-1", name: "Bright Center", status: "ACTIVE" }}
          impersonation={{
            active: true,
            role: "CENTER_SUPPORT",
            centerName: "Bright Center",
            isReadOnly: true,
          }}
        >
          <div>BODY</div>
        </AppShell>
      </PanelThemeProvider>,
    );

    expect(screen.getByText(t("ru", "shell.readOnlyBadge"))).toBeTruthy();
    expect(screen.getByText(t("ru", "platform.returnToPlatform"))).toBeTruthy();
  });
});

describe("Unified Account page & legacy redirect", () => {
  it("redirects /account/security to /account?tab=security", () => {
    expect(() => AccountSecurityRedirectPage()).toThrow("NEXT_REDIRECT:/account?tab=security");
  });

  it("renders all 4 account tabs and switches between Profile, Security (2FA), Notifications (Quiet Hours), and Appearance", async () => {
    installFetchMock([
      { match: "/api/account/telegram", reply: jsonResponse({ linked: false, account: null }) },
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions: [] }) },
      {
        match: "/api/auth/2fa",
        method: "GET",
        reply: jsonResponse({ enabled: false, secret: "ABCDEF123", uri: "otpauth://totp/test" }),
      },
    ]);

    render(
      <PanelThemeProvider initialTheme="light" initialResolvedTheme="light">
        <AccountSettingsTabs
          locale="ru"
          profile={{
            id: "u-1",
            fullName: "Камилла Директор",
            email: "dir@center.uz",
            phone: "+998901234567",
            username: "kamilla",
            avatarUrl: null,
            preferredLanguage: "ru",
            createdAt: "2026-01-01T00:00:00.000Z",
            role: "DIRECTOR",
            canEditFullName: true,
            twoFactorEnabled: false,
          }}
          preferences={DEFAULT_NOTIFICATION_PREFS}
          quietHours={{ enabled: true, start: 22, end: 7 }}
          centerSettings={{
            hasCenter: true,
            smsEnabled: true,
            smsDailyLimit: 200,
            canManageCenter: true,
          }}
          notificationsHref="/center/notifications"
        />
      </PanelThemeProvider>,
    );

    expect(screen.getAllByText("Камилла Директор").length).toBeGreaterThan(0);

    // Switch to Security tab via click + state update
    fireEvent.mouseDown(screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabSecurity")) }));
    fireEvent.click(screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabSecurity")) }));
    await waitFor(() =>
      expect(screen.getByText(t("ru", "account.twoFactorSetupStart"))).toBeTruthy(),
    );

    // Switch to Notifications tab
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabNotifications")) }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabNotifications")) }),
    );
    await waitFor(() =>
      expect(screen.getByText(t("ru", "account.quietHoursTitle"))).toBeTruthy(),
    );

    // Switch to Appearance tab
    fireEvent.mouseDown(
      screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabAppearance")) }),
    );
    fireEvent.click(
      screen.getByRole("tab", { name: new RegExp(t("ru", "account.tabAppearance")) }),
    );
    await waitFor(() =>
      expect(screen.getByText(t("ru", "account.appearanceLangTitle"))).toBeTruthy(),
    );
  });
});

// Keep NextResponse referenced only when needed (no unused imports)
void NextResponse;
