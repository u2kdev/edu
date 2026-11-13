import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { POST as generateInviteRoute } from "@/app/api/invites/generate/route";
import { POST as acceptInviteRoute } from "@/app/api/invites/accept/route";
import { POST as staffPostRoute, PATCH as staffPatchRoute } from "@/app/api/tenant/staff/route";
import {
  createTestUser,
  createTestCenter,
  createTestMembership,
  createTestSessionToken,
  cleanupTestEntities,
} from "../helpers/auth-fixtures";
import { invokeRoute } from "../helpers/e2e-client";

describe("Tier 1 Feature Coverage: R3 Unified Role Matrix & Invites Concurrency", () => {
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
   * TC-R3-01: Center Admin Cannot Generate Invites for Director, Center Admin, Accountant, or Platform Roles
   */
  it("TC-R3-01: CENTER_ADMIN is forbidden from generating invites for DIRECTOR, CENTER_ADMIN, ACCOUNTANT, or platform roles", async () => {
    const centerOwner = await createTestUser();
    cleanups.userIds.push(centerOwner.id);

    const center = await createTestCenter({ ownerId: centerOwner.id });
    cleanups.centerIds.push(center.id);

    const adminUser = await createTestUser();
    cleanups.userIds.push(adminUser.id);
    await createTestMembership(adminUser.id, center.id, "CENTER_ADMIN");

    const adminToken = await createTestSessionToken(adminUser, {
      activeCenterId: center.id,
      activeCenterRole: "CENTER_ADMIN",
    });

    const forbiddenRoles = ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "SUPERADMIN", "PLATFORM_ADMIN"];

    for (const targetRole of forbiddenRoles) {
      const res = await invokeRoute(generateInviteRoute, "/api/invites/generate", {
        method: "POST",
        token: adminToken,
        body: { targetRole },
      });

      expect(res.status).toBe(403);
    }

    // Allowed role check: TEACHER
    const allowedRes = await invokeRoute<{ success: boolean; invite: { code: string; targetRole: string } }>(
      generateInviteRoute,
      "/api/invites/generate",
      {
        method: "POST",
        token: adminToken,
        body: { targetRole: "TEACHER" },
      }
    );

    expect(allowedRes.status).toBe(200);
    expect(allowedRes.data.success).toBe(true);
    expect(allowedRes.data.invite.targetRole).toBe("TEACHER");
    cleanups.inviteCodes.push(allowedRes.data.invite.code);
  });

  /**
   * TC-R3-02: Director Cannot Generate Invites with Platform Roles
   */
  it("TC-R3-02: DIRECTOR is forbidden from generating invites conferring platform roles", async () => {
    const directorUser = await createTestUser();
    cleanups.userIds.push(directorUser.id);

    const center = await createTestCenter({ ownerId: directorUser.id });
    cleanups.centerIds.push(center.id);

    await createTestMembership(directorUser.id, center.id, "DIRECTOR");

    const directorToken = await createTestSessionToken(directorUser, {
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });

    const platformRoles = ["SUPERADMIN", "PLATFORM_ADMIN", "DEVELOPER", "PLATFORM_SUPPORT"];

    for (const targetRole of platformRoles) {
      const res = await invokeRoute(generateInviteRoute, "/api/invites/generate", {
        method: "POST",
        token: directorToken,
        body: { targetRole },
      });

      expect(res.status).toBe(403);
    }

    // Allowed center-level role check: ACCOUNTANT
    const allowedRes = await invokeRoute<{ success: boolean; invite: { code: string; targetRole: string } }>(
      generateInviteRoute,
      "/api/invites/generate",
      {
        method: "POST",
        token: directorToken,
        body: { targetRole: "ACCOUNTANT" },
      }
    );

    expect(allowedRes.status).toBe(200);
    cleanups.inviteCodes.push(allowedRes.data.invite.code);
  });

  /**
   * TC-R3-03: Unified canAssignRole Matrix in Staff Management Endpoints
   */
  it("TC-R3-03: CENTER_ADMIN is forbidden from creating or modifying staff to equal or higher roles", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const adminUser = await createTestUser();
    cleanups.userIds.push(adminUser.id);
    await createTestMembership(adminUser.id, center.id, "CENTER_ADMIN");

    const adminToken = await createTestSessionToken(adminUser, {
      activeCenterId: center.id,
      activeCenterRole: "CENTER_ADMIN",
    });

    // 3a: Attempt to create CENTER_ADMIN
    const resCreateAdmin = await invokeRoute(staffPostRoute, "/api/tenant/staff", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "Another Admin",
        email: `newadmin-${Date.now()}@test.uz`,
        staffRole: "CENTER_ADMIN",
      },
    });
    expect(resCreateAdmin.status).toBe(403);

    // 3b: Attempt to create ACCOUNTANT
    const resCreateAcc = await invokeRoute(staffPostRoute, "/api/tenant/staff", {
      method: "POST",
      token: adminToken,
      body: {
        fullName: "New Accountant",
        email: `newacc-${Date.now()}@test.uz`,
        staffRole: "ACCOUNTANT",
      },
    });
    expect(resCreateAcc.status).toBe(403);

    // 3c: Attempt to promote a teacher to CENTER_ADMIN via PATCH
    const teacherUser = await createTestUser();
    cleanups.userIds.push(teacherUser.id);
    const teacherMem = await createTestMembership(teacherUser.id, center.id, "TEACHER");

    const resPatchRole = await invokeRoute(staffPatchRoute, "/api/tenant/staff", {
      method: "PATCH",
      token: adminToken,
      body: {
        membershipId: teacherMem.id,
        newRole: "CENTER_ADMIN",
      },
    });
    expect(resPatchRole.status).toBe(403);
  });

  /**
   * TC-R3-04: Atomic Invite Acceptance Concurrency (Anti-Race Condition & TOCTOU)
   */
  it("TC-R3-04: 10 concurrent requests to single-use invite result in exactly 1 success and 9 failures", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const creatorMem = await createTestMembership(owner.id, center.id, "DIRECTOR");

    const code = `CONC-${Date.now()}`;
    cleanups.inviteCodes.push(code);

    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code,
        targetRole: "STUDENT",
        maxUses: 1,
        usesCount: 0,
        isRevoked: false,
        createdByMembershipId: creatorMem.id,
      },
    });

    // Create 10 distinct users and tokens
    const users = await Promise.all(
      Array.from({ length: 10 }).map(async (_, idx) => {
        const u = await createTestUser({ email: `race-user-${idx}-${Date.now()}@test.uz` });
        cleanups.userIds.push(u.id);
        const token = await createTestSessionToken(u);
        return { user: u, token };
      })
    );

    // Fire 10 simultaneous requests
    const results = await Promise.all(
      users.map(({ token }) =>
        invokeRoute(acceptInviteRoute, "/api/invites/accept", {
          method: "POST",
          token,
          body: { code },
        })
      )
    );

    const successResponses = results.filter((r) => r.status === 200);
    const errorResponses = results.filter((r) => r.status === 400);

    expect(successResponses.length).toBe(1);
    expect(errorResponses.length).toBe(9);

    // Database verification: usesCount must equal exactly 1
    const inviteInDb = await db.inviteCode.findUnique({
      where: { code },
    });
    expect(inviteInDb?.usesCount).toBe(1);

    // Exactly 1 student membership created in this center
    const studentMemberships = await db.centerMembership.count({
      where: {
        centerId: center.id,
        role: "STUDENT",
      },
    });
    expect(studentMemberships).toBe(1);
  });

  /**
   * TC-R3-05: Invite Role Immutability (Role Derived Strictly from DB Code Record)
   */
  it("TC-R3-05: Redemption strictly uses targetRole from DB, ignoring client body overrides", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const creatorMem = await createTestMembership(owner.id, center.id, "DIRECTOR");

    const code = `STRICT-${Date.now()}`;
    cleanups.inviteCodes.push(code);

    await db.inviteCode.create({
      data: {
        centerId: center.id,
        code,
        targetRole: "STUDENT",
        maxUses: 5,
        usesCount: 0,
        createdByMembershipId: creatorMem.id,
      },
    });

    const studentUser = await createTestUser();
    cleanups.userIds.push(studentUser.id);
    const token = await createTestSessionToken(studentUser);

    // Malicious payload attempting to escalate to DIRECTOR / SUPERADMIN
    const res = await invokeRoute<{ role: string }>(acceptInviteRoute, "/api/invites/accept", {
      method: "POST",
      token,
      body: {
        code,
        targetRole: "DIRECTOR",
        role: "SUPERADMIN",
      },
    });

    expect(res.status).toBe(200);
    expect(res.data.role).toBe("STUDENT");

    // DB check: membership created has role STUDENT
    const membership = await db.centerMembership.findFirst({
      where: {
        userId: studentUser.id,
        centerId: center.id,
      },
    });
    expect(membership?.role).toBe("STUDENT");
  });

  /**
   * TC-R3-06: Invite Redemption Rejection for BLOCKED Centers
   */
  it("TC-R3-06: Rejects invite redemption when center status is BLOCKED", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const blockedCenter = await createTestCenter({
      ownerId: owner.id,
      status: "BLOCKED",
    });
    cleanups.centerIds.push(blockedCenter.id);

    const creatorMem = await createTestMembership(owner.id, blockedCenter.id, "DIRECTOR");

    const code = `BLOCKED-${Date.now()}`;
    cleanups.inviteCodes.push(code);

    await db.inviteCode.create({
      data: {
        centerId: blockedCenter.id,
        code,
        targetRole: "STUDENT",
        maxUses: 10,
        usesCount: 0,
        createdByMembershipId: creatorMem.id,
      },
    });

    const user = await createTestUser();
    cleanups.userIds.push(user.id);
    const token = await createTestSessionToken(user);

    const res = await invokeRoute(acceptInviteRoute, "/api/invites/accept", {
      method: "POST",
      token,
      body: { code },
    });

    // Must be rejected (403 or 400 neutral error)
    expect([400, 403]).toContain(res.status);

    // No membership created in blocked center
    const mem = await db.centerMembership.findFirst({
      where: { userId: user.id, centerId: blockedCenter.id },
    });
    expect(mem).toBeNull();
  });
});
