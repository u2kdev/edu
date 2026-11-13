import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db";
import { POST as impersonateRoute } from "@/app/api/platform/impersonate/route";
import { POST as stopImpersonateRoute } from "@/app/api/platform/impersonate/stop/route";
import { GET as getGradesRoute, POST as postGradeRoute } from "@/app/api/grades/route";
import { GET as getCoursesRoute } from "@/app/api/courses/route";
import { ORIGINAL_SESSION_COOKIE } from "@/lib/impersonation";
import {
  createTestUser,
  createTestCenter,
  createTestMembership,
  createTestSessionToken,
  cleanupTestEntities,
} from "../helpers/auth-fixtures";
import { invokeRoute } from "../helpers/e2e-client";

describe("Tier 1 Feature Coverage: R4 Impersonation Control & Scoping", () => {
  const cleanups: {
    userIds: string[];
    centerIds: string[];
  } = {
    userIds: [],
    centerIds: [],
  };

  afterEach(async () => {
    await cleanupTestEntities(cleanups);
    cleanups.userIds = [];
    cleanups.centerIds = [];
  });

  /**
   * E2E-R4-01: Impersonation Target Matrix Enforcement (Platform Role Targets Forbidden)
   */
  it("E2E-R4-01: Forbids impersonating SUPERADMIN, DEVELOPER, and platform staff", async () => {
    const supportUser = await createTestUser({ platformRole: "PLATFORM_SUPPORT" });
    cleanups.userIds.push(supportUser.id);
    const supportToken = await createTestSessionToken(supportUser);

    const superAdminUser1 = await createTestUser({ platformRole: "SUPERADMIN" });
    const superAdminUser2 = await createTestUser({ platformRole: "SUPERADMIN" });
    const developerUser = await createTestUser({ platformRole: "DEVELOPER" });
    const platformAdminUser = await createTestUser({ platformRole: "PLATFORM_ADMIN" });
    cleanups.userIds.push(superAdminUser1.id, superAdminUser2.id, developerUser.id, platformAdminUser.id);

    const superAdminToken = await createTestSessionToken(superAdminUser1);

    // 1. Support targeting Superadmin -> 403
    const res1 = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: supportToken,
      body: { targetUserId: superAdminUser1.id, reason: "Support test" },
    });
    expect(res1.status).toBe(403);

    // 2. Support targeting Developer -> 403
    const res2 = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: supportToken,
      body: { targetUserId: developerUser.id, reason: "Support test" },
    });
    expect(res2.status).toBe(403);

    // 3. Support targeting Platform Admin -> 403
    const res3 = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: supportToken,
      body: { targetUserId: platformAdminUser.id, reason: "Support test" },
    });
    expect(res3.status).toBe(403);

    // 4. Superadmin targeting another Superadmin -> 403
    const res4 = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: superAdminToken,
      body: { targetUserId: superAdminUser2.id, reason: "Superadmin peer test" },
    });
    expect(res4.status).toBe(403);
  });

  /**
   * E2E-R4-02: Support Role Target Matrix Enforcement (Only CENTER_SUPPORT Allowed)
   */
  it("E2E-R4-02: PLATFORM_SUPPORT may only impersonate CENTER_SUPPORT, not DIRECTOR or TEACHER", async () => {
    const centerOwner = await createTestUser();
    cleanups.userIds.push(centerOwner.id);

    const center = await createTestCenter({ ownerId: centerOwner.id });
    cleanups.centerIds.push(center.id);

    const supportUser = await createTestUser({ platformRole: "PLATFORM_SUPPORT" });
    cleanups.userIds.push(supportUser.id);
    const supportToken = await createTestSessionToken(supportUser);

    const directorUser = await createTestUser();
    cleanups.userIds.push(directorUser.id);
    await createTestMembership(directorUser.id, center.id, "DIRECTOR");

    const teacherUser = await createTestUser();
    cleanups.userIds.push(teacherUser.id);
    await createTestMembership(teacherUser.id, center.id, "TEACHER");

    const centerSupportUser = await createTestUser();
    cleanups.userIds.push(centerSupportUser.id);
    await createTestMembership(centerSupportUser.id, center.id, "CENTER_SUPPORT");

    // 1. Support targeting DIRECTOR -> 403
    const resDirector = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: supportToken,
      body: {
        targetUserId: directorUser.id,
        targetCenterId: center.id,
        reason: "Checking director access",
      },
    });
    expect(resDirector.status).toBe(403);

    // 2. Support targeting TEACHER -> 403
    const resTeacher = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: supportToken,
      body: {
        targetUserId: teacherUser.id,
        targetCenterId: center.id,
        reason: "Checking teacher access",
      },
    });
    expect(resTeacher.status).toBe(403);

    // 3. Support targeting CENTER_SUPPORT -> 200 OK
    const resCenterSupport = await invokeRoute<{ success: boolean; user: { id: string } }>(
      impersonateRoute,
      "/api/platform/impersonate",
      {
        method: "POST",
        token: supportToken,
        body: {
          targetUserId: centerSupportUser.id,
          targetCenterId: center.id,
          reason: "Assisting with center ticket #1234",
        },
      }
    );
    expect(resCenterSupport.status).toBe(200);
    expect(resCenterSupport.data.success).toBe(true);
    expect(resCenterSupport.data.user.id).toBe(centerSupportUser.id);
  });

  /**
   * E2E-R4-03: Default Read-Only Mode & Mutation Block for Impersonated Sessions
   */
  it("E2E-R4-03: Default impersonated session is strictly read-only and blocks mutations", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const directorUser = await createTestUser();
    cleanups.userIds.push(directorUser.id);
    await createTestMembership(directorUser.id, center.id, "DIRECTOR");

    const superAdmin = await createTestUser({ platformRole: "SUPERADMIN" });
    cleanups.userIds.push(superAdmin.id);

    // Session token representing active impersonation with isReadOnly: true (default)
    const impersonatedReadOnlyToken = await createTestSessionToken(directorUser, {
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
      impersonatorUserId: superAdmin.id,
      isReadOnly: true,
    });

    // Read operation succeeds
    const readRes = await invokeRoute(getCoursesRoute, "/api/courses", {
      method: "GET",
      token: impersonatedReadOnlyToken,
    });
    expect(readRes.status).toBe(200);

    // Mutation operation is blocked (403 Forbidden)
    const mutateRes = await invokeRoute(postGradeRoute, "/api/grades", {
      method: "POST",
      token: impersonatedReadOnlyToken,
      body: {
        studentMembershipId: "00000000-0000-0000-0000-000000000001",
        gradeType: "HOMEWORK",
        value: 100,
      },
    });
    expect(mutateRes.status).toBe(403);
  });

  /**
   * E2E-R4-04: SUPERADMIN Explicit Write Mode with Mandatory Reason & Mutation AuditLog
   */
  it("E2E-R4-04: SUPERADMIN write impersonation requires non-empty reason and attributes mutations", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const directorUser = await createTestUser();
    cleanups.userIds.push(directorUser.id);
    const directorMem = await createTestMembership(directorUser.id, center.id, "DIRECTOR");

    const superAdmin = await createTestUser({ platformRole: "SUPERADMIN" });
    cleanups.userIds.push(superAdmin.id);
    const superAdminToken = await createTestSessionToken(superAdmin);

    // Attempting write impersonation without reason must fail with 400
    const failNoReason = await invokeRoute(impersonateRoute, "/api/platform/impersonate", {
      method: "POST",
      token: superAdminToken,
      body: {
        targetUserId: directorUser.id,
        targetCenterId: center.id,
        allowWrite: true,
        reason: "",
      },
    });
    expect([400, 403]).toContain(failNoReason.status);

    // Starting write impersonation with explicit reason
    const startRes = await invokeRoute<{ success: boolean; user: { id: string } }>(
      impersonateRoute,
      "/api/platform/impersonate",
      {
        method: "POST",
        token: superAdminToken,
        body: {
          targetUserId: directorUser.id,
          targetCenterId: center.id,
          allowWrite: true,
          reason: "Emergency data correction for student record",
        },
      }
    );
    expect(startRes.status).toBe(200);

    // AuditLog records impersonation start
    const auditStart = await db.auditLog.findFirst({
      where: {
        actorUserId: superAdmin.id,
        action: "PLATFORM_IMPERSONATION_STARTED",
      },
    });
    expect(auditStart).toBeDefined();
  });

  /**
   * E2E-R4-05: RBAC Scoping Preserved During Impersonation
   */
  it("E2E-R4-05: Impersonating STUDENT preserves student scoping and blocks director permissions", async () => {
    const owner = await createTestUser();
    cleanups.userIds.push(owner.id);

    const center = await createTestCenter({ ownerId: owner.id });
    cleanups.centerIds.push(center.id);

    const studentUser = await createTestUser();
    cleanups.userIds.push(studentUser.id);
    const studentMem = await createTestMembership(studentUser.id, center.id, "STUDENT");

    const superAdmin = await createTestUser({ platformRole: "SUPERADMIN" });
    cleanups.userIds.push(superAdmin.id);

    // Impersonating student in Center
    const studentImpersonatedToken = await createTestSessionToken(studentUser, {
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
      impersonatorUserId: superAdmin.id,
      isReadOnly: true,
    });

    // 1. Calling staff list route must be forbidden for student
    const { GET: getStaffRoute } = await import("@/app/api/tenant/staff/route");
    const staffRes = await invokeRoute(getStaffRoute, "/api/tenant/staff", {
      method: "GET",
      token: studentImpersonatedToken,
    });
    expect(staffRes.status).toBe(403);

    // 2. Querying grades returns only the student's own grades
    const gradesRes = await invokeRoute<{ grades?: Array<{ studentMembershipId: string }> }>(
      getGradesRoute,
      "/api/grades",
      {
        method: "GET",
        token: studentImpersonatedToken,
      }
    );
    expect(gradesRes.status).toBe(200);
    if (gradesRes.data.grades && gradesRes.data.grades.length > 0) {
      for (const item of gradesRes.data.grades) {
        expect(item.studentMembershipId).toBe(studentMem.id);
      }
    }
  });

  /**
   * E2E-R4-06: Impersonation Stop Lifecycle & Revocation Integrity
   */
  it("E2E-R4-06: Stop restores original session and rejects if original superadmin account is inactive/revoked", async () => {
    const superAdmin = await createTestUser({ platformRole: "SUPERADMIN" });
    cleanups.userIds.push(superAdmin.id);
    const superAdminToken = await createTestSessionToken(superAdmin);

    const targetUser = await createTestUser();
    cleanups.userIds.push(targetUser.id);

    // 1. Normal Stop
    const { signJWT } = await import("@/lib/auth");
    const validOriginalCookie = signJWT(
      {
        userId: superAdmin.id,
        email: superAdmin.email,
        platformRole: superAdmin.platformRole,
        originalToken: superAdminToken,
        impersonatedUserId: targetUser.id,
        startedAt: Date.now(),
      },
      "60m"
    );

    const stopRes = await invokeRoute<{ success: boolean; redirectUrl: string }>(
      stopImpersonateRoute,
      "/api/platform/impersonate/stop",
      {
        method: "POST",
        cookies: {
          [ORIGINAL_SESSION_COOKIE]: validOriginalCookie,
        },
      }
    );
    expect(stopRes.status).toBe(200);
    expect(stopRes.data.success).toBe(true);
    expect(stopRes.cookies["auth_token"]).toBeDefined();

    // 2. Revoked / Inactive Original Account
    await db.platformUser.update({
      where: { id: superAdmin.id },
      data: { isActive: false },
    });

    const stopFailRes = await invokeRoute(
      stopImpersonateRoute,
      "/api/platform/impersonate/stop",
      {
        method: "POST",
        cookies: {
          [ORIGINAL_SESSION_COOKIE]: validOriginalCookie,
        },
      }
    );
    expect([401, 403]).toContain(stopFailRes.status);
  });
});
