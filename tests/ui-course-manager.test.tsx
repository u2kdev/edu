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
import CourseManager, { type CourseItem } from "@/components/CourseManager";
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
  usePathname: () => "/center/courses",
  useSearchParams: () => new URLSearchParams(),
}));

const coursesData: CourseItem[] = [
  {
    id: "c-1",
    title: "React для начинающих",
    description: "Изучаем компоненты и хуки",
    isPublished: true,
    modules: [
      {
        id: "m-1",
        title: "Введение в React",
        lessons: [
          { id: "l-1", title: "JSX основы", durationMinutes: 45, lessonType: "VIDEO" },
          { id: "l-2", title: "Практика компонентов", durationMinutes: 30, lessonType: "PRACTICE" },
        ],
      },
    ],
    groups: [{ id: "g-1" }],
  },
  {
    id: "c-2",
    title: "Python Basic",
    description: null,
    isPublished: false,
    modules: [],
    groups: [],
  },
];

const createForm = () => document.querySelector("form") as HTMLFormElement;

describe("CourseManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders DataTable rows by default and expands curriculum in Программа mode", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    const table = within(screen.getByRole("table"));
    expect(table.getByText("React для начинающих")).toBeTruthy();
    expect(table.getByText("Python Basic")).toBeTruthy();
    expect(table.getByText("Изучаем компоненты и хуки")).toBeTruthy();
    expect(table.getByText("Без описания")).toBeTruthy();
    expect(table.getAllByText("Опубликован")).toHaveLength(1);
    expect(table.getByText("Модулей: 1")).toBeTruthy();
    expect(table.getByText("Групп: 1")).toBeTruthy();
    expect(table.getByText("Модулей: 0")).toBeTruthy();
    expect(table.getByText("Групп: 0")).toBeTruthy();

    // Switch to accordion curriculum view.
    fireEvent.click(screen.getByRole("button", { name: "Программа" }));

    expect(screen.getByText("Учебная программа (модули)")).toBeTruthy();
    expect(screen.getByText("Введение в React")).toBeTruthy();
    expect(screen.getByText("JSX основы")).toBeTruthy();
    expect(screen.getByText("Практика компонентов")).toBeTruthy();
    expect(screen.getByText("45 минут")).toBeTruthy();
    expect(screen.getByText("30 минут")).toBeTruthy();
    expect(screen.getByText("VIDEO")).toBeTruthy();
    expect(screen.getByText("PRACTICE")).toBeTruthy();
    expect(screen.queryByText("Модули курса еще не созданы.")).toBeNull();
  });

  it("shows the empty state when the center has no courses", () => {
    render(<CourseManager initialCourses={[]} role="DIRECTOR" />);

    expect(
      screen.getByText("В этом учебном центре пока нет добавленных курсов."),
    ).toBeTruthy();
  });

  it("shows the add-course button only for DIRECTOR and CENTER_ADMIN", () => {
    const { unmount } = render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    expect(screen.getByRole("button", { name: /Добавить курс/ })).toBeTruthy();
    unmount();

    const admin = render(<CourseManager initialCourses={coursesData} role="CENTER_ADMIN" />);
    expect(screen.getByRole("button", { name: /Добавить курс/ })).toBeTruthy();
    admin.unmount();

    const teacher = render(<CourseManager initialCourses={coursesData} role="TEACHER" />);
    expect(screen.queryByRole("button", { name: /Добавить курс/ })).toBeNull();
    teacher.unmount();

    render(<CourseManager initialCourses={coursesData} />);
    expect(screen.queryByRole("button", { name: /Добавить курс/ })).toBeNull();
  });

  it("toggles the accordion and renders the empty-curriculum note for a course without modules", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: "Программа" }));

    fireEvent.click(screen.getByText("Python Basic"));

    expect(screen.getByText("Модули курса еще не созданы.")).toBeTruthy();
    expect(screen.queryByText("JSX основы")).toBeNull();

    fireEvent.click(screen.getByText("Python Basic"));
    expect(screen.queryByText("Модули курса еще не созданы.")).toBeNull();
  });

  it("opens the create modal and closes it on cancel without sending a request", () => {
    const { calls } = installFetchMock([]);
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Название курса")).toBeTruthy();
    expect(within(dialog).getByText("Описание курса")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("creates a course, sends the payload, refreshes and resets the form", async () => {
    const { calls } = installFetchMock([
      { match: "/api/courses", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));

    const form = createForm();
    const titleInput = form.querySelector('input[type="text"]') as HTMLInputElement;
    const descInput = form.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: "Новый курс" } });
    fireEvent.change(descInput, { target: { value: "Описание нового курса" } });

    fireEvent.submit(form);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/courses");
    expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(calls[0])).toEqual({
      title: "Новый курс",
      description: "Описание нового курса",
      isPublished: true,
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));
    const nextForm = createForm();
    expect((nextForm.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("");
    expect((nextForm.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("surfaces a create error returned by the API via inline alert and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/courses",
        method: "POST",
        reply: jsonResponse({ error: "Курс с таким названием уже существует" }, 400),
      },
    ]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));
    fireEvent.submit(createForm());

    expect(await screen.findByText("Курс с таким названием уже существует")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(within(screen.getByRole("dialog")).getByText("Название курса")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows fallback network error inline when the error body has no message", async () => {
    installFetchMock([
      { match: "/api/courses", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));
    fireEvent.submit(createForm());

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Название курса")).toBeTruthy();
  });

  it("reports a network failure with the localized error message inline", async () => {
    installFetchMock([]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить курс/ }));
    fireEvent.submit(createForm());

    expect(await screen.findByText("Ошибка сети")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("uses the uz-Latn localization for labels and the network error", async () => {
    installFetchMock([]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" locale="uz-Latn" />);

    expect(screen.getByRole("button", { name: /Yangi kurs qoʻshish/ })).toBeTruthy();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Modullar: 1")).toBeTruthy();
    expect(table.getByText("Guruhlar: 1")).toBeTruthy();
    expect(table.getByText("Chop etilgan")).toBeTruthy();
    expect(table.getByText("Tavsifsiz")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Программа" }));
    expect(screen.getByText("Oʻquv dasturi (modullar)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Yangi kurs qoʻshish/ }));
    expect(screen.getByText("Yangi kurs yaratish")).toBeTruthy();

    fireEvent.submit(createForm());
    expect(await screen.findByText("Tarmoq xatosi")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
  });

  it("falls back to Russian translations for an unsupported locale", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" locale="fr" />);

    expect(screen.getByRole("button", { name: /Добавить курс/ })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("Модулей: 1")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Программа" }));
    expect(screen.getByText("Учебная программа (модули)")).toBeTruthy();
  });
});
