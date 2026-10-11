import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { GET as getCourses } from "../src/app/api/courses/route";
import { GET as getGrades } from "../src/app/api/grades/route";
import { POST as logoutRoute } from "../src/app/api/auth/logout/route";
import { DELETE as deleteSessionRoute } from "../src/app/api/auth/sessions/route";
import { POST as resetPasswordRoute } from "../src/app/api/auth/password/reset/route";
import { db } from "../src/lib/db";
import { signJWT, hashJti, hashPassword } from "../src/lib/auth";
import crypto from "crypto";

let currentToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: currentToken } : undefined),
    delete: () => {},
  }),
}));

describe("TRUST-3 Item 1: requireTenantAccess validates UserSession revocation & isActive on /api/courses and /api/grades", () => {
  let centerId: string;
  let userId: string;
  let userEmail: string;
  let membershipId: string;
  let jti1: string;
  let sessionId1: string;

  beforeAll(async () => {
    userEmail = `director-${Date.now()}@t3i1.com`;
    const user = await db.platformUser.create({
      data: {
        email: userEmail,
        fullName: "Director T3",
        passwordHash: await hashPassword("Password123!"),
        platformRole: "NONE",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    userId = user.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Center T3",
        slug: `c-t3-${Date.now()}`,
        status: "ACTIVE",
        ownerId: userId,
      },
    });
    centerId = center.id;

    const membership = await db.centerMembership.create({
      data: {
        userId,
        centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    membershipId = membership.id;

    await db.course.create({
      data: {
        title: "Test Course T3",
        centerId,
        createdByMembershipId: membershipId,
      },
    });
  });

  afterAll(async () => {
    await db.grade.deleteMany({ where: { centerId } });
    await db.course.deleteMany({ where: { centerId } });
    await db.centerMembership.deleteMany({ where: { centerId } });
    await db.learningCenter.deleteMany({ where: { id: centerId } });
    await db.userSession.deleteMany({ where: { userId } });
    await db.passwordResetToken.deleteMany({ where: { userId } });
    await db.platformUser.deleteMany({ where: { id: userId } });
  });

  beforeEach(async () => {
    jti1 = `jti-${Date.now()}-${Math.random()}`;
    const s1 = await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti1),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "Vitest Agent",
      },
    });
    sessionId1 = s1.id;
    currentToken = signJWT(
      {
        userId,
        email: userEmail,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: "DIRECTOR",
      },
      "7d",
      jti1
    );
  });

  const mockReq = (path: string, method = "GET") =>
    new Request(`http://localhost${path}`, { method });

  it("baseline: valid session returns 200 on /api/courses and /api/grades", async () => {
    const resCourses = await getCourses(mockReq("/api/courses"));
    expect(resCourses.status).toBe(200);

    const resGrades = await getGrades(mockReq("/api/grades"));
    expect(resGrades.status).toBe(200);
  });

  it("after logout: same JWT receives 401 on /api/courses and /api/grades", async () => {
    const logoutRes = await logoutRoute(mockReq("/api/auth/logout", "POST"));
    expect(logoutRes.status).toBe(200);

    // Using the same JWT token that was logged out
    const resCourses = await getCourses(mockReq("/api/courses"));
    expect(resCourses.status).toBe(401);

    const resGrades = await getGrades(mockReq("/api/grades"));
    expect(resGrades.status).toBe(401);
  });

  it("after single session revocation via DELETE /api/auth/sessions?id=...: revoked JWT receives 401", async () => {
    const delRes = await deleteSessionRoute(mockReq(`/api/auth/sessions?id=${sessionId1}`, "DELETE"));
    expect(delRes.status).toBe(200);

    const resCourses = await getCourses(mockReq("/api/courses"));
    expect(resCourses.status).toBe(401);

    const resGrades = await getGrades(mockReq("/api/grades"));
    expect(resGrades.status).toBe(401);
  });

  it("after logout-all (allButCurrent from another session): previous session receives 401", async () => {
    // Create a 2nd session
    const jti2 = `jti2-${Date.now()}`;
    await db.userSession.create({
      data: {
        userId,
        jtiHash: hashJti(jti2),
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
        ipAddress: "127.0.0.1",
        userAgent: "Vitest Agent 2",
      },
    });

    // Act as session 2 and revoke all but current
    currentToken = signJWT(
      { userId, email: userEmail, platformRole: "NONE", activeCenterId: centerId, activeCenterRole: "DIRECTOR" },
      "7d",
      jti2
    );
    const delAllRes = await deleteSessionRoute(mockReq("/api/auth/sessions?allButCurrent=true", "DELETE"));
    expect(delAllRes.status).toBe(200);

    // Switch back to session 1 JWT
    currentToken = signJWT(
      { userId, email: userEmail, platformRole: "NONE", activeCenterId: centerId, activeCenterRole: "DIRECTOR" },
      "7d",
      jti1
    );

    const resCourses = await getCourses(mockReq("/api/courses"));
    expect(resCourses.status).toBe(401);

    const resGrades = await getGrades(mockReq("/api/grades"));
    expect(resGrades.status).toBe(401);
  });

  it("after password reset: existing JWT session receives 401", async () => {
    const rawResetToken = `token-${Date.now()}`;
    const tokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    await db.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });

    const resetReq = new Request("http://localhost/api/auth/password/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: rawResetToken, newPassword: "NewStrongPassword123!" }),
    });

    const resetRes = await resetPasswordRoute(resetReq);
    expect(resetRes.status).toBe(200);

    // Existing session token now must be rejected with 401
    const resCourses = await getCourses(mockReq("/api/courses"));
    expect(resCourses.status).toBe(401);

    const resGrades = await getGrades(mockReq("/api/grades"));
    expect(resGrades.status).toBe(401);
  });

  it("when user account is deactivated (isActive=false): JWT receives 401", async () => {
    await db.platformUser.update({
      where: { id: userId },
      data: { isActive: false },
    });

    try {
      const resCourses = await getCourses(mockReq("/api/courses"));
      expect(resCourses.status).toBe(401);

      const resGrades = await getGrades(mockReq("/api/grades"));
      expect(resGrades.status).toBe(401);
    } finally {
      await db.platformUser.update({
        where: { id: userId },
        data: { isActive: true },
      });
    }
  });
});
