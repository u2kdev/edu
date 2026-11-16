// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  within,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import PlatformAdminManager, {
  type AdminCenterItem,
  type PlanOption,
} from "@/components/PlatformAdminManager";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/platform/centers",
  useSearchParams: () => new URLSearchParams(),
}));

const plans: PlanOption[] = [
  { id: "plan-basic", name: "Базовый", priceMonthly: 150000 },
  { id: "plan-pro", name: "Про", priceMonthly: 300000 },
];

const centers: AdminCenterItem[] = [
  {
    id: "ct-1",
    name: "Quantum Academy",
    slug: "quantum-academy",
    status: "ACTIVE",
    owner: { fullName: "Александр Волков", email: "director@quantum.ru" },
    subscriptions: [{ plan: { name: "Про" } }],
  },
  {
    id: "ct-2",
    name: "Code School",
    slug: "code-school",
    status: "TRIAL",
    owner: null,
    subscriptions: [],
  },
  {
    id: "ct-3",
    name: "Frozen Lab",
    slug: "frozen-lab",
    status: "PAUSED",
    owner: { fullName: "Елена Смирнова", email: null },
    subscriptions: [{ plan: null }],
  },
  {
    id: "ct-4",
    name: "Blocked Inc",
    slug: "blocked-inc",
    status: "BLOCKED",
    owner: { fullName: null, email: "x@blocked.uz" },
    subscriptions: [{ plan: { name: "Базовый" } }],
  },
];

const metrics = { totalCenters: 4, activeCenters: 1, pausedCenters: 1 };

const createForm = () => document.querySelector("form") as HTMLFormElement;

function renderManager(
  overrides: Partial<ComponentProps<typeof PlatformAdminManager>> = {},
) {
  return render(
    <PlatformAdminManager initialCenters={centers} plans={plans} metrics={metrics} {...overrides} />,
  );
}

describe("PlatformAdminManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the platform metrics and the full tenant registry", () => {
    renderManager();

    // Metrics cards.
    expect(screen.getByText("Всего центров")).toBeTruthy();
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Активных")).toBeTruthy();
    expect(screen.getByText("Заморожены")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThanOrEqual(2);

    // Registry rows + slugs (scoped to the desktop table; mobile card view renders the same items).
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Quantum Academy")).toBeTruthy();
    expect(table.getByText("slug: quantum-academy")).toBeTruthy();
    expect(table.getByText("Code School")).toBeTruthy();
    expect(table.getByText("Frozen Lab")).toBeTruthy();
    expect(table.getByText("Blocked Inc")).toBeTruthy();

    // Owners.
    expect(table.getByText("Александр Волков")).toBeTruthy();
    expect(table.getByText("director@quantum.ru")).toBeTruthy();
    expect(table.getByText("Елена Смирнова")).toBeTruthy();
    expect(table.getByText("x@blocked.uz")).toBeTruthy();

    // Subscription plan names, with "Trial" fallback for missing/empty plans.
    expect(table.getByText("Про")).toBeTruthy();
    expect(table.getByText("Базовый")).toBeTruthy();
    expect(table.getAllByText("Trial")).toHaveLength(2);

    // Status badges.
    expect(table.getByText("ACTIVE")).toBeTruthy();
    expect(table.getByText("TRIAL")).toBeTruthy();
    expect(table.getByText("PAUSED")).toBeTruthy();
    expect(table.getByText("BLOCKED")).toBeTruthy();
  });

  it("shows the empty state when no centers exist", () => {
    renderManager({ initialCenters: [] });

    expect(
      screen.getByText(
        "Нажмите «Создать учебный центр», чтобы добавить первый центр.",
      ),
    ).toBeTruthy();
  });

  it("offers the status buttons that make sense for each center status", () => {
    const { unmount } = renderManager({ initialCenters: [centers[0]] }); // ACTIVE
    let table = within(screen.getByRole("table"));
    expect(table.queryByRole("button", { name: "Активировать" })).toBeNull();
    expect(table.getByRole("button", { name: "Заморозить" })).toBeTruthy();
    expect(table.getByRole("button", { name: "Заблокировать" })).toBeTruthy();
    unmount();

    const paused = renderManager({ initialCenters: [centers[2]] }); // PAUSED
    table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Активировать" })).toBeTruthy();
    expect(table.queryByRole("button", { name: "Заморозить" })).toBeNull();
    expect(table.getByRole("button", { name: "Заблокировать" })).toBeTruthy();
    paused.unmount();

    const blocked = renderManager({ initialCenters: [centers[3]] }); // BLOCKED
    table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Активировать" })).toBeTruthy();
    expect(table.getByRole("button", { name: "Заморозить" })).toBeTruthy();
    expect(table.queryByRole("button", { name: "Заблокировать" })).toBeNull();
    blocked.unmount();

    renderManager({ initialCenters: [centers[1]] }); // TRIAL -> all three
    table = within(screen.getByRole("table"));
    expect(table.getByRole("button", { name: "Активировать" })).toBeTruthy();
    expect(table.getByRole("button", { name: "Заморозить" })).toBeTruthy();
    expect(table.getByRole("button", { name: "Заблокировать" })).toBeTruthy();
  });

  it("patches a center status and refreshes the router on success", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/platform/centers/ct-2",
        method: "PATCH",
        reply: jsonResponse({ ok: true }),
      },
    ]);

    renderManager({ initialCenters: [centers[1]] }); // TRIAL
    const table = within(screen.getByRole("table"));

    fireEvent.click(table.getByRole("button", { name: "Активировать" }));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/platform/centers/ct-2");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(sentBody(calls[0])).toEqual({ centerId: "ct-2", status: "ACTIVE" });
  });

  it("surfaces a status-update API error in an alert banner", async () => {
    installFetchMock([
      {
        match: "/api/platform/centers/ct-2",
        method: "PATCH",
        reply: jsonResponse({ error: "Недостаточно прав" }, 403),
      },
    ]);

    renderManager({ initialCenters: [centers[1]] });
    const table = within(screen.getByRole("table"));

    fireEvent.click(table.getByRole("button", { name: "Заблокировать" }));

    expect(await screen.findByText("Недостаточно прав")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reports a status-update network failure in an alert banner", async () => {
    installFetchMock([]); // no route -> fetch throws

    renderManager({ initialCenters: [centers[1]] });
    const table = within(screen.getByRole("table"));

    fireEvent.click(table.getByRole("button", { name: "Заморозить" }));

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
  });

  it("opens the create modal and closes it on cancel without sending a request", () => {
    const { calls } = installFetchMock([]);
    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    expect(screen.getByText("Создание учебного центра и аккаунта директора")).toBeTruthy();
    // Plan options are listed with their price.
    expect(screen.getByRole("option", { name: /Базовый \(150\s?000 UZS\/мес\)/ })).toBeTruthy();
    expect(screen.getByRole("option", { name: /Про \(300\s?000 UZS\/мес\)/ })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Создание учебного центра и аккаунта директора")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("auto-generates a URL slug from the center name", () => {
    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));

    const nameInput = screen.getByPlaceholderText("e.g. Школа Кодинга Квантум");
    const slugInput = screen.getByPlaceholderText(
      "e.g. quantum-coding",
    ) as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Quantum Coding!" } });
    expect(slugInput.value).toBe("quantum-coding");

    // Cyrillic is transliterated: the API only accepts /^[a-z0-9-]+$/.
    fireEvent.change(nameInput, { target: { value: "Школа Кодинга" } });
    expect(slugInput.value).toBe("shkola-kodinga");

    // Manual slug edits win over the auto value — including later name changes.
    fireEvent.change(slugInput, { target: { value: "custom-slug" } });
    expect(slugInput.value).toBe("custom-slug");
    fireEvent.change(nameInput, { target: { value: "Другое Название" } });
    expect(slugInput.value).toBe("custom-slug");
  });

  it("creates a center and director, sends the payload, refreshes and resets the form", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({ id: "ct-new" }, 201) },
    ]);

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));

    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum Coding" },
    });
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "ONLINE" } });
    fireEvent.change(selects[1], { target: { value: "plan-pro" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Александр Волков"), {
      target: { value: "Александр Волков" },
    });
    fireEvent.change(screen.getByPlaceholderText("director@quantum.ru"), {
      target: { value: "director@quantum.ru" },
    });
    fireEvent.change(screen.getByPlaceholderText("+7 (999) 111-22-33"), {
      target: { value: "+7 999 111 22 33" },
    });

    fireEvent.submit(createForm());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/platform/centers");
    expect(sentBody(calls[0])).toEqual({
      name: "Quantum Coding",
      slug: "quantum-coding",
      centerType: "ONLINE",
      planId: "plan-pro",
      directorEmail: "director@quantum.ru",
      directorFullName: "Александр Волков",
      directorPhone: "+7 999 111 22 33",
    });

    await waitFor(() =>
      expect(
        screen.queryByText("Создание учебного центра и аккаунта директора"),
      ).toBeNull(),
    );
    // Reopening shows cleared fields.
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    expect(
      (screen.getByPlaceholderText("e.g. Школа Кодинга Квантум") as HTMLInputElement).value,
    ).toBe("");
    expect(
      (screen.getByPlaceholderText("e.g. quantum-coding") as HTMLInputElement).value,
    ).toBe("");
  });

  it("shows the API create error in the modal banner", async () => {
    installFetchMock([
      {
        match: "/api/platform/centers",
        method: "POST",
        reply: jsonResponse({ error: "Такой slug уже занят" }, 400),
      },
    ]);

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum" },
    });
    fireEvent.submit(createForm());

    expect(await screen.findByText("Такой slug уже занят")).toBeTruthy();
    expect(screen.getByText("Создание учебного центра и аккаунта директора")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('falls back to "Ошибка при создании центра" when the error body has no message', async () => {
    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum" },
    });
    fireEvent.submit(createForm());

    expect(await screen.findByText("Ошибка при создании центра")).toBeTruthy();
  });

  it("reports a create network failure in the modal banner", async () => {
    installFetchMock([]); // no route -> fetch throws

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum" },
    });
    fireEvent.submit(createForm());

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
  });

  it("clears the stale error banner when the modal is closed and reopened", async () => {
    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({ error: "Такой slug уже занят" }, 400) },
    ]);

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum" },
    });
    fireEvent.submit(createForm());
    expect(await screen.findByText("Такой slug уже занят")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Отмена/ }));
    expect(screen.queryByText("Создание учебного центра и аккаунта директора")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    expect(screen.queryByText("Такой slug уже занят")).toBeNull();
  });

  it("resets the director phone and the manual-slug flag after a successful create", async () => {
    installFetchMock([
      { match: "/api/platform/centers", method: "POST", reply: jsonResponse({ id: "ct-new" }, 201) },
    ]);

    renderManager();
    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Quantum" },
    });
    fireEvent.change(screen.getByPlaceholderText("+7 (999) 111-22-33"), {
      target: { value: "+998 90 000 00 00" },
    });
    fireEvent.submit(createForm());
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: /Создать учебный центр/ }));
    expect(
      (screen.getByPlaceholderText("+7 (999) 111-22-33") as HTMLInputElement).value,
    ).toBe("");
    // The auto-slug follows the name again after the reset.
    fireEvent.change(screen.getByPlaceholderText("e.g. Школа Кодинга Квантум"), {
      target: { value: "Noviy Centr" },
    });
    expect(
      (screen.getByPlaceholderText("e.g. quantum-coding") as HTMLInputElement).value,
    ).toBe("noviy-centr");
  });
});
