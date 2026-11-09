import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as registerPushToken } from "../src/app/api/mobile/push-token/register/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { dispatchMobilePush } from "../src/lib/mobile-push";
import { signJWT, hashJti, hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Push Notifications & Tenant Isolation", () => {
  let userId: string = "";
  let centerAId: string = "";
  let centerBId: string = "";
  let membershipAId: string = "";
  let membershipBId: string = "";
  let bearerToken: string = "";
  const email = `push-iso-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Create User
    const user = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Push Isolation Tester",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    // 2. Create Center A (ACTIVE)
    const centerA = await db.learningCenter.create({
      data: {
        name: "Push Center A",
        slug: `push-center-a-${Date.now()}`,
        status: "ACTIVE",
        ownerId: userId,
      },
    });
    centerAId = centerA.id;

    // 3. Create Center B (ACTIVE initially)
    const centerB = await db.learningCenter.create({
      data: {
        name: "Push Center B",
        slug: `push-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: userId,
      },
    });
    centerBId = centerB.id;

    // 4. Enroll User in Center A and Center B
    const memA = await db.centerMembership.create({
      data: { userId, centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
    });
    membershipAId = memA.id;

    const memB = await db.centerMembership.create({
      data: { userId, centerId: centerBId, role: "STUDENT", status: "ACTIVE" },
    });
    membershipBId = memB.id;

    // 5. Issue session
    const jti = uuidv4();
    bearerToken = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        activeCenterId: centerAId,
        activeCenterRole: "STUDENT",
        jti,
      },
      "15m"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userAgent: "push-tester",
      },
    });
  });

  afterAll(async () => {
    if (userId) {
      await db.devicePushToken.deleteMany({ where: { userId } });
      await db.userSession.deleteMany({ where: { userId } });
    }
    if (membershipAId || membershipBId) {
      await db.centerMembership.deleteMany({ where: { id: { in: [membershipAId, membershipBId] } } });
    }
    if (centerAId || centerBId) {
      await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    }
    if (userId) {
      await db.platformUser.deleteMany({ where: { id: userId } });
    }
  });

  it("registers DevicePushToken bound to userId and active centerId", async () => {
    const req = new Request("http://localhost/api/mobile/push-token/register", {
      method: "POST",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        pushToken: "ExponentPushToken[center-A-token-123]",
        platform: "android",
        deviceInfo: "Galaxy S20",
      }),
    });

    const res = await registerPushToken(req);
    expect(res.status).toBe(200);

    const saved = await db.devicePushToken.findUnique({
      where: { pushToken: "ExponentPushToken[center-A-token-123]" },
    });
    expect(saved).not.toBeNull();
    expect(saved?.centerId).toBe(centerAId);
    expect(saved?.userId).toBe(userId);
  });

  it("enforces tenant isolation: center B notification does not match token explicitly registered for center A", async () => {
    // Register token explicitly for Center B
    await db.devicePushToken.create({
      data: {
        userId,
        centerId: centerBId,
        platform: "android",
        pushToken: "ExponentPushToken[center-B-token-456]",
      },
    });

    const result = await dispatchMobilePush({
      userId,
      centerId: centerBId,
      title: "Test Center B",
      body: "Center B notification",
    });

    expect(result.sent).toBe(true);
    expect(result.recipientTokens).toContain("ExponentPushToken[center-B-token-456]");
    expect(result.recipientTokens).not.toContain("ExponentPushToken[center-A-token-123]");
  });

  it("refuses push delivery if learning center is suspended or inactive", async () => {
    // Set Center B to BLOCKED / SUSPENDED
    await db.learningCenter.update({
      where: { id: centerBId },
      data: { status: "BLOCKED" },
    });

    const result = await dispatchMobilePush({
      userId,
      centerId: centerBId,
      title: "Blocked Center",
      body: "Should not be delivered",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("CENTER_SUSPENDED_OR_INACTIVE");

    // Restore Center B status
    await db.learningCenter.update({
      where: { id: centerBId },
      data: { status: "ACTIVE" },
    });
  });

  it("refuses push delivery if recipient membership is inactive", async () => {
    // Suspend membership in Center A
    await db.centerMembership.update({
      where: { id: membershipAId },
      data: { status: "SUSPENDED" },
    });

    const result = await dispatchMobilePush({
      userId,
      centerId: centerAId,
      title: "Inactive Member",
      body: "Should not be delivered",
    });

    expect(result.sent).toBe(false);
    expect(result.reason).toBe("MEMBERSHIP_INACTIVE");

    // Restore membership
    await db.centerMembership.update({
      where: { id: membershipAId },
      data: { status: "ACTIVE" },
    });
  });

  it("deletes device push tokens on user logout", async () => {
    // Verify token exists before logout
    const countBefore = await db.devicePushToken.count({ where: { userId } });
    expect(countBefore).toBeGreaterThan(0);

    const logoutReq = new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { authorization: `Bearer ${bearerToken}` },
    });

    const logoutRes = await logout(logoutReq);
    expect(logoutRes.status).toBe(200);

    const countAfter = await db.devicePushToken.count({ where: { userId } });
    expect(countAfter).toBe(0);
  });
});
