// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import StudentsManager from "@/components/StudentsManager";
import { installFetchMock, jsonResponse, brokenResponse, sentBody } from "./helpers/ui";

// `next/link` is mocked so the anchor is rendered without depending on the Next
// App Router context (which does not exist in jsdom).
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    __esModule: true,
    default: ({
      href,
      children,
      ...rest
    }: {
      href?: unknown;
      children?: unknown;
      [key: string]: unknown;
    }) =>
      React.createElement(
        "a",
        { href: typeof href === "string" ? href : "", ...rest },
        children as React.ReactNode,
      ),
  };
});

const groups = [
  { id: "g-1", name: "Математика" },
  { id: "g-2", name: "Физика" },
];

// Rich fixture set: one ACTIVE student with an ACTIVE enrollment, one ARCHIVED
// student with no active enrollment and a NULL phone.
const students = [
  {
    id: "s-1",
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00.000Z",
    user: {
      id: "u-1",
      fullName: "Алишер Каримов",
      email: "alisher@example.uz",
      phone: "+998901112233",
    },
    enrollments: [
      {
        id: "e-1",
        status: "ACTIVE",
        group: { id: "g-1", name: "Математика", course: { title: "Алгебра" } },
      },
      {
        // FINISHED enrollment whose group is NOT in the filter options, so we
        // can assert it is never rendered as a badge.
        id: "e-2",
        status: "FINISHED",
        group: { id: "g-99", name: "Биология" },
      },
    ],
    parentLinksAsStudent: [
      { parent: { user: { fullName: "Отец Каримов", phone: "+998900000000" } } },
    ],
  },
  {
    id: "s-2",
    status: "ARCHIVED",
    createdAt: "2026-02-01T00:00:00.000Z",
    user: {
      id: "u-2",
      fullName: "Нилуфар Рахимова",
      email: "nilufar@example.uz",
      phone: null,
    },
    enrollments: [],
  },
];

function studentsResponse(
  list: unknown[] = students,
  pagination: { totalPages: number; totalCount: number } = { totalPages: 2, totalCount: 42 },
) {
  return jsonResponse({ students: list, pagination });
}

const getRoute = (reply: Response | (() => Response)) =>
  ({ match: "/api/students", method: "GET", reply }) as const;

describe("StudentsManager (UI)", () => {
  beforeEach(() => {
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the header, total count, table, cards, statuses, groups and management actions", async () => {
    installFetchMock([getRoute(studentsResponse())]);

    const { container } = render(
      <StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />,
    );

    // Title and server-side total count.
    expect(await screen.findByText("Студенты")).toBeTruthy();
    expect(screen.getByText("Всего учеников: 42")).toBeTruthy();

    // Both responsive views render in jsdom (CSS classes are ignored).
    expect(screen.getAllByText("Алишер Каримов").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Нилуфар Рахимова").length).toBeGreaterThan(0);
    expect(container.querySelectorAll("table")).toHaveLength(1);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);

    // Status labels (also present as filter <option> values).
    expect(screen.getAllByText("Активен").length).toBeGreaterThan(0);
    expect(screen.getAllByText("В архиве").length).toBeGreaterThan(0);

    // Contact details.
    expect(screen.getAllByText("alisher@example.uz").length).toBeGreaterThan(0);
    expect(screen.getAllByText("+998901112233").length).toBeGreaterThan(0);

    // Active enrollment badge vs. "no groups" fallback.
    expect(screen.getAllByText("Математика").length).toBeGreaterThan(0);
    expect(screen.queryByText("Биология")).toBeNull();
    expect(screen.getAllByText("Не зачислен ни в одну группу").length).toBeGreaterThan(0);

    // Profile links point at the membership id.
    const links = screen.getAllByRole("link", { name: "Алишер Каримов" });
    expect(links.some((a) => a.getAttribute("href") === "/center/students/s-1")).toBe(true);

    // Management actions visible for a DIRECTOR.
    expect(screen.getByRole("button", { name: /Добавить студента/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Импорт из CSV/ })).toBeTruthy();
  });

  it("shows the loading state while the request is pending", () => {
    const pending = {
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    } as unknown as Response;
    installFetchMock([getRoute(pending)]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);

    expect(screen.getByText("Загрузка студентов...")).toBeTruthy();
  });

  it("hides the management actions for roles that cannot manage students", async () => {
    installFetchMock([getRoute(studentsResponse())]);

    render(<StudentsManager initialGroups={groups} role="TEACHER" locale="ru" />);

    await screen.findByText("Студенты");
    expect(screen.queryByRole("button", { name: /Добавить студента/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Импорт из CSV/ })).toBeNull();
  });

  it("renders the empty state when there are no students", async () => {
    installFetchMock([getRoute(studentsResponse([], { totalPages: 1, totalCount: 0 }))]);

    render(<StudentsManager initialGroups={groups} role="CENTER_ADMIN" locale="ru" />);

    expect(await screen.findByText("Студенты не найдены")).toBeTruthy();
  });

  it("renders the filtered empty state once a filter is applied", async () => {
    installFetchMock([
      { match: "/api/students", method: "GET", reply: studentsResponse([], { totalPages: 1, totalCount: 0 }) },
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);

    await screen.findByText("Студенты не найдены");
    fireEvent.change(screen.getByPlaceholderText("Поиск по имени или email..."), {
      target: { value: "несуществует" },
    });

    expect(await screen.findByText("По заданным фильтрам ничего не найдено")).toBeTruthy();
  });

  it("surfaces an API error and recovers after pressing retry", async () => {
    let call = 0;
    installFetchMock([
      {
        match: "/api/students",
        method: "GET",
        reply: () => {
          call += 1;
          return call === 1
            ? jsonResponse({ error: "Сервер недоступен" }, 500)
            : studentsResponse();
        },
      },
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);

    expect(await screen.findByText("Сервер недоступен")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Повторить попытку" }));

    await screen.findAllByText("Алишер Каримов");
    expect(screen.queryByText("Сервер недоступен")).toBeNull();
  });

  it("falls back to the localized message when the error body has no `error` field", async () => {
    installFetchMock([getRoute(jsonResponse({}, 500))]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);

    expect(await screen.findByText("Ошибка при загрузке студентов")).toBeTruthy();
  });

  it("reports a malformed payload through the error state", async () => {
    installFetchMock([getRoute(brokenResponse(200))]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);

    expect(await screen.findByText("invalid json")).toBeTruthy();
  });

  it("sends every filter as a query parameter when the controls change", async () => {
    const { calls } = installFetchMock([
      { match: "/api/students", method: "GET", reply: studentsResponse([], { totalPages: 1, totalCount: 0 }) },
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты не найдены");

    const lastUrl = () => decodeURIComponent(calls[calls.length - 1].url);
    expect(lastUrl()).toContain("page=1");
    expect(lastUrl()).toContain("pageSize=15");
    expect(lastUrl()).toContain("sortBy=name");
    expect(lastUrl()).toContain("sortOrder=asc");

    fireEvent.change(screen.getByPlaceholderText("Поиск по имени или email..."), {
      target: { value: "али" },
    });
    await waitFor(() => expect(lastUrl()).toContain("search=али"));

    const [groupSelect, statusSelect, sortSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];

    fireEvent.change(groupSelect, { target: { value: "g-1" } });
    await waitFor(() => expect(lastUrl()).toContain("groupId=g-1"));

    fireEvent.change(statusSelect, { target: { value: "ARCHIVED" } });
    await waitFor(() => expect(lastUrl()).toContain("status=ARCHIVED"));

    fireEvent.change(sortSelect, { target: { value: "createdAt-desc" } });
    await waitFor(() => {
      expect(lastUrl()).toContain("sortBy=createdAt");
      expect(lastUrl()).toContain("sortOrder=desc");
    });
  });

  it("paginates forward and backward and disables the boundary buttons", async () => {
    installFetchMock([getRoute(studentsResponse(students, { totalPages: 3, totalCount: 45 }))]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    expect(await screen.findByText("Страница 1 из 3")).toBeTruthy();

    // The whole content (pagination included) unmounts while a page request is
    // loading, so the buttons must be re-queried after every navigation.
    const paginationButtons = () =>
      screen
        .getAllByRole("button")
        .filter((b) => b.className.includes("disabled:opacity-40")) as HTMLButtonElement[];

    await waitFor(() => expect(paginationButtons()).toHaveLength(2));
    expect(paginationButtons()[0].disabled).toBe(true);
    expect(paginationButtons()[1].disabled).toBe(false);

    fireEvent.click(paginationButtons()[1]);
    expect(await screen.findByText("Страница 2 из 3")).toBeTruthy();
    await waitFor(() => {
      expect(paginationButtons()).toHaveLength(2);
      expect(paginationButtons()[0].disabled).toBe(false);
    });

    fireEvent.click(paginationButtons()[1]);
    expect(await screen.findByText("Страница 3 из 3")).toBeTruthy();
    await waitFor(() => {
      expect(paginationButtons()).toHaveLength(2);
      expect(paginationButtons()[1].disabled).toBe(true);
    });

    fireEvent.click(paginationButtons()[0]);
    expect(await screen.findByText("Страница 2 из 3")).toBeTruthy();
  });

  it("closes the add-student modal without any request when cancelled", async () => {
    const { calls } = installFetchMock([getRoute(studentsResponse())]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Добавить студента/ }));
    expect(screen.getByPlaceholderText("Алишер Навоий")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByPlaceholderText("Алишер Навоий")).toBeNull();
    expect(calls.some((c) => c.init?.method === "POST")).toBe(false);
  });

  it("creates a student with an invite code, shows the code and closes the modal", async () => {
    const { calls } = installFetchMock([
      getRoute(studentsResponse()),
      { match: "/api/students", method: "POST", reply: jsonResponse({ inviteCode: "INV-123" }, 201) },
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Добавить студента/ }));
    fireEvent.change(screen.getByPlaceholderText("Алишер Навоий"), {
      target: { value: "Тест Тестов" },
    });
    fireEvent.change(screen.getByPlaceholderText("alisher@example.uz"), {
      target: { value: "test@example.uz" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Алишер Навоий").closest("form")!);

    expect(await screen.findByText("INV-123")).toBeTruthy();
    expect(screen.getByText("Студент успешно создан! Одноразовый инвайт-код:")).toBeTruthy();

    // Success also triggers a refetch.
    await waitFor(() =>
      expect(calls.filter((c) => (c.init?.method ?? "GET") === "GET").length).toBeGreaterThan(1),
    );

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByText("INV-123")).toBeNull());
  });

  it("creates a student without an invite, sends the full body and refetches", async () => {
    const { calls } = installFetchMock([
      getRoute(studentsResponse()),
      { match: "/api/students", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    const { container } = render(
      <StudentsManager initialGroups={groups} role="CENTER_ADMIN" locale="ru" />,
    );
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Добавить студента/ }));
    fireEvent.change(screen.getByPlaceholderText("Алишер Навоий"), {
      target: { value: "Иван Иванов" },
    });
    fireEvent.change(screen.getByPlaceholderText("alisher@example.uz"), {
      target: { value: "ivan@example.uz" },
    });
    fireEvent.change(screen.getByPlaceholderText("+998901234567"), {
      target: { value: "+998901234567" },
    });
    // 3 header selects + the modal select (last one).
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[3], { target: { value: "g-1" } });
    // Uncheck "create with invite code" so the modal closes on success.
    fireEvent.click(screen.getByLabelText("Создать с инвайт-кодом"));

    fireEvent.submit(screen.getByPlaceholderText("Алишер Навоий").closest("form")!);

    await waitFor(() => expect(screen.queryByPlaceholderText("Алишер Навоий")).toBeNull());

    const postCall = calls.find((c) => c.init?.method === "POST")!;
    expect(sentBody(postCall)).toEqual({
      fullName: "Иван Иванов",
      email: "ivan@example.uz",
      phone: "+998901234567",
      groupId: "g-1",
      withInvite: false,
    });

    await waitFor(() =>
      expect(calls.filter((c) => (c.init?.method ?? "GET") === "GET").length).toBeGreaterThan(1),
    );
  });

  it("surfaces an add-student validation error via alert and keeps the modal open", async () => {
    installFetchMock([
      getRoute(studentsResponse()),
      { match: "/api/students", method: "POST", reply: jsonResponse({ error: "Email уже занят" }, 400) },
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Добавить студента/ }));
    fireEvent.change(screen.getByPlaceholderText("Алишер Навоий"), {
      target: { value: "Дубликат" },
    });
    fireEvent.change(screen.getByPlaceholderText("alisher@example.uz"), {
      target: { value: "dup@example.uz" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Алишер Навоий").closest("form")!);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Email уже занят"));
    expect(screen.getByPlaceholderText("Алишер Навоий")).toBeTruthy();
  });

  it("reports an add-student network failure with a generic alert", async () => {
    installFetchMock([getRoute(studentsResponse())]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Добавить студента/ }));
    fireEvent.change(screen.getByPlaceholderText("Алишер Навоий"), {
      target: { value: "Без сети" },
    });
    fireEvent.change(screen.getByPlaceholderText("alisher@example.uz"), {
      target: { value: "offline@example.uz" },
    });
    fireEvent.submit(screen.getByPlaceholderText("Алишер Навоий").closest("form")!);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("previews and executes a CSV import, sending the right mode and rendering both reports", async () => {
    let csvCall = 0;
    const { calls } = installFetchMock([
      {
        match: "/api/students/import-csv",
        method: "POST",
        reply: () => {
          csvCall += 1;
          return csvCall === 1
            ? jsonResponse({
                totalParsed: 3,
                validCount: 2,
                errorCount: 1,
                validPreview: [{ fullName: "A", email: "a@b.c" }],
                errors: [{ row: 2, error: "bad email", raw: "x" }],
              })
            : jsonResponse({ createdCount: 2, errors: [{ row: 3, error: "duplicate" }] });
        },
      },
      getRoute(studentsResponse()),
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));

    const previewBtn = screen.getByRole("button", { name: "Предпросмотр CSV" }) as HTMLButtonElement;
    const executeBtn = screen.getByRole("button", { name: "Отправить" }) as HTMLButtonElement;
    expect(previewBtn.disabled).toBe(true);
    expect(executeBtn.disabled).toBe(true);

    const csv = "ФИО, Email\nИван, ivan@example.uz";
    fireEvent.change(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/), {
      target: { value: csv },
    });
    expect(previewBtn.disabled).toBe(false);

    fireEvent.click(previewBtn);
    expect(await screen.findByText("Корректных строк: 2")).toBeTruthy();
    expect(screen.getByText("Ошибок: 1")).toBeTruthy();
    expect(screen.getByText(/Отчёт об ошибках/)).toBeTruthy();
    expect(screen.getByText("Строка 2: bad email")).toBeTruthy();

    const previewCall = calls.find((c) => c.url.includes("import-csv"))!;
    expect(sentBody(previewCall)).toEqual({ csvContent: csv, mode: "preview" });

    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    expect(await screen.findByText("Успешно импортировано: 2")).toBeTruthy();
    expect(screen.getByText("Строка 3: duplicate")).toBeTruthy();

    const executeCall = calls.filter((c) => c.url.includes("import-csv"))[1];
    expect(sentBody(executeCall)).toEqual({ csvContent: csv, mode: "execute" });

    // After execution the preview block and action buttons disappear.
    expect(screen.queryByRole("button", { name: "Отправить" })).toBeNull();
  });

  it("keeps the execute button disabled when the preview has no valid rows", async () => {
    installFetchMock([
      {
        match: "/api/students/import-csv",
        method: "POST",
        reply: jsonResponse({
          totalParsed: 1,
          validCount: 0,
          errorCount: 1,
          validPreview: [],
          errors: [{ row: 1, error: "empty", raw: "" }],
        }),
      },
      getRoute(studentsResponse()),
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));
    fireEvent.change(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/), {
      target: { value: "bad,," },
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр CSV" }));

    expect(await screen.findByText("Корректных строк: 0")).toBeTruthy();
    const executeBtn = screen.getByRole("button", { name: "Отправить" }) as HTMLButtonElement;
    expect(executeBtn.disabled).toBe(true);
  });

  it("reports a CSV preview API error via alert", async () => {
    installFetchMock([
      { match: "/api/students/import-csv", method: "POST", reply: jsonResponse({ error: "CSV битый" }, 400) },
      getRoute(studentsResponse()),
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));
    fireEvent.change(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/), {
      target: { value: "broken" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр CSV" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("CSV битый"));
  });

  it("reports a CSV execute API error via alert", async () => {
    let csvCall = 0;
    installFetchMock([
      {
        match: "/api/students/import-csv",
        method: "POST",
        reply: () => {
          csvCall += 1;
          return csvCall === 1
            ? jsonResponse({
                totalParsed: 1,
                validCount: 1,
                errorCount: 0,
                validPreview: [{ fullName: "A", email: "a@b.c" }],
                errors: [],
              })
            : jsonResponse({ error: "Импорт упал" }, 500);
        },
      },
      getRoute(studentsResponse()),
    ]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));
    fireEvent.change(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/), {
      target: { value: "ok, ok@example.uz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр CSV" }));
    await screen.findByText("Корректных строк: 1");

    fireEvent.click(screen.getByRole("button", { name: "Отправить" }));
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Импорт упал"));
  });

  it("reports a CSV network failure with a generic alert", async () => {
    installFetchMock([getRoute(studentsResponse())]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));
    fireEvent.change(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/), {
      target: { value: "offline" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Предпросмотр CSV" }));

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("closes the CSV modal from its close button", async () => {
    installFetchMock([getRoute(studentsResponse())]);

    render(<StudentsManager initialGroups={groups} role="DIRECTOR" locale="ru" />);
    await screen.findByText("Студенты");

    fireEvent.click(screen.getByRole("button", { name: /Импорт из CSV/ }));
    expect(screen.getByPlaceholderText(/ФИО, Email, Телефон, ID группы/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByPlaceholderText(/ФИО, Email, Телефон, ID группы/)).toBeNull();
  });
});
