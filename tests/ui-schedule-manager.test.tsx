// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import type { ComponentProps } from "react";
import ScheduleManager, {
  type ScheduleSlotItem,
  type UpcomingLessonItem,
} from "@/components/ScheduleManager";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

// `next/navigation` is not available in jsdom, so we mock the App Router hook.
// The router `refresh` is what the component calls after a successful create.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/schedule",
  useSearchParams: () => new URLSearchParams(),
}));

// Filter <option> labels (from the `groups`/`teachers` props) are deliberately
// different from the slot's `group.name`/teacher name so text queries stay
// unambiguous.
const groups = [
  { id: "g-1", name: "Группа A" },
  { id: "g-2", name: "Группа B" },
];

const teachers = [
  { id: "t-1", user: { fullName: "Иванов Иван" } },
  { id: "t-2", user: { fullName: "Петров Пётр" } },
];

const slots: ScheduleSlotItem[] = [
  {
    id: "slot-1",
    groupId: "g-1",
    teacherMembershipId: "t-1",
    roomName: "101",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:30",
    status: "ACTIVE",
    group: {
      id: "g-1",
      name: "Алгебра-1",
      course: { title: "Алгебра" },
      subject: { name: "Алгебра", color: "#ff0000" },
    },
    teacher: { id: "t-1", user: { fullName: "Иванов Иван" } },
  },
  {
    id: "slot-2",
    groupId: "g-2",
    teacherMembershipId: "t-2",
    roomName: null,
    dayOfWeek: 2,
    startTime: "11:00",
    endTime: "12:30",
    status: "CANCELLED",
    cancelledReason: "Праздник",
    group: { id: "g-2", name: "Физика-2", course: { title: "Физика" } },
    teacher: { id: "t-2", user: { fullName: "Петров Пётр" } },
  },
];

const upcomingLessons: UpcomingLessonItem[] = [
  {
    id: "l-1",
    title: "Пробный урок",
    lessonType: "ONLINE",
    status: "SCHEDULED",
    scheduledAt: "2026-05-01T10:00:00.000Z",
    durationMinutes: 60,
    onlineMeetingUrl: "https://meet.example.com/x",
    module: { course: { title: "Английский" } },
    substituteTeacher: { id: "t-9", user: { fullName: "Сидоров Сидор" } },
  },
  {
    id: "l-2",
    title: "Офлайн занятие",
    lessonType: "OFFLINE",
    status: "CANCELLED",
    scheduledAt: null,
    durationMinutes: 90,
    module: { course: { title: "Химия" } },
  },
];

type ManagerProps = ComponentProps<typeof ScheduleManager>;

function renderManager(overrides: Partial<ManagerProps> = {}) {
  return render(
    <ScheduleManager
      initialSlots={slots}
      upcomingLessons={upcomingLessons}
      groups={groups}
      teachers={teachers}
      userRole="DIRECTOR"
      locale="ru"
      {...overrides}
    />,
  );
}

/** The day-view edit/delete icon buttons (their classes are unique enough). */
const dayEditButtons = (c: HTMLElement) =>
  c.querySelectorAll('button[class*="hover:bg-slate-800"]');
const dayDeleteButtons = (c: HTMLElement) =>
  c.querySelectorAll('button[class*="hover:bg-rose-500"]');

describe("ScheduleManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the header, iCal export, week grid, statuses and upcoming lessons", () => {
    installFetchMock([]); // render only — no request should be issued

    const { container } = renderManager();

    // Header + iCal export.
    expect(screen.getByText("Расписание")).toBeTruthy();
    expect(screen.getByText("Управление и просмотр расписания занятий")).toBeTruthy();
    const ical = screen.getByRole("link", { name: /Экспорт в iCal/ });
    expect(ical.getAttribute("href")).toBe("/api/schedule/ical");

    // Management action visible for a DIRECTOR.
    expect(screen.getByRole("button", { name: /Добавить занятие/ })).toBeTruthy();

    // Week view (default) renders all seven short day names.
    for (const d of ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]) {
      expect(screen.getByText(d)).toBeTruthy();
    }

    // Slot content: group, time span, teacher, room.
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
    expect(screen.getByText("09:00–10:30")).toBeTruthy();
    expect(screen.getByText("101")).toBeTruthy();
    expect(screen.getAllByText("Иванов Иван").length).toBeGreaterThan(0);

    // CANCELLED appears once for slot-2 and once for the cancelled lesson.
    expect(screen.getAllByText("Отменено")).toHaveLength(2);

    // Empty weekdays render an em-dash placeholder (days 3..7).
    expect(screen.getAllByText("—")).toHaveLength(5);

    // Edit affordances for every slot (opacity only, still in the DOM).
    expect(
      container.querySelectorAll('button[class*="group-hover:opacity-100"]'),
    ).toHaveLength(2);

    // Upcoming one-time lessons block.
    expect(screen.getByText("Ближайшие занятия (на неделю)")).toBeTruthy();
    expect(screen.getByText("Пробный урок")).toBeTruthy();
    expect(screen.getByText("Онлайн")).toBeTruthy();
    expect(screen.getByText("Офлайн")).toBeTruthy();
    expect(screen.getByText("Замена: Сидоров Сидор")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Ссылка на встречу/ })).toBeTruthy();
  });

  it("renders the empty state when there are no slots and no lessons", () => {
    installFetchMock([]);

    renderManager({ initialSlots: [], upcomingLessons: [] });

    expect(screen.getByText("Занятий не найдено")).toBeTruthy();
    expect(
      screen.getByText("На выбранный период или по фильтрам расписание отсутствует"),
    ).toBeTruthy();
    expect(screen.queryByText("Ближайшие занятия (на неделю)")).toBeNull();
  });

  it("hides every management action for roles that cannot manage the schedule", () => {
    installFetchMock([]);

    const { container } = renderManager({ userRole: "TEACHER" });

    expect(screen.queryByRole("button", { name: /Добавить занятие/ })).toBeNull();
    expect(container.querySelectorAll('button[class*="group-hover:opacity-100"]')).toHaveLength(0);
  });

  it("switches between day, week and month views and reacts to day selection", () => {
    installFetchMock([]);

    const { container } = renderManager();

    // --- Day view ---
    fireEvent.click(screen.getByRole("button", { name: "День" }));
    expect(screen.getByRole("button", { name: "Понедельник (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Вторник (1)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Среда (0)" })).toBeTruthy();

    // Day 1 is selected by default -> only slot-1 is displayed.
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
    expect(screen.queryByText("Физика-2")).toBeNull();

    // Switch to day 2 -> cancelled slot and its reason appear.
    fireEvent.click(screen.getByRole("button", { name: "Вторник (1)" }));
    expect(screen.getByText("Физика-2")).toBeTruthy();
    expect(screen.getByText("Причина отмены: Праздник")).toBeTruthy();

    // An empty day renders the "Нет занятий" placeholder.
    fireEvent.click(screen.getByRole("button", { name: "Среда (0)" }));
    expect(screen.getByText("Нет занятий")).toBeTruthy();
    expect(screen.queryByText("Физика-2")).toBeNull();

    // --- Month view ---
    fireEvent.click(screen.getByRole("button", { name: "Месяц" }));
    // 28 simulated cells => every weekday recurs 4 times.
    expect(screen.getAllByText("09:00 Алгебра-1")).toHaveLength(4);
    expect(screen.getAllByText("11:00 Физика-2")).toHaveLength(4);

    // --- Back to week view ---
    fireEvent.click(screen.getByRole("button", { name: "Неделя" }));
    expect(screen.getByText("09:00–10:30")).toBeTruthy();
  });

  it("filters slots by group, teacher and free-text search", () => {
    installFetchMock([]);

    renderManager();

    // Both slots render in the default week view.
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
    expect(screen.getByText("Физика-2")).toBeTruthy();

    const [groupSelect, teacherSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];

    // Filter by group.
    fireEvent.change(groupSelect, { target: { value: "g-2" } });
    expect(screen.queryByText("Алгебра-1")).toBeNull();
    expect(screen.getByText("Физика-2")).toBeTruthy();

    // Reset group, filter by teacher.
    fireEvent.change(groupSelect, { target: { value: "" } });
    fireEvent.change(teacherSelect, { target: { value: "t-1" } });
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
    expect(screen.queryByText("Физика-2")).toBeNull();

    // Reset teacher, search by course title.
    fireEvent.change(teacherSelect, { target: { value: "" } });
    const search = screen.getByPlaceholderText("Поиск по предмету, группе или аудитории...");
    fireEvent.change(search, { target: { value: "Физика" } });
    expect(screen.getByText("Физика-2")).toBeTruthy();
    expect(screen.queryByText("Алгебра-1")).toBeNull();

    // Search by room.
    fireEvent.change(search, { target: { value: "101" } });
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
    expect(screen.queryByText("Физика-2")).toBeNull();

    // Search by teacher name.
    fireEvent.change(search, { target: { value: "Петров" } });
    expect(screen.getByText("Физика-2")).toBeTruthy();
    expect(screen.queryByText("Алгебра-1")).toBeNull();

    // No match -> empty state.
    fireEvent.change(search, { target: { value: "ничего-нет" } });
    expect(screen.getByText("Занятий не найдено")).toBeTruthy();
  });

  it("appends the selected group to the iCal export link", () => {
    installFetchMock([]);

    renderManager();

    const [groupSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    fireEvent.change(groupSelect, { target: { value: "g-1" } });

    expect(
      screen.getByRole("link", { name: /Экспорт в iCal/ }).getAttribute("href"),
    ).toBe("/api/schedule/ical?groupId=g-1");
  });

  it("opens the create modal with defaults and cancels without any request", () => {
    const { calls } = installFetchMock([]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Добавить занятие/ }));

    // Modal title duplicates the header button label.
    expect(screen.getAllByText("Добавить занятие").length).toBe(2);

    // Header has 2 selects; the modal adds group / teacher / dayOfWeek.
    const selects = container.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    expect(selects).toHaveLength(5);
    expect(selects[2].value).toBe("g-1");
    expect(selects[3].value).toBe("t-1");
    expect(selects[4].value).toBe("1");

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByPlaceholderText("например, Аудитория 101")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("creates a slot, sends the full payload and refreshes the router", async () => {
    const { calls } = installFetchMock([
      { match: "/api/tenant/schedule", method: "POST", reply: jsonResponse({ slot: { id: "new" } }, 201) },
    ]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Добавить занятие/ }));

    fireEvent.change(container.querySelector('input[placeholder="например, Аудитория 101"]')!, {
      target: { value: "202" },
    });

    const selects = container.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    fireEvent.change(selects[4], { target: { value: "3" } }); // dayOfWeek

    const times = container.querySelectorAll('input[type="time"]');
    fireEvent.change(times[0], { target: { value: "08:00" } });
    fireEvent.change(times[1], { target: { value: "09:30" } });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    const post = calls.find((c) => c.init?.method === "POST")!;
    expect(sentBody(post)).toEqual({
      groupId: "g-1",
      teacherMembershipId: "t-1",
      dayOfWeek: 3,
      startTime: "08:00",
      endTime: "09:30",
      roomName: "202",
    });

    await waitFor(() => expect(screen.queryByPlaceholderText("например, Аудитория 101")).toBeNull());
  });

  it("surfaces a server error and its conflicts in the create modal", async () => {
    installFetchMock([
      {
        match: "/api/tenant/schedule",
        method: "POST",
        reply: jsonResponse(
          { error: "Конфликт расписания", conflicts: ["Аудитория занята", "Преподаватель занят"] },
          400,
        ),
      },
    ]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Добавить занятие/ }));
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Конфликт расписания")).toBeTruthy();
    expect(screen.getByText("Аудитория занята")).toBeTruthy();
    expect(screen.getByText("Преподаватель занят")).toBeTruthy();

    // Modal stays open and the submit button is re-enabled.
    expect(container.querySelector("form")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeTruthy();
  });

  it("reports a network failure while creating a slot", async () => {
    installFetchMock([]); // any request throws inside the mock
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /Добавить занятие/ }));
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText(/Unhandled fetch: POST \/api\/tenant\/schedule/)).toBeTruthy();
  });

  it("opens the edit modal prefilled and saves changes via PATCH", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/tenant/schedule",
        method: "PATCH",
        reply: jsonResponse({
          slot: { roomName: "303", status: "CANCELLED", cancelledReason: "Болезнь" },
        }),
      },
    ]);
    const { container } = renderManager();

    // Day view exposes explicit edit/delete buttons.
    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayEditButtons(container)[0]);

    expect(screen.getByText("Редактировать занятие")).toBeTruthy();

    // Header 2 + modal group/teacher/dayOfWeek/status.
    const selects = container.querySelectorAll("select") as NodeListOf<HTMLSelectElement>;
    expect(selects).toHaveLength(6);
    expect(selects[2].value).toBe("g-1");
    expect(selects[4].value).toBe("1");
    expect(selects[5].value).toBe("ACTIVE");

    // Selecting CANCELLED reveals the reason input.
    fireEvent.change(selects[5], { target: { value: "CANCELLED" } });
    const reasonLabel = screen.getByText("Причина отмены");
    const reasonInput = reasonLabel.parentElement!.querySelector("input")!;
    fireEvent.change(reasonInput, { target: { value: "Болезнь" } });

    fireEvent.change(container.querySelector('input[placeholder="например, Аудитория 101"]')!, {
      target: { value: "303" },
    });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(screen.queryByText("Редактировать занятие")).toBeNull());

    const patch = calls.find((c) => c.init?.method === "PATCH")!;
    expect(sentBody(patch)).toEqual({
      id: "slot-1",
      groupId: "g-1",
      teacherMembershipId: "t-1",
      dayOfWeek: 1,
      startTime: "09:00",
      endTime: "10:30",
      roomName: "303",
      status: "CANCELLED",
      cancelledReason: "Болезнь",
    });

    // Editing updates local state instead of refreshing the router.
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.getByText("303")).toBeTruthy();
    expect(screen.getByText("Причина отмены: Болезнь")).toBeTruthy();
  });

  it("surfaces a server error while editing a slot", async () => {
    installFetchMock([
      {
        match: "/api/tenant/schedule",
        method: "PATCH",
        reply: jsonResponse({ error: "Слот не найден", conflicts: ["Дубликат"] }, 404),
      },
    ]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayEditButtons(container)[0]);
    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Слот не найден")).toBeTruthy();
    expect(screen.getByText("Дубликат")).toBeTruthy();
    expect(screen.getByText("Редактировать занятие")).toBeTruthy();
  });

  it("deletes a slot after confirmation, sending the id and removing the row", async () => {
    const { calls } = installFetchMock([
      { match: "/api/tenant/schedule", method: "DELETE", reply: jsonResponse({}, 200) },
    ]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayDeleteButtons(container)[0]);

    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sentBody(calls[0])).toEqual({ id: "slot-1" });
    expect(window.confirm).toHaveBeenCalledTimes(1);

    await waitFor(() => expect(screen.queryByText("Алгебра-1")).toBeNull());
    expect(screen.getByText("Нет занятий")).toBeTruthy();
  });

  it("does not send a delete request when the confirmation is declined", () => {
    const { calls } = installFetchMock([]);
    const { container } = renderManager();

    vi.mocked(window.confirm).mockReturnValue(false);

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayDeleteButtons(container)[0]);

    expect(calls).toHaveLength(0);
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
  });

  it("alerts with the API message when deleting fails", async () => {
    installFetchMock([
      {
        match: "/api/tenant/schedule",
        method: "DELETE",
        reply: jsonResponse({ error: "Нельзя удалить" }, 400),
      },
    ]);
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayDeleteButtons(container)[0]);

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Нельзя удалить"));
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
  });

  it("reports a delete network failure with the raw error message", async () => {
    installFetchMock([]); // delete request throws inside the mock
    const { container } = renderManager();

    fireEvent.click(screen.getByRole("button", { name: "День" }));
    fireEvent.click(dayDeleteButtons(container)[0]);

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        expect.stringContaining("Unhandled fetch: DELETE"),
      ),
    );
    expect(screen.getByText("Алгебра-1")).toBeTruthy();
  });

  it("shows an overflow counter in the month view when a day has more than two slots", () => {
    installFetchMock([]);

    const overflow = [
      slots[0],
      { ...slots[0], id: "slot-3" },
      { ...slots[0], id: "slot-4" },
      slots[1],
    ];
    renderManager({ initialSlots: overflow, upcomingLessons: [] });

    fireEvent.click(screen.getByRole("button", { name: "Месяц" }));

    // Monday recurs four times, each cell shows 2 chips + "+1".
    expect(screen.getAllByText("+1")).toHaveLength(4);
    expect(screen.getAllByText("09:00 Алгебра-1")).toHaveLength(8);
  });

  it("adopts the refreshed server slots after router.refresh (new slot appears)", () => {
    installFetchMock([]);
    const { rerender } = renderManager();

    expect(screen.queryByText("Новая-3")).toBeNull();

    // What Next.js does after router.refresh(): re-render with fresh props.
    rerender(
      <ScheduleManager
        initialSlots={[
          ...slots,
          {
            ...slots[1],
            id: "slot-3",
            groupId: "g-3",
            dayOfWeek: 3,
            startTime: "14:00",
            endTime: "15:30",
            status: "ACTIVE",
            group: { id: "g-3", name: "Новая-3", course: { title: "Новый курс" } },
          },
        ]}
        upcomingLessons={upcomingLessons}
        groups={groups}
        teachers={teachers}
        userRole="DIRECTOR"
        locale="ru"
      />,
    );

    expect(screen.getByText("Новая-3")).toBeTruthy();
  });
});
