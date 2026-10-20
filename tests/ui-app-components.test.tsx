// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import WorkspaceSwitcher from "@/components/WorkspaceSwitcher";
import PlatformSidebar from "@/components/platform/PlatformSidebar";
import ImpersonateButton from "@/components/ImpersonateButton";
import LogoutButton from "@/components/LogoutButton";
import { ThemeProvider, useTheme } from "@/components/landing/ThemeProvider";
import { AuthShell } from "@/components/auth/AuthShell";
import { SUPPORTED_LOCALES, LOCALE_META, t } from "@/i18n";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

const { pushMock, refreshMock, pathnameRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  refreshMock: vi.fn(),
  pathnameRef: { current: "/platform-admin" },
}));

// `window.location.reload` cannot be stubbed (non-configurable in jsdom), so the
// component goes through `@/lib/reload` and the test observes that helper.
const reloadMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/reload", () => ({ reloadPage: reloadMock }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: refreshMock,
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => pathnameRef.current,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: (props: unknown) => {
      const { href, children, onClick, ...rest } = props as {
        href?: unknown;
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
  refreshMock.mockReset();
  pathnameRef.current = "/platform-admin";
  window.localStorage.clear();
  document.documentElement.classList.remove("dark");
  vi.spyOn(window, "alert").mockImplementation(() => {});
  vi.spyOn(window, "confirm").mockImplementation(() => true);

  reloadMock.mockReset();
});

afterEach(() => {
  document.documentElement.classList.remove("dark");
  cleanup();
  vi.restoreAllMocks();
});

const memberships = [
  {
    id: "m-1",
    centerId: "c-1",
    centerName: "Alpha Academy",
    centerSlug: "alpha",
    centerStatus: "ACTIVE",
    role: "DIRECTOR",
  },
  {
    id: "m-2",
    centerId: "c-2",
    centerName: "Beta School",
    centerSlug: "beta",
    centerStatus: "ACTIVE",
    role: "TEACHER",
  },
];

describe("LanguageSwitcher", () => {
  it("shows the current locale and lists every supported locale when opened", () => {
    render(<LanguageSwitcher currentLocale="ru" />);

    const trigger = screen.getByRole("button", { name: "Change language" });
    expect(trigger.textContent).toContain(LOCALE_META.ru.nativeLabel);
    // dropdown starts closed
    expect(screen.queryByText(LOCALE_META["uz-Latn"].nativeLabel)).toBeNull();

    fireEvent.click(trigger);
    for (const locale of SUPPORTED_LOCALES) {
      expect(screen.getAllByText(LOCALE_META[locale].nativeLabel).length).toBeGreaterThan(0);
    }
    // the translated label is shown only when it differs from the native one
    expect(screen.getByText(LOCALE_META["uz-Latn"].label)).toBeTruthy();
  });

  it("selects another locale without persisting when persist=false", () => {
    const onLocaleChange = vi.fn();
    const { calls } = installFetchMock([]);
    render(<LanguageSwitcher currentLocale="ru" onLocaleChange={onLocaleChange} persist={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(screen.getByText(LOCALE_META["uz-Latn"].nativeLabel));

    expect(onLocaleChange).toHaveBeenCalledWith("uz-Latn");
    expect(calls).toHaveLength(0);
    expect(screen.queryByText(LOCALE_META["uz-Latn"].label)).toBeNull();
  });

  it("ignores a click on the already-active locale", () => {
    const onLocaleChange = vi.fn();
    render(<LanguageSwitcher currentLocale="ru" onLocaleChange={onLocaleChange} persist={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(screen.getAllByText(LOCALE_META.ru.nativeLabel)[1]);

    expect(onLocaleChange).not.toHaveBeenCalled();
    // the dropdown is still dismissed
    expect(screen.queryByText(LOCALE_META["uz-Latn"].nativeLabel)).toBeNull();
  });

  it("persists the new locale, notifies and reloads on success", async () => {
    const onLocaleChange = vi.fn();
    const { calls } = installFetchMock([
      { match: "/api/auth/me/language", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);
    render(<LanguageSwitcher currentLocale="ru" onLocaleChange={onLocaleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(screen.getByText(LOCALE_META["uz-Latn"].nativeLabel));

    await waitFor(() => expect(onLocaleChange).toHaveBeenCalledWith("uz-Latn"));
    expect(sentBody(calls[0])).toEqual({ language: "uz-Latn" });
    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it("reports a rejected save without notifying the parent", async () => {
    const onLocaleChange = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    installFetchMock([
      { match: "/api/auth/me/language", method: "PATCH", reply: jsonResponse({}, 500) },
    ]);
    render(<LanguageSwitcher currentLocale="ru" onLocaleChange={onLocaleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(screen.getByText(LOCALE_META["uz-Latn"].nativeLabel));

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(onLocaleChange).not.toHaveBeenCalled();
    expect(reloadMock).not.toHaveBeenCalled();
  });

  it("reports a network failure without notifying the parent", async () => {
    const onLocaleChange = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    installFetchMock([]);
    render(<LanguageSwitcher currentLocale="ru" onLocaleChange={onLocaleChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Change language" }));
    fireEvent.click(screen.getByText(LOCALE_META["uz-Latn"].nativeLabel));

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(onLocaleChange).not.toHaveBeenCalled();
  });

  it("closes on an outside click and renders an icon only in compact mode", () => {
    render(<LanguageSwitcher currentLocale="ru" compact />);

    const trigger = screen.getByRole("button", { name: "Change language" });
    expect(trigger.textContent).toBe("");

    fireEvent.click(trigger);
    expect(screen.getByText(LOCALE_META["uz-Latn"].nativeLabel)).toBeTruthy();

    fireEvent.mouseDown(document.body);
    expect(screen.queryByText(LOCALE_META["uz-Latn"].nativeLabel)).toBeNull();
  });

  it("falls back to the Russian metadata for an unknown locale", () => {
    render(<LanguageSwitcher currentLocale="fr" />);
    expect(
      screen.getByRole("button", { name: "Change language" }).textContent,
    ).toContain(LOCALE_META.ru.nativeLabel);
  });
});

describe("WorkspaceSwitcher", () => {
  it("renders every membership and marks the active workspace", () => {
    const { container } = render(
      <WorkspaceSwitcher memberships={memberships} activeCenterId="c-2" platformRole="DIRECTOR" />,
    );

    expect(screen.getByText("Текущий Воркспейс")).toBeTruthy();
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("c-2");
    const options = container.querySelectorAll("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toBe("Alpha Academy (DIRECTOR)");
    expect(options[1].textContent).toBe("Beta School (TEACHER)");
    expect(screen.queryByText(/Создать центр/)).toBeNull();
  });

  it("defaults to the first workspace and switches tenant on change", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/switch-tenant", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    const { container } = render(
      <WorkspaceSwitcher memberships={memberships} platformRole="DIRECTOR" />,
    );

    const select = container.querySelector("select") as HTMLSelectElement;
    expect(select.value).toBe("c-1");

    fireEvent.change(select, { target: { value: "c-2" } });

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({ centerId: "c-2" });
  });

  it("does not refresh the router when the switch request fails", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/switch-tenant", method: "POST", reply: jsonResponse({}, 500) },
    ]);
    const { container } = render(
      <WorkspaceSwitcher memberships={memberships} platformRole="DIRECTOR" />,
    );

    fireEvent.change(container.querySelector("select")!, { target: { value: "c-2" } });

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("logs a network failure instead of refreshing", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    installFetchMock([]);
    const { container } = render(
      <WorkspaceSwitcher memberships={memberships} platformRole="DIRECTOR" />,
    );

    fireEvent.change(container.querySelector("select")!, { target: { value: "c-2" } });

    await waitFor(() => expect(errorSpy).toHaveBeenCalled());
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("shows the empty placeholder when there are no memberships", () => {
    const { container } = render(<WorkspaceSwitcher memberships={[]} platformRole="DIRECTOR" />);

    expect(screen.getByText("Нет активных центров")).toBeTruthy();
    expect(container.querySelector("select")).toBeNull();
  });

  it("renders the create-center link for platform staff only", () => {
    const { container, unmount } = render(
      <WorkspaceSwitcher memberships={memberships} platformRole="SUPERADMIN" />,
    );
    expect(screen.getByText("+ Создать центр (Платформа)")).toBeTruthy();
    expect(container.querySelector('a[href="/dashboard/platform"]')).toBeTruthy();
    unmount();

    render(<WorkspaceSwitcher memberships={memberships} platformRole="PLATFORM_ADMIN" />);
    expect(screen.getByText("+ Создать центр (Платформа)")).toBeTruthy();
  });
});

const navLabels = {
  analytics: t("ru", "platform.analytics"),
  centers: t("ru", "platform.centerManagement"),
  plans: t("ru", "platform.plans"),
  subscriptions: t("ru", "platform.subscriptions"),
  support: t("ru", "platform.support"),
  audit: t("ru", "platform.auditLog"),
  impersonate: t("ru", "platform.impersonate"),
};

const superadmin = { fullName: "Азиз Каримов", email: "aziz@example.uz", platformRole: "SUPERADMIN" };

describe("PlatformSidebar", () => {
  it("renders every nav item for a superadmin and marks the exact analytics link active", () => {
    render(<PlatformSidebar user={superadmin} locale="ru" />);

    for (const label of Object.values(navLabels)) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }

    const analyticsLink = screen.getByText(navLabels.analytics).closest("a")!;
    expect(analyticsLink.getAttribute("href")).toBe("/platform-admin");
    expect(analyticsLink.className).toContain("bg-blue-50");

    const centersLink = screen.getByText(navLabels.centers).closest("a")!;
    expect(centersLink.getAttribute("href")).toBe("/platform-admin/centers");
    expect(centersLink.className).not.toContain("bg-blue-50");
  });

  it("filters the navigation by platform role", () => {
    const { unmount } = render(
      <PlatformSidebar
        user={{ ...superadmin, platformRole: "PLATFORM_SUPPORT" }}
        locale="ru"
      />,
    );
    expect(screen.getByText(navLabels.analytics)).toBeTruthy();
    expect(screen.getByText(navLabels.support)).toBeTruthy();
    expect(screen.getByText(navLabels.impersonate)).toBeTruthy();
    expect(screen.queryByText(navLabels.centers)).toBeNull();
    expect(screen.queryByText(navLabels.plans)).toBeNull();
    expect(screen.queryByText(navLabels.audit)).toBeNull();
    unmount();

    render(
      <PlatformSidebar user={{ ...superadmin, platformRole: "FULL_ACCESS" }} locale="ru" />,
    );
    expect(screen.getByText(navLabels.centers)).toBeTruthy();
    expect(screen.getByText(navLabels.support)).toBeTruthy();
    expect(screen.queryByText(navLabels.plans)).toBeNull();
    expect(screen.queryByText(navLabels.impersonate)).toBeNull();
  });

  it("activates a non-exact item when the path is nested below it", () => {
    pathnameRef.current = "/platform-admin/centers/xyz";
    render(<PlatformSidebar user={superadmin} locale="ru" />);

    expect(screen.getByText(navLabels.centers).closest("a")!.className).toContain("bg-blue-50");
    expect(screen.getByText(navLabels.analytics).closest("a")!.className).not.toContain(
      "bg-blue-50",
    );
  });

  it("renders the user card, the role badge, the back link and the bottom widgets", () => {
    const { container } = render(<PlatformSidebar user={superadmin} locale="ru" />);

    expect(screen.getByText(superadmin.fullName)).toBeTruthy();
    expect(screen.getByText(superadmin.email)).toBeTruthy();
    expect(screen.getByText(t("ru", "roles.SUPERADMIN"))).toBeTruthy();
    expect(screen.getByText("Вернуться в учебный центр")).toBeTruthy();
    expect(container.querySelector('a[href="/center"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: "Change language" })).toBeTruthy();
    expect(screen.getByText("Выйти из аккаунта")).toBeTruthy();
  });

  it("opens and closes the mobile drawer and locks the body scroll", async () => {
    const { container } = render(<PlatformSidebar user={superadmin} locale="ru" />);

    expect(container.querySelector(".fixed.inset-0.z-50")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню навигации" }));
    expect(container.querySelector(".fixed.inset-0.z-50")).toBeTruthy();
    expect(document.body.style.overflow).toBe("hidden");

    // the close button exists in both the drawer and the (CSS-hidden) desktop nav
    fireEvent.click(screen.getAllByRole("button", { name: "Закрыть меню" })[0]);
    await waitFor(() => expect(container.querySelector(".fixed.inset-0.z-50")).toBeNull());
    await waitFor(() => expect(document.body.style.overflow).toBe(""));
  });

  it("closes the drawer when the route changes", async () => {
    const { container, rerender } = render(<PlatformSidebar user={superadmin} locale="ru" />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть меню навигации" }));
    expect(container.querySelector(".fixed.inset-0.z-50")).toBeTruthy();

    pathnameRef.current = "/platform-admin/centers";
    rerender(<PlatformSidebar user={superadmin} locale="ru" />);

    await waitFor(() => expect(container.querySelector(".fixed.inset-0.z-50")).toBeNull());
  });

  it("renders the localized navigation for the uz-Latn locale", () => {
    render(
      <PlatformSidebar user={{ ...superadmin, fullName: "Aziz Karimov" }} locale="uz-Latn" />,
    );

    expect(screen.getByText(t("uz-Latn", "platform.analytics"))).toBeTruthy();
    expect(screen.getByText(t("uz-Latn", "platform.centerManagement"))).toBeTruthy();
    expect(screen.getByText(t("uz-Latn", "roles.SUPERADMIN"))).toBeTruthy();
  });
});

describe("ImpersonateButton", () => {
  it("renders the default label and impersonates the target user", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/impersonate", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    render(<ImpersonateButton targetUserId="u-1" targetCenterId="c-9" />);

    const button = screen.getByRole("button", { name: /Войти как/ });
    fireEvent.click(button);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sentBody(calls[0])).toEqual({ targetUserId: "u-1", targetCenterId: "c-9" });
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("surfaces the server error, the generic error and a network failure", async () => {
    installFetchMock([
      { match: "/api/platform/impersonate", method: "POST", reply: jsonResponse({ error: "Нет доступа" }, 403) },
    ]);
    const first = render(<ImpersonateButton targetUserId="u-1" label="Impersonate" />);
    expect(screen.getByRole("button", { name: /Impersonate/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Impersonate/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Нет доступа"));
    first.unmount();

    installFetchMock([
      { match: "/api/platform/impersonate", method: "POST", reply: jsonResponse({}, 500) },
    ]);
    vi.mocked(window.alert).mockClear();
    const second = render(<ImpersonateButton targetUserId="u-2" />);
    fireEvent.click(screen.getByRole("button", { name: /Войти как/ }));
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Ошибка входа от имени пользователя"),
    );
    second.unmount();

    installFetchMock([]);
    vi.mocked(window.alert).mockClear();
    render(<ImpersonateButton targetUserId="u-3" />);
    fireEvent.click(screen.getByRole("button", { name: /Войти как/ }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("disables the button while the request is in flight", async () => {
    let resolveFetch!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    installFetchMock([
      {
        match: "/api/platform/impersonate",
        method: "POST",
        reply: (() => pending) as unknown as () => Response,
      },
    ]);
    render(<ImpersonateButton targetUserId="u-1" />);

    const button = screen.getByRole("button", { name: /Войти как/ }) as HTMLButtonElement;
    fireEvent.click(button);

    await waitFor(() => expect(button.disabled).toBe(true));
    resolveFetch(jsonResponse({ ok: true }));
    await waitFor(() => expect(button.disabled).toBe(false));
  });
});

describe("LogoutButton", () => {
  it("posts the logout request and redirects to the login page", async () => {
    const { calls } = installFetchMock([
      { match: "/api/auth/logout", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);
    render(<LogoutButton />);

    fireEvent.click(screen.getByRole("button", { name: /Выйти из аккаунта/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/login"));
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(calls[0].url).toContain("/api/auth/logout");
    expect(calls[0].init?.method).toBe("POST");
    expect(calls[0].init?.body).toBeUndefined();
  });
});

const ThemeProbe = () => {
  const { theme, toggleTheme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("light")}>light</button>
    </div>
  );
};

describe("ThemeProvider", () => {
  const themeAttr = () => document.documentElement.getAttribute("data-theme");

  it("renders children and starts in light mode without a saved preference", () => {
    render(
      <ThemeProvider>
        <p>themed content</p>
      </ThemeProvider>,
    );

    expect(screen.getByText("themed content")).toBeTruthy();
    expect(themeAttr()).toBe("light");
  });

  it("applies the saved dark preference on mount", async () => {
    window.localStorage.setItem("edarschi-theme", "dark");
    render(
      <ThemeProvider>
        <p>x</p>
      </ThemeProvider>,
    );

    await waitFor(() => expect(themeAttr()).toBe("dark"));
    // The legacy `.dark` class would repaint the dashboards through body tokens.
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("applies the light attribute when the saved preference is light", async () => {
    document.documentElement.setAttribute("data-theme", "dark");
    window.localStorage.setItem("edarschi-theme", "light");
    render(
      <ThemeProvider>
        <p>x</p>
      </ThemeProvider>,
    );

    await waitFor(() => expect(themeAttr()).toBe("light"));
  });

  it("honours a ?theme= pin without overwriting the saved preference", () => {
    window.localStorage.setItem("edarschi-theme", "light");
    window.history.pushState({}, "", "/?theme=dark");

    render(
      <ThemeProvider>
        <p>x</p>
      </ThemeProvider>,
    );

    expect(themeAttr()).toBe("dark");
    // A shared link must not silently rewrite the visitor's own choice.
    expect(window.localStorage.getItem("edarschi-theme")).toBe("light");

    window.history.pushState({}, "", "/");
  });

  it("exposes toggleTheme and setTheme through the context and persists the choice", () => {
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("current-theme").textContent).toBe("light");

    fireEvent.click(screen.getByText("toggle"));
    expect(screen.getByTestId("current-theme").textContent).toBe("dark");
    expect(window.localStorage.getItem("edarschi-theme")).toBe("dark");
    expect(themeAttr()).toBe("dark");

    fireEvent.click(screen.getByText("light"));
    expect(screen.getByTestId("current-theme").textContent).toBe("light");
    expect(window.localStorage.getItem("edarschi-theme")).toBe("light");
    expect(themeAttr()).toBe("light");
  });

  it("throws when useTheme is used outside a provider", () => {
    const Orphan = () => {
      useTheme();
      return null;
    };
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => render(<Orphan />)).toThrow(/useTheme must be used within a ThemeProvider/);
  });
});

describe("AuthShell", () => {
  it("renders the brand link, the header and the children", () => {
    const { container } = render(
      <AuthShell title="Заголовок" subtitle="Подзаголовок">
        <button>continue</button>
      </AuthShell>,
    );

    expect(screen.getByText("e-darischi")).toBeTruthy();
    expect(container.querySelector('a[href="/"]')).toBeTruthy();
    expect(screen.getByText("Заголовок")).toBeTruthy();
    expect(screen.getByText("Подзаголовок")).toBeTruthy();
    expect(screen.getByRole("button", { name: "continue" })).toBeTruthy();
    expect(container.querySelector(".max-w-md")).toBeTruthy();
  });

  it("widens the card and drops the header block when no copy is provided", () => {
    const { container } = render(
      <AuthShell wide>
        <span>only children</span>
      </AuthShell>,
    );

    expect(container.querySelector(".max-w-lg")).toBeTruthy();
    expect(container.querySelector(".max-w-md")).toBeNull();
    expect(container.querySelector("h1")).toBeNull();
    expect(container.querySelector("p")).toBeNull();
    expect(screen.getByText("only children")).toBeTruthy();
  });
});
