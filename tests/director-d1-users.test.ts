import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Reason: Exception: Test setup and verification requires raw db access for multi-tenant fixtures.
// eslint-disable-next-line no-restricted-imports
import { db } from "../src/lib/db";
import { signJWT, hashPassword, comparePassword } from "../src/lib/auth";
import { canManageUserAccount, canActorManageRole } from "../src/lib/tenant-user-guard";

// Route handlers under test
import { POST as postCreateUser, GET as getUsers } from "../src/app/api/tenant/users/route";
import { PATCH as patchUser, DELETE as deleteUser, GET as getUser } from "../src/app/api/tenant/users/[id]/route";
import { POST as postResetPassword } from "../src/app/api/tenant/users/[id]/reset-password/route";
import { POST as postSendResetLink } from "../src/app/api/tenant/users/[id]/send-reset-link/route";
import { POST as postParentLink } from "../src/app/api/invites/parent-link/route";
import { POST as postAcceptInvite } from "../src/app/api/invites/accept/route";
import { POST as postFirstLoginChangePassword } from "../src/app/api/account/change-password/route";

describe("Stage D1: Director User Management, Shared Accounts, Parents & Scoping", () => {
  let centerAId: string;
  let centerBId: string;
  let dirAUserId: string;
  let adminAUserId: string;
  let dirBUserId: string;

  let tokenDirA: string;
  let tokenAdminA: string;
  let tokenDirB: string;

  let studentAId: string;
  let studentAUserId: string;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Create Director A, Center Admin A, Director B
    const userDirA = await db.platformUser.create({
      data: {
        email: `dir_d1_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director A",
        emailVerified: new Date(),
      },
    });
    dirAUserId = userDirA.id;

    const userAdminA = await db.platformUser.create({
      data: {
        email: `admin_d1_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Admin A",
        emailVerified: new Date(),
      },
    });
    adminAUserId = userAdminA.id;

    const userDirB = await db.platformUser.create({
      data: {
        email: `dir_d1_b_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director B",
        emailVerified: new Date(),
      },
    });
    dirBUserId = userDirB.id;

    // 2. Create Plan & Centers
    const plan = (await db.subscriptionPlan.findFirst()) || (await db.subscriptionPlan.create({
      data: {
        name: "D1 Standard Plan",
        maxStudents: 50,
        maxTeachers: 10,
        maxCourses: 20,
        maxBranches: 2,
        priceMonthly: 500000,
      },
    }));

    const centerA = await db.learningCenter.create({
      data: {
        name: `Center A D1 ${ts}`,
        slug: `d1-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUserId,
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: `Center B D1 ${ts}`,
        slug: `d1-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUserId,
      },
    });
    centerBId = centerB.id;

    // Subscriptions
    await db.subscription.create({
      data: {
        centerId: centerAId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await db.subscription.create({
      data: {
        centerId: centerBId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });

    // Memberships
    await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const adminMemA = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: adminAUserId,
        role: "CENTER_ADMIN",
        status: "ACTIVE",
      },
    });

    await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // JWT Tokens
    tokenDirA = await signJWT({
      userId: dirAUserId,
      email: userDirA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    tokenAdminA = await signJWT({
      userId: adminAUserId,
      email: userAdminA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "CENTER_ADMIN",
    });

    tokenDirB = await signJWT({
      userId: dirBUserId,
      email: userDirB.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    // Create a base student in Center A
    const studentUser = await db.platformUser.create({
      data: {
        email: `student_base_${ts}@test.uz`,
        phone: `+99890111${ts.toString().slice(-4)}`,
        fullName: "Base Student A",
        passwordHash: await hashPassword("StudentPass123!"),
      },
    });
    studentAUserId = studentUser.id;

    const studentMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: studentAUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentAId = studentMem.id;
  });

  afterAll(async () => {
    await db.parentLink.deleteMany({ where: { student: { centerId: { in: [centerAId, centerBId] } } } });
    await db.inviteCode.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.auditLog.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.centerMembership.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.subscription.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    await db.platformUser.deleteMany({
      where: { id: { in: [dirAUserId, adminAUserId, dirBUserId, studentAUserId] } },
    });
  });

  describe("1. User Creation Flow (Auto-password, mustChangePassword, no-store, AuditLog safety)", () => {
    it("creates user with generated password, returns credentials, and does NOT log password in AuditLog", async () => {
      const ts = Date.now();
      const phone = `+99890222${ts.toString().slice(-4)}`;
      const req = new Request("http://localhost:3000/api/tenant/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: "New Student Flow",
          phone,
          role: "STUDENT",
          generatePassword: true,
          mustChangePassword: true,
        }),
      });

      const res = await postCreateUser(req);
      expect(res.status).toBe(201);

      // Verify no-store headers
      expect(res.headers.get("Cache-Control")).toContain("no-store");

      const data = await res.json();
      expect(data.credentials).toBeDefined();
      expect(data.credentials.password).toBeDefined();
      expect(data.credentials.password.length).toBeGreaterThanOrEqual(12);
      expect(data.membership.role).toBe("STUDENT");

      // Verify user in DB has mustChangePassword = true
      const createdUser = await db.platformUser.findUnique({
        where: { id: data.membership.userId },
      });
      expect(createdUser?.mustChangePassword).toBe(true);

      // Verify password works
      const isValid = await comparePassword(data.credentials.password, createdUser?.passwordHash || "");
      expect(isValid).toBe(true);

      // Verify AuditLog does NOT contain the password
      const audit = await db.auditLog.findFirst({
        where: {
          centerId: centerAId,
          action: "CREATE_USER",
          resourceId: data.membership.id,
        },
      });
      expect(audit).not.toBeNull();
      expect(audit?.detailsJson).not.toContain(data.credentials.password);
    });

    it("allows user creation without email if phone is provided", async () => {
      const ts = Date.now();
      const phone = `+99890333${ts.toString().slice(-4)}`;
      const req = new Request("http://localhost:3000/api/tenant/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: "No Email Student",
          phone,
          role: "STUDENT",
        }),
      });

      const res = await postCreateUser(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.membership.user.phone).toBe(phone);
    });

    it("rejects creation when neither email nor phone is provided", async () => {
      const req = new Request("http://localhost:3000/api/tenant/users", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Invalid Student",
          role: "STUDENT",
        }),
      });

      const res = await postCreateUser(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("email или номер телефона");
    });
  });

  describe("2. First Login Password Change", () => {
    it("allows user with mustChangePassword=true to change password and clears the flag", async () => {
      const ts = Date.now();
      const testUser = await db.platformUser.create({
        data: {
          email: `first_login_${ts}@test.uz`,
          passwordHash: await hashPassword("TempPass123!"),
          fullName: "First Login User",
          mustChangePassword: true,
        },
      });

      const userToken = await signJWT({
        userId: testUser.id,
        email: testUser.email,
        platformRole: "NONE",
      });

      const req = new Request("http://localhost:3000/api/auth/change-password", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${userToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "TempPass123!",
          newPassword: "BrandNewSecurePass456!",
          confirmPassword: "BrandNewSecurePass456!",
        }),
      });

      const res = await postFirstLoginChangePassword(req);
      expect(res.status).toBe(200);

      const refreshedUser = await db.platformUser.findUnique({
        where: { id: testUser.id },
      });
      expect(refreshedUser?.mustChangePassword).toBe(false);

      const isValid = await comparePassword("BrandNewSecurePass456!", refreshedUser?.passwordHash || "");
      expect(isValid).toBe(true);
    });
  });

  describe("3. Shared Accounts Rule (Cross-Center Isolation)", () => {
    let multiCenterUserId: string;
    let multiCenterMemAId: string;

    beforeAll(async () => {
      const ts = Date.now();
      // User belonging to Center A and Center B
      const sharedUser = await db.platformUser.create({
        data: {
          email: `shared_user_${ts}@test.uz`,
          phone: `+99890444${ts.toString().slice(-4)}`,
          fullName: "Shared Student",
          passwordHash: await hashPassword("SharedPass123!"),
        },
      });
      multiCenterUserId = sharedUser.id;

      const memA = await db.centerMembership.create({
        data: {
          centerId: centerAId,
          userId: multiCenterUserId,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
      multiCenterMemAId = memA.id;

      await db.centerMembership.create({
        data: {
          centerId: centerBId,
          userId: multiCenterUserId,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
    });

    it("canManageUserAccount returns canManage=false for multi-center user", async () => {
      const checkA = await canManageUserAccount(centerAId, multiCenterUserId, db);
      expect(checkA.canManage).toBe(false);
      expect(checkA.isShared).toBe(true);
      expect(checkA.otherCenterCount).toBe(1);

      // Single center student check
      const checkSingle = await canManageUserAccount(centerAId, studentAUserId, db);
      expect(checkSingle.canManage).toBe(true);
      expect(checkSingle.isShared).toBe(false);
    });

    it("blocks password reset by director for multi-center user with 403", async () => {
      const req = new Request(`http://localhost:3000/api/tenant/users/${multiCenterMemAId}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await postResetPassword(req, { params: { id: multiCenterMemAId } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("USER_IS_SHARED");
      expect(data.error).toContain("нескольких центрах");
    });

    it("blocks updating phone/email for multi-center user", async () => {
      const req = new Request(`http://localhost:3000/api/tenant/users/${multiCenterMemAId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: "+998909999999",
        }),
      });

      const res = await patchUser(req, { params: { id: multiCenterMemAId } });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.code).toBe("USER_IS_SHARED");
    });

    it("allows sending reset link even for multi-center user (non-intrusive)", async () => {
      const req = new Request(`http://localhost:3000/api/tenant/users/${multiCenterMemAId}/send-reset-link`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
        },
      });

      const res = await postSendResetLink(req, { params: { id: multiCenterMemAId } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.resetUrl).toBeDefined();
    });

    it("allows password reset for single-center student in Center A", async () => {
      const req = new Request(`http://localhost:3000/api/tenant/users/${studentAId}/reset-password`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const res = await postResetPassword(req, { params: { id: studentAId } });
      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      const data = await res.json();
      expect(data.credentials.password).toBeDefined();
    });
  });

  describe("4. Role Hierarchy & Destructive Action Protections", () => {
    it("canActorManageRole correctly protects Director and Center Admin hierarchy", () => {
      // Center Admin trying to manage Director
      expect(canActorManageRole("CENTER_ADMIN", "DIRECTOR").allowed).toBe(false);

      // Center Admin trying to manage another Center Admin
      expect(canActorManageRole("CENTER_ADMIN", "CENTER_ADMIN").allowed).toBe(false);

      // Director managing Center Admin
      expect(canActorManageRole("DIRECTOR", "CENTER_ADMIN").allowed).toBe(true);

      // Director managing Teacher or Student
      expect(canActorManageRole("DIRECTOR", "TEACHER").allowed).toBe(true);
      expect(canActorManageRole("DIRECTOR", "STUDENT").allowed).toBe(true);
    });

    it("requires minimum 5 char reason for archiving / blocking a user", async () => {
      // Trying to delete without reason or with < 5 chars
      const req = new Request(`http://localhost:3000/api/tenant/users/${studentAId}?reason=bad`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
        },
      });

      const res = await deleteUser(req, { params: { id: studentAId } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("5 символов");
    });
  });

  describe("5. Parents & ParentLink (Student Parent Codes, Direct Link & Scope)", () => {
    let generatedParentCode: string;

    it("generates student personal parent invite code carrying studentMembershipId", async () => {
      const req = new Request("http://localhost:3000/api/invites/parent-link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "INITIATE_BY_ADMIN",
          studentId: studentAId,
        }),
      });

      const res = await postParentLink(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.parentInviteCode).toBeDefined();
      generatedParentCode = data.parentInviteCode;

      // Verify invite code record has studentMembershipId
      const inviteRecord = await db.inviteCode.findFirst({
        where: { code: generatedParentCode },
      });
      expect(inviteRecord?.studentMembershipId).toBe(studentAId);
      expect(inviteRecord?.targetRole).toBe("PARENT");
    });

    it("accepts parent code and automatically links parent to student with confirmed ParentLink", async () => {
      const ts = Date.now();
      const parentUser = await db.platformUser.create({
        data: {
          email: `parent_claimer_${ts}@test.uz`,
          fullName: "Mama Student A",
          passwordHash: await hashPassword("ParentPass123!"),
        },
      });

      const parentToken = await signJWT({
        userId: parentUser.id,
        email: parentUser.email,
        platformRole: "NONE",
      });

      const req = new Request("http://localhost:3000/api/invites/accept", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${parentToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code: generatedParentCode,
        }),
      });

      const res = await postAcceptInvite(req);
      expect(res.status).toBe(200);

      // Verify ParentLink was created in DB
      const parentLink = await db.parentLink.findFirst({
        where: {
          studentMembershipId: studentAId,
        },
      });
      expect(parentLink).not.toBeNull();
      expect(parentLink?.status).toBe("CONFIRMED");
    });

    it("allows revoking parent code by director", async () => {
      // Generate a new code
      const genReq = new Request("http://localhost:3000/api/invites/parent-link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "INITIATE_BY_ADMIN",
          studentId: studentAId,
        }),
      });
      const genRes = await postParentLink(genReq);
      const { parentInviteCode } = await genRes.json();

      // Revoke it
      const revokeReq = new Request("http://localhost:3000/api/invites/parent-link", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "REVOKE_PARENT_CODE",
          inviteCode: parentInviteCode,
        }),
      });

      const revokeRes = await postParentLink(revokeReq);
      expect(revokeRes.status).toBe(200);

      const checkCode = await db.inviteCode.findFirst({
        where: { code: parentInviteCode },
      });
      expect(checkCode?.isRevoked).toBe(true);
    });
  });

  describe("6. Cross-Center Isolation on Users API", () => {
    it("Director B cannot view or modify users in Center A", async () => {
      // Attempt to fetch Center A student using Center B Director token
      const req = new Request(`http://localhost:3000/api/tenant/users/${studentAId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenDirB}`,
        },
      });

      const res = await getUser(req, { params: { id: studentAId } });
      expect(res.status).toBe(404);
    });

    it("Director A only sees users of Center A in list", async () => {
      const req = new Request("http://localhost:3000/api/tenant/users", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
        },
      });

      const res = await getUsers(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.users).toBeDefined();
      // Ensure all returned users belong to Center A
      for (const item of data.users) {
        expect(item.centerId).toBe(centerAId);
      }
    });
  });
});
