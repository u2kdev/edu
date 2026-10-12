import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { db } from "../src/lib/db";
import { clearRateLimit } from "../src/lib/rate-limit";

describe("PendingInvite Limits (POST /api/auth/register)", () => {
  let centerId: string;
  let code1Limit: string;
  let ownerId: string;
  let testEmail = `limit-target-${Date.now()}@test.com`;

  beforeAll(async () => {
    const owner = await db.platformUser.create({
      data: { email: `limitowner-${Date.now()}@test.com`, passwordHash: "x", fullName: "Reg Owner" },
    });
    ownerId = owner.id;
    const center = await db.learningCenter.create({
      data: { name: "Limit Center", slug: `limit-c-${Date.now()}`, ownerId, status: "ACTIVE" },
    });
    centerId = center.id;
    const membership = await db.centerMembership.create({
      data: { userId: ownerId, centerId, role: "DIRECTOR", status: "ACTIVE" }
    });

    const invite = await db.inviteCode.create({
      data: { centerId, code: `LIM-${Date.now()}`, targetRole: "STUDENT", maxUses: 100, createdByMembershipId: membership.id },
    });
    code1Limit = invite.code;
    
    // Create the target user (existing user)
    await db.platformUser.create({
      data: { email: testEmail, passwordHash: "x", fullName: "Test Limit" }
    });
  });

  afterAll(async () => {
    await db.pendingInvite.deleteMany({ where: { email: testEmail } });
    await db.inviteCode.deleteMany({ where: { centerId } });
    await db.centerMembership.deleteMany({ where: { centerId } });
    await db.learningCenter.delete({ where: { id: centerId } });
    await db.platformUser.deleteMany({ where: { email: { in: [testEmail, `limitowner-${ownerId}@test.com`] } } });
  });

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany();
  });

  const mockReq = (body: unknown, ip: string = "1.1.1.1") =>
    new Request(`http://localhost/api/auth/register`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  it("IP Limit: 21st registration from same IP in 1 hour returns 429", async () => {
    const spamIp = "1.2.3.4";
    // Send 20 requests sequentially, bypassing _register and center-level limit so we test IP limit
    for (let i = 0; i < 20; i++) {
      await clearRateLimit(spamIp + "_register");
      await clearRateLimit(code1Limit + "_register");
      await clearRateLimit(spamIp + "_" + code1Limit + "_register");
      await clearRateLimit(spamIp + "_" + centerId + "_pending");
      await registerPost(mockReq({ email: testEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp));
    }

    await clearRateLimit(spamIp + "_register");
    await clearRateLimit(code1Limit + "_register");
    await clearRateLimit(spamIp + "_" + code1Limit + "_register");
    await clearRateLimit(spamIp + "_" + centerId + "_pending");
    const res21 = await registerPost(mockReq({ email: testEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp));
    expect(res21.status).toBe(429);
    const data = await res21.json();
    expect(data.error.code).toBe("RATE_LIMITED");
  });

  it("Email/Center Limit: 11th registration for same center returns 429", async () => {
    const spamIp = "5.5.5.5";
    for (let i = 0; i < 10; i++) {
      await clearRateLimit(spamIp + "_register");
      await clearRateLimit(code1Limit + "_register");
      await clearRateLimit(spamIp + "_" + code1Limit + "_register");
      await registerPost(mockReq({ email: testEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp));
    }

    await clearRateLimit(spamIp + "_register");
    await clearRateLimit(code1Limit + "_register");
    await clearRateLimit(spamIp + "_" + code1Limit + "_register");
    const res11 = await registerPost(mockReq({ email: testEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp));
    expect(res11.status).toBe(429);
    const data11 = await res11.json();
    expect(data11.error.code).toBe("RATE_LIMITED");
  });
});
