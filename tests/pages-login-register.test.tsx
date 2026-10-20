// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { t } from "@/i18n";
import LoginPage from "@/app/login/page";
import RegisterPage from "@/app/(auth)/register/page";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

const { pushMock, refreshMock, searchParamsRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  searchParamsRef: { current: new URLSearchParams() },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: refreshMock,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => searchParamsRef.current,
  usePathname: () => "/login",
}));

const ru = (key: string) => t("ru", key);

beforeEach(() => {
  pushMock.mockReset();
  refreshMock.mockReset();
  searchParamsRef.current = new URLSearchParams();
  window.history.pushState({}, "", "/login");
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LoginPage", () => {
  it("renders the brand panel, the form and the dev quick logins", () => {
    const { container } = render(<LoginPage />);

    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(screen.getAllByText("e-darischi").length).toBeGreaterThan(0);
    expect(screen.getByText("Суперадмин")).toBeTruthy();
    expect(screen.getByText("Директор центра")).toBeTruthy();
    expect(container.querySelector('a[href="/forgot-password"]')).toBeTruthy();
    expect(container.querySelector('a[href="/register"]')).toBeTruthy();
  });

  it("logs in, remembers the choice and follows the ?next= target", async () => {
    window.history.pushState({}, "", "/login?next=/invites/accept?pendingInviteId=abc");
    const { calls } = installFetchMock([
      { match: "/api/auth/login", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    const { container } = render(<LoginPage />);

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "director@example.com" } });
    fireEvent.change(inputs[1], { target: { value: "S3cret!!" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/invites/accept?pendingInviteId=abc"),
    );
    expect(refreshMock).toHaveBeenCalled();
    expect(sentBody(calls[0])).toEqual({
      email: "director@example.com",
      password: "S3cret!!",
      rememberMe: true,
    });
  });

  it("ignores a protocol-relative ?next= and falls back to /dashboard", async () => {
    window.history.pushState({}, "", "/login?next=//evil.example.com");
    installFetchMock([
      { match: "/api/auth/login", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/dashboard"));
  });

  it("renders per-field validation errors from a VALIDATION_ERROR response", async () => {
    installFetchMock([
      {
        match: "/api/auth/login",
        method: "POST",
        reply: jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              details: [
                { path: ["email"], message: "auth.email" },
                { path: ["password"], message: "auth.passwordHint" },
                { message: "ignored-without-path" },
              ],
            },
          },
          400,
        ),
      },
    ]);
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(ru("auth.email"))).toBeTruthy());
    expect(screen.getByText(ru("auth.passwordHint"))).toBeTruthy();
    expect(screen.getByText(ru("common.error"))).toBeTruthy();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("explains a rate-limited login", async () => {
    installFetchMock([
      {
        match: "/api/auth/login",
        method: "POST",
        reply: jsonResponse({ error: { code: "RATE_LIMITED" } }, 429),
      },
    ]);
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() =>
      expect(
        screen.getByText("Слишком много попыток входа. Пожалуйста, подождите 15 минут."),
      ).toBeTruthy(),
    );
  });

  it("shows a translated message and a generic fallback for other failures", async () => {
    installFetchMock([
      {
        match: "/api/auth/login",
        method: "POST",
        reply: jsonResponse({ error: { message: "auth.token.required" } }, 401),
      },
    ]);
    const { container, unmount } = render(<LoginPage />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(ru("auth.token.required"))).toBeTruthy());
    unmount();

    installFetchMock([
      { match: "/api/auth/login", method: "POST", reply: jsonResponse({ success: false }, 400) },
    ]);
    const second = render(<LoginPage />);
    fireEvent.submit(second.container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("Ошибка при входе")).toBeTruthy());
  });

  it("surfaces the thrown error message on a network failure", async () => {
    installFetchMock([]);
    const { container } = render(<LoginPage />);

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText(/Unhandled fetch/)).toBeTruthy());
  });

  it("toggles password visibility, remember-me and the interface locale", () => {
    const { container } = render(<LoginPage />);

    const toggle = screen.getByRole("button", { name: "Показать пароль" });
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: "Скрыть пароль" })).toBeTruthy();
    expect(container.querySelectorAll("input")[1].getAttribute("type")).toBe("text");

    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /zbekcha/ }));
    expect(screen.getByRole("button", { name: /Русский/ })).toBeTruthy();
    expect(screen.getByText("Parol")).toBeTruthy();
    expect(container.querySelector('a[href="/register"]')!.textContent).toBe(
      t("uz-Latn", "auth.register"),
    );
  });

  it("prefills the superadmin credentials from the dev shortcut", () => {
    const { container } = render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Суперадмин" }));

    const inputs = container.querySelectorAll("input");
    expect((inputs[0] as HTMLInputElement).value).toBe("admin@platform.com");
    expect((inputs[1] as HTMLInputElement).value).toBe("Password123!");
  });
});

describe("RegisterPage", () => {
  it("renders the invite form with an empty strength meter", () => {
    const { container } = render(<RegisterPage />);

    expect(screen.getByText("Не задан")).toBeTruthy();
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(container.querySelector('a[href="/login"]')).toBeTruthy();
  });

  it("prefills the invite code from the query string", () => {
    searchParamsRef.current = new URLSearchParams("code=inv-777");
    const { container } = render(<RegisterPage />);

    const codeInput = container.querySelectorAll("input")[0] as HTMLInputElement;
    expect(codeInput.value).toBe("inv-777");
  });

  it("uppercases the invite code as it is typed", () => {
    const { container } = render(<RegisterPage />);
    const codeInput = container.querySelectorAll("input")[0] as HTMLInputElement;

    fireEvent.change(codeInput, { target: { value: "abc-123" } });
    expect(codeInput.value).toBe("ABC-123");
  });

  it("grades password strength from weak to strong", () => {
    const { container } = render(<RegisterPage />);
    const password = container.querySelectorAll("input")[4] as HTMLInputElement;

    fireEvent.change(password, { target: { value: "abcdefghij" } });
    expect(screen.getByText("Слабый (мин. 10 симв.)")).toBeTruthy();

    fireEvent.change(password, { target: { value: "Abcdefghij1" } });
    expect(screen.getByText("Средний")).toBeTruthy();

    fireEvent.change(password, { target: { value: "Abcdefghij1!" } });
    expect(screen.getByText("Надёжный")).toBeTruthy();
  });

  it("registers the user and shows the success screen", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/register", method: "POST", reply: jsonResponse({ success: true }) },
    ]);
    const { container } = render(<RegisterPage />);

    const inputs = container.querySelectorAll("input");
    fireEvent.change(inputs[0], { target: { value: "INV-1" } });
    fireEvent.change(inputs[1], { target: { value: "Алишер Навои" } });
    fireEvent.change(inputs[2], { target: { value: "user@example.uz" } });
    fireEvent.change(inputs[3], { target: { value: "+998901234567" } });
    fireEvent.change(inputs[4], { target: { value: "Abcdefghij1!" } });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.getByText("Регистрация успешна!")).toBeTruthy());
    expect(sentBody(calls[0])).toEqual({
      inviteCode: "INV-1",
      email: "user@example.uz",
      password: "Abcdefghij1!",
      fullName: "Алишер Навои",
      phone: "+998901234567",
      locale: "ru",
    });

    fireEvent.click(screen.getByRole("button", { name: /Войти в систему/ }));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("renders object, string and empty error payloads", async () => {
    installFetchMock([
      {
        match: "/api/auth/register",
        method: "POST",
        reply: jsonResponse({ error: { message: "Код приглашения недействителен" } }, 400),
      },
    ]);
    const { container, unmount } = render(<RegisterPage />);
    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() =>
      expect(screen.getByText("Код приглашения недействителен")).toBeTruthy(),
    );
    unmount();

    installFetchMock([
      { match: "/api/auth/register", method: "POST", reply: jsonResponse({ error: "Плохой код" }, 400) },
    ]);
    const second = render(<RegisterPage />);
    fireEvent.submit(second.container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("Плохой код")).toBeTruthy());
    second.unmount();

    installFetchMock([
      { match: "/api/auth/register", method: "POST", reply: jsonResponse({}, 400) },
    ]);
    const third = render(<RegisterPage />);
    fireEvent.submit(third.container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText("Ошибка при регистрации")).toBeTruthy());
  });

  it("switches the interface locale and reports network failures in it", async () => {
    installFetchMock([]);
    const { container } = render(<RegisterPage />);

    fireEvent.click(screen.getByRole("button", { name: /zbekcha/ }));
    expect(screen.getByText("Taklifnoma orqali ro'yxatdan o'tish")).toBeTruthy();

    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(screen.getByText(/Unhandled fetch/)).toBeTruthy());

    installFetchMock([]);
    const passwordToggle = screen.getByRole("button", { name: "Показать пароль" });
    fireEvent.click(passwordToggle);
    expect(screen.getByRole("button", { name: "Скрыть пароль" })).toBeTruthy();
  });
});
