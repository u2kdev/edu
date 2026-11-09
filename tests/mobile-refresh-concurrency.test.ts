import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as mobileLogin } from "../src/app/api/auth/mobile/login/route";
import { POST as mobileRefresh } from "../src/app/api/auth/mobile/refresh/route";
import { getAuthSession, hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";

describe("Mobile Refresh Token Atomic Rotation & Reuse Protection", () => {
  let userId: string = "";
  let centerId: string = "";
  let membershipId: string = "";
  const email = `concurrency-${Date.now()}@test.com`;

  beforeAll(async () => {
    const user = await db.platformUser.create({
      data: {
        email,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Concurrency Tester",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Concurrency Center",
        slug: `concurrency-${Date.now()}`,
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

  const mockReq = (url: string, body: unknown, ipSuffix: number) => {
    return new Request(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `127.0.4.${ipSuffix}`,
      },
      body: JSON.stringify(body),
    });
  };

  it("atomic rotation with Promise.all: exactly one succeeds, the other returns 401 without revoking session", async () => {
    // 1. Login
    const loginRes = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceId: "atomic-device-1",
      }, 1)
    );
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    const originalRefreshToken = loginData.refreshToken;

    // 2. Concurrently fire two refresh requests with the SAME token
    const [res1, res2] = await Promise.all([
      mobileRefresh(
        mockReq("http://localhost/api/auth/mobile/refresh", {
          refreshToken: originalRefreshToken,
          deviceId: "atomic-device-1",
        }, 2)
      ),
      mobileRefresh(
        mockReq("http://localhost/api/auth/mobile/refresh", {
          refreshToken: originalRefreshToken,
          deviceId: "atomic-device-1",
        }, 3)
      ),
    ]);

    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toEqual([200, 401]);

    const successRes = res1.status === 200 ? res1 : res2;
    const failedRes = res1.status === 401 ? res1 : res2;

    const successData = await successRes.json();
    expect(successData.token).toBeDefined();
    expect(successData.refreshToken).toBeDefined();

    const failedData = await failedRes.json();
    expect(failedData.error).toBeDefined();

    // 3. Verify session was NOT revoked: the successful access token still works
    const checkAuthReq = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${successData.token}` },
    });
    const session = await getAuthSession(checkAuthReq);
    expect(session).not.toBeNull();
    expect(session?.user.id).toBe(userId);
  });

  it("subsequent reuse of already rotated refresh token revokes the entire session", async () => {
    // 1. Login
    const loginRes = await mobileLogin(
      mockReq("http://localhost/api/auth/mobile/login", {
        email,
        password: "MobilePass123!",
        deviceId: "reuse-device-1",
      }, 10)
    );
    expect(loginRes.status).toBe(200);
    const loginData = await loginRes.json();
    const tokenV1 = loginData.refreshToken;

    // 2. Rotate once: V1 -> V2
    const rotateRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: tokenV1,
        deviceId: "reuse-device-1",
      }, 11)
    );
    expect(rotateRes.status).toBe(200);
    const rotateData = await rotateRes.json();
    const tokenV2 = rotateData.refreshToken;
    const accessTokenV2 = rotateData.token;

    // Token V2 access token works
    const checkV2 = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${accessTokenV2}` },
    });
    expect(await getAuthSession(checkV2)).not.toBeNull();

    // Wait for race window to pass to simulate subsequent reuse attack
    await new Promise((r) => setTimeout(r, 1200));

    // 3. Attempt to reuse rotated tokenV1 -> should be rejected and revoke the session!
    const reuseRes = await mobileRefresh(
      mockReq("http://localhost/api/auth/mobile/refresh", {
        refreshToken: tokenV1,
        deviceId: "reuse-device-1",
      }, 12)
    );
    expect(reuseRes.status).toBe(401);
    const reuseData = await reuseRes.json();
    expect(reuseData.error.code).toBe("SESSION_REVOKED");

    // 4. Session must now be revoked: even accessTokenV2 and tokenV2 no longer work!
    const checkRevoked = new Request("http://localhost/api/students/me", {
      headers: { authorization: `Bearer ${accessTokenV2}` },
    });
    expect(await getAuthSession(checkRevoked)).toBeNull();
  });
});
