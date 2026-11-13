import { describe, it, expect } from "vitest";
import nextConfig from "../next.config.mjs";

describe("platform/** legacy redirects in next.config.mjs", () => {
  it("redirects() returns expected redirect mappings from /platform to /platform-admin", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const redirects = await nextConfig.redirects!();

    const expected = [
      { source: "/platform", destination: "/platform-admin" },
      { source: "/platform/tenants", destination: "/platform-admin/centers" },
      { source: "/platform/tenants/create", destination: "/platform-admin/centers/create" },
      { source: "/platform/tenants/:id", destination: "/platform-admin/centers/:id" },
      { source: "/platform/subscriptions", destination: "/platform-admin/subscriptions" },
      { source: "/platform/support", destination: "/platform-admin/support" },
      { source: "/platform/:path*", destination: "/platform-admin/:path*" },
    ];

    for (const exp of expected) {
      const match = redirects.find((r) => r.source === exp.source);
      expect(match, `Redirect for ${exp.source} must exist`).toBeDefined();
      expect(match?.destination).toBe(exp.destination);
      expect(match?.permanent).toBe(false);
    }
  });
});
