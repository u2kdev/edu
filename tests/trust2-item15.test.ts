import { describe, it, expect } from "vitest";
import {
  membershipPermissionsSchema,
  hasPermission,
} from "../src/lib/permissions";

describe("TRUST-2 Item 15: membershipPermissions validation & isolation", () => {
  it("membershipPermissionsSchema accepts valid center permissions", () => {
    const valid = {
      granted: ["grades.finalize", "courses.create"],
      denied: ["payments.refund"],
    };
    const res = membershipPermissionsSchema.safeParse(valid);
    expect(res.success).toBe(true);
  });

  it("membershipPermissionsSchema rejects any platform.* permissions", () => {
    const malicious = {
      granted: ["platform.database", "platform.infrastructure"],
    };
    const res = membershipPermissionsSchema.safeParse(malicious);
    expect(res.success).toBe(false);
  });

  it("membershipPermissionsSchema rejects extra unexpected properties", () => {
    const malicious = {
      granted: ["grades.finalize"],
      superUser: true,
    };
    const res = membershipPermissionsSchema.safeParse(malicious);
    expect(res.success).toBe(false);
  });

  it("hasPermission ignores platform privilege escalation attempted via membershipPermissions JSON", () => {
    const jsonWithPlatformEscalation = JSON.stringify({
      granted: ["platform.infrastructure"],
    });

    const hasInfra = hasPermission(
      "platform.infrastructure",
      "NONE",
      "TEACHER",
      jsonWithPlatformEscalation
    );
    expect(hasInfra).toBe(false);
  });
});
