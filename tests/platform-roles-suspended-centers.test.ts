import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { requireTenantAccess } from "../src/lib/tenant";
import { db } from "../src/lib/db";
import { hashPassword, signJWT } from "../src/lib/auth";

let currentToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" && currentToken ? { value: currentToken } : undefined),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}));

describe("Platform roles in BLOCKED and CANCELLED centers", () => {
  const timestamp = Date.now();
  let blockedCenterId: string;
  let cancelledCenterId: string;
  let superAdminId: string;
  let developerId: string;
  let supportId: string;
  let ownerId: string;

  beforeAll(async () => {
    const pw = await hashPassword("ValidPass123!");

    // Platform users
    const sa = await db.platformUser.create({
      data: { email: `sa-${timestamp}@platform.com`, passwordHash: pw, fullName: "Super Admin", platformRole: "SUPERADMIN", emailVerified: new Date() },
    });
    superAdminId = sa.id;

    const dev = await db.platformUser.create({
      data: { email: `dev-${timestamp}@platform.com`, passwordHash: pw, fullName: "Developer", platformRole: "DEVELOPER", emailVerified: new Date() },
    });
    developerId = dev.id;

    const sup = await db.platformUser.create({
      data: { email: `sup-${timestamp}@platform.com`, passwordHash: pw, fullName: "Support", platformRole: "PLATFORM_SUPPORT", emailVerified: new Date() },
    });
    supportId = sup.id;

    const owner = await db.platformUser.create({
      data: { email: `owner-${timestamp}@tenant.com`, passwordHash: pw, fullName: "Owner", platformRole: "NONE", emailVerified: new Date() },
    });
    ownerId = owner.id;

    // Centers
    const blockedCenter = await db.learningCenter.create({
      data: { name: "Blocked Center", slug: `blocked-${timestamp}`, ownerId, status: "BLOCKED" },
    });
    blockedCenterId = blockedCenter.id;

    const cancelledCenter = await db.learningCenter.create({
      data: { name: "Cancelled Center", slug: `cancelled-${timestamp}`, ownerId, status: "CANCELLED" },
    });
    cancelledCenterId = cancelledCenter.id;
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({
      where: { centerId: { in: [blockedCenterId, cancelledCenterId] } },
    });
    await db.learningCenter.deleteMany({
      where: { id: { in: [blockedCenterId, cancelledCenterId] } },
    });
    await db.platformUser.deleteMany({
      where: { id: { in: [superAdminId, developerId, supportId, ownerId] } },
    });
  });

  const makeReq = (userId: string, role: string, method: string = "GET", body?: Record<string, unknown>, headers?: Record<string, string>) => {
    const token = signJWT({
      userId,
      email: `${userId}@test.com`,
      platformRole: role,
    });
    currentToken = token;

    return new Request("http://localhost/api/test", {
      method,
      headers: {
        cookie: `auth_token=${token}`,
        "Content-Type": "application/json",
        ...(headers || {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it("denies PLATFORM_SUPPORT access to BLOCKED and CANCELLED centers even for reading", async () => {
    const reqBlocked = makeReq(supportId, "PLATFORM_SUPPORT", "GET");
    await expect(requireTenantAccess(reqBlocked, blockedCenterId)).rejects.toMatchObject({
      status: 403,
      code: "SUSPENDED_ACCESS_DENIED",
    });

    const reqCancelled = makeReq(supportId, "PLATFORM_SUPPORT", "GET");
    await expect(requireTenantAccess(reqCancelled, cancelledCenterId)).rejects.toMatchObject({
      status: 403,
      code: "SUSPENDED_ACCESS_DENIED",
    });
  });

  it("allows SUPERADMIN and DEVELOPER to read BLOCKED and CANCELLED centers without reason", async () => {
    const reqSa = makeReq(superAdminId, "SUPERADMIN", "GET");
    const accessSa = await requireTenantAccess(reqSa, blockedCenterId);
    expect(accessSa.center.id).toBe(blockedCenterId);

    const reqDev = makeReq(developerId, "DEVELOPER", "GET");
    const accessDev = await requireTenantAccess(reqDev, cancelledCenterId);
    expect(accessDev.center.id).toBe(cancelledCenterId);
  });

  it("blocks write operations by SUPERADMIN / DEVELOPER to BLOCKED / CANCELLED centers without reason", async () => {
    const reqSaNoReason = makeReq(superAdminId, "SUPERADMIN", "POST", { name: "Updated" });
    await expect(requireTenantAccess(reqSaNoReason, blockedCenterId)).rejects.toMatchObject({
      status: 400,
      code: "REASON_REQUIRED",
    });

    const reqDevNoReason = makeReq(developerId, "DEVELOPER", "DELETE");
    await expect(requireTenantAccess(reqDevNoReason, cancelledCenterId)).rejects.toMatchObject({
      status: 400,
      code: "REASON_REQUIRED",
    });
  });

  it("allows write operations by SUPERADMIN / DEVELOPER with reason and writes to AuditLog", async () => {
    const reasonText = "Compliance emergency data correction";
    const reqWriteWithReason = makeReq(
      superAdminId,
      "SUPERADMIN",
      "POST",
      { reason: reasonText, data: "some-change" }
    );

    const access = await requireTenantAccess(reqWriteWithReason, blockedCenterId);
    expect(access.center.id).toBe(blockedCenterId);

    // Verify audit log entry
    const audit = await db.auditLog.findFirst({
      where: {
        centerId: blockedCenterId,
        actorUserId: superAdminId,
        action: "PLATFORM_SUSPENDED_TENANT_WRITE",
      },
    });

    expect(audit).not.toBeNull();
    const details = JSON.parse(audit?.detailsJson || "{}");
    expect(details.reason).toBe(reasonText);
    expect(details.centerStatus).toBe("BLOCKED");
  });
});
