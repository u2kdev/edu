import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST as acceptInvite } from "../src/app/api/invites/accept/route";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Invite Security", () => {
  let user: string;
  let tenant: string;

  beforeAll(async () => {
    const u = await db.platformUser.create({ data: { email: `invite-test-${Date.now()}@test.com`, passwordHash: "x", fullName: "Test" } });
    user = u.id;
    mockToken = signJWT({ userId: user, email: u.email, platformRole: "NONE" });

    const c = await db.learningCenter.create({ data: { name: "Test", slug: `test-${Date.now()}`, ownerId: user, status: "ACTIVE" } });
    tenant = c.id;
  });

  afterAll(async () => {
    await db.learningCenter.deleteMany({ where: { id: tenant } });
    await db.platformUser.deleteMany({ where: { id: user } });
  });

  const mockReq = (code: string, ip: string) => new Request("http://localhost/api/invites/accept", {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    body: JSON.stringify({ code })
  });

  it("should return neutral error for invalid code", async () => {
    const res = await acceptInvite(mockReq("INVALID_CODE_123", "10.0.0.1"));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Недействительный инвайт-код");
  });

  it("should return neutral error for expired code", async () => {
    const { getTenantDb } = await import("../src/lib/db-tenant");
    const tenantDb = getTenantDb(tenant);
    // Create a dummy membership first
    const mem = await tenantDb.centerMembership.create({ data: { userId: user, centerId: tenant, role: "DIRECTOR" } });
    
    const invite = await tenantDb.inviteCode.create({
      data: { centerId: tenant, code: "EXPIRED_123", targetRole: "STUDENT", expiresAt: new Date(Date.now() - 10000), maxUses: 1, usesCount: 0, createdByMembershipId: mem.id }
    });
    
    const res = await acceptInvite(mockReq("EXPIRED_123", "10.0.0.2"));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Недействительный инвайт-код");
  });

  it("should return neutral error for fully used code", async () => {
    const { getTenantDb } = await import("../src/lib/db-tenant");
    const tenantDb = getTenantDb(tenant);
    const mem = await tenantDb.centerMembership.findFirst({ where: { userId: user } });
    const invite = await tenantDb.inviteCode.create({
      data: { centerId: tenant, code: "USED_123", targetRole: "STUDENT", expiresAt: new Date(Date.now() + 100000), maxUses: 1, usesCount: 1, createdByMembershipId: mem!.id }
    });
    
    const res = await acceptInvite(mockReq("USED_123", "10.0.0.3"));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("Недействительный инвайт-код");
  });

  it("should enforce rate limiting on invite attempts", async () => {
    let res;
    for (let i = 0; i < 11; i++) {
      res = await acceptInvite(mockReq("SOME_CODE", "10.0.0.4"));
    }
    const data = await res!.json();
    expect(res!.status).toBe(429);
    expect(data.error.code).toBe("RATE_LIMITED");
  });
});
