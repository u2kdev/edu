import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DELETE as deleteAccount } from "../src/app/api/auth/account/delete/route";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { getAuthSession, hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Account Deletion & App Store Compliance", () => {
  let userId: string = "";
  let bearerToken: string = "";
  const email = `delete-me-${Date.now()}@test.com`;
  const password = "MobilePass123!";

  beforeAll(async () => {
    const user = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        fullName: "User To Delete",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    const jti = uuidv4();
    bearerToken = signJWT(
      {
        userId,
        email,
        platformRole: "NONE",
        jti,
      },
      "15m"
    );

    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userAgent: "deletion-tester",
      },
    });

    await db.devicePushToken.create({
      data: {
        userId,
        platform: "ios",
        pushToken: `ExponentPushToken[del-${Date.now()}]`,
      },
    });
  });

  afterAll(async () => {
    if (userId) {
      await db.auditLog.deleteMany({ where: { actorUserId: userId } });
      await db.devicePushToken.deleteMany({ where: { userId } });
      await db.userSession.deleteMany({ where: { userId } });
      await db.platformUser.deleteMany({ where: { id: userId } });
    }
  });

  it("DELETE /api/auth/account/delete: soft-deletes account, revokes all sessions, and deletes push tokens", async () => {
    // 1. Send account deletion request with Bearer token and password
    const deleteReq = new Request("http://localhost/api/auth/account/delete", {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${bearerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ password: "MobilePass123!" }),
    });

    const res = await deleteAccount(deleteReq);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);

    // 2. Verify user record in DB: marked inactive, email anonymized
    const userInDb = await db.platformUser.findUnique({
      where: { id: userId },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb?.isActive).toBe(false);
    expect(userInDb?.email).toContain("deleted_");

    // 3. Verify all sessions revoked
    const sessions = await db.userSession.findMany({
      where: { userId },
    });
    expect(sessions.every((s) => s.revokedAt !== null)).toBe(true);

    // 4. Verify push tokens deleted
    const pushTokensCount = await db.devicePushToken.count({
      where: { userId },
    });
    expect(pushTokensCount).toBe(0);

    // 5. Subsequent request with bearer token fails
    const probeReq = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${bearerToken}` },
    });
    const session = await getAuthSession(probeReq);
    expect(session).toBeNull();

    // 6. Login with original credentials fails
    const loginReq = new Request("http://localhost/api/auth/mobile/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginRes = await mobileLogin(loginReq);
    expect(loginRes.status).toBe(401);
  });
});
