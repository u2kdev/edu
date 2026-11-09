import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { getAuthSession, hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { requireTenantAccess } from "../src/lib/tenant";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

const mockSet = vi.fn();
const mockDelete = vi.fn();
const mockGet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: () => ({
    set: mockSet,
    get: mockGet,
    delete: mockDelete,
  }),
  headers: () => ({
    get: vi.fn(),
  }),
}));

describe("Mobile Authentication & Gateway", () => {
  let userId: string = "";
  let centerId: string = "";
  let membershipId: string = "";
  let unverifiedUserId: string = "";
  const email = `mobile-auth-${Date.now()}@test.com`;
  const unverifiedEmail = `mobile-unverified-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Create an active, verified user (who also acts as owner)
    const user = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Mobile Tester",
        preferredLanguage: "uz_Latn",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    // 2. Create a Learning Center with ownerId
    const center = await db.learningCenter.create({
      data: {
        name: "Mobile Test Academy",
        slug: `mobile-test-${Date.now()}`,
        status: "ACTIVE",
        ownerId: userId,
      },
    });
    centerId = center.id;

    // 3. Link user to center as STUDENT
    const membership = await db.centerMembership.create({
      data: {
        userId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    membershipId = membership.id;

    // 4. Create an unverified user
    const unverifiedUser = await db.platformUser.create({
      data: {
        email: unverifiedEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Unverified Tester",
        emailVerified: null,
        isActive: true,
      },
    });
    unverifiedUserId = unverifiedUser.id;
  });

  beforeEach(() => {
    mockSet.mockClear();
    mockGet.mockClear();
    mockDelete.mockClear();
  });

  afterAll(async () => {
    const ids = [userId, unverifiedUserId].filter(Boolean);
    if (ids.length > 0) {
      await db.auditLog.deleteMany({ where: { actorUserId: { in: ids } } });
      await db.userSession.deleteMany({ where: { userId: { in: ids } } });
    }
    if (membershipId) {
      await db.centerMembership.deleteMany({ where: { id: membershipId } });
    }
    if (centerId) {
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (ids.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: ids } } });
    }
  });

  const mockMobileReq = (body: unknown, ip: string = `127.0.1.${Math.floor(Math.random() * 200 + 1)}`) => {
    return new Request("http://localhost/api/auth/mobile/login", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(body),
    });
  };

  it("POST /api/auth/mobile/login: success with valid credentials", async () => {
    const res = await mobileLogin(
      mockMobileReq({
        email,
        password: "MobilePass123!",
        deviceName: "iPhone 15 Pro",
        platform: "ios",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.token).toBeDefined();
    expect(typeof data.token).toBe("string");
    expect(data.user.id).toBe(userId);
    expect(data.user.email).toBe(email);
    expect(data.user.preferredLanguage).toBe("uz_Latn");
    expect(data.activeCenterId).toBe(centerId);
    expect(data.activeCenterRole).toBe("STUDENT");
    expect(data.memberships.length).toBe(1);
    expect(data.memberships[0].role).toBe("STUDENT");

    // Verify UserSession stored in DB
    const session = await db.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    expect(session).not.toBeNull();
    expect(session?.userAgent).toContain("iPhone 15 Pro");

    // Verify AuditLog written
    const audit = await db.auditLog.findFirst({
      where: { actorUserId: userId, action: "MOBILE_LOGIN_SUCCESS" },
    });
    expect(audit).not.toBeNull();
  });

  it("POST /api/auth/mobile/login: fails with incorrect password", async () => {
    const res = await mobileLogin(
      mockMobileReq({
        email,
        password: "WrongPassword999!",
      })
    );

    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe("UNAUTHORIZED");
  });

  it("POST /api/auth/mobile/login: fails for unverified user (403)", async () => {
    const res = await mobileLogin(
      mockMobileReq({
        email: unverifiedEmail,
        password: "MobilePass123!",
      })
    );

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("getAuthSession: authenticates via Authorization: Bearer <token>", async () => {
    const jti = uuidv4();
    const token = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: "STUDENT",
        jti,
      },
      "30d"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "mobile-test-agent",
      },
    });

    const bearerReq = new Request("http://localhost/api/students/me", {
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const session = await getAuthSession(bearerReq);
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe(userId);
    expect(session?.user.email).toBe(email);
    expect(session?.activeCenterId).toBe(centerId);
    expect(session?.activeCenterRole).toBe("STUDENT");
  });

  it("getAuthSession: rejects revoked session token", async () => {
    const jti = uuidv4();
    const token = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        jti,
      },
      "30d"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        revokedAt: new Date(),
        userAgent: "revoked-agent",
      },
    });

    const req = new Request("http://localhost/api/any", {
      headers: { authorization: `Bearer ${token}` },
    });

    const session = await getAuthSession(req);
    expect(session).toBeNull();
  });

  it("getAuthSession: rejects tampered or forged token", async () => {
    const jti = uuidv4();
    const token = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        jti,
      },
      "30d"
    );

    // Tamper with the token payload
    const parts = token.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}xyz.${parts[2]}`;

    const req = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${tamperedToken}` },
    });

    const session = await getAuthSession(req);
    expect(session).toBeNull();
  });

  it("getAuthSession: rejects expired token", async () => {
    const jti = uuidv4();
    // Create token with -10s expiration
    const token = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        jti,
      },
      "-10s"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() - 10000),
        userAgent: "expired-token-agent",
      },
    });

    const req = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${token}` },
    });

    const session = await getAuthSession(req);
    expect(session).toBeNull();
  });

  it("requireTenantAccess: allows access when Bearer token is provided", async () => {
    const jti = uuidv4();
    const token = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: "STUDENT",
        jti,
      },
      "30d"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "tenant-bearer-test",
      },
    });

    const tenantReq = new Request(`http://localhost/api/tenant/info`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const tenantContext = await requireTenantAccess(tenantReq, centerId);
    expect(tenantContext).toBeDefined();
    expect(tenantContext.session.user.id).toBe(userId);
    expect(tenantContext.center.id).toBe(centerId);
  });
});
