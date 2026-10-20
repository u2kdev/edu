// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
  within,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import AttendanceManager from "@/components/AttendanceManager";
import {
  installFetchMock,
  jsonResponse,
  brokenResponse,
  sentBody,
  type FetchRoute,
  type FetchRecord,
} from "./helpers/ui";

// AttendanceManager does not import `next/navigation`, but the router is mocked
// for parity with the other manager suites (and to assert that nothing in this
// component ever asks the App Router to refresh).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/attendance",
  useSearchParams: () => new URLSearchParams(),
}));

const groups = [
  { id: "g-1", name: "Математика" },
  { id: "g-2", name: "Физика" },
  { id: "g-3", name: "Химия" },
];

// g-1 -> two lessons, g-2 -> one lesson, g-3 -> intentionally no lessons
// (drives the disabled lesson selector + "no data" option branch).
const lessonsByGroup = {
  "g-1": [
    { id: "l-1", title: "Урок 1", scheduledAt: "2026-05-01T10:00:00.000Z" },
    { id: "l-2", title: "Урок 2", scheduledAt: null },
  ],
  "g-2": [{ id: "l-3", title: "Урок 3", scheduledAt: null }],
};

// g-1 -> two students, g-2 -> empty roster, g-3 -> one student (no lessons).
const studentsByGroup = {
  "g-1": [
    { id: "s-1", fullName: "Алишер Каримов", email: "alisher@example.uz" },
    { id: "s-2", fullName: "Нилуфар Рахимова", email: "nilufar@example.uz" },
  ],
  "g-2": [],
  "g-3": [{ id: "s-3", fullName: "Зафар Юсупов", email: "zafar@example.uz" }],
};

// Persisted attendance differs per lesson so we can assert the refetch.
const l1Attendance = [
  { studentMembershipId: "s-1", status: "ABSENT", note: "Болел" },
  { studentMembershipId: "s-2", status: "LATE", note: null },
];

const l2Attendance = [
  { studentMembershipId: "s-1", status: "PRESENT", note: null },
  { studentMembershipId: "s-2", status: "ABSENT", note: "Прогул" },
];

const riskStudents = [
  {
    studentMembershipId: "s-2",
    studentName: "Нилуфар Рахимова",
    totalLessons: 10,
    presentLessons: 5,
    attendanceRate: 50,
    isAtRisk: true,
  },
  {
    studentMembershipId: "s-3",
    studentName: "Зафар Юсупов",
    totalLessons: 8,
    presentLessons: 6,
    attendanceRate: 75,
    isAtRisk: true,
  },
];

/** Route matching a per-lesson attendance GET (`/api/attendance?lessonId=...`). */
const lessonRoute = (
  lessonId: string,
  reply: Response | (() => Response),
): FetchRoute => ({ match: `lessonId=${lessonId}`, method: "GET", reply });

/** Route for the risk-list analytics request. */
const analyticsRoute = (reply: Response | (() => Response)): FetchRoute => ({
  match: "/api/attendance/analytics",
  method: "GET",
  reply,
});

/** Route for the bulk attendance POST. */
const saveRoute = (reply: Response | (() => Response)): FetchRoute => ({
  match: "/api/attendance",
  method: "POST",
  reply,
});

function renderManager(
  overrides: Partial<ComponentProps<typeof AttendanceManager>> = {},
) {
  return render(
    <AttendanceManager
      groups={groups}
      lessonsByGroup={lessonsByGroup}
      studentsByGroup={studentsByGroup}
      locale="ru"
      userRole="DIRECTOR"
      {...overrides}
    />,
  );
}

const groupSelect = () =>
  screen.getAllByRole("combobox")[0] as HTMLSelectElement;
const lessonSelect = () =>
  screen.getAllByRole("combobox")[1] as HTMLSelectElement;

const rows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll("tbody tr")) as HTMLElement[];

const statusButton = (row: HTMLElement, label: string) =>
  within(row).getByRole("button", { name: label }) as HTMLButtonElement;

const noteInput = (row: HTMLElement) =>
  row.querySelector("input") as HTMLInputElement;

// Every *active* status button paints itself `text-white`; the inactive variant
// of the same status only carries a coloured border/text (e.g. `text-red-400`).
const isActive = (btn: HTMLButtonElement) => btn.className.includes("text-white");

const saveButton = () =>
  screen.getByRole("button", { name: /Сохранить отметки/ }) as HTMLButtonElement;

const riskButton = () =>
  screen.getByRole("button", { name: /Зона риска/ }) as HTMLButtonElement;

const postCalls = (calls: FetchRecord[]) =>
  calls.filter((c) => c.init?.method === "POST");

describe("AttendanceManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    // The component does not use native dialogs; spy on them so any stray call
    // fails loudly instead of crashing jsdom.
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the selectors, the roster and the risk badge, and preloads the saved attendance", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      lessonRoute("l-2", jsonResponse({ attendance: l2Attendance })),
      lessonRoute("l-3", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: riskStudents })),
    ]);

    const { container } = renderManager();

    // Selectors default to the first group / first lesson.
    expect(screen.getByText("Выберите группу")).toBeTruthy();
    expect(screen.getByText("Выберите урок")).toBeTruthy();
    expect(groupSelect().value).toBe("g-1");
    expect(lessonSelect().value).toBe("l-1");
    expect(Array.from(groupSelect().options).map((o) => o.textContent)).toEqual([
      "Математика",
      "Физика",
      "Химия",
    ]);
    expect(Array.from(lessonSelect().options).map((o) => o.textContent)).toEqual([
      "Урок 1",
      "Урок 2",
    ]);

    // Roster header, table headers and both responsive variants.
    expect(screen.getByText("Ученики: 2")).toBeTruthy();
    expect(screen.getByText("Статус")).toBeTruthy();
    expect(screen.getByText("Заметка")).toBeTruthy();
    expect(rows(container)).toHaveLength(2);
    expect(screen.getAllByText("Алишер Каримов").length).toBeGreaterThan(0);
    expect(screen.getAllByText("nilufar@example.uz").length).toBeGreaterThan(0);
    // 2 students x (desktop table + mobile card).
    expect(screen.getAllByText("Присутствует")).toHaveLength(4);

    // The persisted attendance is preloaded into the rows.
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));
    expect(isActive(statusButton(rows(container)[0], "Отсутствует"))).toBe(true);
    expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(false);
    expect(isActive(statusButton(rows(container)[1], "Опоздал"))).toBe(true);
    expect(noteInput(rows(container)[1]).value).toBe("");

    // Risk badge count reflects the analytics payload.
    await waitFor(() =>
      expect(riskButton().textContent).toContain("2"),
    );

    // Export link for an authorised role points at the selected group.
    const link = screen.getByRole("link", { name: /Экспорт в CSV/ });
    expect(link.getAttribute("href")).toBe("/api/attendance/export?groupId=g-1");
    expect(link.hasAttribute("download")).toBe(true);
  });

  it("renders the empty roster state for a group without students and disables saving", async () => {
    const { calls } = installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      lessonRoute("l-3", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));

    fireEvent.change(groupSelect(), { target: { value: "g-2" } });

    await waitFor(() => expect(screen.getByText("Ученики: 0")).toBeTruthy());
    expect(screen.getByText("Нет данных")).toBeTruthy();
    expect(rows(container)).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);
    // The new group's single lesson was still fetched.
    await waitFor(() =>
      expect(calls.some((c) => c.url === "/api/attendance?lessonId=l-3")).toBe(true),
    );
  });

  it("disables the lesson selector and skips saving when a group has no lessons", async () => {
    const { calls } = installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.change(groupSelect(), { target: { value: "g-3" } });

    await waitFor(() => expect(lessonSelect().disabled).toBe(true));
    expect(Array.from(lessonSelect().options).map((o) => o.textContent)).toEqual([
      "Нет данных",
    ]);
    // The roster still renders even though there is no lesson to take attendance for.
    expect(screen.getAllByText("Зафар Юсупов").length).toBeGreaterThan(0);
    expect(screen.getByText("Ученики: 1")).toBeTruthy();

    const lessonFetches = calls.filter((c) => c.url.includes("lessonId=")).length;

    fireEvent.click(saveButton());

    // No lesson selected -> handleSave returns before issuing any request.
    expect(postCalls(calls)).toHaveLength(0);
    expect(calls.filter((c) => c.url.includes("lessonId=")).length).toBe(lessonFetches);
  });

  it("refetches and replaces the statuses when another lesson is selected", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      lessonRoute("l-2", jsonResponse({ attendance: l2Attendance })),
      lessonRoute("l-3", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));

    fireEvent.change(lessonSelect(), { target: { value: "l-2" } });

    await waitFor(() => expect(noteInput(rows(container)[1]).value).toBe("Прогул"));
    expect(noteInput(rows(container)[0]).value).toBe("");
    expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(true);
    expect(isActive(statusButton(rows(container)[1], "Отсутствует"))).toBe(true);
  });

  it("clears the previous lesson's marks when the next lesson has no saved attendance", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      lessonRoute("l-3", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));

    fireEvent.change(lessonSelect(), { target: { value: "l-3" } });

    await waitFor(() =>
      expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(true),
    );
    expect(noteInput(rows(container)[0]).value).toBe("");
    expect(noteInput(rows(container)[1]).value).toBe("");
  });

  it("clears the previous lesson's marks when the next request fails", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      lessonRoute("l-3", jsonResponse({}, 500)),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));

    fireEvent.change(lessonSelect(), { target: { value: "l-3" } });

    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe(""));
    expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(true);
  });

  it('mark-all-present flags everybody and the save body reflects it', async () => {
    const { calls } = installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
      saveRoute(jsonResponse({ ok: true })),
    ]);

    const { container } = renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(screen.getByRole("button", { name: "Отметить всех" }));

    const r = rows(container);
    expect(isActive(statusButton(r[0], "Присутствует"))).toBe(true);
    expect(isActive(statusButton(r[1], "Присутствует"))).toBe(true);

    fireEvent.click(saveButton());

    await waitFor(() => expect(postCalls(calls)).toHaveLength(1));
    const post = postCalls(calls)[0];
    expect(post.url).toBe("/api/attendance");
    expect(post.init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(post)).toEqual({
      lessonId: "l-1",
      records: [
        { studentMembershipId: "s-1", groupId: "g-1", status: "PRESENT", note: null },
        { studentMembershipId: "s-2", groupId: "g-1", status: "PRESENT", note: null },
      ],
    });
    expect(await screen.findByText("Посещаемость успешно сохранена")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("saves the edited statuses and notes of every student", async () => {
    const { calls } = installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: l1Attendance })),
      analyticsRoute(jsonResponse({ riskList: [] })),
      saveRoute(jsonResponse({ ok: true })),
    ]);

    const { container } = renderManager();
    await waitFor(() => expect(noteInput(rows(container)[0]).value).toBe("Болел"));

    fireEvent.click(statusButton(rows(container)[1], "По ув. причине"));
    fireEvent.change(noteInput(rows(container)[1]), {
      target: { value: "Справка от врача" },
    });

    expect(isActive(statusButton(rows(container)[1], "По ув. причине"))).toBe(true);

    fireEvent.click(saveButton());

    await screen.findByText("Посещаемость успешно сохранена");
    const post = postCalls(calls)[0];
    expect(sentBody(post)).toEqual({
      lessonId: "l-1",
      records: [
        { studentMembershipId: "s-1", groupId: "g-1", status: "ABSENT", note: "Болел" },
        {
          studentMembershipId: "s-2",
          groupId: "g-1",
          status: "EXCUSED",
          note: "Справка от врача",
        },
      ],
    });
  });

  it("surfaces a save error returned by the API and hides the success banner", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
      saveRoute(jsonResponse({ error: "Урок не найден" }, 400)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(saveButton());

    expect(await screen.findByText("Урок не найден")).toBeTruthy();
    expect(screen.queryByText("Посещаемость успешно сохранена")).toBeNull();
  });

  it('uses the "Failed to save attendance" fallback when the error body has no message', async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
      saveRoute(jsonResponse({}, 500)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(saveButton());

    expect(await screen.findByText("Failed to save attendance")).toBeTruthy();
  });

  it('reports a save network failure as "Network error while saving"', async () => {
    // No POST route -> the mocked fetch throws -> the component's catch branch.
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(saveButton());

    expect(await screen.findByText("Network error while saving")).toBeTruthy();
  });

  it("keeps the default PRESENT status when the attendance request is not ok", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ error: "boom" }, 500)),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await screen.findAllByText("Алишер Каримов");

    await waitFor(() => expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(true));
    expect(isActive(statusButton(rows(container)[1], "Присутствует"))).toBe(true);
    expect(noteInput(rows(container)[0]).value).toBe("");
  });

  it("keeps the default PRESENT status when the attendance payload is malformed", async () => {
    installFetchMock([
      lessonRoute("l-1", brokenResponse(200)),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager();
    await screen.findAllByText("Алишер Каримов");

    await waitFor(() => expect(isActive(statusButton(rows(container)[0], "Присутствует"))).toBe(true));
    expect(noteInput(rows(container)[0]).value).toBe("");
  });

  it("shows the risk-list loading placeholder while analytics is pending", async () => {
    const pending = {
      ok: true,
      status: 200,
      json: () => new Promise(() => {}),
    } as unknown as Response;

    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(pending),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(riskButton());

    expect(screen.getByText("...")).toBeTruthy();
    expect(screen.getByText("Нет учеников в зоне риска")).toBeTruthy();
  });

  it("opens and closes the risk list with the at-risk students and their rates", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: riskStudents })),
    ]);

    renderManager();
    await waitFor(() => expect(riskButton().textContent).toContain("2"));

    fireEvent.click(riskButton());

    expect(await screen.findByText("2 Ученики")).toBeTruthy();
    expect(screen.getByText("50% (5/10)")).toBeTruthy();
    expect(screen.getByText("75% (6/8)")).toBeTruthy();
    expect(screen.getAllByText("Зафар Юсупов").length).toBeGreaterThan(0);

    // Clicking again collapses the panel.
    fireEvent.click(riskButton());
    expect(screen.queryByText("50% (5/10)")).toBeNull();
  });

  it("renders the empty risk-list message and a zero badge when nobody is at risk", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(riskButton());

    expect(screen.getByText("0 Ученики")).toBeTruthy();
    expect(screen.getByText("Нет учеников в зоне риска")).toBeTruthy();
    expect(riskButton().textContent).toContain("0");
  });

  it("falls back to an empty risk list when analytics returns a server error", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ error: "down" }, 500)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(riskButton());

    expect(screen.getByText("Нет учеников в зоне риска")).toBeTruthy();
    expect(riskButton().textContent).toContain("0");
  });

  it("falls back to an empty risk list when the analytics payload is malformed", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(brokenResponse(200)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(riskButton());

    expect(screen.getByText("Нет учеников в зоне риска")).toBeTruthy();
  });

  it("treats a missing `riskList` field as an empty list", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({})),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(riskButton());

    expect(screen.getByText("0 Ученики")).toBeTruthy();
    expect(screen.getByText("Нет учеников в зоне риска")).toBeTruthy();
  });

  it("shows the CSV export only for roles allowed to export", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { unmount } = renderManager({ userRole: "TEACHER" });
    await screen.findAllByText("Алишер Каримов");
    expect(screen.getByRole("link", { name: /Экспорт в CSV/ })).toBeTruthy();
    unmount();

    renderManager({ userRole: "STUDENT" });
    await screen.findAllByText("Алишер Каримов");
    expect(screen.queryByRole("link", { name: /Экспорт в CSV/ })).toBeNull();
    // Attendance marking controls are still available to a STUDENT.
    expect(saveButton()).toBeTruthy();
  });

  it("shows the CSV export for CENTER_ADMIN but hides it for SUPERADMIN", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { unmount } = renderManager({ userRole: "CENTER_ADMIN" });
    await screen.findAllByText("Алишер Каримов");
    expect(screen.getByRole("link", { name: /Экспорт в CSV/ })).toBeTruthy();
    unmount();

    renderManager({ userRole: "SUPERADMIN" });
    await screen.findAllByText("Алишер Каримов");
    expect(screen.queryByRole("link", { name: /Экспорт в CSV/ })).toBeNull();
  });

  it("renders uz-Latn labels", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: riskStudents })),
    ]);

    const { container } = renderManager({ locale: "uz-Latn" });
    await screen.findAllByText("Алишер Каримов");

    expect(screen.getByText("Guruhni tanlang")).toBeTruthy();
    expect(screen.getByText("Darsni tanlang")).toBeTruthy();
    expect(screen.getAllByText("Qatnashdi").length).toBeGreaterThan(0);
    expect(screen.getByText("Davomatni saqlash")).toBeTruthy();
    expect(screen.getByText("Barchani belgilash")).toBeTruthy();
    expect(screen.getByText("Oʻquvchilar: 2")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Xavf guruhi/ })).toBeTruthy();

    // The lesson selector is disabled for the lesson-less group in uz-Latn too.
    fireEvent.change(groupSelect(), { target: { value: "g-3" } });
    await waitFor(() => expect(lessonSelect().disabled).toBe(true));
    expect(Array.from(lessonSelect().options).map((o) => o.textContent)).toEqual([
      "Maʼlumot yoʻq",
    ]);
    expect(rows(container)).toHaveLength(1);
  });

  it("falls back to Russian for an unsupported locale", async () => {
    installFetchMock([
      lessonRoute("l-1", jsonResponse({ attendance: [] })),
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    renderManager({ locale: "fr" });
    await screen.findAllByText("Алишер Каримов");

    expect(screen.getByText("Выберите группу")).toBeTruthy();
    expect(screen.getByText("Сохранить отметки")).toBeTruthy();
  });

  it("renders the empty state and disables saving when there are no groups at all", async () => {
    installFetchMock([
      analyticsRoute(jsonResponse({ riskList: [] })),
    ]);

    const { container } = renderManager({
      groups: [],
      lessonsByGroup: {},
      studentsByGroup: {},
    });

    await screen.findAllByText("Нет данных");
    expect(groupSelect().options).toHaveLength(0);
    expect(lessonSelect().disabled).toBe(true);
    expect(screen.getByText("Ученики: 0")).toBeTruthy();
    expect(rows(container)).toHaveLength(0);
    expect(saveButton().disabled).toBe(true);
  });
});
