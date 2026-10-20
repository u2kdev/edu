// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, type ComponentType } from "react";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { t, formatDateLocalized } from "@/i18n";
import { installFetchMock, jsonResponse, sentBody } from "./helpers/ui";

/**
 * Assorted platform-admin pages:
 *  - `platform-admin/page.tsx`        (server dashboard, platform db)
 *  - `platform-admin/seo/page.tsx`    (server, role-gated placeholder)
 *  - `platform-admin/audit/page.tsx`  (server, SUPERADMIN-only audit table)
 *  - `platform-admin/centers/[id]`    (client card: fetch + tabs + metrics)
 *
 * The three server pages are called directly (hoisted auth/db spies, like the
 * other pages-* suites). The client card is rendered with Testing Library; its
 * `fetch` calls are mocked and asserted with plain vitest matchers.
 */

const { redirectMock, getAuthSessionMock, routerMock, dbMock } = vi.hoisted(() => {
  const model = (...methods: string[]) => {
    const obj: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of methods) obj[method] = vi.fn();
    return obj;
  };
  return {
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    getAuthSessionMock: vi.fn(),
    routerMock: {
      push: vi.fn(),
      replace: vi.fn(),
      refresh: vi.fn(),
      back: vi.fn(),
      prefetch: vi.fn(),
    },
    dbMock: {
      learningCenter: model("count", "findMany", "findUnique"),
      platformUser: model("count", "findMany", "findUnique"),
      centerMembership: model("count", "findMany"),
      subscription: model("findMany"),
      subscriptionPlan: model("findMany"),
      auditLog: model("findMany"),
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: () => routerMock,
}));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/db", () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-1", centerId: "center-1" }],
    user: {
      id: "u-1",
      preferredLanguage: "ru",
      fullName: "Root Admin",
      platformRole: "SUPERADMIN" as string | undefined,
    },
    ...overrides,
  };
}

function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && (node as { props?: unknown }).props !== undefined) {
    return collectText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

function flatText(node: unknown): string {
  return collectText(node).replace(/\s+/g, " ").trim();
}

/** Collect every value of a given prop name anywhere in the element tree. */
function collectPropValues(node: unknown, prop: string, out: unknown[] = []): unknown[] {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) collectPropValues(child, prop, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props !== undefined) {
    if (prop in el.props) out.push(el.props[prop]);
    collectPropValues(el.props.children, prop, out);
  }
  return out;
}

type PageName = "dashboard" | "seo" | "audit";

async function loadPage(name: PageName): Promise<() => Promise<unknown>> {
  switch (name) {
    case "dashboard":
      return (await import("@/app/platform-admin/page")).default;
    case "seo":
      return (await import("@/app/platform-admin/seo/page")).default;
    case "audit":
      return (await import("@/app/platform-admin/audit/page")).default;
  }
}

async function loadCenterCard(): Promise<ComponentType<{ params: { id: string } }>> {
  return (await import("@/app/platform-admin/centers/[id]/page")).default as unknown as ComponentType<{
    params: { id: string };
  }>;
}

beforeEach(() => {
  vi.resetModules();
  redirectMock.mockClear();
  getAuthSessionMock.mockReset();
  for (const model of Object.values(dbMock)) {
    for (const fn of Object.values(model)) {
      (fn as ReturnType<typeof vi.fn>).mockReset();
    }
  }
  dbMock.learningCenter.findMany.mockResolvedValue([]);
  dbMock.subscription.findMany.mockResolvedValue([]);
  dbMock.subscriptionPlan.findMany.mockResolvedValue([]);
  dbMock.auditLog.findMany.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
});

// ---------------------------------------------------------------------------
// 1. /platform-admin (dashboard)
// ---------------------------------------------------------------------------

describe("platform-admin dashboard page", () => {
  const load = () => loadPage("dashboard");

  const expiringSub = {
    id: "sub-1",
    center: {
      id: "c-exp",
      name: "Expiring Center",
      slug: "expiring",
      status: "ACTIVE",
      owner: { fullName: "Ow", email: "o@x.uz" },
    },
    plan: { name: "Pro" },
    currentPeriodEndsAt: new Date("2026-04-05T00:00:00.000Z"),
  };

  const recentCenters = [
    {
      id: "c-1",
      name: "Alpha",
      slug: "alpha",
      status: "ACTIVE",
      owner: { id: "u-9", fullName: "Alice", email: "alice@x.uz" },
      subscriptions: [{ plan: { name: "Pro" } }],
      _count: { memberships: 3, courses: 2 },
    },
    {
      id: "c-2",
      name: "Beta",
      slug: "beta",
      status: "BLOCKED",
      owner: { id: "u-8", fullName: "Bob", email: "bob@x.uz" },
      subscriptions: [],
      _count: { memberships: 0, courses: 0 },
    },
  ];

  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("renders platform KPIs, expiring subscriptions and recent centers", async () => {
    dbMock.learningCenter.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(6) // ACTIVE
      .mockResolvedValueOnce(2) // PAUSED
      .mockResolvedValueOnce(1) // TRIAL
      .mockResolvedValueOnce(1); // BLOCKED
    dbMock.platformUser.count.mockResolvedValue(50);
    dbMock.centerMembership.count.mockResolvedValueOnce(30).mockResolvedValueOnce(8); // STUDENT, TEACHER
    dbMock.subscription.findMany.mockResolvedValue([expiringSub]);
    dbMock.learningCenter.findMany.mockResolvedValue(recentCenters);
    getAuthSessionMock.mockResolvedValue(session());

    const Page = await load();
    const element = await Page();
    const text = flatText(element);

    // Aggregations
    expect(dbMock.learningCenter.count).toHaveBeenCalledTimes(5);
    expect(dbMock.learningCenter.count).toHaveBeenNthCalledWith(2, {
      where: { status: "ACTIVE" },
    });
    expect(dbMock.learningCenter.count).toHaveBeenNthCalledWith(3, {
      where: { status: "PAUSED" },
    });
    expect(dbMock.learningCenter.count).toHaveBeenNthCalledWith(4, {
      where: { status: "TRIAL" },
    });
    expect(dbMock.learningCenter.count).toHaveBeenNthCalledWith(5, {
      where: { status: "BLOCKED" },
    });
    expect(dbMock.platformUser.count).toHaveBeenCalledTimes(1);
    expect(dbMock.centerMembership.count).toHaveBeenNthCalledWith(1, {
      where: { role: "STUDENT", status: "ACTIVE" },
    });
    expect(dbMock.centerMembership.count).toHaveBeenNthCalledWith(2, {
      where: { role: "TEACHER", status: "ACTIVE" },
    });
    expect(dbMock.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
    expect(dbMock.learningCenter.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 8, orderBy: { createdAt: "desc" } }),
    );

    // Header
    expect(text).toContain(t("ru", "dashboard.welcome", { name: "Root Admin" }));
    expect(text).toContain(t("ru", "platform.title"));
    expect(text).toContain(t("ru", "roles.SUPERADMIN"));

    // Metric cards
    expect(text).toContain("10");
    expect(text).toContain("50 аккаунтов зарегистрировано");
    expect(text).toContain(t("ru", "platform.frozen").toLowerCase()); // paused > 0 badge
    expect(text).toContain(t("ru", "platform.blocked").toLowerCase()); // blocked > 0 badge
    expect(text).toContain("1 подписок истекают скоро");
    expect(text).toContain(t("ru", "platform.trial"));

    // Expiring subscriptions block
    expect(text).toContain("Expiring Center");
    expect(text).toContain("Pro");
    expect(text).toContain(formatDateLocalized(expiringSub.currentPeriodEndsAt, "ru"));

    // Recent centers table
    expect(text).toContain("Alpha");
    expect(text).toContain("alpha");
    expect(text).toContain("Alice");
    expect(text).toContain("alice@x.uz");
    expect(text).toContain("Beta");
    expect(text).toContain("bob@x.uz");
    expect(text).toContain(t("ru", "platform.active"));
    expect(text).toContain("—"); // Beta has no subscription → dash

    // SUPERADMIN is not FULL_ACCESS → no engineering banner
    expect(text).not.toContain("Режим инженерного доступа");
  });

  it("renders the FULL_ACCESS banner and the healthy-plans state", async () => {
    dbMock.learningCenter.count
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(0) // ACTIVE
      .mockResolvedValueOnce(1) // PAUSED
      .mockResolvedValueOnce(0) // TRIAL
      .mockResolvedValueOnce(0); // BLOCKED
    dbMock.learningCenter.findMany.mockResolvedValue([
      {
        id: "c-3",
        name: "Paused Co",
        slug: "paused-co",
        status: "PAUSED",
        owner: { id: "u-7", fullName: "Cara", email: "cara@x.uz" },
        subscriptions: [{ plan: null }],
        _count: { memberships: 0, courses: 0 },
      },
    ]);
    getAuthSessionMock.mockResolvedValue(
      session({
        memberships: [],
        user: {
          id: "u-1",
          preferredLanguage: "ru",
          fullName: "Eng",
          platformRole: "FULL_ACCESS",
        },
      }),
    );

    const Page = await load();
    const element = await Page();
    const text = flatText(element);

    expect(text).toContain("Режим инженерного доступа (FULL_ACCESS)");
    expect(text).toContain("Все тарифные планы в норме");
    expect(text).not.toContain("подписок истекают скоро");
    expect(text).toContain(t("ru", "roles.FULL_ACCESS"));
    // no BLOCKED centers → no blocked badge
    expect(text).not.toContain(t("ru", "platform.blocked").toLowerCase());
    expect(text).toContain(t("ru", "platform.frozen").toLowerCase());
    // PAUSED status now resolves through the catalog instead of leaking the raw key.
    expect(text).toContain(t("ru", "platform.paused"));
    expect(text).not.toContain("platform.paused");
  });
});

// ---------------------------------------------------------------------------
// 2. /platform-admin/seo
// ---------------------------------------------------------------------------

describe("platform-admin/seo page", () => {
  const load = () => loadPage("seo");

  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it.each(["NONE", "PLATFORM_SUPPORT", "DIRECTOR"])(
    "redirects role %s to /center",
    async (role) => {
      getAuthSessionMock.mockResolvedValue(
        session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", platformRole: role } }),
      );
      const Page = await load();
      await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
    },
  );

  it.each(["SUPERADMIN", "PLATFORM_ADMIN", "SEO_ADMIN", "FULL_ACCESS"])(
    "renders the SEO panel for %s",
    async (role) => {
      getAuthSessionMock.mockResolvedValue(
        session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", platformRole: role } }),
      );
      const Page = await load();
      const element = await Page();
      const text = flatText(element);

      expect(text).toContain("Панель SEO и Контента Платформы");
      expect(text).toContain("Meta Title (ru)");
      expect(text).toContain("OpenGraph & Социальные сети");
      // Inputs render their value via `defaultValue`, not as text children.
      expect(collectPropValues(element, "defaultValue")).toContain(
        "https://academiasaas.com/og-banner.png",
      );
    },
  );
});

// ---------------------------------------------------------------------------
// 3. /platform-admin/audit
// ---------------------------------------------------------------------------

describe("platform-admin/audit page", () => {
  const load = () => loadPage("audit");

  it("redirects to /login when there is no session", async () => {
    getAuthSessionMock.mockResolvedValue(null);
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("blocks a non-SUPERADMIN back to /platform-admin", async () => {
    getAuthSessionMock.mockResolvedValue(
      session({ user: { id: "u-1", preferredLanguage: "ru", fullName: "X", platformRole: "PLATFORM_ADMIN" } }),
    );
    const Page = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/platform-admin");
  });

  it("renders audit rows, pretty-printing JSON and falling back on bad JSON", async () => {
    dbMock.auditLog.findMany.mockResolvedValue([
      {
        id: "log-1",
        action: "SUSPEND_CENTER",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        detailsJson: '{"reason":"payment"}',
        resource: "LearningCenter",
        actor: { id: "u-2", fullName: "Admin Two", email: "admin2@x.uz", platformRole: "SUPERADMIN" },
        center: { id: "c-1", name: "Alpha", slug: "alpha" },
      },
      {
        id: "log-2",
        action: "RAW_EVENT",
        createdAt: new Date("2026-04-02T10:00:00.000Z"),
        detailsJson: "not-json",
        resource: "System",
        actor: null,
        center: null,
      },
    ]);
    getAuthSessionMock.mockResolvedValue(session());

    const Page = await load();
    const element = await Page();
    const text = flatText(element);

    expect(dbMock.auditLog.findMany).toHaveBeenCalledWith({
      take: 50,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, fullName: true, email: true, platformRole: true } },
        center: { select: { id: true, name: true, slug: true } },
      },
    });
    expect(text).toContain("SUSPEND_CENTER");
    expect(text).toContain('{"reason":"payment"}');
    expect(text).toContain("Admin Two");
    expect(text).toContain("admin2@x.uz");
    expect(text).toContain("Alpha");
    expect(text).toContain("alpha");
    // null actor / null center fallbacks + unparseable details kept verbatim
    expect(text).toContain("Система");
    expect(text).toContain("— (Платформа)");
    expect(text).toContain("RAW_EVENT");
    expect(text).toContain("not-json");
    expect(text).toContain("Всего записей: 2");
  });

  it("renders an empty audit journal", async () => {
    getAuthSessionMock.mockResolvedValue(session());
    const Page = await load();
    const text = flatText(await Page());

    expect(text).toContain("Журнал аудита пуст");
    expect(text).toContain("Всего записей: 0");
  });
});

// ---------------------------------------------------------------------------
// 4. /platform-admin/centers/[id] (client card)
// ---------------------------------------------------------------------------

describe("platform-admin/centers/[id] client card", () => {
  const centerPayload = {
    data: {
      id: "c-1",
      name: "Bright Center",
      slug: "bright",
      email: "hello@bright.uz",
      phone: "+998900000001",
      timeZone: null,
      status: "ACTIVE",
      createdAt: "2026-01-15T00:00:00.000Z",
      owner: { id: "u-owner", fullName: "Owner Fallback", email: "owner@x.uz" },
    },
    director: { id: "u-dir", fullName: "Ivan Director", email: "dir@x.uz", phone: null },
    metrics: { usersByRole: { STUDENT: 42, TEACHER: 7, CENTER_ADMIN: 3 } },
    auditLogs: [
      { action: "CREATE_CENTER", createdAt: "2026-01-16T00:00:00.000Z", details: "created" },
    ],
  };

  it("shows the loading placeholder, then the fetched center card", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers/c-1", reply: jsonResponse(centerPayload) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-1" } }));
    expect(screen.getByText("Загрузка карточки центра...")).toBeTruthy();

    await waitFor(() => expect(screen.getByText("Bright Center")).toBeTruthy());

    expect(calls[0].url).toBe("/api/platform/centers/c-1");
    expect(screen.getByText("Slug: bright")).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText("hello@bright.uz")).toBeTruthy();
    expect(screen.getByText("+998900000001")).toBeTruthy();
    // null timeZone falls back to Asia/Tashkent
    expect(screen.getByText("Asia/Tashkent")).toBeTruthy();
    // director block (not the owner fallback)
    expect(screen.getByText("Ivan Director")).toBeTruthy();
    expect(screen.getByText("dir@x.uz")).toBeTruthy();
    // metrics
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("7")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    // audit logs + impersonate button (director has an id)
    expect(screen.getByText("CREATE_CENTER")).toBeTruthy();
    expect(screen.getByText("created")).toBeTruthy();
    expect(screen.getByText("Войти как")).toBeTruthy();
  });

  it("falls back to json.center/json and the owner when director is missing", async () => {
    installFetchMock([
      {
        match: "/api/platform/centers/c-2",
        reply: jsonResponse({
          center: {
            id: "c-2",
            name: "Fallback Center",
            slug: "fallback",
            email: null,
            phone: null,
            status: "TRIAL",
            createdAt: "2026-02-01T00:00:00.000Z",
            owner: { id: "u-owner", fullName: "Owner Only", email: "owner@x.uz" },
          },
        }),
      },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-2" } }));
    await waitFor(() => expect(screen.getByText("Fallback Center")).toBeTruthy());

    expect(screen.getByText("Owner Only")).toBeTruthy();
    expect(screen.getByText("TRIAL")).toBeTruthy();
    // dash placeholders for missing email/phone, and empty audit log
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Записей в аудит-логе пока нет.")).toBeTruthy();
  });

  it("renders an error banner when the API responds with a failure", async () => {
    installFetchMock([
      { match: "/api/platform/centers/c-3", reply: jsonResponse({ error: "nope" }, 500) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-3" } }));
    await waitFor(() =>
      expect(screen.getByText("Не удалось загрузить данные центра")).toBeTruthy(),
    );
  });

  it("switches between the overview/edit/director/suspend tabs", async () => {
    installFetchMock([
      { match: "/api/platform/centers/c-4", reply: jsonResponse(centerPayload) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-4" } }));
    await waitFor(() => expect(screen.getByText("Bright Center")).toBeTruthy());

    fireEvent.click(screen.getByText("Редактировать"));
    expect(screen.getByText("Редактирование параметров центра")).toBeTruthy();

    fireEvent.click(screen.getByText("Директор"));
    expect(screen.getByText("Назначение нового директора")).toBeTruthy();

    fireEvent.click(screen.getByText("Управление доступом"));
    expect(screen.getByText("Управление статусом центра")).toBeTruthy();
  });

  it("saves edits via PATCH and reports success", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers/c-5", reply: jsonResponse(centerPayload) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-5" } }));
    await waitFor(() => expect(screen.getByText("Bright Center")).toBeTruthy());

    fireEvent.click(screen.getByText("Редактировать"));
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() =>
      expect(screen.getByText("Параметры центра успешно обновлены")).toBeTruthy(),
    );

    const patch = calls.find((c) => c.init?.method === "PATCH");
    expect(patch?.url).toBe("/api/platform/centers/c-5");
    expect(sentBody(patch!)).toEqual({
      name: "Bright Center",
      email: "hello@bright.uz",
      phone: "+998900000001",
      timeZone: "",
    });
  });

  it("assigns a new director via POST /director", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers/c-6", reply: jsonResponse(centerPayload) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-6" } }));
    await waitFor(() => expect(screen.getByText("Bright Center")).toBeTruthy());

    fireEvent.click(screen.getByText("Директор"));
    fireEvent.change(screen.getByPlaceholderText("director@example.com"), {
      target: { value: "new@dir.uz" },
    });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() =>
      expect(screen.getByText("Новый директор успешно назначен")).toBeTruthy(),
    );

    const post = calls.find((c) => c.url.endsWith("/director"));
    expect(post?.url).toBe("/api/platform/centers/c-6/director");
    expect(post?.init?.method).toBe("POST");
    expect(sentBody(post!)).toEqual({ email: "new@dir.uz" });
  });

  it("rejects a too-short suspension reason before hitting the API", async () => {
    const { calls } = installFetchMock([
      { match: "/api/platform/centers/c-7", reply: jsonResponse(centerPayload) },
    ]);
    const Page = await loadCenterCard();

    render(createElement(Page, { params: { id: "c-7" } }));
    await waitFor(() => expect(screen.getByText("Bright Center")).toBeTruthy());

    fireEvent.click(screen.getByText("Управление доступом"));
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() =>
      expect(
        screen.getByText("Причина должна быть длиной от 5 до 500 символов"),
      ).toBeTruthy(),
    );
    expect(calls.some((c) => c.url.includes("/suspend"))).toBe(false);
  });
});
