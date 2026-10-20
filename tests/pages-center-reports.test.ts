import { describe, it, expect, vi, beforeEach } from "vitest";
import { t, formatCurrencyLocalized } from "@/i18n";

/**
 * `src/app/center/reports/page.tsx` — plain async server component.
 * Follows the pattern of tests/pages-center-schedule.test.ts:
 *  - `vi.hoisted` spies for redirect / getAuthSession / requireTenantPageAccess
 *  - a fake tenant db returned by `requireTenantPageAccess().getTenantDb()`
 *  - `vi.resetModules()` + a fresh dynamic import before every page call
 */

const { redirectMock, getAuthSessionMock, requireTenantPageAccessMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  getAuthSessionMock: vi.fn(),
  requireTenantPageAccessMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/lib/auth", () => ({ getAuthSession: getAuthSessionMock }));
vi.mock("@/lib/tenant", () => ({ requireTenantPageAccess: requireTenantPageAccessMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb() {
  return {
    centerPayment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null }, _count: 0 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    centerMembership: {
      count: vi.fn().mockResolvedValue(0),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
}

type Db = ReturnType<typeof makeDb>;

function session(overrides: Record<string, unknown> = {}) {
  return {
    activeCenterId: "center-1",
    activeCenterRole: "DIRECTOR",
    memberships: [{ id: "m-director", centerId: "center-1" }],
    user: { id: "u-1", preferredLanguage: "ru" },
    ...overrides,
  };
}

function setUp(db: Db, sess: unknown) {
  requireTenantPageAccessMock.mockResolvedValue({ getTenantDb: () => db });
  getAuthSessionMock.mockResolvedValue(sess);
}

async function loadPage() {
  return (await import("@/app/center/reports/page")).default;
}

/** Recursively flatten every rendered text node of an element tree. */
function collectText(node: unknown): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(collectText).join(" ");
  if (typeof node === "object" && (node as { props?: unknown }).props !== undefined) {
    return collectText((node as { props: { children?: unknown } }).props.children);
  }
  return "";
}

/** Walk the element tree and collect every element node. */
function walk(node: unknown, out: Array<{ props: Record<string, unknown> }> = []) {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props !== undefined) {
    out.push(el as { props: Record<string, unknown> });
    walk(el.props.children, out);
  }
  return out;
}

/** Every `href` prop rendered anywhere in the tree. */
function allHrefs(node: unknown): string[] {
  return walk(node)
    .map((el) => el.props.href)
    .filter((href): href is string => typeof href === "string");
}

// ---------------------------------------------------------------------------

describe("CenterReportsPage (server page)", () => {
  beforeEach(() => {
    vi.resetModules();
    redirectMock.mockClear();
    getAuthSessionMock.mockReset();
    requireTenantPageAccessMock.mockReset();
  });

  it("redirects to /login when there is no session", async () => {
    setUp(makeDb(), null);
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects to /center when the session has no active center", async () => {
    setUp(makeDb(), session({ activeCenterId: null }));
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("redirects teachers / students to /center", async () => {
    setUp(makeDb(), session({ activeCenterRole: "TEACHER" }));
    const Page = await loadPage();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/center");

    vi.resetModules();
    redirectMock.mockClear();
    setUp(makeDb(), session({ activeCenterRole: "STUDENT" }));
    const Page2 = await loadPage();
    await expect(Page2()).rejects.toThrow("NEXT_REDIRECT:/center");
  });

  it("renders financial + teacher-hours report for a DIRECTOR", async () => {
    const db = makeDb();
    db.centerPayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 1_000_000 }, _count: 4 }) // PAID
      .mockResolvedValueOnce({ _sum: { amount: 200_000 }, _count: 2 }); // PENDING
    db.centerMembership.count.mockResolvedValue(20);
    db.centerPayment.findMany.mockResolvedValue([
      {
        id: "p-1",
        amount: 300_000,
        student: { user: { fullName: "Anna Smith", email: "anna@x.uz", phone: "+998 90 123-45-67" } },
        group: { name: "A1" },
      },
      {
        id: "p-2",
        amount: 150_000,
        student: { user: { fullName: "Bob Jones", email: "bob@x.uz", phone: null } },
        group: null,
      },
    ]);
    db.centerMembership.findMany.mockResolvedValue([
      {
        id: "teach-1",
        user: { fullName: "Ivan Petrov", email: "ivan@x.uz" },
        taughtGroups: [{ id: "g-1", enrollments: [{ id: "e-1" }, { id: "e-2" }] }, { id: "g-2", enrollments: [] }, { id: "g-3", enrollments: [] }],
        substituteLessons: [{ id: "s-1" }, { id: "s-2" }],
      },
    ]);
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page();
    // NBSP used by Intl.NumberFormat is normalised to a plain space.
    const text = collectText(element).replace(/\s+/g, " ");
    const cur = (n: number, l: string) => formatCurrencyLocalized(n, l, "UZS").replace(/\s+/g, " ");

    // KPIs
    expect(db.centerPayment.aggregate).toHaveBeenNthCalledWith(1, {
      where: { centerId: "center-1", status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });
    expect(db.centerPayment.aggregate).toHaveBeenNthCalledWith(2, {
      where: { centerId: "center-1", status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    });
    expect(db.centerMembership.count).toHaveBeenCalledWith({
      where: { centerId: "center-1", role: "STUDENT", status: "ACTIVE" },
    });

    expect(text).toContain(cur(1_000_000, "ru"));
    expect(text).toContain(cur(200_000, "ru"));
    // MRR = activeStudentsCount (20) * avgPayment (1_000_000 / 4 = 250_000)
    expect(text).toContain(cur(5_000_000, "ru"));
    expect(text).toContain("20 активных учеников");

    // Debtors table
    expect(db.centerPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { centerId: "center-1", status: "PENDING" },
        orderBy: { createdAt: "desc" },
      }),
    );
    expect(text).toContain("Anna Smith");
    expect(text).toContain("Bob Jones");
    expect(text).toContain("bob@x.uz"); // no phone -> falls back to email
    expect(text).toContain("A1");
    expect(text).toContain("—"); // null group

    // WhatsApp deep link only for the debtor with a phone
    const hrefs = allHrefs(element);
    expect(hrefs.some((h) => h.startsWith("https://wa.me/998901234567?"))).toBe(true);
    expect(hrefs.some((h) => h.includes(encodeURIComponent("Anna Smith")))).toBe(true);

    // Teacher hours table
    expect(db.centerMembership.findMany).toHaveBeenCalledWith({
      where: { centerId: "center-1", role: "TEACHER" },
      include: {
        user: { select: { fullName: true, email: true } },
        taughtGroups: { include: { enrollments: true } },
        substituteLessons: true,
      },
    });
    expect(text).toContain("Ivan Petrov");
    expect(text).toContain("2 учеников"); // 2 enrollments total across taught groups
    expect(text).toContain("3 групп");
    expect(text).toContain("2 замен");
    // estHours = 3 * 12 + 2 * 1.5 = 39
    expect(text).toContain("~ 39 акад. часов");
  });

  it("allows a CENTER_ADMIN", async () => {
    const db = makeDb();
    setUp(db, session({ activeCenterRole: "CENTER_ADMIN" }));
    const Page = await loadPage();
    const element = await Page();

    expect(collectText(element).length).toBeGreaterThan(0);
    expect(db.centerMembership.count).toHaveBeenCalled();
  });

  it("falls back to the default average payment and renders empty states", async () => {
    const db = makeDb();
    // aggregate default -> { _sum: { amount: null }, _count: 0 }
    db.centerMembership.count.mockResolvedValue(0);
    setUp(db, session({ user: { id: "u-1", preferredLanguage: "uz-Latn" } }));

    const Page = await loadPage();
    const element = await Page();
    const text = collectText(element).replace(/\s+/g, " ");

    // avgPayment fallback = 150000, activeStudents = 0 -> MRR = 0
    expect(text).toContain(formatCurrencyLocalized(0, "uz-Latn", "UZS").replace(/\s+/g, " "));
    expect(text).toContain(t("uz-Latn", "common.noData"));
    expect(text).toContain("0 активных учеников");
  });

  it("renders a dashed placeholder when a debtor has no phone", async () => {
    const db = makeDb();
    db.centerPayment.findMany.mockResolvedValue([
      {
        id: "p-9",
        amount: 10,
        student: { user: { fullName: "NoPhone", email: "np@x.uz", phone: "" } },
        group: { name: "B1" },
      },
    ]);
    setUp(db, session());

    const Page = await loadPage();
    const element = await Page();

    // Empty phone string -> no WhatsApp anchor at all
    expect(allHrefs(element).some((h) => h.startsWith("https://wa.me/"))).toBe(false);
    expect(collectText(element)).toContain("np@x.uz");
  });
});
