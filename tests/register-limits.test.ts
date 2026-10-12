import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { db } from "../src/lib/db";
import { rateLimits } from "../src/lib/rate-limit";

describe("Registration Rate Limits", () => {
  let centerId: string;
  let codeBase: string;
  let code10Limit: string;
  let ownerId: string;

  beforeAll(async () => {
    const owner = await db.platformUser.create({
      data: { email: `reglim-owner-${Date.now()}@test.com`, passwordHash: "x", fullName: "Reg Owner" },
    });
    ownerId = owner.id;
    const center = await db.learningCenter.create({
      data: { name: "Limit Center", slug: `reglim-c-${Date.now()}`, ownerId, status: "ACTIVE" },
    });
    centerId = center.id;
    const membership = await db.centerMembership.create({
      data: { userId: ownerId, centerId, role: "DIRECTOR", status: "ACTIVE" }
    });

    const invite = await db.inviteCode.create({
      data: { centerId, code: `LIM10-${Date.now()}`, targetRole: "STUDENT", maxUses: 100, createdByMembershipId: membership.id },
    });
    code10Limit = invite.code;
    codeBase = `BASE-${Date.now()}`;
  });

  afterAll(async () => {
    await db.inviteCode.deleteMany({ where: { centerId } });
    await db.centerMembership.deleteMany({ where: { centerId } });
    await db.learningCenter.delete({ where: { id: centerId } });
    await db.platformUser.deleteMany({ where: { email: { contains: "reglim" } } });
  });

  beforeEach(() => {
    rateLimits.clear();
  });

  const mockReq = (body: unknown, ip: string = "1.1.1.1") =>
    new Request(`http://localhost/api/auth/register`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  it("Allows 30 registrations from same IP using ONE code with sufficient limit (classroom scenario)", async () => {
    const ip = "4.4.4.4";
    const results: { message?: string }[] = [];
    for (let i = 0; i < 30; i++) {
      const res = await registerPost(mockReq({ email: `reglim-samecode-${i}@test.com`, password: "password123", fullName: `Class ${i}`, inviteCode: code10Limit }, ip));
      results.push((await res.json()) as { message?: string });
    }
    const successes = results.filter((r) => r.message === "Registration successful. Please check your email to confirm.");
    expect(successes.length).toBe(30);
  }, 15000);

  it("Blocks single code brute-force from same IP after 10 failed attempts", async () => {
    const ip = "4.4.4.5";
    const responses: Response[] = [];
    for (let i = 0; i < 15; i++) {
      const res = await registerPost(mockReq({ email: `reglim-bad-${i}@test.com`, password: "password123", fullName: `Spam`, inviteCode: "INVALIDCODE999" }, ip));
      responses.push(res);
    }
    
    // First 10 should be 400 Invalid Invite
    const badRequests = responses.filter((r) => r.status === 400);
    // The rest (5) should be 429 Rate Limited
    const rateLimitedRequests = responses.filter((r) => r.status === 429);
    
    expect(badRequests.length).toBe(10);
    expect(rateLimitedRequests.length).toBe(5);
  });
});
