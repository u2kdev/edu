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

  const mockReq = (body: any, ip: string = "1.1.1.1") =>
    new Request(`http://localhost/api/auth/register`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  it("Allows 30 registrations from same IP using different codes (classroom scenario)", async () => {
    const ip = "4.4.4.4";
    const promises = [];
    
    // Create 30 different codes
    for (let i = 0; i < 30; i++) {
      await db.inviteCode.create({
        data: { centerId, code: `${codeBase}-${i}`, targetRole: "STUDENT", maxUses: 1, createdByMembershipId: await db.centerMembership.findFirst({where:{centerId}}).then(m=>m!.id) }
      });
      promises.push(
        registerPost(mockReq({ email: `reglim-diff-${i}@test.com`, password: "password123", fullName: `Class ${i}`, inviteCode: `${codeBase}-${i}` }, ip)).then(r => r.json())
      );
    }
    
    const results = await Promise.all(promises);
    const successes = results.filter(r => r.message === "Registration successful. Please check your email to confirm.");
    expect(successes.length).toBe(30);
  }, 15000);

  it("Blocks single code brute-force from same IP after 10 attempts", async () => {
    const ip = "4.4.4.5";
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        registerPost(mockReq({ email: `reglim-same-${i}@test.com`, password: "password123", fullName: `Spam`, inviteCode: code10Limit }, ip))
      );
    }
    await Promise.all(promises);

    const res11 = await registerPost(mockReq({ email: `reglim-same-11@test.com`, password: "password123", fullName: `Spam`, inviteCode: code10Limit }, ip));
    expect(res11.status).toBe(429);
    const data = await res11.json();
    expect(data.error.code).toBe("RATE_LIMITED");
    expect(data.error.message).toContain("Too many registration attempts for this code from this IP");
  });
});
