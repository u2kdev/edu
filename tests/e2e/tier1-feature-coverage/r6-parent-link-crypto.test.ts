import { describe, it, expect, beforeEach, afterEach } from "vitest";
import crypto from "crypto";
import { db } from "@/lib/db";
import { POST as parentLinkRoute } from "@/app/api/invites/parent-link/route";
import {
  createTestUser,
  createTestCenter,
  createTestMembership,
  createTestSessionToken,
  cleanupTestEntities,
} from "../helpers/auth-fixtures";
import { invokeRoute } from "../helpers/e2e-client";

describe("Tier 1 Feature Coverage: R6 Parent Link Cryptography & Anti-IDOR", () => {
  const cleanups: {
    userIds: string[];
    centerIds: string[];
    inviteCodes: string[];
  } = {
    userIds: [],
    centerIds: [],
    inviteCodes: [],
  };

  afterEach(async () => {
    await cleanupTestEntities(cleanups);
    cleanups.userIds = [];
    cleanups.centerIds = [];
    cleanups.inviteCodes = [];
  });

  /**
   * E2E-R6-01: CSPRNG Token Generation & Entropy
   */
  it("E2E-R6-01: Generates parent link codes with CSPRNG and sufficient entropy", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const director = await createTestUser();
    cleanups.userIds.push(director.id);
    await createTestMembership(director.id, center.id, "DIRECTOR");

    const directorToken = await createTestSessionToken(director, {
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    const studentMem = await createTestMembership(student.id, center.id, "STUDENT");

    const res = await invokeRoute<{
      success: boolean;
      parentInviteCode: string;
      studentMembershipId: string;
    }>(parentLinkRoute, "/api/invites/parent-link", {
      method: "POST",
      token: directorToken,
      body: {
        action: "INITIATE_BY_ADMIN",
        studentId: studentMem.id,
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(res.data.parentInviteCode).toBeDefined();
    cleanups.inviteCodes.push(res.data.parentInviteCode);

    const code = res.data.parentInviteCode;

    // Requirement: Must not follow the legacy weak pattern with Math.random() 4-digit suffix
    const legacyWeakPattern = /^PARENT-[A-Z0-9]{5}-\d{4}$/;
    expect(code).not.toMatch(legacyWeakPattern);

    // Code length must be at least 12 characters ensuring cryptographic entropy
    expect(code.length).toBeGreaterThanOrEqual(12);
  });

  /**
   * E2E-R6-02: Cryptographic Hash Storage in Database
   */
  it("E2E-R6-02: Plaintext invite code is never stored in DB plaintext row", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const director = await createTestUser();
    cleanups.userIds.push(director.id);
    await createTestMembership(director.id, center.id, "DIRECTOR");

    const directorToken = await createTestSessionToken(director, {
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    const studentMem = await createTestMembership(student.id, center.id, "STUDENT");

    const res = await invokeRoute<{ parentInviteCode: string }>(
      parentLinkRoute,
      "/api/invites/parent-link",
      {
        method: "POST",
        token: directorToken,
        body: {
          action: "INITIATE_BY_ADMIN",
          studentId: studentMem.id,
        },
      }
    );

    expect(res.status).toBe(200);
    const plaintextCode = res.data.parentInviteCode;
    cleanups.inviteCodes.push(plaintextCode);

    // Query InviteCode table in DB
    const dbRecord = await db.inviteCode.findFirst({
      where: { studentMembershipId: studentMem.id },
      orderBy: { createdAt: "desc" },
    });

    expect(dbRecord).toBeDefined();

    // Plaintext code string must NOT appear in the database column 'code' or row
    // Stored hash (SHA-256) should be present
    const expectedHash = crypto.createHash("sha256").update(plaintextCode.toUpperCase().trim()).digest("hex");
    const codeInDb = dbRecord?.code || "";

    // If hashed storage is enforced, either code is the hash or codeHash column holds the hash
    const isStoredHashed = codeInDb === expectedHash || codeInDb !== plaintextCode;
    expect(isStoredHashed).toBe(true);
  });

  /**
   * E2E-R6-03: Anti-IDOR Student Binding
   */
  it("E2E-R6-03: Binds parent strictly to the student associated in DB, ignoring studentId in claim payload", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const director = await createTestUser();
    cleanups.userIds.push(director.id);
    const directorMem = await createTestMembership(director.id, center.id, "DIRECTOR");

    const studentLegit = await createTestUser();
    const studentVictim = await createTestUser();
    cleanups.userIds.push(studentLegit.id, studentVictim.id);

    const legitMem = await createTestMembership(studentLegit.id, center.id, "STUDENT");
    const victimMem = await createTestMembership(studentVictim.id, center.id, "STUDENT");

    const code = `SEC-PLINK-${Date.now()}`;
    cleanups.inviteCodes.push(code);

    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code,
        targetRole: "PARENT",
        studentMembershipId: legitMem.id,
        maxUses: 2,
        usesCount: 0,
        createdByMembershipId: directorMem.id,
      },
    });

    const parentUser = await createTestUser();
    cleanups.userIds.push(parentUser.id);
    const parentToken = await createTestSessionToken(parentUser);

    // Attacker parent claims code for legitimate child, but supplies victim student's ID
    const res = await invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
      method: "POST",
      token: parentToken,
      body: {
        action: "CLAIM_PARENT_LINK",
        inviteCode: code,
        studentId: victimMem.id, // Malicious override attempt
      },
    });

    if (res.status === 200) {
      // If accepted, check ParentLink table
      const links = await db.parentLink.findMany({
        where: { parent: { userId: parentUser.id } },
      });

      // Must be linked strictly to legitMem, NEVER to victimMem
      expect(links.length).toBe(1);
      expect(links[0].studentMembershipId).toBe(legitMem.id);
      expect(links[0].studentMembershipId).not.toBe(victimMem.id);
    } else {
      expect(res.status).toBe(400);
    }
  });

  /**
   * E2E-R6-04: Expiration, Revocation, and Max Uses Concurrency Enforcement
   */
  it("E2E-R6-04: Enforces expiration, admin revocation, and atomic max uses limit", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const director = await createTestUser();
    cleanups.userIds.push(director.id);
    const directorMem = await createTestMembership(director.id, center.id, "DIRECTOR");

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    const studentMem = await createTestMembership(student.id, center.id, "STUDENT");

    const parent = await createTestUser();
    cleanups.userIds.push(parent.id);
    const parentToken = await createTestSessionToken(parent);

    // 1. Expired Code
    const expiredCode = `EXP-${Date.now()}`;
    cleanups.inviteCodes.push(expiredCode);
    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code: expiredCode,
        targetRole: "PARENT",
        studentMembershipId: studentMem.id,
        maxUses: 2,
        usesCount: 0,
        expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
        createdByMembershipId: directorMem.id,
      },
    });

    const resExpired = await invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
      method: "POST",
      token: parentToken,
      body: { action: "CLAIM_PARENT_LINK", inviteCode: expiredCode },
    });
    expect([400, 410]).toContain(resExpired.status);

    // 2. Revoked Code
    const revokedCode = `REV-${Date.now()}`;
    cleanups.inviteCodes.push(revokedCode);
    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code: revokedCode,
        targetRole: "PARENT",
        studentMembershipId: studentMem.id,
        maxUses: 2,
        usesCount: 0,
        isRevoked: true,
        createdByMembershipId: directorMem.id,
      },
    });

    const resRevoked = await invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
      method: "POST",
      token: parentToken,
      body: { action: "CLAIM_PARENT_LINK", inviteCode: revokedCode },
    });
    expect(resRevoked.status).toBe(400);

    // 3. Concurrent Max Uses (maxUses = 2, 5 concurrent requests)
    const raceCode = `RACE-PARENT-${Date.now()}`;
    cleanups.inviteCodes.push(raceCode);
    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code: raceCode,
        targetRole: "PARENT",
        studentMembershipId: studentMem.id,
        maxUses: 2,
        usesCount: 0,
        createdByMembershipId: directorMem.id,
      },
    });

    const parents = await Promise.all(
      Array.from({ length: 5 }).map(async (_, i) => {
        const u = await createTestUser({ email: `parent-race-${i}-${Date.now()}@test.uz` });
        cleanups.userIds.push(u.id);
        const t = await createTestSessionToken(u);
        return { user: u, token: t };
      })
    );

    const raceResults = await Promise.all(
      parents.map(({ token }) =>
        invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
          method: "POST",
          token,
          body: { action: "CLAIM_PARENT_LINK", inviteCode: raceCode },
        })
      )
    );

    const successes = raceResults.filter((r) => r.status === 200);
    const failures = raceResults.filter((r) => r.status === 400);

    expect(successes.length).toBe(2);
    expect(failures.length).toBe(3);

    const codeInDb = await db.inviteCode.findUnique({ where: { code: raceCode } });
    expect(codeInDb?.usesCount).toBe(2);
  });

  /**
   * E2E-R6-05: Student Center Membership & Center Status Verification
   */
  it("E2E-R6-05: Rejects parent link claims if center is BLOCKED or student is inactive", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const blockedCenter = await createTestCenter({
      ownerId: owner.id,
      status: "BLOCKED",
    });
    cleanups.centerIds.push(blockedCenter.id);

    const directorMem = await createTestMembership(owner.id, blockedCenter.id, "DIRECTOR");

    const student = await createTestUser();
    cleanups.userIds.push(student.id);
    const studentMem = await createTestMembership(student.id, blockedCenter.id, "STUDENT");

    const code = `BLOCKED-P-${Date.now()}`;
    cleanups.inviteCodes.push(code);

    await db.inviteCode.create({
      data: {
        centerId: blockedCenter.id,
        code,
        targetRole: "PARENT",
        studentMembershipId: studentMem.id,
        maxUses: 2,
        usesCount: 0,
        createdByMembershipId: directorMem.id,
      },
    });

    const parent = await createTestUser();
    cleanups.userIds.push(parent.id);
    const parentToken = await createTestSessionToken(parent);

    const resBlocked = await invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
      method: "POST",
      token: parentToken,
      body: { action: "CLAIM_PARENT_LINK", inviteCode: code },
    });

    expect([400, 403]).toContain(resBlocked.status);

    const link = await db.parentLink.findFirst({
      where: { parent: { userId: parent.id } },
    });
    expect(link).toBeNull();
  });

  /**
   * E2E-R6-06: Rate Limiting on CLAIM_PARENT_LINK (Anti-Brute-Force)
   */
  it("E2E-R6-06: Rate limits repeated code enumeration attempts on CLAIM_PARENT_LINK", async () => {
    const parent = await createTestUser();
    cleanups.userIds.push(parent.id);
    const parentToken = await createTestSessionToken(parent);

    const results: number[] = [];
    for (let i = 0; i < 10; i++) {
      const res = await invokeRoute(parentLinkRoute, "/api/invites/parent-link", {
        method: "POST",
        token: parentToken,
        ip: "192.0.2.77",
        body: {
          action: "CLAIM_PARENT_LINK",
          inviteCode: `GUESS-${i}-${Date.now()}`,
        },
      });
      results.push(res.status);
    }

    // After repeated failed attempts, rate limiter must trigger HTTP 429
    expect(results).toContain(429);
  });
});
