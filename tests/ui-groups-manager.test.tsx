// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import GroupsManager from "@/components/GroupsManager";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

// `next/navigation` is not available in jsdom, so we mock the App Router hook.
// The component only ever calls `router.refresh()` (after a successful mutation).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/groups",
  useSearchParams: () => new URLSearchParams(),
}));

const courses = [
  { id: "c-1", title: "Frontend-разработка" },
  { id: "c-2", title: "Python-разработка" },
];

const teachers = [
  { id: "t-1", user: { fullName: "Иванов Иван" } },
  { id: "t-2", user: { fullName: "Петров Пётр" } },
];

// g-1: assigned teacher, 2 students (one with a phone, one with a NULL phone).
// g-2: no teacher, exactly at capacity (1 / 1) -> "full" badge branch.
// g-3: assigned teacher, empty roster -> empty-roster branch.
const groups = [
  {
    id: "g-1",
    name: "Поток JS-2026-A",
    maxStudents: 30,
    course: { id: "c-1", title: "Frontend-разработка" },
    teacher: { id: "t-1", user: { fullName: "Иванов Иван" } },
    enrollments: [
      {
        id: "e-1",
        student: {
          id: "s-1",
          user: {
            fullName: "Алишер Каримов",
            phone: "+998901112233",
            email: "alisher@example.uz",
          },
        },
      },
      {
        id: "e-2",
        student: {
          id: "s-2",
          user: {
            fullName: "Нилуфар Рахимова",
            phone: null,
            email: "nilufar@example.uz",
          },
        },
      },
    ],
  },
  {
    id: "g-2",
    name: "Поток PY-2026-B",
    maxStudents: 1,
    course: { id: "c-2", title: "Python-разработка" },
    teacher: null,
    enrollments: [
      {
        id: "e-3",
        student: {
          id: "s-3",
          user: {
            fullName: "Зафар Юсупов",
            phone: "+998905556677",
            email: "zafar@example.uz",
          },
        },
      },
    ],
  },
  {
    id: "g-3",
    name: "Поток UX-2026-C",
    maxStudents: 20,
    course: { id: "c-1", title: "Frontend-разработка" },
    teacher: { id: "t-2", user: { fullName: "Петров Пётр" } },
    enrollments: [],
  },
];

function renderManager(overrides: Partial<ComponentProps<typeof GroupsManager>> = {}) {
  return render(
    <GroupsManager
      initialGroups={groups}
      courses={courses}
      teachers={teachers}
      role="DIRECTOR"
      locale="ru"
      {...overrides}
    />,
  );
}

/** The card wrapper that `glass-panel` gives every group. */
function cardOf(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 3, name }).closest(".glass-panel") as HTMLElement;
}

/** The <li> row of a single enrollment. */
function rowOf(studentName: string): HTMLElement {
  return screen.getByText(studentName).closest("li") as HTMLElement;
}

/**
 * The card header holds several icon buttons (edit + one transfer/drop pair per
 * student); only the edit button carries the `p-1.5` padding class.
 */
function editButtonOf(name: string): HTMLButtonElement {
  const buttons = within(cardOf(name)).queryAllByRole("button") as HTMLButtonElement[];
  const edit = buttons.find((b) => b.className.includes("p-1.5"));
  if (!edit) throw new Error(`No edit button in group card "${name}"`);
  return edit;
}

const openTransfer = (studentName: string) => {
  fireEvent.click(within(rowOf(studentName)).getByTitle("Перевести в другую группу"));
};

const openDrop = (studentName: string) => {
  fireEvent.click(within(rowOf(studentName)).getByTitle("Отчислить ученика"));
};

const formOf = (container: HTMLElement) => container.querySelector("form") as HTMLFormElement;

describe("GroupsManager (UI)", () => {
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

  it("renders every group card: course, teacher, capacity badge and roster", () => {
    installFetchMock([]);

    renderManager();

    // One card per group.
    expect(screen.getByRole("heading", { level: 3, name: "Поток JS-2026-A" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Поток PY-2026-B" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Поток UX-2026-C" })).toBeTruthy();

    // Course titles (Frontend is shared by two groups).
    expect(screen.getAllByText("Frontend-разработка")).toHaveLength(2);
    expect(screen.getByText("Python-разработка")).toBeTruthy();

    // Teacher assigned / not assigned branches.
    expect(screen.getByText("Преподаватель: Иванов Иван")).toBeTruthy();
    expect(screen.getByText("Преподаватель: Петров Пётр")).toBeTruthy();
    expect(screen.getByText("Преподаватель не назначен")).toBeTruthy();

    // Capacity badges: not full / exactly full / empty.
    expect(screen.getByText(/👥 2 \/ 30/)).toBeTruthy();
    expect(screen.getByText(/👥 1 \/ 1/)).toBeTruthy();
    expect(screen.getByText(/👥 0 \/ 20/)).toBeTruthy();

    // Roster headers + empty-roster fallback.
    expect(screen.getByText("Зачисленные ученики (2)")).toBeTruthy();
    expect(screen.getByText("Зачисленные ученики (1)")).toBeTruthy();
    expect(screen.getByText("Зачисленные ученики (0)")).toBeTruthy();
    expect(screen.getByText("В этой группе пока нет студентов")).toBeTruthy();

    // Student rows: phone when present, e-mail as the fallback.
    expect(screen.getByText("Алишер Каримов")).toBeTruthy();
    expect(screen.getByText("+998901112233")).toBeTruthy();
    expect(screen.getByText("Нилуфар Рахимова")).toBeTruthy();
    expect(screen.getByText("nilufar@example.uz")).toBeTruthy();

    // One edit button per card for a DIRECTOR.
    const editButtons = screen
      .getAllByRole("button")
      .filter((b) => b.className.includes("p-1.5"));
    expect(editButtons).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Создать группу/ })).toBeTruthy();
  });

  it("renders the empty state when there are no groups", () => {
    installFetchMock([]);

    renderManager({ initialGroups: [] });

    expect(screen.getByText("Нет данных")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("hides every management control for a TEACHER but still shows the roster", () => {
    installFetchMock([]);

    renderManager({ role: "TEACHER" });

    expect(screen.queryByRole("button", { name: /Создать группу/ })).toBeNull();
    expect(
      screen.queryAllByRole("button").filter((b) => b.className.includes("p-1.5")),
    ).toHaveLength(0);
    expect(screen.queryByTitle("Перевести в другую группу")).toBeNull();
    expect(screen.queryByTitle("Отчислить ученика")).toBeNull();

    // Read-only data is still rendered.
    expect(screen.getByText("Алишер Каримов")).toBeTruthy();
    expect(screen.getByText("Преподаватель: Иванов Иван")).toBeTruthy();
  });

  it("treats an unknown role as read-only and falls back to the default locale", () => {
    installFetchMock([]);

    renderManager({ role: undefined, locale: "fr" });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByText("Преподаватель не назначен")).toBeTruthy();
    // "fr" is not a supported locale -> the i18n layer falls back to Russian.
    expect(screen.getByText("Зачисленные ученики (0)")).toBeTruthy();
  });

  it("renders the uz-Latn translations", () => {
    installFetchMock([]);

    renderManager({ locale: "uz-Latn" });

    expect(screen.getByRole("button", { name: /Guruh yaratish/ })).toBeTruthy();
    expect(screen.getByText("Oʻqituvchi belgilanmagan")).toBeTruthy();
    expect(screen.getByText("Ushbu guruhda hali oʻquvchilar yoʻq")).toBeTruthy();
  });

  it("creates a group: sends the body, closes the modal and refreshes", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups", method: "POST", reply: jsonResponse({ id: "g-new" }, 201) },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    const nameInput = screen.getByPlaceholderText("e.g. Поток JS-2026-A");
    fireEvent.change(nameInput, { target: { value: "Поток JS-2026-B" } });

    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/groups");
    expect(sentBody(calls[0])).toEqual({
      courseId: "c-1",
      name: "Поток JS-2026-B",
      teacherMembershipId: "",
      maxStudents: "30",
    });

    // Modal closes and the name field is reset.
    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Поток JS-2026-A")).toBeNull());
    expect(screen.queryByText("Выберите курс")).toBeNull();
  });

  it("creates a group with the chosen course, teacher and capacity", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups", method: "POST", reply: jsonResponse({ id: "g-new" }, 201) },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));

    const selects = container.querySelectorAll("select");
    expect(selects).toHaveLength(2); // course + teacher
    fireEvent.change(selects[0], { target: { value: "c-2" } });
    fireEvent.change(selects[1], { target: { value: "t-2" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Поток JS-2026-A"), {
      target: { value: "Поток PY-2026-A" },
    });
    fireEvent.change(container.querySelector('input[type="number"]')!, {
      target: { value: "15" },
    });

    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      courseId: "c-2",
      name: "Поток PY-2026-A",
      teacherMembershipId: "t-2",
      maxStudents: "15",
    });
  });

  it("surfaces a create validation error from the API and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/groups",
        method: "POST",
        reply: jsonResponse({ error: "Название уже занято" }, 400),
      },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Поток JS-2026-A"), {
      target: { value: "Дубликат" },
    });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Название уже занято"));
    expect(screen.getByPlaceholderText("e.g. Поток JS-2026-A")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized create error when the body has no `error`", async () => {
    installFetchMock([{ match: "/api/groups", method: "POST", reply: jsonResponse({}, 400) }]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка создания группы"));
  });

  it("reports a create network failure with the generic alert", async () => {
    installFetchMock([]); // any request throws -> the component's catch branch

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("reports a malformed create payload as a network error", async () => {
    installFetchMock([
      { match: "/api/groups", method: "POST", reply: brokenResponse(200) },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes the create modal without any request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    expect(screen.getByPlaceholderText("e.g. Поток JS-2026-A")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByPlaceholderText("e.g. Поток JS-2026-A")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("opens the prefilled edit modal, sends a PUT and updates the card locally", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups/g-1", method: "PUT", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    expect(screen.getByText("Редактировать группу")).toBeTruthy();

    // Pre-filled from the clicked group.
    const nameInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const maxInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const teacherSelect = container.querySelector("select") as HTMLSelectElement;
    expect(nameInput.value).toBe("Поток JS-2026-A");
    expect(maxInput.value).toBe("30");
    expect(teacherSelect.value).toBe("t-1");

    fireEvent.change(nameInput, { target: { value: "Поток JS-2026-A (вечер)" } });
    fireEvent.change(teacherSelect, { target: { value: "t-2" } });
    fireEvent.change(maxInput, { target: { value: "25" } });

    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/groups/g-1");
    expect(calls[0].init?.method).toBe("PUT");
    expect(sentBody(calls[0])).toEqual({
      name: "Поток JS-2026-A (вечер)",
      teacherMembershipId: "t-2",
      maxStudents: "25",
    });

    // The card is patched in place without a refetch.
    expect(
      screen.getByRole("heading", { level: 3, name: "Поток JS-2026-A (вечер)" }),
    ).toBeTruthy();
    expect(screen.getByText(/👥 2 \/ 25/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Редактировать группу")).toBeNull());
  });

  it("sends `null` as the teacher when the edit modal clears the teacher", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups/g-1", method: "PUT", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.change(container.querySelector("select")!, { target: { value: "" } });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      name: "Поток JS-2026-A",
      teacherMembershipId: null,
      maxStudents: "30",
    });

    // g-1 now also falls back to the "no teacher" label (g-2 already shows it).
    await waitFor(() => expect(screen.getAllByText("Преподаватель не назначен")).toHaveLength(2));
  });

  it("surfaces an edit API error and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/groups/g-1",
        method: "PUT",
        reply: jsonResponse({ error: "Группа не найдена" }, 404),
      },
    ]);

    const { container } = renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Группа не найдена"));
    expect(screen.getByText("Редактировать группу")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized edit error and closes the modal on cancel", async () => {
    installFetchMock([
      { match: "/api/groups/g-1", method: "PUT", reply: jsonResponse({}, 400) },
    ]);

    const { container } = renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сохранения"));

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByText("Редактировать группу")).toBeNull();
  });

  it("reports an edit network failure with the generic alert", async () => {
    installFetchMock([]);

    const { container } = renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("closes the edit modal without sending a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderManager();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    expect(screen.getByText("Редактировать группу")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Редактировать группу")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("transfers a student: defaults to the first other group, sends the body and refreshes", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/groups/g-1/transfer",
        method: "POST",
        reply: jsonResponse({ ok: true }),
      },
    ]);

    const { container } = renderManager();

    openTransfer("Алишер Каримов");

    expect(screen.getByText("Студент: Алишер Каримов")).toBeTruthy();
    // The source group is excluded from the target list.
    const options = screen.getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Поток PY-2026-B (1 / 1)",
      "Поток UX-2026-C (0 / 20)",
    ]);

    const targetSelect = within(formOf(container)).getByRole("combobox") as HTMLSelectElement;
    expect(targetSelect.value).toBe("g-2");

    fireEvent.change(screen.getByPlaceholderText("e.g. Переход на вечернее расписание"), {
      target: { value: "Смена потока" },
    });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/groups/g-1/transfer");
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "s-1",
      targetGroupId: "g-2",
      reason: "Смена потока",
    });
    expect(window.alert).toHaveBeenCalledWith("Студент успешно переведен");
    await waitFor(() => expect(screen.queryByText("Студент: Алишер Каримов")).toBeNull());
  });

  it("transfers a student into an explicitly picked target group", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups/g-1/transfer", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = renderManager();

    openTransfer("Алишер Каримов");
    fireEvent.change(within(formOf(container)).getByRole("combobox"), {
      target: { value: "g-3" },
    });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "s-1",
      targetGroupId: "g-3",
      reason: "",
    });
  });

  it("surfaces a transfer API error and a network failure", async () => {
    let call = 0;
    installFetchMock([
      {
        match: "/api/groups/g-1/transfer",
        method: "POST",
        reply: () => {
          call += 1;
          return call === 1 ? jsonResponse({ error: "Группа заполнена" }, 400) : brokenResponse(200);
        },
      },
    ]);

    const { container } = renderManager();

    openTransfer("Алишер Каримов");
    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Группа заполнена"));
    // Modal stays open so the operator can pick another target.
    expect(screen.getByText("Студент: Алишер Каримов")).toBeTruthy();

    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized transfer error and closes the modal on cancel", async () => {
    installFetchMock([
      { match: "/api/groups/g-1/transfer", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    const { container } = renderManager();

    openTransfer("Алишер Каримов");
    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка перевода"));

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  });

  it("closes the transfer modal without a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderManager();

    openTransfer("Алишер Каримов");
    expect(screen.getByText("Студент: Алишер Каримов")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Студент: Алишер Каримов")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("does nothing when the only group leaves no transfer target", () => {
    const { calls } = installFetchMock([]);

    const { container } = renderManager({ initialGroups: [groups[0]] });

    openTransfer("Алишер Каримов");
    const targetSelect = within(formOf(container)).getByRole("combobox") as HTMLSelectElement;
    expect(targetSelect.options).toHaveLength(0);
    expect(targetSelect.value).toBe("");

    fireEvent.submit(formOf(container));

    expect(calls).toHaveLength(0);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("drops a student: sends the DELETE body, alerts and refreshes", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/groups/g-1/enrollments",
        method: "DELETE",
        reply: jsonResponse({ ok: true }),
      },
    ]);

    const { container } = renderManager();

    openDrop("Нилуфар Рахимова");

    expect(
      screen.getByText("Вы уверены, что хотите отчислить студента Нилуфар Рахимова?"),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByPlaceholderText("e.g. Переезд в другой город / Личные обстоятельства"),
      { target: { value: "Переезд" } },
    );
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/groups/g-1/enrollments");
    expect(calls[0].init?.method).toBe("DELETE");
    expect(sentBody(calls[0])).toEqual({ studentMembershipId: "s-2", reason: "Переезд" });
    expect(window.alert).toHaveBeenCalledWith("Студент отчислен из группы");
    await waitFor(() =>
      expect(
        screen.queryByText("Вы уверены, что хотите отчислить студента Нилуфар Рахимова?"),
      ).toBeNull(),
    );
  });

  it("surfaces a drop API error and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/groups/g-1/enrollments",
        method: "DELETE",
        reply: jsonResponse({ error: "Зачисление не найдено" }, 404),
      },
    ]);

    const { container } = renderManager();

    openDrop("Нилуфар Рахимова");
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Зачисление не найдено"));
    expect(
      screen.getByText("Вы уверены, что хотите отчислить студента Нилуфар Рахимова?"),
    ).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized drop error and reports a network failure", async () => {
    let call = 0;
    installFetchMock([
      {
        // Зафар lives in g-2, so match the suffix rather than the exact id.
        match: "/enrollments",
        method: "DELETE",
        reply: () => {
          call += 1;
          return call === 1 ? jsonResponse({}, 500) : brokenResponse(200);
        },
      },
    ]);

    const { container } = renderManager();

    openDrop("Зафар Юсупов");
    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка отчисления"));

    fireEvent.submit(formOf(container));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes the drop modal without a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderManager();

    openDrop("Алишер Каримов");
    expect(
      screen.getByText("Вы уверены, что хотите отчислить студента Алишер Каримов?"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(
      screen.queryByText("Вы уверены, что хотите отчислить студента Алишер Каримов?"),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
