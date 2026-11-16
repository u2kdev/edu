// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import GroupsManager from "@/components/GroupsManager";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

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

function renderCardView(overrides: Partial<ComponentProps<typeof GroupsManager>> = {}) {
  const res = renderManager(overrides);
  fireEvent.click(screen.getByRole("button", { name: "Карточки" }));
  return res;
}

function cardOf(name: string): HTMLElement {
  return screen.getByRole("heading", { level: 3, name }).closest(".rounded-lg") as HTMLElement;
}

function rowOf(studentName: string): HTMLElement {
  return screen.getByText(studentName).closest("li") as HTMLElement;
}

function editButtonOf(name: string): HTMLButtonElement {
  return within(cardOf(name)).getByTitle("Редактировать группу") as HTMLButtonElement;
}

const openTransfer = (studentName: string) => {
  fireEvent.click(within(rowOf(studentName)).getByTitle("Перевести в другую группу"));
};

const openDrop = (studentName: string) => {
  fireEvent.click(within(rowOf(studentName)).getByTitle("Отчислить ученика"));
};

const formOf = (_container?: HTMLElement) => document.querySelector("form") as HTMLFormElement;

describe("GroupsManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders DataTable rows by default and opens GroupDetailSheet with tabs", () => {
    installFetchMock([]);
    renderManager();

    const table = within(screen.getByRole("table"));
    expect(table.getByText("Поток JS-2026-A")).toBeTruthy();
    expect(table.getByText("Поток PY-2026-B")).toBeTruthy();
    expect(table.getByText("Поток UX-2026-C")).toBeTruthy();
    expect(table.getByText("2 / 30")).toBeTruthy();

    fireEvent.click(table.getAllByRole("button", { name: "Карточка" })[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Состав (2)")).toBeTruthy();
    expect(within(dialog).getByText("Тарифы оплаты периода")).toBeTruthy();
    expect(within(dialog).getByText("Алишер Каримов")).toBeTruthy();
  });

  it("renders every group card when switched to Карточки: course, teacher, capacity badge and roster", () => {
    installFetchMock([]);

    renderCardView();

    expect(screen.getByRole("heading", { level: 3, name: "Поток JS-2026-A" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Поток PY-2026-B" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 3, name: "Поток UX-2026-C" })).toBeTruthy();

    expect(screen.getAllByText("Frontend-разработка").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText("Python-разработка").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("Преподаватель: Иванов Иван")).toBeTruthy();
    expect(screen.getByText("Преподаватель: Петров Пётр")).toBeTruthy();
    expect(screen.getAllByText("Преподаватель не назначен").length).toBeGreaterThanOrEqual(1);

    expect(screen.getByText("2 / 30")).toBeTruthy();
    expect(screen.getByText("1 / 1")).toBeTruthy();
    expect(screen.getByText("0 / 20")).toBeTruthy();

    expect(screen.getByText("Зачисленные ученики (2)")).toBeTruthy();
    expect(screen.getByText("Зачисленные ученики (1)")).toBeTruthy();
    expect(screen.getByText("Зачисленные ученики (0)")).toBeTruthy();
    expect(screen.getByText("В этой группе пока нет учеников")).toBeTruthy();

    expect(screen.getByText("Алишер Каримов")).toBeTruthy();
    expect(screen.getByText("+998901112233")).toBeTruthy();
    expect(screen.getByText("Нилуфар Рахимова")).toBeTruthy();
    expect(screen.getByText("nilufar@example.uz")).toBeTruthy();

    expect(screen.getAllByTitle("Редактировать группу")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Создать группу/ })).toBeTruthy();
  });

  it("renders the empty state when there are no groups", () => {
    installFetchMock([]);

    renderManager({ initialGroups: [] });

    expect(screen.getByRole("heading", { level: 3, name: "Нет данных" })).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("hides every management control for a TEACHER but still shows the roster in card view", () => {
    installFetchMock([]);

    renderCardView({ role: "TEACHER" });

    expect(screen.queryByRole("button", { name: /Создать группу/ })).toBeNull();
    expect(screen.queryByTitle("Редактировать группу")).toBeNull();
    expect(screen.queryByTitle("Перевести в другую группу")).toBeNull();
    expect(screen.queryByTitle("Отчислить ученика")).toBeNull();

    expect(screen.getByText("Алишер Каримов")).toBeTruthy();
    expect(screen.getByText("Преподаватель: Иванов Иван")).toBeTruthy();
  });

  it("treats an unknown role as read-only and falls back to the default locale", () => {
    installFetchMock([]);

    renderCardView({ role: undefined, locale: "fr" });

    expect(screen.queryByRole("button", { name: /Создать группу/ })).toBeNull();
    expect(screen.queryByTitle("Редактировать группу")).toBeNull();
    expect(screen.getAllByText("Преподаватель не назначен").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Зачисленные ученики (0)")).toBeTruthy();
  });

  it("renders the uz-Latn translations", () => {
    installFetchMock([]);

    renderCardView({ locale: "uz-Latn" });

    expect(screen.getByRole("button", { name: /Guruh yaratish/ })).toBeTruthy();
    expect(screen.getAllByText("Oʻqituvchi belgilanmagan").length).toBeGreaterThanOrEqual(1);
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
      teacherMembershipId: null,
      assistantMembershipId: null,
      maxStudents: "30",
    });

    await waitFor(() => expect(screen.queryByPlaceholderText("e.g. Поток JS-2026-A")).toBeNull());
    expect(screen.queryByText("Выберите курс")).toBeNull();
  });

  it("creates a group with the chosen course, teacher and capacity", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups", method: "POST", reply: jsonResponse({ id: "g-new" }, 201) },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));

    const form = formOf(container);
    const selects = form.querySelectorAll("select");
    expect(selects).toHaveLength(2);
    fireEvent.change(selects[0], { target: { value: "c-2" } });
    fireEvent.change(selects[1], { target: { value: "t-2" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Поток JS-2026-A"), {
      target: { value: "Поток PY-2026-A" },
    });
    fireEvent.change(form.querySelector('input[type="number"]')!, {
      target: { value: "15" },
    });

    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      courseId: "c-2",
      name: "Поток PY-2026-A",
      teacherMembershipId: "t-2",
      assistantMembershipId: null,
      maxStudents: "15",
    });
  });

  it("surfaces a create validation error from the API inline and keeps the modal open", async () => {
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

    expect(await screen.findByText("Название уже занято")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText("e.g. Поток JS-2026-A")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized create error inline when the body has no `error`", async () => {
    installFetchMock([{ match: "/api/groups", method: "POST", reply: jsonResponse({}, 400) }]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Ошибка создания группы")).toBeTruthy();
  });

  it("reports a create network failure inline", async () => {
    installFetchMock([]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("reports a malformed create payload as a network error inline", async () => {
    installFetchMock([
      { match: "/api/groups", method: "POST", reply: brokenResponse(200) },
    ]);

    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Создать группу/ }));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
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

    const { container } = renderCardView();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    expect(screen.getByText("Редактировать группу")).toBeTruthy();

    const form = formOf(container);
    const nameInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    const maxInput = form.querySelector('input[type="number"]') as HTMLInputElement;
    const teacherSelect = form.querySelector("select") as HTMLSelectElement;
    expect(nameInput.value).toBe("Поток JS-2026-A");
    expect(maxInput.value).toBe("30");
    expect(teacherSelect.value).toBe("t-1");

    fireEvent.change(nameInput, { target: { value: "Поток JS-2026-A (вечер)" } });
    fireEvent.change(teacherSelect, { target: { value: "t-2" } });
    fireEvent.change(maxInput, { target: { value: "25" } });

    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/groups/g-1");
    expect(calls[0].init?.method).toBe("PUT");
    expect(sentBody(calls[0])).toEqual({
      name: "Поток JS-2026-A (вечер)",
      teacherMembershipId: "t-2",
      assistantMembershipId: null,
      maxStudents: "25",
    });

    expect(
      screen.getByRole("heading", { level: 3, name: "Поток JS-2026-A (вечер)" }),
    ).toBeTruthy();
    expect(screen.getByText("2 / 25")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Редактировать группу")).toBeNull());
  });

  it("sends `null` as the teacher when the edit modal clears the teacher", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups/g-1", method: "PUT", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = renderCardView();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    const form = formOf(container);
    fireEvent.change(form.querySelector("select")!, { target: { value: "" } });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      name: "Поток JS-2026-A",
      teacherMembershipId: null,
      assistantMembershipId: null,
      maxStudents: "30",
    });

    await waitFor(() => expect(screen.getAllByText("Преподаватель не назначен").length).toBeGreaterThanOrEqual(2));
  });

  it("surfaces an edit API error inline and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/groups/g-1",
        method: "PUT",
        reply: jsonResponse({ error: "Группа не найдена" }, 404),
      },
    ]);

    const { container } = renderCardView();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Группа не найдена")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(screen.getByText("Редактировать группу")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized edit error and closes the modal on cancel", async () => {
    installFetchMock([
      { match: "/api/groups/g-1", method: "PUT", reply: jsonResponse({}, 400) },
    ]);

    const { container } = renderCardView();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Ошибка сохранения")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByText("Редактировать группу")).toBeNull();
  });

  it("reports an edit network failure inline", async () => {
    installFetchMock([]);

    const { container } = renderCardView();

    fireEvent.click(editButtonOf("Поток JS-2026-A"));
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
  });

  it("closes the edit modal without sending a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderCardView();

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

    const { container } = renderCardView();

    openTransfer("Алишер Каримов");

    expect(screen.getByText("Ученик: Алишер Каримов")).toBeTruthy();
    const form = formOf(container);
    const options = within(form).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Поток PY-2026-B (1 / 1)",
      "Поток UX-2026-C (0 / 20)",
    ]);

    const targetSelect = within(form).getByRole("combobox") as HTMLSelectElement;
    expect(targetSelect.value).toBe("g-2");

    fireEvent.change(screen.getByPlaceholderText("e.g. Переход на вечернее расписание"), {
      target: { value: "Смена потока" },
    });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls[0].url).toBe("/api/groups/g-1/transfer");
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "s-1",
      targetGroupId: "g-2",
      reason: "Смена потока",
    });
    expect(await screen.findByText("Ученик переведён")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Ученик: Алишер Каримов")).toBeNull());
  });

  it("transfers a student into an explicitly picked target group", async () => {
    const { calls } = installFetchMock([
      { match: "/api/groups/g-1/transfer", method: "POST", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = renderCardView();

    openTransfer("Алишер Каримов");
    const form = formOf(container);
    fireEvent.change(within(form).getByRole("combobox"), {
      target: { value: "g-3" },
    });
    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(sentBody(calls[0])).toEqual({
      studentMembershipId: "s-1",
      targetGroupId: "g-3",
      reason: "",
    });
  });

  it("surfaces a transfer API error and a network failure inline", async () => {
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

    const { container } = renderCardView();

    openTransfer("Алишер Каримов");
    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Группа заполнена")).toBeTruthy();
    expect(screen.getByText("Ученик: Алишер Каримов")).toBeTruthy();

    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized transfer error and closes the modal on cancel", async () => {
    installFetchMock([
      { match: "/api/groups/g-1/transfer", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    const { container } = renderCardView();

    openTransfer("Алишер Каримов");
    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Ошибка перевода")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
  });

  it("closes the transfer modal without a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderCardView();

    openTransfer("Алишер Каримов");
    expect(screen.getByText("Ученик: Алишер Каримов")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Ученик: Алишер Каримов")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("does nothing when the only group leaves no transfer target", () => {
    const { calls } = installFetchMock([]);

    const { container } = renderCardView({ initialGroups: [groups[0]] });

    openTransfer("Алишер Каримов");
    const form = formOf(container);
    const targetSelect = within(form).getByRole("combobox") as HTMLSelectElement;
    expect(targetSelect.options).toHaveLength(0);
    expect(targetSelect.value).toBe("");

    fireEvent.submit(form);

    expect(calls).toHaveLength(0);
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("drops a student: sends the DELETE body, shows inline alert and refreshes", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/groups/g-1/enrollments",
        method: "DELETE",
        reply: jsonResponse({ ok: true }),
      },
    ]);

    const { container } = renderCardView();

    openDrop("Нилуфар Рахимова");

    expect(
      screen.getByText("Вы уверены, что хотите отчислить ученика Нилуфар Рахимова?"),
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
    expect(await screen.findByText("Ученик отчислен из группы")).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.queryByText("Вы уверены, что хотите отчислить ученика Нилуфар Рахимова?"),
      ).toBeNull(),
    );
  });

  it("surfaces a drop API error inline and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/groups/g-1/enrollments",
        method: "DELETE",
        reply: jsonResponse({ error: "Зачисление не найдено" }, 404),
      },
    ]);

    const { container } = renderCardView();

    openDrop("Нилуфар Рахимова");
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Зачисление не найдено")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(
      screen.getByText("Вы уверены, что хотите отчислить ученика Нилуфар Рахимова?"),
    ).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to the localized drop error and reports a network failure inline", async () => {
    let call = 0;
    installFetchMock([
      {
        match: "/enrollments",
        method: "DELETE",
        reply: () => {
          call += 1;
          return call === 1 ? jsonResponse({}, 500) : brokenResponse(200);
        },
      },
    ]);

    const { container } = renderCardView();

    openDrop("Зафар Юсупов");
    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Ошибка отчисления")).toBeTruthy();

    fireEvent.submit(formOf(container));
    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("closes the drop modal without a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    renderCardView();

    openDrop("Алишер Каримов");
    expect(
      screen.getByText("Вы уверены, что хотите отчислить ученика Алишер Каримов?"),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(
      screen.queryByText("Вы уверены, что хотите отчислить ученика Алишер Каримов?"),
    ).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
