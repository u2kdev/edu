import { describe, it, expect } from "vitest";
import { getTenantDb } from "../src/lib/db-tenant";

describe("TRUST-2 Item 5: getTenantDb throws on empty or invalid centerId", () => {
  it("throws when centerId is empty string", () => {
    expect(() => getTenantDb("")).toThrow("Invalid or empty centerId provided to getTenantDb");
  });

  it("throws when centerId is whitespace", () => {
    expect(() => getTenantDb("   ")).toThrow("Invalid or empty centerId provided to getTenantDb");
  });

  it("throws when centerId is null or undefined", () => {
    expect(() => getTenantDb(null as (string | null))).toThrow("Invalid or empty centerId provided to getTenantDb");
    expect(() => getTenantDb(undefined as (string | undefined))).toThrow("Invalid or empty centerId provided to getTenantDb");
  });
});
