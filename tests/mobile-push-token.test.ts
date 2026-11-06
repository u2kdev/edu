import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as registerPushToken } from "../src/app/api/mobile/push-token/register/route";
import { POST as unregisterPushToken } from "../src/app/api/mobile/push-token/unregister/route";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Device Push Token Management", () => {
  let userAId: string;
  let userBId: string;
  let tokenA: string;
  let tokenB: string;
  const emailA = `push-user-a-${Date.now()}@test.com`;
  const emailB = `push-user-b-${Date.now()}@test.com`;
  const samplePushToken = `ExponentPushToken[mobile-device-test-${Date.now()}]`;

  beforeAll(async () => {
    // 1. Create User A
    const uA = await db.platformUser.create({
      data: {
        email: emailA,
        passwordHash: await hashPassword("PassA123!"),
        fullName: "Push Tester A",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userAId = uA.id;

    // Create session for User A
    const jtiA = uuidv4();
    tokenA = signJWT({ userId: userAId, email: emailA, platformRole: "NONE", jti: jtiA }, "30d");
    await db.userSession.create({
      data: {
        userId: userAId,
        jtiHash: hashJti(jtiA),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "mobile-test-agent",
      },
    });

    // 2. Create User B
    const uB = await db.platformUser.create({
      data: {
        email: emailB,
        passwordHash: await hashPassword("PassB123!"),
        fullName: "Push Tester B",
        preferredLanguage: "uz_Latn",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userBId = uB.id;

    // Create session for User B
    const jtiB = uuidv4();
    tokenB = signJWT({ userId: userBId, email: emailB, platformRole: "NONE", jti: jtiB }, "30d");
    await db.userSession.create({
      data: {
        userId: userBId,
        jtiHash: hashJti(jtiB),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "mobile-test-agent",
      },
    });
  });

  afterAll(async () => {
    const userIds = [userAId, userBId].filter(Boolean);
    if (userIds.length > 0) {
      await db.devicePushToken.deleteMany({ where: { userId: { in: userIds } } });
      await db.auditLog.deleteMany({ where: { actorUserId: { in: userIds } } });
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  const mockReq = (url: string, body: unknown, authToken?: string) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-forwarded-for": "127.0.0.1",
    };
    if (authToken) {
      headers["authorization"] = `Bearer ${authToken}`;
    }
    return new Request(`http://localhost${url}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  };

  it("POST /api/mobile/push-token/register: rejects unauthenticated request (401)", async () => {
    const req = mockReq("/api/mobile/push-token/register", {
      pushToken: samplePushToken,
      platform: "ios",
    });

    const res = await registerPushToken(req);
    expect(res.status).toBe(401);
  });

  it("POST /api/mobile/push-token/register: rejects invalid payload (400)", async () => {
    const req = mockReq(
      "/api/mobile/push-token/register",
      {
        pushToken: "", // Invalid: too short
        platform: "symbian", // Invalid platform
      },
      tokenA
    );

    const res = await registerPushToken(req);
    expect(res.status).toBe(400);
  });

  it("POST /api/mobile/push-token/register: registers push token for user A", async () => {
    const req = mockReq(
      "/api/mobile/push-token/register",
      {
        pushToken: samplePushToken,
        platform: "ios",
        deviceInfo: "iPhone 16, iOS 18.1",
      },
      tokenA
    );

    const res = await registerPushToken(req);
    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.registered).toBe(true);
    expect(data.id).toBeDefined();

    // Verify database record
    const record = await db.devicePushToken.findUnique({
      where: { pushToken: samplePushToken },
    });
    expect(record).not.toBeNull();
    expect(record?.userId).toBe(userAId);
    expect(record?.platform).toBe("ios");
    expect(record?.deviceInfo).toBe("iPhone 16, iOS 18.1");
  });

  it("POST /api/mobile/push-token/register: handles device re-assignment when user B logs in on same device", async () => {
    // User B now registers with the exact same pushToken (e.g. shared or re-logged device)
    const req = mockReq(
      "/api/mobile/push-token/register",
      {
        pushToken: samplePushToken,
        platform: "ios",
        deviceInfo: "iPhone 16 (User B session)",
      },
      tokenB
    );

    const res = await registerPushToken(req);
    expect(res.status).toBe(200);

    const record = await db.devicePushToken.findUnique({
      where: { pushToken: samplePushToken },
    });
    expect(record).not.toBeNull();
    // Must be updated to User B without duplication
    expect(record?.userId).toBe(userBId);
    expect(record?.deviceInfo).toBe("iPhone 16 (User B session)");
  });

  it("POST /api/mobile/push-token/unregister: deletes token when user B logs out", async () => {
    const req = mockReq(
      "/api/mobile/push-token/unregister",
      {
        pushToken: samplePushToken,
      },
      tokenB
    );

    const res = await unregisterPushToken(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.unregistered).toBe(true);
    expect(data.count).toBe(1);

    // Verify token is deleted
    const record = await db.devicePushToken.findUnique({
      where: { pushToken: samplePushToken },
    });
    expect(record).toBeNull();
  });

  it("POST /api/mobile/push-token/unregister: idempotent for already removed token", async () => {
    const req = mockReq(
      "/api/mobile/push-token/unregister",
      {
        pushToken: samplePushToken,
      },
      tokenB
    );

    const res = await unregisterPushToken(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
  });
});
