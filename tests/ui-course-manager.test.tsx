// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
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

  it("expands the first course by default and renders its curriculum, counts and published badge", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    // Both course headers are visible; the busiest one carries the badge.
    expect(screen.getByText("React для начинающих")).toBeTruthy();
    expect(screen.getByText("Python Basic")).toBeTruthy();
    expect(screen.getByText("Изучаем компоненты и хуки")).toBeTruthy();
    expect(screen.getByText("Без описания")).toBeTruthy();
    expect(screen.getAllByText("Опубликован")).toHaveLength(1);

    // Per-course counters.
    expect(screen.getByText("Модулей: 1")).toBeTruthy();
    expect(screen.getByText("Групп: 1")).toBeTruthy();
    expect(screen.getByText("Модулей: 0")).toBeTruthy();
    expect(screen.getByText("Групп: 0")).toBeTruthy();

    // First course is expanded -> curriculum + module + lessons rendered.
    expect(screen.getByText("Учебная Программа (Модули)")).toBeTruthy();
    expect(screen.getByText("Введение в React")).toBeTruthy();
    expect(screen.getByText("JSX основы")).toBeTruthy();
    expect(screen.getByText("Практика компонентов")).toBeTruthy();
    expect(screen.getByText("45 минут")).toBeTruthy();
    expect(screen.getByText("30 минут")).toBeTruthy();
    expect(screen.getByText("VIDEO")).toBeTruthy();
    expect(screen.getByText("PRACTICE")).toBeTruthy();

    // The collapsed course has no curriculum section yet.
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
    expect(screen.getByRole("button", { name: /Добавить Новый Курс/ })).toBeTruthy();
    unmount();

    const admin = render(<CourseManager initialCourses={coursesData} role="CENTER_ADMIN" />);
    expect(screen.getByRole("button", { name: /Добавить Новый Курс/ })).toBeTruthy();
    admin.unmount();

    const teacher = render(<CourseManager initialCourses={coursesData} role="TEACHER" />);
    expect(screen.queryByRole("button", { name: /Добавить Новый Курс/ })).toBeNull();
    teacher.unmount();

    render(<CourseManager initialCourses={coursesData} />);
    expect(screen.queryByRole("button", { name: /Добавить Новый Курс/ })).toBeNull();
  });

  it("toggles the accordion and renders the empty-curriculum note for a course without modules", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    // Expand the second course (React collapses).
    fireEvent.click(screen.getByText("Python Basic"));

    expect(screen.getByText("Модули курса еще не созданы.")).toBeTruthy();
    expect(screen.queryByText("JSX основы")).toBeNull();

    // Collapse it again.
    fireEvent.click(screen.getByText("Python Basic"));
    expect(screen.queryByText("Модули курса еще не созданы.")).toBeNull();
  });

  it("opens the create modal and closes it on cancel without sending a request", () => {
    const { calls } = installFetchMock([]);
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));
    expect(screen.getByText("Создать Новый Курс")).toBeTruthy();
    expect(screen.getByText("Название курса")).toBeTruthy();
    expect(screen.getByText("Описание курса")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Создать Новый Курс")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("creates a course, sends the payload, refreshes and resets the form", async () => {
    const { calls } = installFetchMock([
      { match: "/api/courses", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    const { container } = render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));

    const titleInput = container.querySelector('input[type="text"]') as HTMLInputElement;
    const descInput = container.querySelector("textarea") as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: "Новый курс" } });
    fireEvent.change(descInput, { target: { value: "Описание нового курса" } });

    fireEvent.submit(createForm());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/courses");
    expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(calls[0])).toEqual({
      title: "Новый курс",
      description: "Описание нового курса",
      isPublished: true,
    });

    await waitFor(() => expect(screen.queryByText("Создать Новый Курс")).toBeNull());
    // Form state was reset for a subsequent open.
    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));
    expect((container.querySelector('input[type="text"]') as HTMLInputElement).value).toBe("");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("");
  });

  it("surfaces a create error returned by the API via alert and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/courses",
        method: "POST",
        reply: jsonResponse({ error: "Курс с таким названием уже существует" }, 400),
      },
    ]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));
    fireEvent.submit(createForm());

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith("Курс с таким названием уже существует"),
    );
    expect(screen.getByText("Создать Новый Курс")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("alerts with undefined when the error body has no message", async () => {
    installFetchMock([
      { match: "/api/courses", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));
    fireEvent.submit(createForm());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith(undefined));
    expect(screen.getByText("Создать Новый Курс")).toBeTruthy();
  });

  it("reports a network failure with the localized error message", async () => {
    installFetchMock([]); // no route -> fetch throws

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Добавить Новый Курс/ }));
    fireEvent.submit(createForm());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("uses the uz-Latn localization for labels and the network error", async () => {
    installFetchMock([]);

    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" locale="uz-Latn" />);

    expect(screen.getByRole("button", { name: /Yangi kurs qoʻshish/ })).toBeTruthy();
    expect(screen.getByText("Modullar: 1")).toBeTruthy();
    expect(screen.getByText("Guruhlar: 1")).toBeTruthy();
    expect(screen.getByText("Chop etilgan")).toBeTruthy();
    expect(screen.getByText("Tavsifsiz")).toBeTruthy();
    expect(screen.getByText("Oʻquv dasturi (Modullar)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Yangi kurs qoʻshish/ }));
    expect(screen.getByText("Yangi kurs yaratish")).toBeTruthy();

    fireEvent.submit(createForm());
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Tarmoq xatosi"));
  });

  it("falls back to Russian translations for an unsupported locale", () => {
    render(<CourseManager initialCourses={coursesData} role="DIRECTOR" locale="fr" />);

    expect(screen.getByRole("button", { name: /Добавить Новый Курс/ })).toBeTruthy();
    expect(screen.getByText("Модулей: 1")).toBeTruthy();
    expect(screen.getByText("Учебная Программа (Модули)")).toBeTruthy();
  });
});
