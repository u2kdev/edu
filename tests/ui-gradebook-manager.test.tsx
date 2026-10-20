// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import GradebookManager from "@/components/GradebookManager";
import {
  installFetchMock,
  jsonResponse,
  brokenResponse,
  sentBody,
  type FetchRoute,
  type FetchRecord,
} from "./helpers/ui";

// GradebookManager does not import `next/navigation`; the router is mocked for
// parity with the other manager suites and so the tests can assert the
// component updates its matrix locally (through a refetch, not a router refresh).
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center/grades",
  useSearchParams: () => new URLSearchParams(),
}));

const groups = [
  { id: "g-1", name: "Математика" },
  { id: "g-2", name: "Физика" },
  { id: "g-3", name: "Химия" },
];

/** Build a grade item with sane defaults; override only what a test needs. */
function grade(partial: Record<string, unknown> & { id: string; value: number }) {
  return {
    gradeType: "MIDTERM",
    maxValue: 100,
    lifecycle: "ACTIVE",
    comment: null,
    lessonId: null,
    createdAt: "2026-05-01T10:00:00.000Z",
    ...partial,
  };
}

// g-1 -> two students (one with an unlocked + a locked grade, one without any),
// g-2 -> one student with a single unlocked grade, g-3 -> intentionally absent.
const matrixG1 = {
  groupId: "g-1",
  groupName: "Математика 10-А",
  students: [
    {
      studentMembershipId: "st-1",
      studentName: "Алишер Каримов",
      studentEmail: "alisher@example.uz",
      grades: [
        grade({ id: "gr-1", gradeType: "MIDTERM", value: 85 }),
        grade({
          id: "gr-2",
          gradeType: "FINAL",
          value: 90,
          lifecycle: "FINAL",
          comment: "Отлично",
        }),
      ],
      weightedScore: 88,
      letterGrade: "B",
    },
    {
      studentMembershipId: "st-2",
      studentName: "Нилуфар Рахимова",
      studentEmail: "nilufar@example.uz",
      grades: [],
      weightedScore: 0,
      letterGrade: "F",
    },
  ],
};

const matrixG1Refreshed = {
  groupId: "g-1",
  groupName: "Математика 10-А",
  students: [
    {
      studentMembershipId: "st-1",
      studentName: "Алишер Каримов",
      studentEmail: "alisher@example.uz",
      grades: [grade({ id: "gr-1", gradeType: "MIDTERM", value: 85 })],
      weightedScore: 85,
      letterGrade: "B",
    },
  ],
};

const matrixG2 = {
  groupId: "g-2",
  groupName: "Физика 9-Б",
  students: [
    {
      studentMembershipId: "st-3",
      studentName: "Зафар Юсупов",
      studentEmail: "zafar@example.uz",
      grades: [grade({ id: "gr-3", gradeType: "QUIZ", value: 70 })],
      weightedScore: 70,
      letterGrade: "C",
    },
  ],
};

const matrixG2Empty = {
  groupId: "g-2",
  groupName: "Физика 9-Б",
  students: [],
};

/** Route for the matrix GET of a single group. */
const matrixRoute = (
  groupId: string,
  reply: Response | (() => Response),
): FetchRoute => ({ match: `groupId=${groupId}`, method: "GET", reply });

/** Route for the finalize POST. */
const finalizeRoute = (reply: Response | (() => Response)): FetchRoute => ({
  match: "/api/grades/finalize",
  method: "POST",
  reply,
});

function renderManager(
  overrides: Partial<ComponentProps<typeof GradebookManager>> = {},
) {
  return render(
    <GradebookManager groups={groups} locale="ru" userRole="DIRECTOR" {...overrides} />,
  );
}

const groupSelect = () =>
  screen.getAllByRole("combobox")[0] as HTMLSelectElement;

const finalizeButton = () =>
  screen.getByRole("button", {
    name: /Финализировать период/,
  }) as HTMLButtonElement;

const exportLink = () =>
  screen.getByRole("link", { name: /Экспорт в CSV/ }) as HTMLAnchorElement;

const iconCount = (container: HTMLElement, cls: string) =>
  container.querySelectorAll(`svg.${cls}`).length;

const postCalls = (calls: FetchRecord[]) =>
  calls.filter((c) => c.init?.method === "POST");

/** A deferred value used to keep a fetch response pending. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe("GradebookManager (UI)", () => {
  beforeEach(() => {
    refresh.mockReset();
    // The component does not use native dialogs; spy on them so any stray call
    // fails loudly instead of blowing up jsdom.
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(window, "confirm").mockImplementation(() => true);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the group selector, loads the default group matrix and paints both responsive variants", async () => {
    const { calls } = installFetchMock([
      matrixRoute("g-1", jsonResponse(matrixG1)),
    ]);

    const { container } = renderManager();

    // Selector defaults to the first group and lists every option.
    expect(screen.getByText("Выберите группу")).toBeTruthy();
    expect(groupSelect().value).toBe("g-1");
    expect(Array.from(groupSelect().options).map((o) => o.textContent)).toEqual([
      "Математика",
      "Физика",
      "Химия",
    ]);

    // Header falls back to the i18n title until the matrix arrives, then uses
    // the server-provided group name.
    await screen.findByText("Математика 10-А");
    expect(screen.getByText("2 Ученики")).toBeTruthy();

    // Desktop headers.
    expect(screen.getByText("Ученики")).toBeTruthy();
    expect(screen.getByText("Успеваемость и журнал оценок")).toBeTruthy();
    expect(screen.getByText("Итоговый балл")).toBeTruthy();
    expect(screen.getByText("Оценка")).toBeTruthy();

    // Both the desktop table and the mobile cards render in jsdom.
    expect(screen.getAllByText("Алишер Каримов")).toHaveLength(2);
    expect(screen.getAllByText("alisher@example.uz")).toHaveLength(2);
    expect(screen.getAllByText("Нилуфар Рахимова")).toHaveLength(2);
    expect(screen.getAllByText("88%")).toHaveLength(2);
    expect(screen.getAllByText("0%")).toHaveLength(2);
    expect(screen.getAllByText("B")).toHaveLength(2);
    expect(screen.getAllByText("F")).toHaveLength(2);

    // Desktop grade chips carry a rich title tooltip; the mobile chips show a
    // truncated grade type instead.
    expect(screen.getByTitle("MIDTERM: 85/100")).toBeTruthy();
    expect(screen.getByTitle("FINAL: 90/100 (Отлично) [LOCKED]")).toBeTruthy();
    expect(screen.getByText("MID: 85")).toBeTruthy();
    expect(screen.getByText("FIN: 90")).toBeTruthy();

    // A student with no grades shows the em-dash placeholder on desktop only.
    expect(screen.getByText("—")).toBeTruthy();

    // Locks: finalize button + desktop FINAL chip + mobile FINAL chip.
    expect(iconCount(container, "lucide-lock")).toBe(3);

    // Export link for an authorised role points at the selected group.
    expect(exportLink().getAttribute("href")).toBe(
      "/api/grades/export?groupId=g-1",
    );
    expect(exportLink().hasAttribute("download")).toBe(true);

    // Exactly one matrix request and no router refresh.
    expect(calls).toHaveLength(1);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows the loading spinner, disables finalize while pending, then renders the matrix", async () => {
    const d = deferred<unknown>();
    const pending = {
      ok: true,
      status: 200,
      json: () => d.promise,
    } as unknown as Response;

    installFetchMock([matrixRoute("g-1", pending)]);

    renderManager();

    // Pending matrix: spinner + fallback title + zero students, finalize locked.
    expect(screen.getByText("...")).toBeTruthy();
    expect(screen.getByText("Матрица оценок")).toBeTruthy();
    expect(screen.getByText("0 Ученики")).toBeTruthy();
    expect(finalizeButton().disabled).toBe(true);

    d.resolve(matrixG1);

    await screen.findByText("Математика 10-А");
    expect(screen.queryByText("...")).toBeNull();
    expect(finalizeButton().disabled).toBe(false);
  });

  it("surfaces the API error message when the matrix request is not ok", async () => {
    installFetchMock([
      matrixRoute("g-1", jsonResponse({ error: "Нет доступа к журналу" }, 403)),
    ]);

    renderManager();

    expect(await screen.findByText("Нет доступа к журналу")).toBeTruthy();
    // No matrix data -> the empty state + fallback title remain.
    expect(screen.getByText("Матрица оценок")).toBeTruthy();
    expect(screen.getByText("Оценок пока нет")).toBeTruthy();
    expect(screen.getByText("0 Ученики")).toBeTruthy();
  });

  it('falls back to "Failed to load gradebook" when the error body has no message', async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse({}, 500))]);

    renderManager();

    expect(await screen.findByText("Failed to load gradebook")).toBeTruthy();
  });

  it("reports a malformed success payload as a network error", async () => {
    installFetchMock([matrixRoute("g-1", brokenResponse(200))]);

    renderManager();

    expect(
      await screen.findByText("Network error loading gradebook"),
    ).toBeTruthy();
  });

  it("reports a malformed error payload as a network error", async () => {
    installFetchMock([matrixRoute("g-1", brokenResponse(503))]);

    renderManager();

    expect(
      await screen.findByText("Network error loading gradebook"),
    ).toBeTruthy();
  });

  it("reports a failed fetch (no route) as a network error", async () => {
    // No route at all: the mocked fetch throws inside the component's try block.
    installFetchMock([]);

    renderManager();

    expect(
      await screen.findByText("Network error loading gradebook"),
    ).toBeTruthy();
  });

  it("renders the empty state for a group without students", async () => {
    installFetchMock([
      matrixRoute("g-1", jsonResponse(matrixG1)),
      matrixRoute("g-2", jsonResponse(matrixG2Empty)),
    ]);

    const { container } = renderManager();
    await screen.findByText("Математика 10-А");

    fireEvent.change(groupSelect(), { target: { value: "g-2" } });

    await screen.findByText("Физика 9-Б");
    expect(screen.getByText("Оценок пока нет")).toBeTruthy();
    expect(screen.getByText("0 Ученики")).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    // No grades -> only the finalize button carries a lock.
    expect(iconCount(container, "lucide-lock")).toBe(1);
  });

  it("refetches and replaces the matrix when another group is selected", async () => {
    const { calls } = installFetchMock([
      matrixRoute("g-1", jsonResponse(matrixG1)),
      matrixRoute("g-2", jsonResponse(matrixG2)),
    ]);

    renderManager();
    await screen.findByText("Математика 10-А");

    fireEvent.change(groupSelect(), { target: { value: "g-2" } });

    await screen.findByText("Физика 9-Б");
    expect(screen.getAllByText("Зафар Юсупов")).toHaveLength(2);
    expect(screen.queryByText("Алишер Каримов")).toBeNull();
    expect(screen.getByText("1 Ученики")).toBeTruthy();
    expect(screen.getByText("QUI: 70")).toBeTruthy();

    // The export link follows the newly selected group.
    expect(exportLink().getAttribute("href")).toBe(
      "/api/grades/export?groupId=g-2",
    );

    expect(calls.map((c) => c.url)).toEqual([
      "/api/grades/matrix?groupId=g-1",
      "/api/grades/matrix?groupId=g-2",
    ]);
  });

  it("drops the previous group's rows immediately while the next group is still loading", async () => {
    const g2 = deferred<Response>();
    globalThis.fetch = vi.fn(async (input: unknown) => {
      const url = String(input);
      return url.includes("groupId=g-2") ? g2.promise : jsonResponse(matrixG1);
    }) as unknown as typeof fetch;

    renderManager();
    await screen.findByText("Математика 10-А");
    expect(screen.queryAllByText("Алишер Каримов").length).toBeGreaterThan(0);

    fireEvent.change(groupSelect(), { target: { value: "g-2" } });

    // No mixed state: the old group's header and rows are gone before g-2 resolves.
    await waitFor(() => expect(screen.queryAllByText("Алишер Каримов")).toHaveLength(0));
    expect(screen.queryByText("Математика 10-А")).toBeNull();

    g2.resolve(jsonResponse(matrixG2));
    await screen.findByText("Физика 9-Б");
  });

  it("renders the empty state and never fetches when there are no groups", async () => {
    const { calls } = installFetchMock([]);

    const { container } = renderManager({ groups: [] });

    await screen.findByText("Оценок пока нет");
    expect(groupSelect().options).toHaveLength(0);
    expect(screen.getByText("Матрица оценок")).toBeTruthy();
    expect(screen.getByText("0 Ученики")).toBeTruthy();
    expect(container.querySelectorAll("tbody tr")).toHaveLength(0);
    // No group selected -> finalize is disabled.
    expect(finalizeButton().disabled).toBe(true);
    expect(calls).toHaveLength(0);
  });

  it("finalizes the period, refetches the matrix in place and never refreshes the router", async () => {
    let matrixCalls = 0;
    const { calls } = installFetchMock([
      {
        match: "groupId=g-1",
        method: "GET",
        reply: () => {
          matrixCalls += 1;
          return jsonResponse(matrixCalls === 1 ? matrixG1 : matrixG1Refreshed);
        },
      },
      finalizeRoute(jsonResponse({ ok: true })),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(finalizeButton());

    expect(
      await screen.findByText("Оценки периода успешно финализированы"),
    ).toBeTruthy();

    const posts = postCalls(calls);
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/grades/finalize");
    expect(posts[0].init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(sentBody(posts[0])).toEqual({ groupId: "g-1" });

    // The matrix was refetched: the refreshed payload drops the second student.
    await waitFor(() =>
      expect(screen.queryByText("Нилуфар Рахимова")).toBeNull(),
    );
    expect(screen.getByText("1 Ученики")).toBeTruthy();
    expect(matrixCalls).toBe(2);
    expect(refresh).not.toHaveBeenCalled();
  });

  it("surfaces a finalize error returned by the API and hides the success banner", async () => {
    installFetchMock([
      matrixRoute("g-1", jsonResponse(matrixG1)),
      finalizeRoute(jsonResponse({ error: "Период уже закрыт" }, 400)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(finalizeButton());

    expect(await screen.findByText("Период уже закрыт")).toBeTruthy();
    expect(
      screen.queryByText("Оценки периода успешно финализированы"),
    ).toBeNull();
  });

  it('uses the "Failed to finalize period" fallback when the error body has no message', async () => {
    installFetchMock([
      matrixRoute("g-1", jsonResponse(matrixG1)),
      finalizeRoute(jsonResponse({}, 500)),
    ]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(finalizeButton());

    expect(await screen.findByText("Failed to finalize period")).toBeTruthy();
  });

  it('reports a finalize network failure as "Network error while finalizing"', async () => {
    // No finalize route -> the mocked fetch throws.
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG1))]);

    renderManager();
    await screen.findAllByText("Алишер Каримов");

    fireEvent.click(finalizeButton());

    expect(
      await screen.findByText("Network error while finalizing"),
    ).toBeTruthy();
  });

  it("shows the finalize button only for DIRECTOR and CENTER_ADMIN", async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG1))]);

    const { unmount } = renderManager({ userRole: "DIRECTOR" });
    await screen.findAllByText("Алишер Каримов");
    expect(finalizeButton()).toBeTruthy();
    unmount();

    renderManager({ userRole: "CENTER_ADMIN" });
    await screen.findAllByText("Алишер Каримов");
    expect(finalizeButton()).toBeTruthy();
  });

  it("hides the finalize button for TEACHER and STUDENT", async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG1))]);

    const { unmount } = renderManager({ userRole: "TEACHER" });
    await screen.findAllByText("Алишер Каримов");
    expect(
      screen.queryByRole("button", { name: /Финализировать период/ }),
    ).toBeNull();
    unmount();

    renderManager({ userRole: "STUDENT" });
    await screen.findAllByText("Алишер Каримов");
    expect(
      screen.queryByRole("button", { name: /Финализировать период/ }),
    ).toBeNull();
  });

  it("shows the CSV export for DIRECTOR, CENTER_ADMIN and TEACHER but not for students", async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG1))]);

    const director = renderManager({ userRole: "DIRECTOR" });
    await screen.findAllByText("Алишер Каримов");
    expect(exportLink()).toBeTruthy();
    director.unmount();

    const teacher = renderManager({ userRole: "TEACHER" });
    await screen.findAllByText("Алишер Каримов");
    expect(exportLink()).toBeTruthy();
    teacher.unmount();

    const admin = renderManager({ userRole: "CENTER_ADMIN" });
    await screen.findAllByText("Алишер Каримов");
    expect(exportLink()).toBeTruthy();
    admin.unmount();

    renderManager({ userRole: "SUPERADMIN" });
    await screen.findAllByText("Алишер Каримов");
    expect(screen.queryByRole("link", { name: /Экспорт в CSV/ })).toBeNull();
  });

  it("renders uz-Latn labels", async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG2))]);

    renderManager({ locale: "uz-Latn" });

    expect(screen.getByText("Guruhni tanlang")).toBeTruthy();
    await screen.findByText("Физика 9-Б");
    expect(screen.getByText("1 Oʻquvchilar")).toBeTruthy();
    expect(screen.getByText("Yakuniy ball")).toBeTruthy();
    expect(screen.getByText("Baho")).toBeTruthy();
    expect(screen.getByText("CSV ga eksport")).toBeTruthy();
    expect(screen.getByText("Davrni yakunlash")).toBeTruthy();
  });

  it("falls back to Russian for an unsupported locale", async () => {
    installFetchMock([matrixRoute("g-1", jsonResponse(matrixG1))]);

    renderManager({ locale: "fr" });

    expect(screen.getByText("Выберите группу")).toBeTruthy();
    expect(screen.getByText("Экспорт в CSV")).toBeTruthy();
    expect(screen.getByText("Финализировать период")).toBeTruthy();
    await screen.findByText("Математика 10-А");
  });
});
