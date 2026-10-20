// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import InvitesManager, {
  type InviteItem,
  type CourseSelectItem,
  type GroupSelectItem,
} from "@/components/InvitesManager";
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
  usePathname: () => "/center/invites",
  useSearchParams: () => new URLSearchParams(),
}));

const courses: CourseSelectItem[] = [
  { id: "c-1", title: "Frontend React" },
  { id: "c-2", title: "Python Basics" },
];

const groups: GroupSelectItem[] = [
  { id: "g-1", name: "Группа A" },
  { id: "g-2", name: "Группа B" },
];

// i-1 -> bound to a course, i-2 -> bound to a group, i-3 -> unbound center code.
const invites: InviteItem[] = [
  {
    id: "i-1",
    code: "JOIN-JS2026",
    targetRole: "STUDENT",
    usesCount: 3,
    maxUses: 10,
    course: { title: "Frontend React" },
    group: null,
  },
  {
    id: "i-2",
    code: "PARENT-1234",
    targetRole: "PARENT",
    usesCount: 0,
    maxUses: null,
    course: null,
    group: { name: "Группа A" },
  },
  {
    id: "i-3",
    code: "TEACH-777",
    targetRole: "TEACHER",
    usesCount: 1,
    maxUses: 5,
    course: null,
    group: null,
  },
];

const redeemForm = () =>
  screen.getByRole("button", { name: "Применить код" }).closest("form")!;

const generateForm = () =>
  screen.getByRole("button", { name: "Создать Код" }).closest("form")!;

/** A deferred value used to keep a fetch response pending. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("InvitesManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    vi.spyOn(window, "alert").mockImplementation(() => {});
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn() },
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("always renders the redeem banner and lists the admin invite table", () => {
    const { container } = render(
      <InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />,
    );

    // Redeem banner (visible for every role).
    expect(screen.getByText("Активировать Инвайт-код")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Применить код" })).toBeTruthy();

    // Admin table for DIRECTOR.
    expect(screen.getByText("Существующие Инвайт-коды Центра")).toBeTruthy();
    expect(screen.getByText("JOIN-JS2026")).toBeTruthy();
    expect(screen.getByText("PARENT-1234")).toBeTruthy();
    expect(screen.getByText("TEACH-777")).toBeTruthy();

    // Role badges.
    expect(screen.getByText("STUDENT")).toBeTruthy();
    expect(screen.getByText("PARENT")).toBeTruthy();
    expect(screen.getByText("TEACHER")).toBeTruthy();

    // Course / group / fallback target cells.
    expect(screen.getByText("Frontend React")).toBeTruthy();
    expect(screen.getByText("Группа A")).toBeTruthy();
    expect(screen.getByText("Общий код центра")).toBeTruthy();

    // Usage counters (span + " / " + maxUses collapse into one cell text).
    const usage = Array.from(container.querySelectorAll("tbody tr")).map((r) =>
      r.children[3].textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(usage).toEqual(["3 / 10", "0 /", "1 / 5"]);

    // One copy button per invite.
    expect(screen.getAllByRole("button", { name: /Копировать/ })).toHaveLength(3);
  });

  it("shows the empty state when the center has no invites", () => {
    render(<InvitesManager initialInvites={[]} courses={courses} groups={groups} role="CENTER_ADMIN" />);

    expect(screen.getByText("Инвайт-коды еще не созданы.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Копировать/ })).toBeNull();
  });

  it("hides the admin table for TEACHER and when no role is provided", () => {
    const { unmount } = render(
      <InvitesManager initialInvites={invites} courses={courses} groups={groups} role="TEACHER" />,
    );
    expect(screen.queryByText("Существующие Инвайт-коды Центра")).toBeNull();
    expect(screen.queryByRole("button", { name: /Сгенерировать Код/ })).toBeNull();
    // Redeem banner remains available.
    expect(screen.getByText("Активировать Инвайт-код")).toBeTruthy();
    unmount();

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);
    expect(screen.queryByText("Существующие Инвайт-коды Центра")).toBeNull();
    expect(screen.queryByRole("button", { name: /Сгенерировать Код/ })).toBeNull();
  });

  it("copies an invite code to the clipboard and flashes the copied state", () => {
    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);

    fireEvent.click(screen.getAllByRole("button", { name: /Копировать/ })[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("JOIN-JS2026");
    expect(screen.getByRole("button", { name: "Скопировано" })).toBeTruthy();
    // The other rows still show the plain copy label.
    expect(screen.getAllByRole("button", { name: /Копировать/ })).toHaveLength(2);
  });

  it("opens the generate modal and closes it on cancel without sending a request", () => {
    const { calls } = installFetchMock([]);
    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));
    expect(screen.getByText("Создать Новый Инвайт-код")).toBeTruthy();
    // Course options are listed inside the modal select.
    expect(screen.getByRole("option", { name: "Frontend React" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Python Basics" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Отмена" }));

    expect(screen.queryByText("Создать Новый Инвайт-код")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("generates an invite with the chosen role/course/maxUses and refreshes on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/invites/generate", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    const { container } = render(
      <InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "CENTER_ADMIN" } });
    fireEvent.change(selects[1], { target: { value: "c-2" } });
    fireEvent.change(container.querySelector('input[type="number"]')!, { target: { value: "5" } });

    fireEvent.submit(generateForm());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("/api/invites/generate");
    expect(calls[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(calls[0])).toEqual({
      targetRole: "CENTER_ADMIN",
      courseId: "c-2",
      groupId: "",
      maxUses: "5",
    });
    await waitFor(() => expect(screen.queryByText("Создать Новый Инвайт-код")).toBeNull());
  });

  it("shows the pending label while the generate request is in flight", async () => {
    const d = deferred<unknown>();
    const pending = { ok: true, status: 201, json: () => d.promise } as unknown as Response;
    installFetchMock([{ match: "/api/invites/generate", method: "POST", reply: pending }]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));
    fireEvent.submit(generateForm());

    expect(screen.getByRole("button", { name: "Генерация..." })).toBeTruthy();

    d.resolve({ id: "new" });
    await waitFor(() => expect(screen.queryByText("Создать Новый Инвайт-код")).toBeNull());
  });

  it("surfaces a generate API error via alert and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/invites/generate",
        method: "POST",
        reply: jsonResponse({ error: "Лимит инвайтов исчерпан" }, 400),
      },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));
    fireEvent.submit(generateForm());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Лимит инвайтов исчерпан"));
    expect(screen.getByText("Создать Новый Инвайт-код")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic alert when a generate error body has no message", async () => {
    installFetchMock([
      { match: "/api/invites/generate", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));
    fireEvent.submit(generateForm());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Не удалось создать код"));
    expect(screen.getByText("Создать Новый Инвайт-код")).toBeTruthy();
  });

  it("reports a generate network failure with a generic alert", async () => {
    installFetchMock([]); // any request throws -> network error branch

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать Код/ }));
    fireEvent.submit(generateForm());

    await waitFor(() => expect(window.alert).toHaveBeenCalledWith("Ошибка сети"));
  });

  it("redeems a code successfully, shows the center name, clears the input and refreshes", async () => {
    const { calls } = installFetchMock([
      {
        match: "/api/invites/accept",
        method: "POST",
        reply: jsonResponse({ center: { name: "IT Academy" }, role: "STUDENT" }),
      },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "JOIN-JS2026" } });
    fireEvent.submit(redeemForm());

    expect(
      await screen.findByText(
        "Успешно! Вы присоединились к центру «IT Academy» с ролью STUDENT",
      ),
    ).toBeTruthy();

    expect(calls).toHaveLength(1);
    expect(sentBody(calls[0])).toEqual({ code: "JOIN-JS2026" });
    expect(input.value).toBe("");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the redeem error returned by the API", async () => {
    installFetchMock([
      {
        match: "/api/invites/accept",
        method: "POST",
        reply: jsonResponse({ error: "Код недействителен" }, 400),
      },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234");
    fireEvent.change(input, { target: { value: "BAD-CODE" } });
    fireEvent.submit(redeemForm());

    expect(await screen.findByText("Код недействителен")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders no banner when a redeem error body has no message", async () => {
    installFetchMock([
      { match: "/api/invites/accept", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    const { container } = render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234");
    fireEvent.change(input, { target: { value: "BAD-CODE" } });
    fireEvent.submit(redeemForm());

    await waitFor(() => expect(window.alert).not.toHaveBeenCalled());
    expect(screen.queryByText(/Успешно!/)).toBeNull();
    // data.error is undefined -> the falsy guard renders no error box.
    expect(container.querySelector(".text-rose-400")).toBeNull();
  });

  it("reports a redeem network failure", async () => {
    installFetchMock([]); // no route -> fetch throws

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234");
    fireEvent.change(input, { target: { value: "JOIN-JS2026" } });
    fireEvent.submit(redeemForm());

    // The component stores the message with a leading space; Testing Library trims it.
    expect(await screen.findByText("Ошибка при активации")).toBeTruthy();
  });
});
