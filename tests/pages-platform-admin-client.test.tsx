// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import PlatformCentersPage from "@/app/platform-admin/centers/page";
import CreateCenterPage from "@/app/platform-admin/centers/create/page";
import PlatformPlansPage from "@/app/platform-admin/plans/page";
import PlatformSubscriptionsPage from "@/app/platform-admin/subscriptions/page";
import PlatformSupportPage from "@/app/platform-admin/support/page";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

/**
 * Client pages of the platform-admin section:
 *  - platform-admin/centers              (fetch list + search/status/pagination)
 *  - platform-admin/centers/create       (zod-stepper wizard + POST)
 *  - platform-admin/plans                (fetch cards + create/edit modal)
 *  - platform-admin/subscriptions        (fetch table + filter/pagination)
 *  - platform-admin/support              (fetch tickets + status tabs + PATCH)
 *
 * All network traffic is mocked through `installFetchMock`; the router is
 * hoisted so `router.push` can be asserted.
 */

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/platform-admin/centers",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: ({ href, children, onClick, ...rest }: Record<string, unknown>) =>
      React.createElement(
        "a",
        {
          href: typeof href === "string" ? href : "",
          onClick: (e: { preventDefault: () => void }) => {
            e.preventDefault();
          },
          ...rest,
        } as Record<string, unknown>,
        children as React.ReactNode,
      ),
  };
});

beforeEach(() => {
  pushMock.mockReset();
  vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// 1. /platform-admin/centers
// ---------------------------------------------------------------------------

describe("platform-admin/centers page", () => {
  const centers = [
    {
      id: "c-1",
      name: "Alpha Center",
      slug: "alpha",
      email: "alpha@x.uz",
      phone: "+998900000001",
      status: "ACTIVE",
      owner: { id: "u-9", fullName: "Alice", email: "alice@x.uz" },
    },
    {
      id: "c-2",
      name: "Beta Center",
      slug: "beta",
      email: null,
      phone: null,
      status: "PAUSED",
      owner: null,
    },
  ];

  it("shows the loading placeholder, then the fetched centers table", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers", reply: jsonResponse({ items: centers, total: 2, pageSize: 10 }) },
    ]);

    render(<PlatformCentersPage />);
    expect(screen.getByText("Загрузка списка учебных центров...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Alpha Center")).toBeTruthy());

    expect(calls[0].url).toBe("/api/platform/centers?page=1");
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("alpha@x.uz")).toBeTruthy();
    expect(screen.getByText("+998900000001")).toBeTruthy();
    expect(screen.getByText("Beta Center")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("PAUSED")).toBeTruthy();
    // dash placeholders for the center without contacts
    expect(screen.getAllByText("—").length).toBe(2);
    // only the owner-having center exposes the impersonation button
    expect(screen.getAllByText("Войти как")).toHaveLength(1);
    expect(screen.getAllByText("Карточка")).toHaveLength(2);
    // single page -> no pagination controls
    expect(screen.queryByText("Вперед")).toBeNull();
  });

  it("falls back to json.data / meta.totalPages and renders pagination", async () => {
    installFetchMock([
      {
        match: "/api/platform/centers",
        reply: jsonResponse({ data: [centers[0]], meta: { totalPages: 3 } }),
      },
    ]);

    render(<PlatformCentersPage />);
    await waitFor(() => expect(screen.getByText("Alpha Center")).toBeTruthy());

    expect(screen.getByText("Страница 1 из 3")).toBeTruthy();
    expect((screen.getByRole("button", { name: /Назад/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: /Вперед/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("renders the empty state when the API returns nothing", async () => {
    installFetchMock([{ match: "/api/platform/centers", reply: jsonResponse({ items: [] }) }]);

    render(<PlatformCentersPage />);
    await waitFor(() => expect(screen.getByText("Центры не найдены")).toBeTruthy());
  });

  it("surfaces a non-2xx response as the error banner", async () => {
    installFetchMock([{ match: "/api/platform/centers", reply: jsonResponse({}, 500) }]);

    render(<PlatformCentersPage />);
    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить список центров")).toBeTruthy(),
    );
  });

  it("surfaces an invalid JSON payload with the thrown error message", async () => {
    installFetchMock([{ match: "/api/platform/centers", reply: brokenResponse() }]);

    render(<PlatformCentersPage />);
    await waitFor(() => expect(screen.getByText("invalid json")).toBeTruthy());
  });

  it("pages forward and back through the list", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers", reply: jsonResponse({ items: centers, total: 25, pageSize: 10 }) },
    ]);

    render(<PlatformCentersPage />);
    await waitFor(() => expect(screen.getByText("Страница 1 из 3")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Вперед/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/platform/centers?page=2")).toBe(true),
    );

    fireEvent.click(screen.getByRole("button", { name: /Назад/ }));
    await waitFor(() =>
      expect(calls.filter((c) => c.url === "/api/platform/centers?page=1").length).toBe(2),
    );
  });

  it("sends the selected status filter and moves the debounced search to page 1", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers", reply: jsonResponse({ items: centers, total: 25, pageSize: 10 }) },
    ]);

    const { container } = render(<PlatformCentersPage />);
    await waitFor(() => expect(screen.getByText("Страница 1 из 3")).toBeTruthy());

    // go to page 2 so we can observe the reset
    fireEvent.click(screen.getByRole("button", { name: /Вперед/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/platform/centers?page=2")).toBe(true),
    );

    // status filter (immediately resets page)
    fireEvent.change(container.querySelector("select")!, { target: { value: "ACTIVE" } });
    await waitFor(() =>
      expect(calls.some((c) => c.url.includes("status=ACTIVE") && c.url.includes("page=1"))).toBe(
        true,
      ),
    );

    // debounced search resets to page 1 as well
    fireEvent.change(container.querySelector('input[type="text"]')!, { target: { value: "alp" } });
    await waitFor(() => expect(calls.some((c) => c.url.includes("q=alp"))).toBe(true), {
      timeout: 2000,
    });
    expect(calls.some((c) => c.url.includes("q=alp") && c.url.includes("page=1"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 2. /platform-admin/centers/create
// ---------------------------------------------------------------------------

describe("platform-admin/centers/create page", () => {
  const next = () => screen.getByRole("button", { name: "Далее" });

  function fillStep1(container: HTMLElement) {
    fireEvent.change(container.querySelector('input[name="name"]')!, {
      target: { value: "Al Beruniy" },
    });
    fireEvent.change(container.querySelector('input[name="slug"]')!, {
      target: { value: "al-beruniy" },
    });
    fireEvent.change(container.querySelector('input[name="phone"]')!, {
      target: { value: "+998901234567" },
    });
    fireEvent.change(container.querySelector('input[name="email"]')!, {
      target: { value: "info@center.uz" },
    });
  }

  function fillStep3(container: HTMLElement) {
    fireEvent.change(container.querySelector('input[name="directorFullName"]')!, {
      target: { value: "Ivan Petrov" },
    });
    fireEvent.change(container.querySelector('input[name="directorEmail"]')!, {
      target: { value: "director@center.uz" },
    });
    fireEvent.change(container.querySelector('input[name="directorPhone"]')!, {
      target: { value: "+998909876543" },
    });
  }

  /** Walk the wizard to step 4 with valid data. */
  function reachStep4(container: HTMLElement) {
    fillStep1(container);
    fireEvent.click(next());
    fireEvent.click(next()); // step 2 -> 3 (TRIAL default is valid)
    fillStep3(container);
    fireEvent.click(next()); // step 3 -> 4
  }

  it("blocks step 1 with validation errors and has a disabled back button", () => {
    installFetchMock([]);
    const { container } = render(<CreateCenterPage />);

    expect(screen.getByText("Шаг 1: Основные реквизиты центра")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Назад" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(next());

    expect(screen.getByText("Название должно содержать не менее 2 символов")).toBeTruthy();
    expect(screen.getByText("Укажите контактный номер телефона")).toBeTruthy();
    expect(screen.getByText("Некорректный email адрес")).toBeTruthy();
    // still on step 1
    expect(screen.queryByText("Шаг 2: Начальный статус доступа")).toBeNull();
  });

  it("rejects a slug with invalid characters", () => {
    installFetchMock([]);
    const { container } = render(<CreateCenterPage />);

    fireEvent.change(container.querySelector('input[name="slug"]')!, { target: { value: "AB_C" } });
    fireEvent.click(next());

    expect(
      screen.getByText("Slug может содержать только строчные латинские буквы, цифры и дефис"),
    ).toBeTruthy();
    expect(screen.queryByText("Шаг 2: Начальный статус доступа")).toBeNull();
  });

  it("walks through all steps, toggles the trial date and creates the center", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/platform/centers",
        method: "POST",
        reply: jsonResponse({ center: { id: "c-9" } }, 201),
      },
    ]);
    const { container } = render(<CreateCenterPage />);

    fillStep1(container);
    fireEvent.click(next());
    expect(screen.getByText("Шаг 2: Начальный статус доступа")).toBeTruthy();
    // TRIAL keeps the trial-end input visible
    expect(container.querySelector('input[name="trialEndsAt"]')).not.toBeNull();

    fireEvent.change(container.querySelector('select[name="status"]')!, {
      target: { value: "ACTIVE" },
    });
    expect(container.querySelector('input[name="trialEndsAt"]')).toBeNull();

    fireEvent.click(next());
    expect(screen.getByText("Шаг 3: Директор учебного центра")).toBeTruthy();

    // going back is allowed once past step 1
    fireEvent.click(screen.getByRole("button", { name: "Назад" }));
    expect(screen.getByText("Шаг 2: Начальный статус доступа")).toBeTruthy();
    fireEvent.click(next());

    // step 3 validation
    fireEvent.click(next());
    expect(screen.getByText("Укажите полное имя директора")).toBeTruthy();
    expect(screen.getByText("Некорректный email директора")).toBeTruthy();

    fillStep3(container);
    fireEvent.click(next());
    expect(screen.getByText("Шаг 4: Проверка и создание")).toBeTruthy();
    expect(screen.getByText("Al Beruniy")).toBeTruthy();
    expect(screen.getByText("al-beruniy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/platform-admin/centers/c-9"));
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post?.init?.method).toBe("POST");
    expect(sentBody(post!)).toEqual({
      name: "Al Beruniy",
      slug: "al-beruniy",
      phone: "+998901234567",
      email: "info@center.uz",
      timeZone: "Asia/Tashkent",
      status: "ACTIVE",
      trialEndsAt: "",
      directorEmail: "director@center.uz",
      directorFullName: "Ivan Petrov",
      directorPhone: "+998909876543",
    });
  });

  it("falls back to the centers list when the API returns no id", async () => {
    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({ data: {} }, 201) },
    ]);
    const { container } = render(<CreateCenterPage />);

    reachStep4(container);
    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/platform-admin/centers"));
  });

  it("prefers data.data.id when the payload nests the center there", async () => {
    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({ data: { id: "c-77" } }, 201) },
    ]);
    const { container } = render(<CreateCenterPage />);

    reachStep4(container);
    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/platform-admin/centers/c-77"));
  });

  it("shows the API message on a 400 and uses the generic message without one", async () => {
    installFetchMock([
      {
        match: "/api/platform/centers",
        method: "POST",
        reply: jsonResponse({ message: "Slug уже занят" }, 400),
      },
    ]);
    const first = render(<CreateCenterPage />);
    reachStep4(first.container);
    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));
    await waitFor(() => expect(screen.getByText("Slug уже занят")).toBeTruthy());
    expect(pushMock).not.toHaveBeenCalled();
    first.unmount();

    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({}, 400) },
    ]);
    const second = render(<CreateCenterPage />);
    reachStep4(second.container);
    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));
    await waitFor(() =>
      expect(screen.getByText("Ошибка при создании учебного центра")).toBeTruthy(),
    );
  });

  it("reports a network failure without navigating", async () => {
    // A rejected fetch that throws a non-Error value exercises the generic branch.
    installFetchMock([
      {
        match: "/api/platform/centers",
        method: "POST",
        reply: () => {
          throw "network down";
        },
      },
    ]);
    const { container } = render(<CreateCenterPage />);

    reachStep4(container);
    fireEvent.click(screen.getByRole("button", { name: /Завершить и создать/ }));

    await waitFor(() => expect(screen.getByText("Не удалось создать центр")).toBeTruthy());
    expect(pushMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 3. /platform-admin/plans
// ---------------------------------------------------------------------------

describe("platform-admin/plans page", () => {
  const plan = {
    id: "pl-1",
    name: "Standard",
    priceMonthly: 50,
    maxStudents: 100,
    maxTeachers: 10,
    maxCourses: 20,
    maxBranches: 1,
    maxStorage: 5120,
    isActive: true,
    _count: { subscriptions: 3 },
  };
  const inactivePlan = {
    ...plan,
    id: "pl-2",
    name: "Legacy",
    isActive: false,
    _count: undefined,
  };

  it("shows the loading placeholder, then renders plan cards and limits", async () => {
    installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan, inactivePlan] }) },
    ]);

    const { container } = render(<PlatformPlansPage />);
    expect(screen.getByText("Загрузка тарифных планов...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Standard")).toBeTruthy());

    expect(screen.getByText("Legacy")).toBeTruthy();
    expect(screen.getAllByText("$50")).toHaveLength(2);
    expect(screen.getByText("НЕАКТИВЕН")).toBeTruthy();
    expect(container.textContent).toContain("100");
    expect(container.textContent).toContain("учеников");
    expect(container.textContent).toContain("GB");
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getAllByText("Изменить")).toHaveLength(2);
  });

  it("renders the empty and error states", async () => {
    installFetchMock([{ match: "/api/platform/plans", reply: jsonResponse({ plans: [] }) }]);
    const first = render(<PlatformPlansPage />);
    await waitFor(() => expect(screen.getByText("Тарифы еще не созданы")).toBeTruthy());
    first.unmount();

    installFetchMock([{ match: "/api/platform/plans", reply: jsonResponse({}, 500) }]);
    render(<PlatformPlansPage />);
    await waitFor(() => expect(screen.getByText("Не удалось загрузить тарифные планы")).toBeTruthy());
  });

  it("creates a plan via POST and refetches on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
      { match: "/api/platform/plans", method: "POST", reply: jsonResponse({}, 201) },
    ]);

    const { container } = render(<PlatformPlansPage />);
    await waitFor(() => expect(screen.getByText("Standard")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Создать тариф/ }));
    expect(screen.getByText("Новый тарифный план")).toBeTruthy();

    const form = container.querySelector("form")!;
    fireEvent.change(form.querySelector('input[type="text"]')!, { target: { value: "Pro" } });
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByText("Новый тарифный план")).toBeNull());
    const post = calls.find((c) => c.init?.method === "POST");
    expect(post?.url).toBe("/api/platform/plans");
    expect(sentBody(post!)).toMatchObject({ name: "Pro", priceMonthly: 50, isActive: true });
    // initial GET + refetch after the successful save
    expect(calls.filter((c) => !c.init?.method || c.init.method === "GET").length).toBe(2);
  });

  it("edits a plan via PATCH with its id and closes the modal", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
      { match: "/api/platform/plans", method: "PATCH", reply: jsonResponse({}, 200) },
    ]);

    const { container } = render(<PlatformPlansPage />);
    await waitFor(() => expect(screen.getByText("Standard")).toBeTruthy());

    fireEvent.click(screen.getByText("Изменить"));
    expect(screen.getByText("Редактировать тариф")).toBeTruthy();

    const form = container.querySelector("form")!;
    expect((form.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("Standard");
    fireEvent.change(form.querySelector('input[type="text"]')!, { target: { value: "Standard+" } });
    fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByText("Редактировать тариф")).toBeNull());
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(sentBody(patch!)).toMatchObject({ id: "pl-1", name: "Standard+" });
  });

  it("cancels the modal without sending a request", () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
    ]);

    render(<PlatformPlansPage />);
    fireEvent.click(screen.getByRole("button", { name: /Создать тариф/ }));
    expect(screen.getByText("Новый тарифный план")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByText("Новый тарифный план")).toBeNull();
    expect(calls.filter((c) => c.init?.method === "POST")).toHaveLength(0);
  });

  it("alerts with the API error, the generic message and the network fallback", async () => {
    installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
      { match: "/api/platform/plans", method: "POST", reply: jsonResponse({ error: "Тариф существует" }, 400) },
    ]);
    const first = render(<PlatformPlansPage />);
    fireEvent.click(screen.getByRole("button", { name: /Создать тариф/ }));
    fireEvent.submit(first.container.querySelector("form")!);
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Тариф существует"),
    );
    // the modal stays open so the operator can correct the input
    expect(screen.getByText("Новый тарифный план")).toBeTruthy();
    first.unmount();

    installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
      { match: "/api/platform/plans", method: "POST", reply: jsonResponse({}, 400) },
    ]);
    const second = render(<PlatformPlansPage />);
    fireEvent.click(screen.getByRole("button", { name: /Создать тариф/ }));
    fireEvent.submit(second.container.querySelector("form")!);
    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Не удалось сохранить тариф"),
    );
    second.unmount();

    installFetchMock([
      { match: "/api/platform/plans", reply: jsonResponse({ plans: [plan] }) },
      {
        match: "/api/platform/plans",
        method: "POST",
        reply: () => {
          throw "network down";
        },
      },
    ]);
    const third = render(<PlatformPlansPage />);
    fireEvent.click(screen.getByRole("button", { name: /Создать тариф/ }));
    fireEvent.submit(third.container.querySelector("form")!);
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сохранения"));
  });
});

// ---------------------------------------------------------------------------
// 4. /platform-admin/subscriptions
// ---------------------------------------------------------------------------

describe("platform-admin/subscriptions page", () => {
  const subs = [
    {
      id: "s-1",
      status: "ACTIVE",
      currentPeriodStartsAt: "2026-01-01T00:00:00.000Z",
      currentPeriodEndsAt: "2026-02-01T00:00:00.000Z",
      autoRenew: true,
      center: { id: "c-1", name: "Alpha", slug: "alpha", status: "ACTIVE" },
      plan: { id: "pl-1", name: "Standard", priceMonthly: 50 },
    },
    {
      id: "s-2",
      status: "PAST_DUE",
      currentPeriodStartsAt: "2026-03-01T00:00:00.000Z",
      currentPeriodEndsAt: "2026-04-01T00:00:00.000Z",
      autoRenew: false,
      center: { id: "c-2", name: "Beta", slug: "beta", status: "PAUSED" },
      plan: { id: "pl-2", name: "Pro", priceMonthly: 99 },
    },
  ];

  it("shows the loading placeholder, then the subscriptions table", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/subscriptions", reply: jsonResponse({ subscriptions: subs }) },
    ]);

    const { container } = render(<PlatformSubscriptionsPage />);
    expect(screen.getByText("Загрузка подписок...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Alpha")).toBeTruthy());

    expect(calls[0].url).toBe("/api/platform/subscriptions?page=1");
    expect(screen.getByText("alpha")).toBeTruthy();
    expect(screen.getByText("Standard")).toBeTruthy();
    expect(screen.getByText("$50/мес")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("PAST_DUE")).toBeTruthy();
    expect(screen.getByText("Включено")).toBeTruthy();
    expect(screen.getByText("Отключено")).toBeTruthy();
    expect(container.textContent).toContain("До:");
    expect(container.textContent).toContain("С:");
    expect(screen.getAllByText("Карточка центра")).toHaveLength(2);
  });

  it("renders the empty and error states", async () => {
    installFetchMock([
      { match: "/api/platform/subscriptions", reply: jsonResponse({ subscriptions: [] }) },
    ]);
    const first = render(<PlatformSubscriptionsPage />);
    await waitFor(() => expect(screen.getByText("Подписки не найдены")).toBeTruthy());
    first.unmount();

    installFetchMock([{ match: "/api/platform/subscriptions", reply: jsonResponse({}, 500) }]);
    render(<PlatformSubscriptionsPage />);
    await waitFor(() => expect(screen.getByText("Не удалось загрузить подписки")).toBeTruthy());
  });

  it("paginates using meta.totalPages and filters by status", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/platform/subscriptions",
        reply: jsonResponse({ subscriptions: subs, meta: { totalPages: 2 } }),
      },
    ]);

    const { container } = render(<PlatformSubscriptionsPage />);
    await waitFor(() => expect(screen.getByText("Страница 1 из 2")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: /Вперед/ }));
    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/platform/subscriptions?page=2")).toBe(true),
    );

    fireEvent.change(container.querySelector("select")!, { target: { value: "TRIAL" } });
    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.url.includes("status=TRIAL") && c.url.includes("page=1"),
        ),
      ).toBe(true),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. /platform-admin/support
// ---------------------------------------------------------------------------

describe("platform-admin/support page", () => {
  const openTicket = {
    id: "t-1",
    subject: "Broken login",
    category: "AUTH",
    priority: "HIGH",
    status: "OPEN",
    createdAt: "2026-04-01T10:00:00.000Z",
    creator: { fullName: "Alice", email: "alice@x.uz" },
    center: { name: "Alpha", slug: "alpha" },
    _count: { messages: 3 },
  };

  it("shows the loading placeholder, then the ticket details and actions", async () => {
    installFetchMock([
      { match: "/api/platform/support", reply: jsonResponse({ tickets: [openTicket] }) },
    ]);

    render(<PlatformSupportPage />);
    expect(screen.getByText("Загрузка обращений...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Broken login")).toBeTruthy());

    expect(screen.getByText("OPEN")).toBeTruthy();
    expect(screen.getByText("HIGH")).toBeTruthy();
    expect(screen.getByText(/Alpha/)).toBeTruthy();
    expect(screen.getByText(/alice@x.uz/)).toBeTruthy();
    expect(screen.getByText("3 сообщений")).toBeTruthy();
    expect(screen.getByRole("button", { name: "В работу" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Решено" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Закрыть" })).toBeTruthy();
  });

  it("renders the empty and error states", async () => {
    installFetchMock([{ match: "/api/platform/support", reply: jsonResponse({ tickets: [] }) }]);
    const first = render(<PlatformSupportPage />);
    await waitFor(() => expect(screen.getByText("Нет активных обращений")).toBeTruthy());
    first.unmount();

    installFetchMock([{ match: "/api/platform/support", reply: jsonResponse({}, 500) }]);
    render(<PlatformSupportPage />);
    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить обращения поддержки")).toBeTruthy(),
    );
  });

  it("hides the resolved/closed actions depending on the ticket status", async () => {
    installFetchMock([
      {
        match: "/api/platform/support",
        reply: jsonResponse({
          tickets: [
            { ...openTicket, id: "t-2", status: "RESOLVED", priority: null, center: null, creator: null },
            { ...openTicket, id: "t-3", status: "CLOSED", _count: undefined },
          ],
        }),
      },
    ]);

    render(<PlatformSupportPage />);
    await waitFor(() => expect(screen.getByText("RESOLVED")).toBeTruthy());

    expect(screen.getByText("CLOSED")).toBeTruthy();
    // no "В работу" (OPEN only) and no "Решено" for RESOLVED/CLOSED
    expect(screen.queryByRole("button", { name: "В работу" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Решено" })).toBeNull();
    // "Закрыть" stays available for the RESOLVED ticket but not for the CLOSED one
    expect(screen.getAllByRole("button", { name: "Закрыть" })).toHaveLength(1);
    // missing counts fall back to 0
    expect(screen.getAllByText("0 сообщений").length).toBeGreaterThan(0);
  });

  it("refetches with the selected status tab", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/support", reply: jsonResponse({ tickets: [openTicket] }) },
    ]);

    render(<PlatformSupportPage />);
    await waitFor(() => expect(screen.getByText("Broken login")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "OPEN (Открытые)" }));

    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/platform/support?status=OPEN")).toBe(true),
    );
  });

  it("patches the ticket status and refetches on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/support", reply: jsonResponse({ tickets: [openTicket] }) },
      { match: "/api/platform/support", method: "PATCH", reply: jsonResponse({}, 200) },
    ]);

    render(<PlatformSupportPage />);
    await waitFor(() => expect(screen.getByText("Broken login")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "В работу" }));

    await waitFor(() => {
      const patch = calls.find((c) => c.init?.method === "PATCH");
      expect(patch?.url).toBe("/api/platform/support");
    });
    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(sentBody(patch!)).toEqual({ id: "t-1", status: "IN_PROGRESS" });
    // refetch after the successful update
    expect(calls.filter((c) => !c.init?.method).length).toBe(2);
  });

  it("alerts when the status update fails", async () => {
    installFetchMock([
      { match: "/api/platform/support", reply: jsonResponse({ tickets: [openTicket] }) },
      { match: "/api/platform/support", method: "PATCH", reply: jsonResponse({}, 500) },
    ]);

    render(<PlatformSupportPage />);
    await waitFor(() => expect(screen.getByText("Broken login")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Решено" }));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Не удалось обновить статус обращения"),
    );
  });
});
