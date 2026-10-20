// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { t } from "@/i18n";
import ForgotPasswordPage from "@/app/(auth)/forgot-password/page";
import ResetPasswordPage from "@/app/(auth)/reset-password/page";
import ConfirmEmailPage from "@/app/(auth)/confirm-email/page";
import AcceptInvitePage from "@/app/invites/accept/page";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

const { pushMock, searchParamsRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParamsRef.current,
  usePathname: () => "/",
}));

/** Expected copy comes from the same i18n helper the components use. */
const ru = (key: string) => t("ru", key);

beforeEach(() => {
  pushMock.mockReset();
  searchParamsRef.current = new URLSearchParams();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ForgotPasswordPage", () => {
  it("renders the email form and the back link", () => {
    const { container } = render(<ForgotPasswordPage />);
    expect(container.querySelector('input#email')).toBeTruthy();
    expect(screen.getByRole("button", { name: new RegExp(ru("auth.forgot.submit")) })).toBeTruthy();
    expect(container.querySelector('a[href="/login"]')?.textContent).toBe(ru("auth.backToLogin"));
  });

  it("posts the email and shows the confirmation screen", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/password/forgot", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    render(<ForgotPasswordPage />);

    fireEvent.change(screen.getByLabelText(ru("auth.email")), {
      target: { value: "user@example.com" },
    });
    fireEvent.submit(screen.getByLabelText(ru("auth.email")).closest("form")!);

    await waitFor(() => expect(screen.getByText(ru("auth.resetLinkSent"))).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({ email: "user@example.com" });
    expect(calls[0].init?.method).toBe("POST");
  });

  it("shows the translated message from a failed response", async () => {
    installFetchMock([
      {
        match: "/api/auth/password/forgot",
        method: "POST",
        reply: jsonResponse({ error: { message: "auth.token.required" } }, 400),
      },
    ]);
    render(<ForgotPasswordPage />);

    fireEvent.submit(screen.getByLabelText(ru("auth.email")).closest("form")!);

    await waitFor(() => expect(screen.getByText(ru("auth.token.required"))).toBeTruthy());
    expect(screen.queryByText(ru("auth.resetLinkSent"))).toBeNull();
  });

  it("falls back to the generic error when the response has no message", async () => {
    installFetchMock([
      { match: "/api/auth/password/forgot", method: "POST", reply: jsonResponse({}, 500) },
    ]);
    render(<ForgotPasswordPage />);

    fireEvent.submit(screen.getByLabelText(ru("auth.email")).closest("form")!);

    await waitFor(() => expect(screen.getByText(ru("common.error"))).toBeTruthy());
  });

  it("handles a network failure", async () => {
    installFetchMock([]);
    render(<ForgotPasswordPage />);

    fireEvent.submit(screen.getByLabelText(ru("auth.email")).closest("form")!);

    await waitFor(() => expect(screen.getByText(ru("common.error"))).toBeTruthy());
  });
});

describe("ResetPasswordPage", () => {
  it("renders a token-required error when the query string has no token", async () => {
    const { container } = render(<ResetPasswordPage />);

    expect(container.querySelector('a[href="/forgot-password"]')).toBeTruthy();
    expect(screen.getByText(ru("common.error"))).toBeTruthy();
    await waitFor(() => expect(screen.getByText(ru("auth.token.required"))).toBeTruthy());
  });

  it("renders the password form when a token is present", () => {
    searchParamsRef.current = new URLSearchParams("token=reset-token");
    const { container } = render(<ResetPasswordPage />);

    expect(container.querySelector('input#password')?.getAttribute("type")).toBe("password");
    expect(screen.getByText(ru("auth.passwordHint"))).toBeTruthy();
  });

  it("resets the password, shows success and redirects to /login after a delay", async () => {
    searchParamsRef.current = new URLSearchParams("token=reset-token");
    const { calls } = installFetchMock([
      { match: "/api/auth/password/reset", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    const { container } = render(<ResetPasswordPage />);

    fireEvent.change(container.querySelector('input#password')!, { target: { value: "S3cret!!" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru("auth.resetSuccess"))).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({ token: "reset-token", newPassword: "S3cret!!" });

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"), { timeout: 4000 });
  });

  it("surfaces a validation error from the first detail entry", async () => {
    searchParamsRef.current = new URLSearchParams("token=reset-token");
    installFetchMock([
      {
        match: "/api/auth/password/reset",
        method: "POST",
        reply: jsonResponse(
          { error: { code: "VALIDATION_ERROR", details: [{ message: "auth.passwordHint" }] } },
          400,
        ),
      },
    ]);
    const { container } = render(<ResetPasswordPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru("auth.passwordHint"))).toBeTruthy());
  });

  it("surfaces a non-validation error message and a network failure", async () => {
    searchParamsRef.current = new URLSearchParams("token=reset-token");
    installFetchMock([
      {
        match: "/api/auth/password/reset",
        method: "POST",
        reply: jsonResponse({ error: { code: "INVALID_TOKEN", message: "auth.requestNewReset" } }, 400),
      },
    ]);
    const { container, unmount } = render(<ResetPasswordPage />);

    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(ru("auth.requestNewReset"))).toBeTruthy());
    unmount();

    installFetchMock([]);
    const second = render(<ResetPasswordPage />);
    fireEvent.submit(second.container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(ru("common.error"))).toBeTruthy());
  });
});

describe("ConfirmEmailPage", () => {
  it("shows the error state when the token is missing", async () => {
    render(<ConfirmEmailPage />);
    await waitFor(() => expect(screen.getByText(ru("auth.confirm.error"))).toBeTruthy());
  });

  it("confirms the token and navigates to /login", async () => {
    searchParamsRef.current = new URLSearchParams("token=confirm-token");
    const { calls } = installFetchMock([
      { match: "/api/auth/confirm-email", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    render(<ConfirmEmailPage />);

    await waitFor(() => expect(screen.getByText(ru("auth.confirm.success"))).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({ token: "confirm-token" });

    fireEvent.click(screen.getByRole("button", { name: ru("auth.confirm.login") }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("treats an expired token as resendable and reports a successful resend", async () => {
    searchParamsRef.current = new URLSearchParams("token=old-token");
    const { calls } = installFetchMock([
      {
        match: "/api/auth/confirm-email",
        method: "POST",
        reply: jsonResponse({ error: { code: "EXPIRED" } }, 400),
      },
      { match: "/api/auth/resend-confirm", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    render(<ConfirmEmailPage />);

    await waitFor(() => expect(screen.getByText(ru("auth.confirm.expired"))).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: ru("auth.confirm.resend") }));

    await waitFor(() => expect(screen.getByText(ru("auth.confirm.resend_success"))).toBeTruthy());
    const resend = calls.find((c) => c.url.includes("resend-confirm"))!;
    expect(resend.init?.body).toBeUndefined();
  });

  it("reports a failed resend and a rejected token as an error", async () => {
    searchParamsRef.current = new URLSearchParams("token=bad-token");
    installFetchMock([
      {
        match: "/api/auth/confirm-email",
        method: "POST",
        reply: jsonResponse({ error: { message: "nope" } }, 400),
      },
      { match: "/api/auth/resend-confirm", method: "POST", reply: jsonResponse({}, 500) },
    ]);
    render(<ConfirmEmailPage />);

    await waitFor(() => expect(screen.getByText(ru("auth.confirm.error"))).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: ru("auth.confirm.resend") }));
    await waitFor(() => expect(screen.getByText(ru("auth.confirm.resend_error"))).toBeTruthy());
  });

  it("reports a network failure during the resend", async () => {
    searchParamsRef.current = new URLSearchParams("token=net-token");
    installFetchMock([
      {
        match: "/api/auth/confirm-email",
        method: "POST",
        reply: brokenResponse(200),
      },
    ]);
    render(<ConfirmEmailPage />);

    await waitFor(() => expect(screen.getByText(ru("auth.confirm.error"))).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: ru("auth.confirm.resend") }));
    await waitFor(() => expect(screen.getByText(ru("auth.confirm.resend_error"))).toBeTruthy());
  });
});

describe("AcceptInvitePage", () => {
  it("rejects a link without an invite id", async () => {
    render(<AcceptInvitePage />);
    await waitFor(() =>
      expect(screen.getByText("Ссылка приглашения недействительна.")).toBeTruthy(),
    );
  });

  it("accepts an invite and links to the workspace", async () => {
    searchParamsRef.current = new URLSearchParams("pendingInviteId=inv-1");
    const { calls } = installFetchMock([
      { match: "/api/auth/invites/accept", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    const { container } = render(<AcceptInvitePage />);

    await waitFor(() => expect(screen.getByText("Приглашение принято")).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({ pendingInviteId: "inv-1" });
    expect(container.querySelector('a[href="/center"]')).toBeTruthy();
  });

  it("asks an anonymous visitor to log in and preserves the return path", async () => {
    searchParamsRef.current = new URLSearchParams("pendingInviteId=inv/2");
    installFetchMock([
      { match: "/api/auth/invites/accept", method: "POST", reply: jsonResponse({}, 401) },
    ]);
    const { container } = render(<AcceptInvitePage />);

    await waitFor(() =>
      expect(screen.getByText("Войдите, чтобы принять приглашение")).toBeTruthy(),
    );
    const href = container.querySelector('a[href*="/login?next="]')!.getAttribute("href")!;
    expect(href).toContain("/login?next=");
    expect(decodeURIComponent(href)).toContain("/invites/accept?pendingInviteId=inv/2");
  });

  it("shows the server-provided error message", async () => {
    searchParamsRef.current = new URLSearchParams("pendingInviteId=inv-3");
    installFetchMock([
      {
        match: "/api/auth/invites/accept",
        method: "POST",
        reply: jsonResponse({ error: { message: "Код уже использован" } }, 409),
      },
    ]);
    render(<AcceptInvitePage />);

    await waitFor(() => expect(screen.getByText("Код уже использован")).toBeTruthy());
  });

  it("falls back to a generic message on a malformed response and on a network failure", async () => {
    searchParamsRef.current = new URLSearchParams("pendingInviteId=inv-4");
    installFetchMock([
      { match: "/api/auth/invites/accept", method: "POST", reply: brokenResponse(500) },
    ]);
    const { unmount } = render(<AcceptInvitePage />);
    await waitFor(() =>
      expect(screen.getByText("Не удалось принять приглашение.")).toBeTruthy(),
    );
    unmount();

    installFetchMock([]);
    render(<AcceptInvitePage />);
    await waitFor(() =>
      expect(screen.getByText("Не удалось принять приглашение. Попробуйте позже.")).toBeTruthy(),
    );
  });
});
