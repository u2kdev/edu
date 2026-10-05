import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { db } from "../src/lib/db";

describe("Registration by Invite (POST /api/auth/register)", () => {
  let centerId: string;
  let code1Limit: string;
  let ownerId: string;
  let expiredCode: string;

  beforeAll(async () => {
    const owner = await db.platformUser.create({
      data: { email: `regowner-${Date.now()}@test.com`, passwordHash: "x", fullName: "Reg Owner" },
    });
    ownerId = owner.id;
    const center = await db.learningCenter.create({
      data: { name: "Reg Center", slug: `reg-c-${Date.now()}`, ownerId, status: "ACTIVE" },
    });
    centerId = center.id;

    // Create a code with limit 1
    const invite = await db.inviteCode.create({
      data: {
        centerId,
        code: `RACE-${Date.now()}`,
        targetRole: "STUDENT",
        maxUses: 1,
        createdByMembershipId: ownerId,
      },
    });
    code1Limit = invite.code;

    // Expired code
    const expired = await db.inviteCode.create({
      data: {
        centerId,
        code: `EXP-${Date.now()}`,
        targetRole: "STUDENT",
        maxUses: 10,
        expiresAt: new Date(Date.now() - 10000),
        createdByMembershipId: ownerId,
      },
    });
    expiredCode = expired.code;
  });

  afterAll(async () => {
    await db.inviteCode.deleteMany({ where: { centerId } });
    await db.centerMembership.deleteMany({ where: { centerId } });
    await db.learningCenter.delete({ where: { id: centerId } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "regowner-" } } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "racer-" } } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "invalid-" } } });
  });

  const mockReq = (body: any) =>
    new Request(`http://localhost/api/auth/register`, {
      method: "POST",
      headers: { "x-forwarded-for": "1.1.1.1" },
      body: JSON.stringify(body),
    });

  it("Invalid, expired, and exhausted codes return the SAME generic response", async () => {
    // 1. Invalid
    const res1 = await registerPost(mockReq({ email: "invalid-1@test.com", password: "password123", fullName: "Test", inviteCode: "NONEXISTENT" }));
    const data1 = await res1.json();

    // 2. Expired
    const res2 = await registerPost(mockReq({ email: "invalid-2@test.com", password: "password123", fullName: "Test", inviteCode: expiredCode }));
    const data2 = await res2.json();

    expect(res1.status).toBe(400);
    expect(data1.error).toBe("Invalid, expired, or exhausted invite code");
    
    expect(res2.status).toBe(400);
    expect(data2.error).toBe("Invalid, expired, or exhausted invite code");
  });

  it("Promise.all on code with limit 1 results in exactly 1 success", async () => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(
        registerPost(mockReq({ email: `racer-${i}@test.com`, password: "password123", fullName: `Racer ${i}`, inviteCode: code1Limit })).then(r => r.json())
      );
    }

    const results = await Promise.all(promises);
    
    const successes = results.filter(r => r.success === true);
    const errors = results.filter(r => r.error === "Invalid, expired, or exhausted invite code");

    expect(successes.length).toBe(1);
    expect(errors.length).toBe(4);

    // Verify it was marked as used 1 time in DB
    const check = await db.inviteCode.findUnique({ where: { code: code1Limit } });
    expect(check?.uses).toBe(1);
  });
});
