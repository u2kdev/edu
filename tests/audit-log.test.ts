import { describe, it, expect } from "vitest";
import { db } from "../src/lib/db";
import { logAuditEvent } from "../src/lib/tenant";

describe("AuditLog centerId nullable", () => {
  it("creates a platform-level audit log (centerId is undefined/null)", async () => {
    // Create user so actorUserId foreign key doesn't fail
    await db.platformUser.create({
      data: { id: "sys", email: "sys@test.com", passwordHash: "x", fullName: "Sys" }
    });
    // Should not throw foreign key constraint violation
    await logAuditEvent({
      actorUserId: "sys",
      action: "PLATFORM_START",
      resource: "System",
      centerId: undefined, // Platform level
    });

    const logs = await db.auditLog.findMany({
      where: { action: "PLATFORM_START" }
    });

    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].centerId).toBeNull();
    
    await db.platformUser.delete({ where: { id: "sys" } });
  });
});
