import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { requireTenantAccess } from "../src/lib/tenant";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-2 Item 1: requireTenantAccess platform roles security", () => {
  let centerId: string;
  let supportUserId: string;
  let fullAccessUserId: string;
  let devUserId: string;

  beforeAll(async () => {
    const owner = await db.platformUser.create({
      data: { email: `owner-${Date.now()}@t2i1.com`, passwordHash: "x", fullName: "Owner" }
    });
    const center = await db.learningCenter.create({
      data: { name: "T2 Center 1", slug: `t2c1-${Date.now()}`, ownerId: owner.id, status: "ACTIVE" }
    });
    centerId = center.id;

    const supportUser = await db.platformUser.create({
      data: { email: `support-${Date.now()}@t2i1.com`, passwordHash: "x", fullName: "Support", platformRole: "PLATFORM_SUPPORT" }
    });
    supportUserId = supportUser.id;

    const fullAccessUser = await db.platformUser.create({
      data: { email: `fullaccess-${Date.now()}@t2i1.com`, passwordHash: "x", fullName: "FullAccess", platformRole: "FULL_ACCESS" }
    });
    fullAccessUserId = fullAccessUser.id;

    const devUser = await db.platformUser.create({
      data: { email: `dev-${Date.now()}@t2i1.com`, passwordHash: "x", fullName: "Dev", platformRole: "DEVELOPER" }
    });
    devUserId = devUser.id;
  });

  afterAll(async () => {
    await db.learningCenter.deleteMany({ where: { id: centerId } });
    await db.platformUser.deleteMany({
      where: { id: { in: [supportUserId, fullAccessUserId, devUserId] } }
    });
  });

  it("PLATFORM_SUPPORT does not receive DIRECTOR and is marked read-only", async () => {
    mockToken = signJWT({ userId: supportUserId, email: "support@t2i1.com", platformRole: "PLATFORM_SUPPORT" });
    const ctx = await requireTenantAccess(centerId);
    expect(ctx.role).not.toBe("DIRECTOR");
    expect(ctx.isReadOnly).toBe(true);
  });

  it("PLATFORM_SUPPORT gets 403 on write operation", async () => {
    mockToken = signJWT({ userId: supportUserId, email: "support@t2i1.com", platformRole: "PLATFORM_SUPPORT" });
    await expect(requireTenantAccess(centerId, { isWrite: true })).rejects.toMatchObject({
      status: 403,
      code: "SUPPORT_READ_ONLY",
    });
  });

  it("FULL_ACCESS is removed from bypass and cannot access without membership", async () => {
    mockToken = signJWT({ userId: fullAccessUserId, email: "full@t2i1.com", platformRole: "FULL_ACCESS" });
    await expect(requireTenantAccess(centerId)).rejects.toThrow("Forbidden: You do not have access to this learning center");
  });

  it("Platform role entry writes AuditLog record", async () => {
    mockToken = signJWT({ userId: devUserId, email: "dev@t2i1.com", platformRole: "DEVELOPER" });
    await requireTenantAccess(centerId);

    const log = await db.auditLog.findFirst({
      where: {
        actorUserId: devUserId,
        centerId: centerId,
        action: "PLATFORM_TENANT_ACCESS",
      },
      orderBy: { createdAt: "desc" },
    });
    expect(log).not.toBeNull();
  });
});
