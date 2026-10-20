// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import StaffManager from "@/components/StaffManager";
import {
  installFetchMock,
  jsonResponse,
  brokenResponse,
  sentBody,
  type FetchRecord,
} from "./helpers/ui";

// StaffManager never imports `next/navigation`, but the router is mocked for
// parity with the other manager suites — and so these tests can assert that no
// mutation ever asks the App Router to refresh (the component repaints purely
// from the refetched `/api/tenant/staff` payload).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/staff",
  useSearchParams: () => new URLSearchParams(),
}));

interface StaffUser {
  id: string;
  email: string;
  phone: string | null;
  fullName: string;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

interface StaffMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: StaffUser;
}

/** Build a staff membership with sane defaults; override whatever a test needs. */
function member(partial: {
  id: string;
  role: string;
  status: string;
  fullName: string;
  email: string;
  phone?: string | null;
}): StaffMember {
  return {
    id: partial.id,
    role: partial.role,
    status: partial.status,
    joinedAt: "2026-01-01T00:00:00.000Z",
    user: {
      id: `u-${partial.id}`,
      email: partial.email,
      phone: partial.phone ?? null,
      fullName: partial.fullName,
      avatarUrl: null,
      isActive: partial.status === "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

// One entry per rendering branch:
//  m-1 DIRECTOR      ACTIVE    -> actions hidden (role === DIRECTOR)
//  m-2 CENTER_ADMIN  ACTIVE    -> "Деактивировать" + "Архивировать" + "Удалить"
//  m-3 TEACHER       INACTIVE  -> "Неактивен" badge, NULL phone, "Активировать"
//  m-4 CENTER_SUPPORT ARCHIVED -> "Архивирован" badge, archive button hidden
//  m-5 STUDENT       ACTIVE    -> "Ученик" badge
//  m-6 SUPERADMIN    ACTIVE    -> unknown role -> raw-role fallback label
const staff: StaffMember[] = [
  member({
    id: "m-1",
    role: "DIRECTOR",
    status: "ACTIVE",
    fullName: "Директор Директоров",
    email: "boss@example.uz",
    phone: "+998900000001",
  }),
  member({
    id: "m-2",
    role: "CENTER_ADMIN",
    status: "ACTIVE",
    fullName: "Админ Админов",
    email: "admin@example.uz",
    phone: "+998900000002",
  }),
  member({
    id: "m-3",
    role: "TEACHER",
    status: "INACTIVE",
    fullName: "Учитель Учителев",
    email: "teacher@example.uz",
    phone: null,
  }),
  member({
    id: "m-4",
    role: "CENTER_SUPPORT",
    status: "ARCHIVED",
    fullName: "Саппорт Саппортов",
    email: "support@example.uz",
    phone: "+998900000004",
  }),
  member({
    id: "m-5",
    role: "STUDENT",
    status: "ACTIVE",
    fullName: "Ученик Учеников",
    email: "student@example.uz",
    phone: "+998900000005",
  }),
  member({
    id: "m-6",
    role: "SUPERADMIN",
    status: "ACTIVE",
    fullName: "Загадочный Роль",
    email: "mystery@example.uz",
    phone: null,
  }),
];

const staffResponse = (list: unknown[] = staff) => jsonResponse({ staff: list });

const getRoute = (reply: Response | (() => Response)) =>
  ({ match: "/api/tenant/staff", method: "GET", reply }) as const;
const postRoute = (reply: Response | (() => Response)) =>
  ({ match: "/api/tenant/staff", method: "POST", reply }) as const;
const patchRoute = (reply: Response | (() => Response)) =>
  ({ match: "/api/tenant/staff", method: "PATCH", reply }) as const;
const deleteRoute = (reply: Response | (() => Response)) =>
  ({ match: "/api/tenant/staff", method: "DELETE", reply }) as const;

/** A `Response`-like object whose `json()` never settles (keeps `saving`/`loading` on). */
const pendingResponse = () =>
  ({ ok: true, status: 200, json: () => new Promise(() => {}) }) as unknown as Response;

function renderManager(overrides: Partial<ComponentProps<typeof StaffManager>> = {}) {
  return render(<StaffManager locale="ru" currentRole="DIRECTOR" {...overrides} />);
}

/** The red error banner (the status badges only share `border-red-500/20`). */
const errorBanner = (container: HTMLElement) =>
  container.querySelector(".border-red-500\\/30");
/** The green success banner (the role badges only share `border-emerald-500/20`). */
const successBanner = (container: HTMLElement) =>
  container.querySelector(".border-emerald-500\\/30");

const formOf = (container: HTMLElement) => container.querySelector("form") as HTMLFormElement;
const roleSelect = (container: HTMLElement) => container.querySelector("select") as HTMLSelectElement;
const optionValues = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.value);
const optionLabels = (select: HTMLSelectElement) => Array.from(select.options).map((o) => o.textContent);

const addButtonName = (locale: string) =>
  locale === "uz-Latn" ? /Xodim qoʻshish/ : /Добавить сотрудника/;

const byMethod = (calls: FetchRecord[], method: string) =>
  calls.filter((c) => (c.init?.method ?? "GET").toUpperCase() === method);

describe("StaffManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    // jsdom does not implement these dialog functions.
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders only the spinner while the initial request is pending", () => {
    installFetchMock([getRoute(pendingResponse())]);

    const { container } = renderManager();

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    // The whole view (header, counter, list) is behind the loading branch.
    expect(screen.queryByText("Сотрудники центра")).toBeNull();
    expect(screen.queryByText("Всего 6 сотрудников")).toBeNull();
    expect(screen.queryByText("Сотрудники ещё не добавлены")).toBeNull();
  });

  it("loads the list after the pending request settles", async () => {
    installFetchMock([getRoute(staffResponse())]);

    const { container } = renderManager();

    expect(container.querySelector(".animate-spin")).toBeTruthy();
    expect(await screen.findByText("Сотрудники центра")).toBeTruthy();
    await waitFor(() => expect(container.querySelector(".animate-spin")).toBeNull());
    expect(screen.getByText("Всего 6 сотрудников")).toBeTruthy();
  });

  it("renders every member: names, contacts, role badges, status badges and avatars", async () => {
    installFetchMock([getRoute(staffResponse())]);

    const { container } = renderManager();

    expect(await screen.findByText("Сотрудники центра")).toBeTruthy();
    expect(screen.getByText("Всего 6 сотрудников")).toBeTruthy();

    // Every member name.
    for (const name of [
      "Директор Директоров",
      "Админ Админов",
      "Учитель Учителев",
      "Саппорт Саппортов",
      "Ученик Учеников",
      "Загадочный Роль",
    ]) {
      expect(screen.getByText(name)).toBeTruthy();
    }

    // Role badges: known roles use the RU label, an unknown role falls back to the raw code.
    expect(screen.getByText("Директор")).toBeTruthy();
    expect(screen.getByText("Админ центра")).toBeTruthy();
    expect(screen.getByText("Преподаватель")).toBeTruthy();
    expect(screen.getByText("Саппорт центра")).toBeTruthy();
    expect(screen.getByText("Ученик")).toBeTruthy();
    expect(screen.getByText("SUPERADMIN")).toBeTruthy();

    // Status badges: exactly one INACTIVE and one ARCHIVED.
    expect(screen.getByText("Неактивен")).toBeTruthy();
    expect(screen.getByText("Архивирован")).toBeTruthy();

    // Emails always render; a NULL phone renders nothing.
    expect(screen.getByText("teacher@example.uz")).toBeTruthy();
    expect(screen.getByText("+998900000001")).toBeTruthy();
    expect(screen.getByText("+998900000004")).toBeTruthy();
    expect(screen.queryByText("+998900000003")).toBeNull();

    // Avatar block shows the uppercased first letter of the full name.
    const avatars = Array.from(container.querySelectorAll(".w-11")).map((el) => el.textContent);
    expect(avatars).toEqual(["Д", "А", "У", "С", "У", "З"]);

    // Only the two non-ACTIVE rows carry the `opacity-50` dimming.
    expect(container.querySelectorAll(".opacity-50")).toHaveLength(2);
  });

  it("shows every action for non-director members and hides the whole action group for a DIRECTOR", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager();

    await screen.findByText("Сотрудники центра");

    // 5 non-director members -> 5 toggle buttons + 5 delete buttons.
    expect(screen.getAllByTitle("Деактивировать")).toHaveLength(3); // m-2, m-5, m-6
    expect(screen.getAllByTitle("Активировать")).toHaveLength(2); // m-3, m-4
    expect(screen.getAllByTitle("Удалить")).toHaveLength(5);
    // The ARCHIVED member hides its own archive button -> 4 instead of 5.
    expect(screen.getAllByTitle("Архивировать")).toHaveLength(4);

    // The DIRECTOR row exposes no buttons at all — his only control would be the delete.
    const directorRow = screen.getByText("Директор Директоров").closest(".glass-panel") as HTMLElement;
    expect(directorRow.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders the empty state in Russian when the list is empty", async () => {
    installFetchMock([getRoute(staffResponse([]))]);

    renderManager();

    expect(await screen.findByText("Сотрудники ещё не добавлены")).toBeTruthy();
    expect(screen.getByText("Всего 0 сотрудников")).toBeTruthy();
    expect(errorBanner(document.body)).toBeNull();
  });

  it("renders the empty state in uz-Latn", async () => {
    installFetchMock([getRoute(staffResponse([]))]);

    renderManager({ locale: "uz-Latn" });

    expect(await screen.findByText("Hali xodimlar qoʻshilmagan")).toBeTruthy();
    expect(screen.getByText("Jami 0 xodim")).toBeTruthy();
  });

  it("keeps an empty list when the payload has no `staff` field", async () => {
    installFetchMock([getRoute(jsonResponse({}))]);

    renderManager();

    expect(await screen.findByText("Сотрудники ещё не добавлены")).toBeTruthy();
    expect(screen.getByText("Всего 0 сотрудников")).toBeTruthy();
  });

  it("surfaces a malformed list payload as the load error and lets it be dismissed", async () => {
    installFetchMock([getRoute(brokenResponse(200))]);

    const { container } = renderManager();

    expect(await screen.findByText("Failed to load staff")).toBeTruthy();
    // The error state still renders the header + empty list.
    expect(screen.getByText("Сотрудники центра")).toBeTruthy();
    expect(screen.getByText("Сотрудники ещё не добавлены")).toBeTruthy();

    fireEvent.click(errorBanner(container)!.querySelector("button")!);

    expect(errorBanner(container)).toBeNull();
    expect(screen.queryByText("Failed to load staff")).toBeNull();
  });

  it("ignores a non-OK list response because the loader never checks `res.ok`", async () => {
    // NOTE (observed behaviour): a 500 whose body is valid JSON is silently
    // treated as "no staff" — the `error` field is never surfaced.
    installFetchMock([getRoute(jsonResponse({ error: "Сервер недоступен" }, 500))]);

    const { container } = renderManager();

    expect(await screen.findByText("Сотрудники ещё не добавлены")).toBeTruthy();
    expect(errorBanner(container)).toBeNull();
    expect(screen.queryByText("Сервер недоступен")).toBeNull();
    expect(screen.getByText("Всего 0 сотрудников")).toBeTruthy();
  });

  it("renders the uz-Latn labels for the header, badges, statuses and action titles", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager({ locale: "uz-Latn" });

    expect(await screen.findByText("Markaz xodimlari")).toBeTruthy();
    expect(screen.getByText("Jami 6 xodim")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Xodim qoʻshish/ })).toBeTruthy();

    // Role badges use the uz labels (the unknown role keeps falling back to the code).
    expect(screen.getByText("Direktor")).toBeTruthy();
    expect(screen.getByText("Markaz admini")).toBeTruthy();
    expect(screen.getByText("Oʻqituvchi")).toBeTruthy();
    expect(screen.getByText("Markaz qoʻllab-quvvatlashi")).toBeTruthy();
    expect(screen.getByText("Oʻquvchi")).toBeTruthy();
    expect(screen.getByText("SUPERADMIN")).toBeTruthy();

    // Status badges and the action tooltips are localized too.
    expect(screen.getByText("Faolsiz")).toBeTruthy();
    expect(screen.getByText("Arxivlangan")).toBeTruthy();
    expect(screen.getAllByTitle("Faolsizlantirish")).toHaveLength(3);
    expect(screen.getAllByTitle("Faollashtirish")).toHaveLength(2);
    expect(screen.getAllByTitle("Arxivlash")).toHaveLength(4);
    expect(screen.getAllByTitle("Oʻchirish")).toHaveLength(5);
  });

  it("falls back to Russian for an unsupported locale", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager({ locale: "fr" });

    expect(await screen.findByText("Сотрудники центра")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Добавить сотрудника/ })).toBeTruthy();
    expect(screen.getByText("Преподаватель")).toBeTruthy();
  });

  it("lets a DIRECTOR assign center-admin, teacher and support roles", async () => {
    installFetchMock([getRoute(staffResponse())]);

    const { container } = renderManager({ currentRole: "DIRECTOR" });
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));

    expect(screen.getByText("Добавить нового сотрудника")).toBeTruthy();
    expect(screen.getByPlaceholderText("Иван Петров")).toBeTruthy();
    expect(screen.getByPlaceholderText("staff@example.com")).toBeTruthy();
    expect(screen.getByPlaceholderText("+998 90 123 45 67")).toBeTruthy();

    const select = roleSelect(container);
    expect(optionValues(select)).toEqual(["CENTER_ADMIN", "TEACHER", "CENTER_SUPPORT"]);
    expect(optionLabels(select)).toEqual(["Админ центра", "Преподаватель", "Саппорт центра"]);
    expect(select.value).toBe("TEACHER");
  });

  it("restricts a non-director to teacher and support roles (and still shows every control)", async () => {
    installFetchMock([getRoute(staffResponse())]);

    const { container, unmount } = renderManager({ currentRole: "TEACHER" });
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    expect(optionValues(roleSelect(container))).toEqual(["TEACHER", "CENTER_SUPPORT"]);
    unmount();

    // NOTE (observed behaviour): `currentRole` only narrows the assignable roles.
    // A STUDENT still sees the add form and all the row actions.
    renderManager({ currentRole: "STUDENT" });
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    expect(optionValues(roleSelect(document.body))).toEqual(["TEACHER", "CENTER_SUPPORT"]);
    expect(screen.getAllByTitle("Удалить")).toHaveLength(5);
    expect(screen.getAllByTitle("Деактивировать")).toHaveLength(3);
  });

  it("renders the uz-Latn add form labels", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager({ locale: "uz-Latn", currentRole: "DIRECTOR" });
    await screen.findByText("Markaz xodimlari");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("uz-Latn") }));

    expect(screen.getByText("Yangi xodim qoʻshish")).toBeTruthy();
    expect(screen.getByPlaceholderText("Ism Familiya")).toBeTruthy();
    expect(screen.getByText(/FISh/)).toBeTruthy();
    expect(screen.getByText("Bekor qilish")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Qoʻshish" })).toBeTruthy();
  });

  it("closes the add form without a request when cancelled", async () => {
    const { calls } = installFetchMock([getRoute(staffResponse())]);

    renderManager();

    await screen.findByText("Сотрудники центра");
    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    expect(screen.getByPlaceholderText("staff@example.com")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByPlaceholderText("staff@example.com")).toBeNull();
    expect(byMethod(calls, "POST")).toHaveLength(0);
  });

  it("adds a staff member: sends the body, closes the form, shows success and refetches", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      postRoute(jsonResponse({ id: "m-new" }, 201)),
    ]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("Иван Петров"), {
      target: { value: "Иван Иванов" },
    });
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "ivan@example.uz" },
    });
    fireEvent.change(screen.getByPlaceholderText("+998 90 123 45 67"), {
      target: { value: "+998901234567" },
    });
    fireEvent.change(roleSelect(container), { target: { value: "CENTER_ADMIN" } });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Иван Иванов успешно добавлен(а)!")).toBeTruthy();

    const post = byMethod(calls, "POST")[0];
    expect(post.url).toBe("/api/tenant/staff");
    expect(post.init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(post)).toEqual({
      email: "ivan@example.uz",
      fullName: "Иван Иванов",
      phone: "+998901234567",
      staffRole: "CENTER_ADMIN",
    });

    // The form closed, its fields were reset and the list was refetched.
    await waitFor(() => expect(screen.queryByPlaceholderText("staff@example.com")).toBeNull());
    await waitFor(() => expect(byMethod(calls, "GET").length).toBeGreaterThan(1));
    // The component never asks the router to refresh.
    expect(refresh).not.toHaveBeenCalled();
  });

  it("omits the phone key when the field is left empty and uses the uz-Latn success text", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      postRoute(jsonResponse({ id: "m-new" }, 201)),
    ]);

    const { container } = renderManager({ locale: "uz-Latn" });
    await screen.findByText("Markaz xodimlari");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("uz-Latn") }));
    fireEvent.change(screen.getByPlaceholderText("Ism Familiya"), {
      target: { value: "Азиз Азизов" },
    });
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "aziz@example.uz" },
    });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Азиз Азизов muvaffaqiyatli qoʻshildi!")).toBeTruthy();

    // `phone: newPhone || undefined` -> JSON.stringify drops the key entirely.
    expect(sentBody(byMethod(calls, "POST")[0])).toEqual({
      email: "aziz@example.uz",
      fullName: "Азиз Азизов",
      staffRole: "TEACHER",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("keeps the add form open and shows an API validation error", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      postRoute(jsonResponse({ error: "Email уже занят" }, 400)),
    ]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "dup@example.uz" },
    });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Email уже занят")).toBeTruthy();
    expect(screen.getByPlaceholderText("staff@example.com")).toBeTruthy();
    // No refetch after a rejected create.
    expect(byMethod(calls, "GET")).toHaveLength(1);
    expect(successBanner(container)).toBeNull();
  });

  it('uses the "Error adding staff member" fallback when the error body has no message', async () => {
    installFetchMock([getRoute(staffResponse()), postRoute(jsonResponse({}, 400))]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Error adding staff member")).toBeTruthy();
  });

  it('reports a malformed create payload as a "Network error" and keeps the form open', async () => {
    installFetchMock([getRoute(staffResponse()), postRoute(brokenResponse(201))]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "x@example.uz" },
    });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Network error")).toBeTruthy();
    expect(screen.getByPlaceholderText("staff@example.com")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reports a create network failure when the POST route is missing", async () => {
    installFetchMock([getRoute(staffResponse())]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "offline@example.uz" },
    });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("disables the submit button and shows a spinner while the create request is in flight", async () => {
    installFetchMock([getRoute(staffResponse()), postRoute(pendingResponse())]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "slow@example.uz" },
    });
    fireEvent.submit(formOf(container));

    const submit = screen.getByRole("button", { name: "Добавить" }) as HTMLButtonElement;
    await waitFor(() => expect(submit.disabled).toBe(true));
    expect(container.querySelector(".animate-spin")).toBeTruthy();
    // The form stays mounted while saving.
    expect(screen.getByPlaceholderText("staff@example.com")).toBeTruthy();
  });

  it("dismisses the success banner with its close button", async () => {
    installFetchMock([getRoute(staffResponse()), postRoute(jsonResponse({ id: "m-new" }, 201))]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getByRole("button", { name: addButtonName("ru") }));
    fireEvent.change(screen.getByPlaceholderText("Иван Петров"), {
      target: { value: "Иван Иванов" },
    });
    fireEvent.change(screen.getByPlaceholderText("staff@example.com"), {
      target: { value: "ivan@example.uz" },
    });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Иван Иванов успешно добавлен(а)!")).toBeTruthy();

    fireEvent.click(successBanner(container)!.querySelector("button")!);
    expect(successBanner(container)).toBeNull();
  });

  it("deactivates an ACTIVE member via PATCH and refetches with a success message", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      patchRoute(jsonResponse({ ok: true })),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    // First ACTIVE non-director row is m-2 (CENTER_ADMIN).
    fireEvent.click(screen.getAllByTitle("Деактивировать")[0]);

    expect(await screen.findByText("Статус сотрудника изменён")).toBeTruthy();

    const patch = byMethod(calls, "PATCH")[0];
    expect(patch.url).toBe("/api/tenant/staff");
    expect(sentBody(patch)).toEqual({ membershipId: "m-2", status: "INACTIVE" });
    await waitFor(() => expect(byMethod(calls, "GET").length).toBeGreaterThan(1));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("reactivates an INACTIVE/ARCHIVED member via PATCH", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      patchRoute(jsonResponse({ ok: true })),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    // First "Активировать" row is m-3 (INACTIVE) -> flips back to ACTIVE.
    fireEvent.click(screen.getAllByTitle("Активировать")[0]);

    await screen.findByText("Статус сотрудника изменён");
    expect(sentBody(byMethod(calls, "PATCH")[0])).toEqual({
      membershipId: "m-3",
      status: "ACTIVE",
    });
  });

  it("surfaces a toggle API error", async () => {
    installFetchMock([
      getRoute(staffResponse()),
      patchRoute(jsonResponse({ error: "Нельзя отключить директора" }, 400)),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Деактивировать")[0]);

    expect(await screen.findByText("Нельзя отключить директора")).toBeTruthy();
  });

  it("silently drops a toggle error whose body has no message", async () => {
    // NOTE (observed behaviour): the failure branch runs `setError(data.error)`
    // with `undefined`, so the alert banner is never rendered at all.
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      patchRoute(jsonResponse({}, 500)),
    ]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Деактивировать")[0]);

    // The PATCH settled without a refetch and without any visible feedback.
    await waitFor(() => expect(byMethod(calls, "PATCH")).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Сотрудники центра")).toBeTruthy());
    expect(byMethod(calls, "GET")).toHaveLength(1);
    expect(errorBanner(container)).toBeNull();
    expect(successBanner(container)).toBeNull();
  });

  it("reports a toggle network failure with the generic message", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Деактивировать")[0]);

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("archives a member: sends ARCHIVED, refetches and reports success", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      patchRoute(jsonResponse({ ok: true })),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    // First archivable row is m-2 (m-4 is already ARCHIVED and hides the button).
    fireEvent.click(screen.getAllByTitle("Архивировать")[0]);

    expect(await screen.findByText("Пользователь успешно архивирован")).toBeTruthy();
    expect(sentBody(byMethod(calls, "PATCH")[0])).toEqual({
      membershipId: "m-2",
      status: "ARCHIVED",
    });
    await waitFor(() => expect(byMethod(calls, "GET").length).toBeGreaterThan(1));
  });

  it('uses the "Error archiving member" fallback and reports a network failure', async () => {
    let call = 0;
    installFetchMock([
      getRoute(staffResponse()),
      patchRoute(() => {
        call += 1;
        return call === 1 ? jsonResponse({}, 500) : brokenResponse(200);
      }),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Архивировать")[0]);
    expect(await screen.findByText("Error archiving member")).toBeTruthy();

    fireEvent.click(screen.getAllByTitle("Архивировать")[0]);
    expect(await screen.findByText("Network error")).toBeTruthy();
    // No refresh was requested by either failure.
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deletes a member with the membership id in the query string and refetches", async () => {
    const { calls } = installFetchMock([
      getRoute(staffResponse()),
      deleteRoute(jsonResponse({ ok: true })),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    // First deletable row is m-2.
    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(await screen.findByText("Пользователь успешно удалён")).toBeTruthy();

    const del = byMethod(calls, "DELETE")[0];
    expect(del.url).toBe("/api/tenant/staff?membershipId=m-2");
    expect(del.init?.headers).toBeUndefined();
    await waitFor(() => expect(byMethod(calls, "GET").length).toBeGreaterThan(1));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("deletes without any confirmation dialog (jsdom dialogs are never called)", async () => {
    installFetchMock([getRoute(staffResponse()), deleteRoute(jsonResponse({ ok: true }))]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);
    await screen.findByText("Пользователь успешно удалён");

    // NOTE (observed behaviour): `handleDelete` never calls `confirm()`, so there
    // is no "confirm false" branch to exercise and the mutation fires immediately.
    expect(window.confirm).not.toHaveBeenCalled();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("renders a 409 delete conflict together with its Russian hint", async () => {
    installFetchMock([
      getRoute(staffResponse()),
      deleteRoute(
        jsonResponse({ error: "У сотрудника есть группы", hint: "Сначала переведите группы" }, 409),
      ),
    ]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(
      await screen.findByText("У сотрудника есть группы. Подсказка: Сначала переведите группы"),
    ).toBeTruthy();
  });

  it("renders a 409 delete conflict with the uz-Latn fallback error and hint", async () => {
    installFetchMock([
      getRoute(staffResponse()),
      deleteRoute(jsonResponse({ hint: "Guruhlardan chiqaring" }, 409)),
    ]);

    renderManager({ locale: "uz-Latn" });
    await screen.findByText("Markaz xodimlari");

    fireEvent.click(screen.getAllByTitle("Oʻchirish")[0]);

    expect(
      await screen.findByText("Oʻchirib boʻlmaydi. Maslahat: Guruhlardan chiqaring"),
    ).toBeTruthy();
  });

  it('uses the "Error deleting member" fallback for a non-409 delete failure', async () => {
    installFetchMock([getRoute(staffResponse()), deleteRoute(jsonResponse({}, 500))]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(await screen.findByText("Error deleting member")).toBeTruthy();
  });

  it("ignores a 409 hint when the status is not 409 and keeps the plain error", async () => {
    installFetchMock([
      getRoute(staffResponse()),
      deleteRoute(jsonResponse({ error: "Ошибка удаления", hint: "не показывать" }, 400)),
    ]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(await screen.findByText("Ошибка удаления")).toBeTruthy();
    expect(screen.queryByText(/Подсказка/)).toBeNull();
    expect(errorBanner(container)).toBeTruthy();
  });

  it("reports a delete network failure with the generic message", async () => {
    installFetchMock([getRoute(staffResponse())]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("reports a malformed delete payload as a network error", async () => {
    installFetchMock([getRoute(staffResponse()), deleteRoute(brokenResponse(200))]);

    renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("shows the loading spinner again while a mutation-triggered refetch is running", async () => {
    let getCall = 0;
    installFetchMock([
      getRoute(() => {
        getCall += 1;
        return getCall === 1 ? staffResponse() : pendingResponse();
      }),
      deleteRoute(jsonResponse({ ok: true })),
    ]);

    const { container } = renderManager();
    await screen.findByText("Сотрудники центра");

    fireEvent.click(screen.getAllByTitle("Удалить")[0]);

    // The refresh wipes the view back to the bare spinner until it resolves.
    await waitFor(() => expect(container.querySelector(".animate-spin")).toBeTruthy());
    expect(screen.queryByText("Сотрудники центра")).toBeNull();
  });
});
