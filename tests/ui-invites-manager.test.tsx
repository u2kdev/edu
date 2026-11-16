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
  screen.getByRole("button", { name: "Создать код" }).closest("form")!;

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
    render(
      <InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />,
    );

    expect(screen.getByText("Активировать инвайт-код")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Применить код" })).toBeTruthy();

    expect(screen.getByText("Существующие инвайт-коды центра")).toBeTruthy();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("JOIN-JS2026")).toBeTruthy();
    expect(table.getByText("PARENT-1234")).toBeTruthy();
    expect(table.getByText("TEACH-777")).toBeTruthy();

    expect(table.getByText("STUDENT")).toBeTruthy();
    expect(table.getByText("PARENT")).toBeTruthy();
    expect(table.getByText("TEACHER")).toBeTruthy();

    expect(table.getByText("Frontend React")).toBeTruthy();
    expect(table.getByText("Группа A")).toBeTruthy();
    expect(table.getByText("Общий код центра")).toBeTruthy();

    const usage = Array.from(screen.getByRole("table").querySelectorAll("tbody tr")).map((r) =>
      r.children[3].textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(usage).toEqual(["3 / 10", "0 /", "1 / 5"]);

    expect(table.getAllByRole("button", { name: /Копировать/ })).toHaveLength(3);
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
    expect(screen.queryByText("Существующие инвайт-коды центра")).toBeNull();
    expect(screen.queryByRole("button", { name: /Сгенерировать код/ })).toBeNull();
    expect(screen.getByText("Активировать инвайт-код")).toBeTruthy();
    unmount();

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);
    expect(screen.queryByText("Существующие инвайт-коды центра")).toBeNull();
    expect(screen.queryByRole("button", { name: /Сгенерировать код/ })).toBeNull();
  });

  it("copies an invite code to the clipboard and flashes the copied state", () => {
    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);

    const table = within(screen.getByRole("table"));
    fireEvent.click(table.getAllByRole("button", { name: /Копировать/ })[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("JOIN-JS2026");
    expect(table.getByRole("button", { name: "Скопировано" })).toBeTruthy();
    expect(table.getAllByRole("button", { name: /Копировать/ })).toHaveLength(2);
  });

  it("opens the generate modal and closes it on cancel without sending a request", () => {
    const { calls } = installFetchMock([]);
    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);

    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Создать новый инвайт-код")).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: "Frontend React" })).toBeTruthy();
    expect(within(dialog).getByRole("option", { name: "Python Basics" })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Отмена" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it("generates an invite with the chosen role/course/maxUses and refreshes on success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/invites/generate", method: "POST", reply: jsonResponse({ id: "new" }, 201) },
    ]);

    render(
      <InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    const dialog = screen.getByRole("dialog");

    const selects = within(dialog).getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "CENTER_ADMIN" } });
    fireEvent.change(selects[1], { target: { value: "c-2" } });
    fireEvent.change(dialog.querySelector('input[type="number"]')!, { target: { value: "5" } });

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
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the pending label while the generate request is in flight", async () => {
    const d = deferred<unknown>();
    const pending = { ok: true, status: 201, json: () => d.promise } as unknown as Response;
    installFetchMock([{ match: "/api/invites/generate", method: "POST", reply: pending }]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    fireEvent.submit(generateForm());

    expect(screen.getByRole("button", { name: "Генерация..." })).toBeTruthy();

    d.resolve({ id: "new" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("surfaces a generate API error via inline alert and keeps the modal open", async () => {
    installFetchMock([
      {
        match: "/api/invites/generate",
        method: "POST",
        reply: jsonResponse({ error: "Лимит инвайтов исчерпан" }, 400),
      },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    fireEvent.submit(generateForm());

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Лимит инвайтов исчерпан")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Создать новый инвайт-код")).toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("falls back to a generic inline error when a generate error body has no message", async () => {
    installFetchMock([
      { match: "/api/invites/generate", method: "POST", reply: jsonResponse({}, 400) },
    ]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    fireEvent.submit(generateForm());

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Не удалось создать код")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
    expect(within(dialog).getByText("Создать новый инвайт-код")).toBeTruthy();
  });

  it("reports a generate network failure inline", async () => {
    installFetchMock([]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} role="DIRECTOR" />);
    fireEvent.click(screen.getByRole("button", { name: /Сгенерировать код/ }));
    fireEvent.submit(generateForm());

    const dialog = screen.getByRole("dialog");
    expect(await within(dialog).findByText("Ошибка сети")).toBeTruthy();
    expect(window.alert).not.toHaveBeenCalled();
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
        "Вы успешно присоединились к центру «IT Academy» с ролью STUDENT",
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

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234");
    fireEvent.change(input, { target: { value: "BAD-CODE" } });
    fireEvent.submit(redeemForm());

    await waitFor(() => expect(window.alert).not.toHaveBeenCalled());
    expect(screen.queryByText(/присоединились к центру/)).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reports a redeem network failure", async () => {
    installFetchMock([]);

    render(<InvitesManager initialInvites={invites} courses={courses} groups={groups} />);

    const input = screen.getByPlaceholderText("e.g. JOIN-JS2026 или PARENT-1234");
    fireEvent.change(input, { target: { value: "JOIN-JS2026" } });
    fireEvent.submit(redeemForm());

    expect(await screen.findByText("Ошибка при активации")).toBeTruthy();
  });
});
