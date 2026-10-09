import { describe, it, expect } from "vitest";
import { hasPermission } from "../src/lib/permissions";

describe("TRUST-2 Item 13: SUPERADMIN permissions boundary", () => {
  it("SUPERADMIN does NOT have technical infrastructure permissions", () => {
    expect(hasPermission("platform.infrastructure", "SUPERADMIN")).toBe(false);
    expect(hasPermission("platform.database", "SUPERADMIN")).toBe(false);
    expect(hasPermission("platform.logs", "SUPERADMIN")).toBe(false);
    expect(hasPermission("platform.feature_flags", "SUPERADMIN")).toBe(false);
    expect(hasPermission("platform.security", "SUPERADMIN")).toBe(false);
  });

  it("SUPERADMIN still has platform management permissions", () => {
    expect(hasPermission("platform.centers.read", "SUPERADMIN")).toBe(true);
    expect(hasPermission("platform.centers.write", "SUPERADMIN")).toBe(true);
    expect(hasPermission("platform.tenants.manage", "SUPERADMIN")).toBe(true);
  });

  it("DEVELOPER retains infrastructure permissions", () => {
    expect(hasPermission("platform.infrastructure", "DEVELOPER")).toBe(true);
    expect(hasPermission("platform.database", "DEVELOPER")).toBe(true);
    expect(hasPermission("platform.logs", "DEVELOPER")).toBe(true);
  });
});
