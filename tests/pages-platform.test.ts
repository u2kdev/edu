import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * `src/app/platform/**` legacy routes (6 pages). Every one of them is a tiny
 * synchronous server component whose only job is to `redirect(...)` to the
 * current /platform-admin location, so the whole test is: call the component
 * and assert the thrown redirect target.
 *
 * Same hoisted-spy pattern as tests/pages-center-server.test.ts.
 */

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

type PageName = "platform" | "tenants" | "tenantsCreate" | "tenantDetails" | "support" | "subscriptions";

async function loadPage(name: PageName): Promise<(props?: unknown) => unknown> {
  switch (name) {
    case "platform":
      return (await import("@/app/platform/page")).default;
    case "tenants":
      return (await import("@/app/platform/tenants/page")).default;
    case "tenantsCreate":
      return (await import("@/app/platform/tenants/create/page")).default;
    case "tenantDetails":
      return (await import("@/app/platform/tenants/[id]/page")).default as unknown as (
        props?: unknown,
      ) => unknown;
    case "support":
      return (await import("@/app/platform/support/page")).default;
    case "subscriptions":
      return (await import("@/app/platform/subscriptions/page")).default;
  }
}

beforeEach(() => {
  vi.resetModules();
  redirectMock.mockClear();
});

describe("platform/** legacy redirect pages", () => {
  it("/platform redirects to /platform-admin", async () => {
    const Page = await loadPage("platform");
    expect(() => Page()).toThrow("NEXT_REDIRECT:/platform-admin");
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin");
  });

  it("/platform/tenants redirects to /platform-admin/centers", async () => {
    const Page = await loadPage("tenants");
    expect(() => Page()).toThrow("NEXT_REDIRECT:/platform-admin/centers");
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin/centers");
  });

  it("/platform/tenants/create redirects to /platform-admin/centers/create", async () => {
    const Page = await loadPage("tenantsCreate");
    expect(() => Page()).toThrow("NEXT_REDIRECT:/platform-admin/centers/create");
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin/centers/create");
  });

  it("/platform/tenants/[id] redirects to the matching center card", async () => {
    const Page = await loadPage("tenantDetails");
    expect(() => Page({ params: { id: "center-42" } })).toThrow(
      "NEXT_REDIRECT:/platform-admin/centers/center-42",
    );
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin/centers/center-42");
  });

  it("/platform/tenants/[id] interpolates arbitrary ids (incl. url-ish chars)", async () => {
    const Page = await loadPage("tenantDetails");
    expect(() => Page({ params: { id: "abc-123/with space" } })).toThrow(
      "NEXT_REDIRECT:/platform-admin/centers/abc-123/with space",
    );
    expect(redirectMock).toHaveBeenLastCalledWith("/platform-admin/centers/abc-123/with space");
  });

  it("/platform/support redirects to /platform-admin/support", async () => {
    const Page = await loadPage("support");
    expect(() => Page()).toThrow("NEXT_REDIRECT:/platform-admin/support");
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin/support");
  });

  it("/platform/subscriptions redirects to /platform-admin/plans", async () => {
    const Page = await loadPage("subscriptions");
    expect(() => Page()).toThrow("NEXT_REDIRECT:/platform-admin/plans");
    expect(redirectMock).toHaveBeenCalledWith("/platform-admin/plans");
  });
});
