// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { t } from "@/i18n";
import CenterPasswordRedirectPage from "@/app/center/profile/password/page";
import CenterSessionsRedirectPage from "@/app/center/profile/sessions/page";
import { SecurityTabPanel } from "@/components/account/SecurityTabPanel";
import NotificationsPage from "@/app/center/notifications/page";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

const { pushMock, redirectMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => ({
    push: pushMock,
    replace: pushMock,
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/account",
  useSearchParams: () => new URLSearchParams(),
}));

const ru = (key: string) => t("ru", key);

beforeEach(() => {
  pushMock.mockReset();
  redirectMock.mockClear();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("legacy /center/profile security redirects", () => {
  it("redirects /center/profile/password to /account?tab=security", () => {
    expect(() => CenterPasswordRedirectPage()).toThrow("NEXT_REDIRECT:/account?tab=security");
  });

  it("redirects /center/profile/sessions to /account?tab=security#sessions", () => {
    expect(() => CenterSessionsRedirectPage()).toThrow(
      "NEXT_REDIRECT:/account?tab=security#sessions",
    );
  });
});

const sessions = [
  {
    id: "s-current",
    ipAddress: "10.0.0.1",
    userAgent: "Chrome on Windows",
    createdAt: "2026-03-01T09:00:00.000Z",
    lastSeenAt: "2026-03-02T09:00:00.000Z",
    isCurrent: true,
  },
  {
    id: "s-2",
    ipAddress: null,
    userAgent: "A very long user agent string that must be truncated to thirty",
    createdAt: "2026-02-01T09:00:00.000Z",
    lastSeenAt: "2026-02-02T09:00:00.000Z",
    isCurrent: false,
  },
  {
    id: "s-3",
    ipAddress: "10.0.0.3",
    userAgent: null,
    createdAt: "2026-01-01T09:00:00.000Z",
    lastSeenAt: "2026-01-02T09:00:00.000Z",
    isCurrent: false,
  },
];

describe("SecurityTabPanel active sessions", () => {
  it("shows a loading placeholder, then the device cards", async () => {
    installFetchMock([
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions }) },
    ]);
    const { container } = render(
      <SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />,
    );

    expect(screen.getByText(ru("common.loading"))).toBeTruthy();
    await waitFor(() => expect(screen.queryByText(ru("common.loading"))).toBeNull());

    expect(screen.getByText(ru("profile.currentDevice"))).toBeTruthy();
    expect(screen.getByText("IP: 10.0.0.1")).toBeTruthy();
    expect(screen.getByText("IP: N/A")).toBeTruthy();
    expect(screen.getByText("Unknown Device")).toBeTruthy();
    expect(container.textContent).toContain("A very long user agent");
    // 3 cards, only the current one hides its revoke button
    expect(screen.getAllByText(ru("profile.revokeSession"))).toHaveLength(2);
    expect(screen.getByText(ru("profile.revokeAll"))).toBeTruthy();
  });

  it("renders the empty state and hides the revoke-all button", async () => {
    installFetchMock([
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions: [] }) },
    ]);
    render(<SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />);

    await waitFor(() => expect(screen.getByText(ru("profile.noDevices"))).toBeTruthy());
    expect(screen.queryByText(ru("profile.revokeAll"))).toBeNull();
  });

  it("reports an API error and a network failure", async () => {
    installFetchMock([
      {
        match: "/api/auth/sessions",
        reply: jsonResponse({ error: { message: "auth.token.required" } }, 500),
      },
    ]);
    const first = render(
      <SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />,
    );
    await waitFor(() => expect(screen.getByText(ru("auth.token.required"))).toBeTruthy());
    first.unmount();

    installFetchMock([{ match: "/api/auth/sessions", reply: brokenResponse(200) }]);
    render(<SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />);
    await waitFor(() => expect(screen.getByText(ru("common.error"))).toBeTruthy());
  });

  it("revokes a single session and removes its card", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions }) },
      { match: "/api/auth/sessions", method: "DELETE", reply: jsonResponse({ success: true }) },
    ]);
    render(<SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />);
    await waitFor(() => expect(screen.getAllByText(ru("profile.revokeSession"))).toHaveLength(2));

    fireEvent.click(screen.getAllByText(ru("profile.revokeSession"))[0]);

    await waitFor(() => expect(screen.getAllByText(ru("profile.revokeSession"))).toHaveLength(1));
    const del = calls.find((c) => c.init?.method === "DELETE")!;
    expect(del.url).toContain("id=s-2");
  });

  it("surfaces an error when a revoke fails", async () => {
    installFetchMock([
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions }) },
      {
        match: "/api/auth/sessions",
        method: "DELETE",
        reply: jsonResponse({ error: { message: "auth.token.required" } }, 403),
      },
    ]);
    render(<SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />);
    await waitFor(() => expect(screen.getAllByText(ru("profile.revokeSession"))).toHaveLength(2));

    fireEvent.click(screen.getAllByText(ru("profile.revokeSession"))[0]);

    await waitFor(() => expect(screen.getByText(ru("auth.token.required"))).toBeTruthy());
  });

  it("keeps only the current session when revoke-all is confirmed, and does nothing otherwise", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/sessions", reply: jsonResponse({ success: true, sessions }) },
      { match: "/api/auth/sessions", method: "DELETE", reply: jsonResponse({ success: true }) },
    ]);
    render(<SecurityTabPanel initialTwoFactorEnabled={false} locale="ru" isReadOnly={false} />);
    await waitFor(() => expect(screen.getByText(ru("profile.revokeAll"))).toBeTruthy());

    // Open confirmation dialog and cancel it
    fireEvent.click(screen.getByText(ru("profile.revokeAll")));
    await waitFor(() => expect(screen.getByText(ru("profile.confirmRevokeAll"))).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: ru("common.cancel") }));
    expect(calls.filter((c) => c.init?.method === "DELETE")).toHaveLength(0);

    // Reopen and confirm
    fireEvent.click(screen.getByText(ru("profile.revokeAll")));
    await waitFor(() => expect(screen.getByText(ru("profile.confirmRevokeAll"))).toBeTruthy());
    const buttons = screen.getAllByRole("button", { name: ru("profile.revokeAll") });
    fireEvent.click(buttons[buttons.length - 1]);

    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("allButCurrent=true"))).toBe(true),
    );
    await waitFor(() => expect(screen.queryByText(ru("profile.revokeSession"))).toBeNull());
    expect(screen.queryByText(ru("profile.revokeAll"))).toBeNull();
  });
});

const notifications = [
  {
    id: "n-1",
    type: "NEW_HOMEWORK",
    titleKey: "notifications.newHomework",
    bodyKey: "notifications.newHomeworkBody",
    bodyParams: { title: "Алгебра" },
    channel: "IN_APP",
    isRead: false,
    createdAt: "2026-03-01T10:00:00.000Z",
    centerId: "c-1",
  },
  {
    id: "n-2",
    type: "GRADE_POSTED",
    titleKey: "notifications.gradePosted",
    bodyKey: "notifications.gradePostedBody",
    bodyParams: JSON.stringify({ value: 5, maxValue: 10 }),
    channel: "IN_APP",
    isRead: true,
    createdAt: "2026-02-01T10:00:00.000Z",
    centerId: null,
  },
  {
    id: "n-3",
    type: "MYSTERY",
    titleKey: "some.unknown.key",
    bodyKey: "some.unknown.body",
    bodyParams: "not-json",
    channel: "IN_APP",
    isRead: false,
    createdAt: "2026-01-01T10:00:00.000Z",
    centerId: null,
  },
];

const feedPage = (overrides: Record<string, unknown> = {}) => ({
  notifications,
  total: 3,
  unreadCount: 2,
  ...overrides,
});

describe("NotificationsPage", () => {
  it("renders every notification, its translated copy and its action links", async () => {
    installFetchMock([{ match: "/api/notifications", reply: jsonResponse(feedPage()) }]);
    const { container } = render(<NotificationsPage />);

    expect(container.querySelector(".animate-pulse")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Новое домашнее задание")).toBeTruthy());

    expect(screen.getByText("Оценка выставлена")).toBeTruthy();
    expect(screen.getByText("Вам задали домашнее задание: Алгебра")).toBeTruthy();
    expect(screen.getByText("Оценка: 5 / 10")).toBeTruthy();
    // unknown title/body keys are shown verbatim
    expect(screen.getByText("some.unknown.key")).toBeTruthy();
    expect(screen.getByText("some.unknown.body")).toBeTruthy();
    expect(screen.getByText("2 новых")).toBeTruthy();
    // only unread items offer "mark as read"
    expect(screen.getAllByText("Отметить как прочитанное")).toHaveLength(2);
    // only known types get a navigation link
    expect(screen.getAllByText("Перейти")).toHaveLength(2);
  });

  it("shows the empty state, wording it for the unread filter", async () => {
    const { calls } = installFetchMock([
      { match: "/api/notifications", reply: jsonResponse(feedPage({ notifications: [], unreadCount: 0 })) },
    ]);
    render(<NotificationsPage />);

    await waitFor(() => expect(screen.getByText("Нет новых уведомлений")).toBeTruthy());
    expect(screen.getByText("Здесь будут отображаться важные события.")).toBeTruthy();

    fireEvent.click(screen.getByText("Только непрочитанные"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].url).toContain("unreadOnly=true");
    await waitFor(() =>
      expect(screen.getByText("У вас нет непрочитанных сообщений.")).toBeTruthy(),
    );
  });

  it("surfaces a failed request and a network error", async () => {
    installFetchMock([{ match: "/api/notifications", reply: jsonResponse({}, 500) }]);
    const first = render(<NotificationsPage />);
    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить уведомления")).toBeTruthy(),
    );
    first.unmount();

    installFetchMock([{ match: "/api/notifications", reply: brokenResponse(200) }]);
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("invalid json")).toBeTruthy());
  });

  it("marks one notification as read and decrements the unread counter", async () => {
    const { calls } = installFetchMock([
      { match: "/api/notifications", reply: jsonResponse(feedPage()) },
      { match: "/api/notifications", method: "PATCH", reply: jsonResponse({ success: true }) },
    ]);
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getAllByText("Отметить как прочитанное")).toHaveLength(2));

    fireEvent.click(screen.getAllByText("Отметить как прочитанное")[0]);

    await waitFor(() =>
      expect(screen.getAllByText("Отметить как прочитанное")).toHaveLength(1),
    );
    expect(screen.getByText("1 новых")).toBeTruthy();
    expect(sentBody(calls.find((c) => c.init?.method === "PATCH")!)).toEqual({
      notificationId: "n-1",
    });
  });

  it("marks everything as read", async () => {
    const { calls } = installFetchMock([
      { match: "/api/notifications", reply: jsonResponse(feedPage()) },
      { match: "/api/notifications", method: "PATCH", reply: jsonResponse({ success: true }) },
    ]);
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("Прочитать все")).toBeTruthy());

    fireEvent.click(screen.getByText("Прочитать все"));

    await waitFor(() => expect(screen.queryByText("2 новых")).toBeNull());
    expect(screen.queryByText("Прочитать все")).toBeNull();
    expect(screen.queryByText("Отметить как прочитанное")).toBeNull();
    expect(sentBody(calls.find((c) => c.init?.method === "PATCH")!)).toEqual({ markAllRead: true });
  });

  it("follows the deep link and marks the notification read on the way", async () => {
    installFetchMock([
      { match: "/api/notifications", reply: jsonResponse(feedPage()) },
      { match: "/api/notifications", method: "PATCH", reply: jsonResponse({ success: true }) },
    ]);
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getAllByText("Перейти")).toHaveLength(2));

    fireEvent.click(screen.getAllByText("Перейти")[0]);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/center/homework"));
  });
});
