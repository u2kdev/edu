import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
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
    const membership = await db.centerMembership.create({
      data: { userId: ownerId, centerId, role: "DIRECTOR", status: "ACTIVE" }
    });

    // Create a code with limit 1
    const invite = await db.inviteCode.create({
      data: {
        centerId,
        code: `RACE-${Date.now()}`,
        targetRole: "STUDENT",
        maxUses: 1,
        createdByMembershipId: membership.id,
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
        createdByMembershipId: membership.id,
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
    await db.platformUser.deleteMany({ where: { email: { startsWith: "exist-" } } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "dir-" } } });
    await db.platformUser.deleteMany({ where: { email: { startsWith: "new-" } } });
  });

  const mockReq = (body: any, ip: string = "1.1.1.1") =>
    new Request(`http://localhost/api/auth/register`, {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    });

  it("Zod rejects bad data", async () => {
    const res = await registerPost(mockReq({ email: "not-an-email", password: "123", fullName: "A", inviteCode: "12" }));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.message).toBe("Invalid data");
  });

  it("Invalid, expired, and exhausted codes return the SAME generic response", async () => {
    // 1. Invalid
    const res1 = await registerPost(mockReq({ email: "invalid-1@test.com", password: "password123", fullName: "Test", inviteCode: "NONEXISTENT" }));
    const data1 = await res1.json();

    // 2. Expired
    const res2 = await registerPost(mockReq({ email: "invalid-2@test.com", password: "password123", fullName: "Test", inviteCode: expiredCode }));
    const data2 = await res2.json();

    expect(res1.status).toBe(400);
    expect(data1.error.message).toBe("Invalid, expired, or exhausted invite code");
    
    expect(res2.status).toBe(400);
    expect(data2.error.message).toBe("Invalid, expired, or exhausted invite code");
  });

  it("Promise.all on code with limit 1 results in 5 pending invites (usesCount is not consumed yet)", async () => {
    const promises = [];
    const raceIp = "1.1.1.2";
    for (let i = 0; i < 5; i++) {
      promises.push(
        registerPost(mockReq({ email: `racer-${i}@test.com`, password: "password123", fullName: `Racer ${i}`, inviteCode: code1Limit }, raceIp)).then(r => r.json())
      );
    }

    const results = await Promise.all(promises);
    
    const successes = results.filter((r: any) => r.message === "Registration successful. Please check your email to confirm.");

    expect(successes.length).toBe(5); // all 5 create pending invites

    const check = await db.inviteCode.findUnique({ where: { code: code1Limit } });
    expect(check?.usesCount).toBe(0); // usesCount is not incremented at registration!
  });

  it("IP Limit: 21st registration from same IP in 1 hour returns 429", async () => {
    const spamIp = "1.2.3.4";
    // Send 20 requests
    const promises = [];
    for (let i = 0; i < 20; i++) {
      promises.push(
        registerPost(mockReq({ email: `spam-${i}@test.com`, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp))
      );
    }
    await Promise.all(promises);

    const res21 = await registerPost(mockReq({ email: `spam-21@test.com`, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, spamIp));
    expect(res21.status).toBe(429);
    const data = await res21.json();
    expect(data.error.message).toBe("Too many pending invites from this IP");
  });

  it("Email/Center Limit: 11th registration for same email and center returns 429", async () => {
    const spamEmail = "limit@test.com";
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        registerPost(mockReq({ email: spamEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, `2.2.2.${i}`))
      );
    }
    await Promise.all(promises);

    const res11 = await registerPost(mockReq({ email: spamEmail, password: "password123", fullName: `Spam`, inviteCode: code1Limit }, "2.2.2.99"));
    expect(res11.status).toBe(429);
    const data = await res11.json();
    expect(data.error.message).toBe("Too many pending invites for this center");
  });

  it("Existing email gets same response, no membership added, receives login email", async () => {
    const existingEmail = `exist-${Date.now()}@test.com`;
    // create user beforehand
    const user = await db.platformUser.create({
      data: { email: existingEmail, passwordHash: "x", fullName: "Exist" }
    });

    const membershipOwner = await db.centerMembership.findFirst({ where: { centerId } });

    const invite = await db.inviteCode.create({
      data: { centerId, code: `EX-${Date.now()}`, targetRole: "STUDENT", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });

    const res = await registerPost(mockReq({ email: existingEmail, password: "password123", fullName: "Exist", inviteCode: invite.code }, "1.1.1.3"));
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.message).toBe("Registration successful. Please check your email to confirm.");

    // Check membership not added
    const mems = await db.centerMembership.findMany({ where: { userId: user.id } });
    expect(mems.length).toBe(0);
  });

  it("Cannot register with an invite code for DIRECTOR or platform role", async () => {
    const membershipOwner = await db.centerMembership.findFirst({ where: { centerId } });
    const invite = await db.inviteCode.create({
      data: { centerId, code: `DIR-${Date.now()}`, targetRole: "DIRECTOR", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });
    const res = await registerPost(mockReq({ email: `dir-${Date.now()}@test.com`, password: "password123", fullName: "Dir", inviteCode: invite.code }, "1.1.1.4"));
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error.message).toBe("Invalid, expired, or exhausted invite code");
  });

  it("New user gets membership based on invite and audit log is written", async () => {
    const membershipOwner = await db.centerMembership.findFirst({ where: { centerId } });
    const invite = await db.inviteCode.create({
      data: { centerId, code: `NEW-${Date.now()}`, targetRole: "TEACHER", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });

    const newEmail = `new-${Date.now()}@test.com`;
    const res = await registerPost(mockReq({ email: newEmail, password: "password123", fullName: "New User", inviteCode: invite.code }, "1.1.1.5"));
    expect(res.status).toBe(200);

    const user = await db.platformUser.findUnique({ where: { email: newEmail }, include: { memberships: true } });
    expect(user).not.toBeNull();
    expect(user!.memberships.length).toBe(1);
    expect(user!.memberships[0].centerId).toBe(centerId);
    expect(user!.memberships[0].role).toBe("TEACHER");

    const audit = await db.auditLog.findFirst({
      where: { actorUserId: user!.id, action: "REGISTERED_VIA_INVITE" }
    });
    expect(audit).not.toBeNull();
    expect(audit!.centerId).toBe(centerId);
  });

  it("Dev email driver logs in development and does not log in production", async () => {
    const membershipOwner = await db.centerMembership.findFirst({ where: { centerId } });
    const inviteDev = await db.inviteCode.create({
      data: { centerId, code: `DEV-${Date.now()}`, targetRole: "STUDENT", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });
    const inviteProd = await db.inviteCode.create({
      data: { centerId, code: `PROD-${Date.now()}`, targetRole: "STUDENT", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });

    const consoleSpy = vi.spyOn(console, "log");

    // 1. Test development mode (default in vitest)
    const resDev = await registerPost(mockReq({ email: `dev-${Date.now()}@test.com`, password: "password123", fullName: "Dev", inviteCode: inviteDev.code }, "1.1.1.6"));
    expect(resDev.status).toBe(200);
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("=== DEV EMAIL DRIVER ==="));

    consoleSpy.mockClear();

    // 2. Test production mode
    vi.stubEnv("NODE_ENV", "production");
    const resProd = await registerPost(mockReq({ email: `prod-${Date.now()}@test.com`, password: "password123", fullName: "Prod", inviteCode: inviteProd.code }, "1.1.1.6"));
    expect(resProd.status).toBe(200);
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("=== DEV EMAIL DRIVER ==="));

    vi.unstubAllEnvs();
    consoleSpy.mockRestore();
  });

  it("Failing email driver does not change response and logs to audit", async () => {
    const membershipOwner = await db.centerMembership.findFirst({ where: { centerId } });
    const invite = await db.inviteCode.create({
      data: { centerId, code: `FAIL-${Date.now()}`, targetRole: "STUDENT", maxUses: 1, createdByMembershipId: membershipOwner!.id }
    });

    vi.stubEnv("TEST_EMAIL_FAIL", "true");
    const targetEmail = `fail-${Date.now()}@test.com`;

    // First register target
    await db.platformUser.create({
      data: { email: targetEmail, passwordHash: "hash", fullName: "Fail" }
    });

    const res = await registerPost(mockReq({ email: targetEmail, password: "password123", fullName: "Fail", inviteCode: invite.code }, "1.1.1.7"));
    expect(res.status).toBe(200);

    // Fire and forget, wait a tick
    await new Promise(r => setTimeout(r, 50));

    const audit = await db.auditLog.findFirst({
      where: { action: "EMAIL_FAILED" },
      orderBy: { createdAt: "desc" }
    });
    
    expect(audit).not.toBeNull();
    expect(audit!.detailsJson).toContain("Simulated email driver failure");

    vi.unstubAllEnvs();
  });
});
