import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { POST as mobileRefresh } from "../src/app/api/auth/mobile/refresh/route";
import { POST as logout } from "../src/app/api/auth/logout/route";
import { getAuthSession, hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";

describe("Mobile Refresh Tokens & Device Rotation", () => {
  let userId: string = "";
  let centerId: string = "";
  let membershipId: string = "";
  const email = `mobile-refresh-${Date.now()}@test.com`;

  beforeAll(async () => {
    const user = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Refresh Tester",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Refresh Academy",
        slug: `refresh-test-${Date.now()}`,
        status: "ACTIVE",
        ownerId: userId,
      },
    });
    centerId = center.id;

    const membership = await db.centerMembership.create({
      data: {
        userId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    membershipId = membership.id;
  });

  afterAll(async () => {
    if (userId) {
      await db.auditLog.deleteMany({ where: { actorUserId: userId } });
      await db.userSession.deleteMany({ where: { userId } });
    }
    if (membershipId) {
      await db.centerMembership.deleteMany({ where: { id: membershipId } });
    }
    if (centerId) {
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (userId) {
      await db.platformUser.deleteMany({ where: { id: userId } });
    }
  });

  const mockReq = (url: string, body: unknown, headers: Record<string, string> = {}) => {
    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
        ...headers,
      },
      body: JSON.stringify(body),
    });
  };

  it("login issues both access token and refresh token with device binding", async () => {
    const res = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceName: "Samsung Galaxy S20",
        deviceId: "device-uuid-1234",
        platform: "android",
      })
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.token).toBeDefined();
    expect(data.refreshToken).toBeDefined();
    expect(typeof data.token).toBe("string");
    expect(typeof data.refreshToken).toBe("string");

    // Verify session in DB
    const session = await db.userSession.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    expect(session).not.toBeNull();
    expect(session?.deviceId).toBe("device-uuid-1234");
    expect(session?.refreshTokenHash).not.toBeNull();
  });

  it("refresh route rotates refresh token and issues new access token", async () => {
    // 1. Initial Login
    const loginRes = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceId: "rot-dev-1",
      })
    );
    const loginData = await loginRes.json();
    const initialAccessToken = loginData.token;
    const initialRefreshToken = loginData.refreshToken;

    // 2. Perform Refresh
    const refreshRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: initialRefreshToken,
        deviceId: "rot-dev-1",
      })
    );

    expect(refreshRes.status).toBe(200);
    const refreshData = await refreshRes.json();
    expect(refreshData.token).toBeDefined();
    expect(refreshData.refreshToken).toBeDefined();
    expect(refreshData.token).not.toBe(initialAccessToken);
    expect(refreshData.refreshToken).not.toBe(initialRefreshToken);

    // 3. New access token works
    const authReq = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${refreshData.token}` },
    });
    const authSession = await getAuthSession(authReq);
    expect(authSession).not.toBeNull();
    expect(authSession?.user.id).toBe(userId);

    // 4. Old refresh token is invalidated upon rotation
    const oldRefreshRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: initialRefreshToken,
        deviceId: "rot-dev-1",
      })
    );
    expect(oldRefreshRes.status).toBe(401);
  });

  it("rejects refresh attempt when deviceId mismatches", async () => {
    const loginRes = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceId: "device-legit",
      })
    );
    const loginData = await loginRes.json();

    const refreshRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: loginData.refreshToken,
        deviceId: "device-attacker",
      })
    );

    expect(refreshRes.status).toBe(401);
    const errData = await refreshRes.json();
    expect(errData.error.code).toBe("DEVICE_MISMATCH");
  });

  it("global logout (all=true) revokes all user sessions and invalidates mobile access and refresh tokens", async () => {
    // 1. Login on mobile
    const loginRes = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceId: "device-to-revoke",
      })
    );
    const loginData = await loginRes.json();
    const mobileAccessToken = loginData.token;
    const mobileRefreshToken = loginData.refreshToken;

    // Verify token works before logout
    const preAuthReq = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${mobileAccessToken}` },
    });
    expect(await getAuthSession(preAuthReq)).not.toBeNull();

    // 2. Perform global logout (e.g. from web or settings with all=true)
    const logoutReq = new Request("http://localhost/api/auth/logout?all=true", {
      method: "POST",
      headers: {
        authorization: `Bearer ${mobileAccessToken}`,
      },
    });
    const logoutRes = await logout(logoutReq);
    expect(logoutRes.status).toBe(200);

    // 3. Mobile access token is immediately rejected
    const postAuthReq = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${mobileAccessToken}` },
    });
    expect(await getAuthSession(postAuthReq)).toBeNull();

    // 4. Mobile refresh token is rejected as session revoked
    const refreshRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: mobileRefreshToken,
        deviceId: "device-to-revoke",
      })
    );
    expect(refreshRes.status).toBe(401);
  });
});
