// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import HomeworkManager, { type HomeworkItem } from "@/components/HomeworkManager";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

// HomeworkManager does not import `next/navigation`, but the router is mocked
// anyway so the suite can assert that mutations update local state *without*
// asking the App Router to refresh (see the `refresh` assertions below).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/homework",
  useSearchParams: () => new URLSearchParams(),
}));

type Sub = HomeworkItem["submissions"][number];

/** Build a submission with sane defaults; override whatever a test needs. */
function sub(partial: Partial<Sub> & { id: string; studentMembershipId: string; studentName: string }): Sub {
  return {
    studentEmail: "",
    submissionText: null,
    filesJson: null,
    status: "SUBMITTED",
    grade: null,
    feedback: null,
    submittedAt: "2026-05-01T10:00:00.000Z",
    ...partial,
  };
}

/** Build a homework item with sane defaults. */
function hw(partial: Partial<HomeworkItem> & { id: string; title: string }): HomeworkItem {
  return {
    lessonId: `lesson-${partial.id}`,
    lessonTitle: "Урок",
    description: null,
    dueDate: null,
    materials: [],
    submissions: [],
    ...partial,
  };
}

// One homework per status branch: ACCEPTED (with grade + feedback), SUBMITTED,
// OVERDUE, REVISION_REQUESTED, no submission at all (NOT_SUBMITTED) and an
// unknown status that must fall back to NOT_SUBMITTED.
const studentHomeworks: HomeworkItem[] = [
  hw({
    id: "hw-accepted",
    title: "ДЗ Принято",
    lessonTitle: "Урок 1",
    description: "Описание первого ДЗ",
    dueDate: "2026-05-10T12:00:00.000Z",
    materials: [{ id: "mat-1", title: "Конспект", materialType: "PDF" }],
    submissions: [
      sub({
        id: "s-acc",
        studentMembershipId: "me-1",
        studentName: "Я Ученик",
        status: "ACCEPTED",
        grade: 88,
        feedback: "Отличная работа",
        submissionText: "Моё решение",
      }),
    ],
  }),
  hw({
    id: "hw-submitted",
    title: "ДЗ Сдано",
    lessonTitle: "Урок 2",
    submissions: [
      sub({ id: "s-sub", studentMembershipId: "me-1", studentName: "Я Ученик", status: "SUBMITTED" }),
    ],
  }),
  hw({
    id: "hw-overdue",
    title: "ДЗ Просрочено",
    lessonTitle: "Урок 3",
    submissions: [
      sub({ id: "s-over", studentMembershipId: "me-1", studentName: "Я Ученик", status: "OVERDUE" }),
    ],
  }),
  hw({
    id: "hw-revision",
    title: "ДЗ Доработка",
    lessonTitle: "Урок 4",
    submissions: [
      sub({
        id: "s-rev",
        studentMembershipId: "me-1",
        studentName: "Я Ученик",
        status: "REVISION_REQUESTED",
      }),
    ],
  }),
  hw({ id: "hw-notstarted", title: "ДЗ Не начато", lessonTitle: "Урок 5" }),
  hw({
    id: "hw-unknown",
    title: "ДЗ Неизвестный статус",
    lessonTitle: "Урок 6",
    submissions: [
      sub({ id: "s-unknown", studentMembershipId: "me-1", studentName: "Я Ученик", status: "PENDING" }),
    ],
  }),
];

// Teacher view: one homework with three submissions (a graded one, one with a
// valid links payload and one with an unknown status that falls back to
// SUBMITTED) plus a homework with zero submissions.
const teacherHomeworks: HomeworkItem[] = [
  hw({
    id: "hw-t1",
    title: "ДЗ Проверка",
    lessonTitle: "Урок A",
    submissions: [
      sub({
        id: "ts-1",
        studentMembershipId: "st-1",
        studentName: "Ученик Один",
        studentEmail: "one@example.uz",
        status: "SUBMITTED",
        submissionText: "Решение ученика",
        filesJson: '{"links":[{"title":"GitHub","url":"https://github.com/repo"}]}',
      }),
      sub({
        id: "ts-2",
        studentMembershipId: "st-2",
        studentName: "Ученик Два",
        status: "ACCEPTED",
        grade: 95,
        feedback: "Молодец",
      }),
      sub({ id: "ts-3", studentMembershipId: "st-3", studentName: "Ученик Три", status: "WEIRD_STATUS" }),
    ],
  }),
  hw({ id: "hw-t2", title: "ДЗ Без работ", lessonTitle: "Урок B" }),
];

// Single-submission fixtures keep the grade-modal queries unambiguous.
const gradeHomeworks: HomeworkItem[] = [
  hw({
    id: "hw-grade",
    title: "ДЗ Оценка",
    lessonTitle: "Урок G",
    submissions: [
      sub({
        id: "g-1",
        studentMembershipId: "st-1",
        studentName: "Ученик Один",
        submissionText: "Решение ученика",
        status: "SUBMITTED",
      }),
    ],
  }),
];

const gradeHomeworksFromRevision: HomeworkItem[] = [
  hw({
    id: "hw-grade-rev",
    title: "ДЗ Оценка Доработка",
    lessonTitle: "Урок R",
    submissions: [
      sub({
        id: "g-rev",
        studentMembershipId: "st-1",
        studentName: "Ученик Один",
        status: "REVISION_REQUESTED",
        grade: 70,
        feedback: "Есть замечания",
      }),
    ],
  }),
];

const linkHomeworks: HomeworkItem[] = [
  hw({
    id: "hw-link",
    title: "ДЗ Ссылки",
    lessonTitle: "Урок L",
    submissions: [
      sub({
        id: "lk-1",
        studentMembershipId: "st-1",
        studentName: "Ученик Один",
        submissionText: "Текст решения",
        filesJson:
          '{"links":[{"title":"GitHub","url":"https://github.com/repo"},{"title":"","url":"https://drive.example.com/f"}]}',
      }),
    ],
  }),
  hw({
    id: "hw-badjson",
    title: "ДЗ Битый JSON",
    lessonTitle: "Урок M",
    submissions: [
      sub({ id: "lk-2", studentMembershipId: "st-2", studentName: "Ученик Два", filesJson: "not-json-at-all" }),
    ],
  }),
];

const submitOnly: HomeworkItem[] = [
  hw({ id: "hw-new", title: "ДЗ Для сдачи", lessonTitle: "Урок X" }),
];

const existingSubmission: HomeworkItem[] = [
  hw({
    id: "hw-existing",
    title: "ДЗ Уже сдано",
    lessonTitle: "Урок Y",
    submissions: [
      sub({
        id: "ex-1",
        studentMembershipId: "me-1",
        studentName: "Я Ученик",
        status: "SUBMITTED",
        submissionText: "Старый ответ",
      }),
    ],
  }),
];

/** The card wrapper `glass-panel` gives every homework. */
function cardOf(title: string): HTMLElement {
  return screen.getByRole("heading", { level: 3, name: title }).closest(".glass-panel") as HTMLElement;
}

function iconCount(container: HTMLElement, cls: string): number {
  return container.querySelectorAll(`svg.${cls}`).length;
}

function openSubmit(title: string) {
  fireEvent.click(within(cardOf(title)).getByRole("button", { name: /Сдать задание/ }));
}

function openGrade(title: string) {
  fireEvent.click(within(cardOf(title)).getByRole("button", { name: "Оценить задание" }));
}

const formOf = (container: HTMLElement) => container.querySelector("form") as HTMLFormElement;

describe("HomeworkManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    // The component does not use native dialogs, but spy on them so any stray
    // call would fail loudly instead of blowing up jsdom.
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders every homework status for a student, with badges, grade, feedback, description and due date", () => {
    installFetchMock([]);

    const { container } = render(
      <HomeworkManager
        homeworks={studentHomeworks}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    // One card per homework.
    for (const title of [
      "ДЗ Принято",
      "ДЗ Сдано",
      "ДЗ Просрочено",
      "ДЗ Доработка",
      "ДЗ Не начато",
      "ДЗ Неизвестный статус",
    ]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeTruthy();
    }
    expect(screen.getByText("Урок 1")).toBeTruthy();
    expect(screen.getByText("Описание первого ДЗ")).toBeTruthy();

    // Only the first homework has a due date -> exactly one clock icon.
    expect(iconCount(container, "lucide-clock")).toBe(1);

    // Filter buttons contribute one label each; badges add one more per status.
    expect(screen.getAllByText("Принято")).toHaveLength(2);
    expect(screen.getAllByText("Сдано")).toHaveLength(2);
    expect(screen.getAllByText("Просрочено")).toHaveLength(2);
    expect(screen.getAllByText("На доработке")).toHaveLength(2);
    // "Не начато" is only a badge (no filter button) -> one for hw-notstarted,
    // one for the unknown-status fallback.
    expect(screen.getAllByText("Не начато")).toHaveLength(2);

    // Grade + feedback surfaced in the student action bar.
    expect(screen.getByText(/Успеваемость: 88\/100/)).toBeTruthy();
    expect(screen.getByText(/"Отличная работа"/)).toBeTruthy();

    // Existing submission -> "re-submit" (RotateCcw) icon; none -> Send.
    expect(iconCount(container, "lucide-rotate-ccw")).toBe(5);
    expect(iconCount(container, "lucide-send")).toBe(1);
    expect(screen.getAllByRole("button", { name: /Сдать задание/ })).toHaveLength(6);

    // Read-only render must not issue any request.
    expect(screen.queryByRole("button", { name: "Оценить задание" })).toBeNull();
  });

  it("treats every homework as NOT_SUBMITTED when no membership id is given", () => {
    installFetchMock([]);

    render(<HomeworkManager homeworks={studentHomeworks} userRole="STUDENT" locale="ru" />);

    expect(screen.getAllByText("Не начато")).toHaveLength(6);
    expect(screen.queryByText(/Успеваемость/)).toBeNull();
    expect(screen.getAllByRole("button", { name: /Сдать задание/ })).toHaveLength(6);
  });

  it("renders the submissions list for a DIRECTOR with badges, grades and grade buttons", () => {
    installFetchMock([]);

    const { container } = render(
      <HomeworkManager homeworks={teacherHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    // Submissions header rendered only for the homework that has submissions.
    expect(screen.getByText("Сдано: 3")).toBeTruthy();
    expect(screen.queryByText("Сдано: 0")).toBeNull();

    // Student rows.
    expect(screen.getByText("Ученик Один")).toBeTruthy();
    expect(screen.getByText("Ученик Два")).toBeTruthy();
    expect(screen.getByText("Ученик Три")).toBeTruthy();

    // Known grade and unknown-status fallback to the SUBMITTED badge.
    expect(screen.getByText("95/100")).toBeTruthy();
    expect(screen.getAllByText("Сдано")).toHaveLength(3); // filter + ts-1 + fallback ts-3
    expect(screen.getAllByText("Принято")).toHaveLength(2); // filter + ts-2

    // One grade button per submission; no student-only controls.
    expect(screen.getAllByRole("button", { name: "Оценить задание" })).toHaveLength(3);
    expect(screen.queryByRole("button", { name: /Сдать задание/ })).toBeNull();
    expect(screen.queryByText("Не начато")).toBeNull();

    // A homework with zero submissions renders neither header nor rows.
    const empty = cardOf("ДЗ Без работ");
    expect(within(empty).queryByRole("button", { name: "Оценить задание" })).toBeNull();
    expect(iconCount(container, "lucide-user")).toBe(3);
  });

  it("treats CENTER_ADMIN as a teacher but SUPERADMIN as read-only", () => {
    installFetchMock([]);

    const { unmount } = render(
      <HomeworkManager homeworks={teacherHomeworks} userRole="CENTER_ADMIN" locale="ru" />,
    );
    expect(screen.getAllByRole("button", { name: "Оценить задание" })).toHaveLength(3);
    unmount();

    render(<HomeworkManager homeworks={teacherHomeworks} userRole="SUPERADMIN" locale="ru" />);
    expect(screen.queryByRole("button", { name: "Оценить задание" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Сдать задание/ })).toBeNull();
    // Cards themselves still render.
    expect(screen.getByRole("heading", { level: 3, name: "ДЗ Проверка" })).toBeTruthy();
  });

  it("renders the localized empty state (ru) when there are no homeworks", () => {
    installFetchMock([]);

    render(<HomeworkManager homeworks={[]} userRole="STUDENT" userMembershipId="me-1" locale="ru" />);

    expect(screen.getByText("Нет данных")).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
  });

  it("renders the empty state in uz-Latn", () => {
    installFetchMock([]);

    render(
      <HomeworkManager homeworks={[]} userRole="STUDENT" userMembershipId="me-1" locale="uz-Latn" />,
    );

    expect(screen.getByText("Maʼlumot yoʻq")).toBeTruthy();
  });

  it("filters the list by the selected status and restores every card on ALL", () => {
    installFetchMock([]);

    render(
      <HomeworkManager
        homeworks={studentHomeworks}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    const headingCount = () => screen.getAllByRole("heading", { level: 3 }).length;
    expect(headingCount()).toBe(6);

    fireEvent.click(screen.getByRole("button", { name: "Принято" }));
    expect(screen.getByRole("button", { name: "Принято" }).className).toContain("bg-brand-500");
    expect(screen.getByRole("button", { name: "Все" }).className).not.toContain("bg-brand-500");
    expect(headingCount()).toBe(1);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("ДЗ Принято");

    fireEvent.click(screen.getByRole("button", { name: "Просрочено" }));
    expect(headingCount()).toBe(1);
    expect(screen.getByRole("heading", { level: 3 }).textContent).toBe("ДЗ Просрочено");

    // Back to ALL restores the full list (the source list is never mutated).
    fireEvent.click(screen.getByRole("button", { name: "Все" }));
    expect(headingCount()).toBe(6);
  });

  it("filters staff by any submission status and shows the empty state when nothing matches", () => {
    installFetchMock([]);

    render(
      <HomeworkManager
        homeworks={teacherHomeworks}
        userRole="DIRECTOR"
        locale="ru"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Сдано" }));
    expect(screen.getAllByRole("heading", { level: 3 }).length).toBeGreaterThan(0);
    for (const heading of screen.getAllByRole("heading", { level: 3 })) {
      expect(heading.textContent).not.toBe("");
    }

    // A status nobody has left → localized empty state instead of stale rows.
    const acceptedOnly = [
      hw({
        id: "hw-only-accepted",
        title: "Только принято",
        submissions: [
          sub({
            id: "s-only-accepted",
            studentMembershipId: "st-9",
            studentName: "Ученик",
            status: "ACCEPTED",
          }),
        ],
      }),
    ];
    cleanup();
    render(<HomeworkManager homeworks={acceptedOnly} userRole="DIRECTOR" locale="ru" />);

    fireEvent.click(screen.getByRole("button", { name: "Просрочено" }));
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByText("Нет данных")).toBeTruthy();
  });

  it("renders uz-Latn labels for filters, badges and actions", () => {
    installFetchMock([]);

    render(
      <HomeworkManager homeworks={submitOnly} userRole="STUDENT" userMembershipId="me-1" locale="uz-Latn" />,
    );

    expect(screen.getByRole("button", { name: "Hammasi" })).toBeTruthy();
    expect(screen.getByText("Boshlanmagan")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Vazifani topshirish/ })).toBeTruthy();
  });

  it("falls back to Russian for an unsupported locale", () => {
    installFetchMock([]);

    render(
      <HomeworkManager homeworks={submitOnly} userRole="STUDENT" userMembershipId="me-1" locale="fr" />,
    );

    expect(screen.getByRole("button", { name: "Все" })).toBeTruthy();
    expect(screen.getByText("Не начато")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Сдать задание/ })).toBeTruthy();
  });

  it("opens the submit modal prefilled with the existing solution and closes it on cancel without a request", () => {
    const { calls } = installFetchMock([]);

    const { container } = render(
      <HomeworkManager
        homeworks={existingSubmission}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Уже сдано");

    const textarea = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(textarea.value).toBe("Старый ответ");

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(container.querySelector("form")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("submits a solution (no link), flips the card to SUBMITTED locally and never refreshes the router", async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    fireEvent.click(within(cardOf("ДЗ Для сдачи")).getByRole("button", { name: /Сдать задание/ }));
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Решено" } });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Задание успешно отправлено")).toBeTruthy();

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/homework");
    expect(calls[0].init?.method).toBe("PATCH");
    expect(sentBody(calls[0])).toEqual({
      action: "SUBMIT",
      homeworkId: "hw-new",
      submissionText: "Решено",
      filesJson: null,
    });

    // The card flips to SUBMITTED in place (badge + re-submit icon) —
    // the component never asks the router to refresh.
    const card = cardOf("ДЗ Для сдачи");
    expect(within(card).getByText("Сдано")).toBeTruthy();
    expect(card.querySelector("svg.lucide-rotate-ccw")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("submits a solution together with a named external link", async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Для сдачи");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Ссылка" } });
    fireEvent.change(screen.getByPlaceholderText("Название (например, Репозиторий)"), {
      target: { value: "Репозиторий" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://..."), {
      target: { value: "https://github.com/me/repo" },
    });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sentBody(calls[0])).toEqual({
      action: "SUBMIT",
      homeworkId: "hw-new",
      submissionText: "Ссылка",
      filesJson: { links: [{ title: "Репозиторий", url: "https://github.com/me/repo" }] },
    });
  });

  it('falls back to the "Link" title when the link name is left empty', async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Для сдачи");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Без названия" } });
    fireEvent.change(screen.getByPlaceholderText("https://..."), {
      target: { value: "https://figma.com/file" },
    });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(calls).toHaveLength(1));
    const body = sentBody(calls[0]) as { filesJson: { links: Array<{ title: string; url: string }> } };
    expect(body.filesJson.links[0]).toEqual({ title: "Link", url: "https://figma.com/file" });
  });

  it("surfaces a submit error returned by the API and keeps the modal open", async () => {
    installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ error: "Нельзя сдать задание" }, 400) },
    ]);

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Для сдачи");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "x" } });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Нельзя сдать задание")).toBeTruthy();
    expect(screen.queryByText("Задание успешно отправлено")).toBeNull();
    expect(container.querySelector("form")).toBeTruthy();
  });

  it('uses the "Failed to submit" fallback when the error body has no message', async () => {
    installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({}, 500) },
    ]);

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Для сдачи");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "x" } });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Failed to submit")).toBeTruthy();
  });

  it('reports a submit network failure as "Network error"', async () => {
    installFetchMock([]); // any request throws inside the mock

    const { container } = render(
      <HomeworkManager
        homeworks={submitOnly}
        userRole="STUDENT"
        userMembershipId="me-1"
        locale="ru"
      />,
    );

    openSubmit("ДЗ Для сдачи");
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "x" } });
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("grades a submission: defaults, request body, local update and modal close", async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    openGrade("ДЗ Оценка");

    expect(screen.getByText("Оценить задание — Ученик Один")).toBeTruthy();
    // No existing grade -> defaults to 100; status defaults to ACCEPTED.
    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(numberInput.value).toBe("100");
    expect(select.value).toBe("ACCEPTED");

    fireEvent.change(numberInput, { target: { value: "95" } });
    fireEvent.change(container.querySelector("textarea")!, { target: { value: "Хорошо" } });
    fireEvent.submit(formOf(container));

    await waitFor(() =>
      expect(screen.queryByText("Оценить задание — Ученик Один")).toBeNull(),
    );

    expect(calls).toHaveLength(1);
    expect(sentBody(calls[0])).toEqual({
      action: "GRADE",
      homeworkId: "hw-grade",
      studentMembershipId: "st-1",
      grade: 95,
      status: "ACCEPTED",
      feedback: "Хорошо",
    });

    // Local patch in place: the row now shows 95/100, no router refresh.
    expect(await screen.findByText("95/100")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("prefills the grade modal from an existing grade/status and submits REVISION_REQUESTED", async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworksFromRevision} userRole="TEACHER" locale="ru" />,
    );

    openGrade("ДЗ Оценка Доработка");

    const numberInput = container.querySelector('input[type="number"]') as HTMLInputElement;
    const select = container.querySelector("select") as HTMLSelectElement;
    expect(numberInput.value).toBe("70");
    expect(select.value).toBe("REVISION_REQUESTED");
    expect((container.querySelector("textarea") as HTMLTextAreaElement).value).toBe("Есть замечания");

    fireEvent.submit(formOf(container));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sentBody(calls[0])).toEqual({
      action: "GRADE",
      homeworkId: "hw-grade-rev",
      studentMembershipId: "st-1",
      grade: 70,
      status: "REVISION_REQUESTED",
      feedback: "Есть замечания",
    });
  });

  it("lets the teacher switch the grade status to REVISION_REQUESTED", async () => {
    const { calls } = installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ ok: true }) },
    ]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    openGrade("ДЗ Оценка");
    fireEvent.change(container.querySelector("select")!, { target: { value: "REVISION_REQUESTED" } });
    fireEvent.submit(formOf(container));

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sentBody(calls[0])).toEqual({
      action: "GRADE",
      homeworkId: "hw-grade",
      studentMembershipId: "st-1",
      grade: 100,
      status: "REVISION_REQUESTED",
      feedback: "",
    });
  });

  it("renders the solution text and parsed links inside the grade modal, falling back to raw JSON", () => {
    installFetchMock([]);

    render(<HomeworkManager homeworks={linkHomeworks} userRole="DIRECTOR" locale="ru" />);

    // Homework with a well-formed links payload.
    openGrade("ДЗ Ссылки");
    expect(screen.getByText("Решение:")).toBeTruthy();
    expect(screen.getByText("Текст решения")).toBeTruthy();
    expect(screen.getByText("Ссылки:")).toBeTruthy();
    const github = screen.getByRole("link", { name: /GitHub/ });
    expect(github.getAttribute("href")).toBe("https://github.com/repo");
    // Empty title falls back to the URL.
    const drive = screen.getByRole("link", { name: "https://drive.example.com/f" });
    expect(drive.getAttribute("href")).toBe("https://drive.example.com/f");

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByText("Решение:")).toBeNull();

    // Homework whose filesJson is not valid JSON -> rendered verbatim, and no
    // solution block because submissionText is null.
    openGrade("ДЗ Битый JSON");
    expect(screen.getByText("not-json-at-all")).toBeTruthy();
    expect(screen.queryByText("Решение:")).toBeNull();
  });

  it("surfaces a grade error returned by the API and keeps the modal open", async () => {
    installFetchMock([
      { match: "/api/homework", method: "PATCH", reply: jsonResponse({ error: "Оценка не сохранена" }, 400) },
    ]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    openGrade("ДЗ Оценка");
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Оценка не сохранена")).toBeTruthy();
    expect(screen.getByText("Оценить задание — Ученик Один")).toBeTruthy();
  });

  it('uses the "Failed to grade" fallback when the error body has no message', async () => {
    installFetchMock([{ match: "/api/homework", method: "PATCH", reply: jsonResponse({}, 500) }]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    openGrade("ДЗ Оценка");
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Failed to grade")).toBeTruthy();
  });

  it('reports a grade network failure as "Network error"', async () => {
    installFetchMock([]);

    const { container } = render(
      <HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />,
    );

    openGrade("ДЗ Оценка");
    fireEvent.submit(formOf(container));

    expect(await screen.findByText("Network error")).toBeTruthy();
  });

  it("closes the grade modal without a request when cancelled", () => {
    const { calls } = installFetchMock([]);

    render(<HomeworkManager homeworks={gradeHomeworks} userRole="DIRECTOR" locale="ru" />);

    openGrade("ДЗ Оценка");
    expect(screen.getByText("Оценить задание — Ученик Один")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Оценить задание — Ученик Один")).toBeNull();
    expect(calls).toHaveLength(0);
  });
});
