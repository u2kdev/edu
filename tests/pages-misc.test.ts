import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getLandingMessages } from "@/lib/landing-i18n";

/**
 * Assorted top-level pages:
 *  - `src/app/setup/page.tsx`    (first-owner bootstrap, platform db)
 *  - `src/app/onboarding/page.tsx` (static "closed multi-tenant" notice)
 *  - `src/app/dev-logins/page.tsx` (dev-only user switcher, env-gated)
 *  - `src/app/dev/ui-kit/page.tsx` (dev-only showroom, production-gated)
 *  - `src/app/ru/page.tsx` + `src/app/page.tsx` (bilingual landing + metadata)
 *
 * Same hoisted-spy pattern as tests/pages-center-server.test.ts, extended with
 * a `notFound` spy for the dev-only pages.
 */

const { redirectMock, notFoundMock, dbMock } = vi.hoisted(() => {
  const model = (...methods: string[]) => {
    const obj: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of methods) obj[method] = vi.fn();
    return obj;
  };
  return {
    redirectMock: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFoundMock: vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    }),
    dbMock: {
      platformUser: model("count", "findMany", "findUnique"),
    },
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: notFoundMock,
}));
vi.mock("@/lib/db", () => ({ db: dbMock }));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

/** Find the first nested element whose component type is named `name`. */
function findElementByName(
  node: unknown,
  name: string,
): { props: Record<string, unknown> } | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByName(child, name);
      if (found) return found;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  const type = el.type;
  if (typeof type === "function" && (type as { name?: string }).name === name) {
    return el as { props: Record<string, unknown> };
  }
  if (type && typeof type === "object" && (type as { name?: string }).name === name) {
    return el as { props: Record<string, unknown> };
  }
  if (el.props !== undefined) return findElementByName(el.props.children, name);
  return null;
}

/** Every `href` prop rendered anywhere in the tree. */
function allHrefs(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node !== "object") return out;
  if (Array.isArray(node)) {
    for (const child of node) allHrefs(child, out);
    return out;
  }
  const el = node as { props?: Record<string, unknown> };
  if (el.props !== undefined) {
    if (typeof el.props.href === "string") out.push(el.props.href);
    allHrefs(el.props.children, out);
  }
  return out;
}

beforeEach(() => {
  vi.resetModules();
  redirectMock.mockClear();
  notFoundMock.mockClear();
  dbMock.platformUser.count.mockReset();
  dbMock.platformUser.findMany.mockReset().mockResolvedValue([]);
  dbMock.platformUser.findUnique.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// 1. /setup
// ---------------------------------------------------------------------------

describe("setup page", () => {
  const load = async () => import("@/app/setup/page");

  it("keeps the route dynamic", async () => {
    const mod = await load();
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("redirects to /login once a SUPERADMIN already exists", async () => {
    dbMock.platformUser.count.mockResolvedValue(1);
    const { default: Page } = await load();
    await expect(Page()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(dbMock.platformUser.count).toHaveBeenCalledWith({
      where: { platformRole: "SUPERADMIN" },
    });
  });

  it("renders the bootstrap form on a fresh platform", async () => {
    dbMock.platformUser.count.mockResolvedValue(0);
    const { default: Page } = await load();
    const element = await Page();
    const text = flatText(element);

    expect(text).toContain("Инициализация платформы");
    expect(text).toContain("Создание первой учетной записи владельца (SUPERADMIN)");
    expect(findElementByName(element, "SetupForm")).not.toBeNull();
    expect(allHrefs(element)).toContain("/login");
  });
});

// ---------------------------------------------------------------------------
// 2. /onboarding
// ---------------------------------------------------------------------------

describe("onboarding page", () => {
  it("renders the closed multi-tenant notice with a login link", async () => {
    const Page = (await import("@/app/onboarding/page")).default;
    const element = Page();
    const text = flatText(element);

    expect(text).toContain("Закрытый Мультитенантный Режим");
    expect(text).toContain("Войти в систему");
    expect(text).toContain("Администратором Платформы");
    expect(allHrefs(element)).toEqual(["/login"]);
  });
});

// ---------------------------------------------------------------------------
// 3. /dev-logins
// ---------------------------------------------------------------------------

describe("dev-logins page", () => {
  const load = async () => import("@/app/dev-logins/page");

  it("keeps the route dynamic", async () => {
    const mod = await load();
    expect(mod.dynamic).toBe("force-dynamic");
  });

  it("throws notFound when DEV_LOGIN is not enabled", async () => {
    vi.stubEnv("DEV_LOGIN", "false");
    const { default: Page } = await load();
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFoundMock).toHaveBeenCalledTimes(1);
    expect(dbMock.platformUser.findMany).not.toHaveBeenCalled();
  });

  it("throws notFound in production even when DEV_LOGIN=true", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEV_LOGIN", "true");
    const { default: Page } = await load();
    await expect(Page()).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("groups users by role and renders a DevLoginButton for each", async () => {
    vi.stubEnv("DEV_LOGIN", "true");
    dbMock.platformUser.findMany.mockResolvedValue([
      { id: "u-super", fullName: "Super", email: "super@x.uz", platformRole: "SUPERADMIN", memberships: [] },
      {
        id: "u-dev",
        fullName: "Dev",
        email: "dev@x.uz",
        platformRole: "DEVELOPER",
        memberships: [],
      },
      {
        id: "u-director",
        fullName: "Dir",
        email: "dir@x.uz",
        platformRole: "NONE",
        memberships: [{ id: "m1", role: "DIRECTOR", center: { name: "Alpha" } }],
      },
      {
        id: "u-teacher",
        fullName: "Teach",
        email: "t@x.uz",
        platformRole: "NONE",
        memberships: [{ id: "m2", role: "TEACHER", center: { name: "Beta" } }],
      },
      {
        id: "u-student",
        fullName: "Stud",
        email: "s@x.uz",
        platformRole: "NONE",
        memberships: [
          { id: "m3", role: "STUDENT", center: { name: "Alpha" } },
          { id: "m4", role: "STUDENT", center: { name: "Beta" } },
        ],
      },
      {
        id: "u-parent",
        fullName: "Par",
        email: "p@x.uz",
        platformRole: "NONE",
        memberships: [{ id: "m5", role: "PARENT", center: { name: "Alpha" } }],
      },
    ]);

    const { default: Page } = await load();
    const element = await Page();
    const text = flatText(element);

    expect(dbMock.platformUser.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "desc" },
      include: { memberships: { include: { center: true } } },
    });

    // Section headers carry the filtered counts.
    // (JSX interpolation leaves spaces around the count, collapsed by flatText.)
    expect(text).toContain("Платформенные администраторы ( 2 )"); // SUPERADMIN + DEVELOPER
    expect(text).toContain("Владельцы центров (DIRECTOR) ( 1 )");
    expect(text).toContain("Преподаватели (TEACHER) ( 1 )");
    expect(text).toContain("Студенты (STUDENT) ( 1 )");
    expect(text).toContain("Родители (PARENT) ( 1 )");

    // Rendered user cards reference their centers and roles.
    expect(text).toContain("Alpha - DIRECTOR");
    expect(text).toContain("Beta - TEACHER");
    expect(text).toContain("Stud");
    expect(text).toContain("s@x.uz");

    const button = findElementByName(element, "DevLoginButton");
    expect(button).not.toBeNull();
    expect(button!.props.userId).toBe("u-super");
    expect(button!.props.userName).toBe("Super");
    expect(button!.props.role).toBe("SUPERADMIN");
  });

  it("renders empty-state placeholders when no users exist", async () => {
    vi.stubEnv("DEV_LOGIN", "true");
    const { default: Page } = await load();
    const element = await Page();
    const text = flatText(element);

    expect(text).toContain("Dev Входы");
    expect(text.match(/Нет пользователей/g)?.length).toBe(5);
    expect(text).toContain("Платформенные администраторы ( 0 )");
    expect(findElementByName(element, "DevLoginButton")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 4. /dev/ui-kit
// ---------------------------------------------------------------------------

describe("dev/ui-kit page", () => {
  it("throws notFound in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const Page = (await import("@/app/dev/ui-kit/page")).default;
    expect(() => Page()).toThrow("NEXT_NOT_FOUND");
  });

  it("renders the showroom outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const Page = (await import("@/app/dev/ui-kit/page")).default;
    const text = flatText(Page());

    expect(text).toContain("Dev UI Kit");
    expect(text).toContain("Internal development component showroom");
  });
});

// ---------------------------------------------------------------------------
// 5. /ru and / (landing)
// ---------------------------------------------------------------------------

describe("russian landing page (/ru)", () => {
  const load = async () => import("@/app/ru/page");

  it("renders LandingView with the ru locale", async () => {
    const { default: RussianHomePage } = await load();
    const element = RussianHomePage() as { type: unknown; props: Record<string, unknown> };
    expect(typeof element.type).toBe("function");
    expect(element.props.locale).toBe("ru");
  });

  it("builds localized metadata", async () => {
    const { generateMetadata } = await load();
    const metadata = await generateMetadata();
    const ru = getLandingMessages("ru");

    expect(metadata.title).toBe(ru.meta.title);
    expect(metadata.description).toBe(ru.meta.description);
    expect(metadata.keywords).toBe(ru.meta.keywords);
    expect(metadata.alternates?.canonical).toBe("https://e-darschi.uz/ru");
    expect(metadata.alternates?.languages).toEqual({
      "uz-UZ": "https://e-darschi.uz/",
      "ru-RU": "https://e-darschi.uz/ru",
    });
    expect(metadata.openGraph?.locale).toBe("ru_RU");
    expect(metadata.openGraph?.url).toBe("https://e-darschi.uz/ru");
    expect((metadata.twitter as { card?: string } | undefined)?.card).toBe(
      "summary_large_image",
    );
  });
});

describe("uzbek landing page (/)", () => {
  const load = async () => import("@/app/page");

  it("renders LandingView with the uz locale", async () => {
    const { default: HomePage } = await load();
    const element = HomePage() as { type: unknown; props: Record<string, unknown> };
    expect(typeof element.type).toBe("function");
    expect(element.props.locale).toBe("uz");
  });

  it("builds localized metadata with the uz canonical", async () => {
    const { generateMetadata } = await load();
    const metadata = await generateMetadata();
    const uz = getLandingMessages("uz");

    expect(metadata.title).toBe(uz.meta.title);
    expect(metadata.description).toBe(uz.meta.description);
    expect(metadata.keywords).toBe(uz.meta.keywords);
    expect(metadata.alternates?.canonical).toBe("https://e-darschi.uz/");
    expect(metadata.openGraph?.locale).toBe("uz_UZ");
    expect(metadata.openGraph?.images).toEqual([
      {
        url: "https://e-darschi.uz/og-image-uz.png",
        width: 1200,
        height: 630,
        alt: "e-darschi LMS platformasi",
      },
    ]);
  });
});
