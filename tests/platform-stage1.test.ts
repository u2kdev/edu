import { describe, it, expect, beforeEach } from "vitest";
import type { PlatformUser } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { POST as loginRoute } from "@/app/api/auth/login/route";
import { POST as changePasswordRoute } from "@/app/api/account/change-password/route";
import { GET as getUsers, POST as createUser } from "@/app/api/platform/users/route";
import { GET as getUser, PATCH as patchUser, DELETE as deleteUser } from "@/app/api/platform/users/[id]/route";
import { POST as resetPasswordRoute } from "@/app/api/platform/users/[id]/reset-password/route";
import { POST as blockRoute } from "@/app/api/platform/users/[id]/block/route";
import { GET as getTeam, POST as addTeamMember } from "@/app/api/platform/team/route";

describe("Stage 1: Platform Users & Authentication", () => {
  let superadminUser: PlatformUser;
  let secondSuperadmin: PlatformUser;
  let platformAdminUser: PlatformUser;
  let regularUser: PlatformUser;

  let superadminToken: string;
  let platformAdminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany({});
    await db.loginAttempt.deleteMany({});

    const ts = Date.now();

    // 1. Superadmin
    superadminUser = await db.platformUser.create({
      data: {
        email: `super1_${ts}@test.com`,
        fullName: "First Superadmin",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "SUPERADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 2. Second Superadmin
    secondSuperadmin = await db.platformUser.create({
      data: {
        email: `super2_${ts}@test.com`,
        fullName: "Second Superadmin",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "SUPERADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 3. Platform Admin
    platformAdminUser = await db.platformUser.create({
      data: {
        email: `pl_admin_${ts}@test.com`,
        fullName: "Platform Admin",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "PLATFORM_ADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    const phoneDigits = String(ts % 10000000).padStart(7, "0");
    const testPhone = `+99890${phoneDigits}`;

    // 4. Regular User
    regularUser = await db.platformUser.create({
      data: {
        email: `student_${ts}@test.com`,
        phone: testPhone,
        username: `user_${ts}`,
        fullName: "Test Regular User",
        passwordHash: await hashPassword("Password123!"),
        platformRole: "NONE",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    superadminToken = await createSessionToken(
      {
        userId: superadminUser.id,
        email: superadminUser.email,
        platformRole: "SUPERADMIN",
      },
      { maxAgeSeconds: 3600 }
    );

    platformAdminToken = await createSessionToken(
      {
        userId: platformAdminUser.id,
        email: platformAdminUser.email,
        platformRole: "PLATFORM_ADMIN",
      },
      { maxAgeSeconds: 3600 }
    );

    regularToken = await createSessionToken(
      {
        userId: regularUser.id,
        email: regularUser.email,
        platformRole: "NONE",
      },
      { maxAgeSeconds: 3600 }
    );
  });

  describe("1. Phone & Username validation and helpers", () => {
    it("normalizes uzbek phone numbers to +998XXXXXXXXX", () => {
      expect(normalizePhone("901234567")).toBe("+998901234567");
      expect(normalizePhone("+998 90 123 45 67")).toBe("+998901234567");
      expect(normalizePhone("998901234567")).toBe("+998901234567");
      expect(normalizePhone("12345")).toBe(null);
    });

    it("validates usernames correctly", () => {
      expect(isValidUsername("aziz_dev")).toBe(true);
      expect(isValidUsername("user-123.test")).toBe(true);
      expect(isValidUsername("ab")).toBe(false); // min 3 chars
      expect(isValidUsername("bad username with space")).toBe(false);
    });
  });

  describe("2. Authentication via email, phone, and username", () => {
    it("logs in with email and records lastLoginAt", async () => {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.email,
          password: "Password123!",
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(regularUser.id);

      const dbUser = await db.platformUser.findUnique({ where: { id: regularUser.id } });
      expect(dbUser?.lastLoginAt).not.toBeNull();
    });

    it("logs in with phone number (raw or formatted)", async () => {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.phone?.replace("+998", "998 "), // raw format with space
          password: "Password123!",
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(regularUser.id);
    });

    it("logs in with username", async () => {
      const req = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.username,
          password: "Password123!",
        }),
      });

      const res = await loginRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.user.id).toBe(regularUser.id);
    });
  });

  describe("3. Forced password change flow (mustChangePassword)", () => {
    it("reports mustChangePassword: true on login and clears it after change", async () => {
      await db.platformUser.update({
        where: { id: regularUser.id },
        data: { mustChangePassword: true },
      });

      // 1. Login shows mustChangePassword
      const loginReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.email,
          password: "Password123!",
        }),
      });
      const loginRes = await loginRoute(loginReq);
      const loginJson = await loginRes.json();
      expect(loginJson.mustChangePassword).toBe(true);

      // 2. Change password via /api/account/change-password
      const changeReq = new Request("http://localhost/api/account/change-password", {
        method: "POST",
        headers: {
          authorization: `Bearer ${regularToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          currentPassword: "Password123!",
          newPassword: "BrandNewSecurePassword456!",
          confirmPassword: "BrandNewSecurePassword456!",
        }),
      });
      const changeRes = await changePasswordRoute(changeReq);
      expect(changeRes.status).toBe(200);

      // 3. Verify user in DB has mustChangePassword = false
      const updatedUser = await db.platformUser.findUnique({ where: { id: regularUser.id } });
      expect(updatedUser?.mustChangePassword).toBe(false);

      // 4. Logging in with new password works cleanly
      const newLoginReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.email,
          password: "BrandNewSecurePassword456!",
        }),
      });
      const newLoginRes = await loginRoute(newLoginReq);
      const newLoginJson = await newLoginRes.json();
      expect(newLoginJson.success).toBe(true);
      expect(newLoginJson.mustChangePassword).toBe(false);
    });
  });

  describe("4. User creation via /api/platform/users", () => {
    it("creates user with generated 16-char password and single-display credentials", async () => {
      const ts = Date.now();
      const createReq = new Request("http://localhost/api/platform/users", {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: "New Student",
          email: `new_student_${ts}@example.com`,
          phone: "+998931112233",
          username: `student_${ts}`,
          mustChangePassword: true,
        }),
      });

      const res = await createUser(createReq);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.initialCredentials.password).toBeDefined();
      expect(json.initialCredentials.password.length).toBe(16);
      expect(json.user.mustChangePassword).toBe(true);

      // Ensure password was NOT stored in plain text
      const createdInDb = await db.platformUser.findUnique({ where: { id: json.user.id } });
      expect(createdInDb?.passwordHash).not.toBe(json.initialCredentials.password);

      // Ensure AuditLog recorded the creation without the password
      const audit = await db.auditLog.findFirst({
        where: { resourceId: json.user.id, action: "PLATFORM_USER_CREATED" },
      });
      expect(audit).toBeDefined();
      expect(audit?.detailsJson).not.toContain(json.initialCredentials.password);
    });

    it("prevents PLATFORM_ADMIN from assigning platform roles", async () => {
      const ts = Date.now();
      const createReq = new Request("http://localhost/api/platform/users", {
        method: "POST",
        headers: {
          authorization: `Bearer ${platformAdminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Unauthorized Role Attempt",
          email: `bad_role_${ts}@example.com`,
          platformRole: "PLATFORM_ADMIN",
        }),
      });

      const res = await createUser(createReq);
      expect(res.status).toBe(403);
    });
  });

  describe("5. Soft-delete safety restrictions", () => {
    it("prevents deleting self", async () => {
      const req = new Request(`http://localhost/api/platform/users/${superadminUser.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Self deletion attempt" }),
      });

      const res = await deleteUser(req, { params: { id: superadminUser.id } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/Нельзя удалить собственную/);
    });

    it("prevents deleting another SUPERADMIN", async () => {
      const req = new Request(`http://localhost/api/platform/users/${secondSuperadmin.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "Deleting other admin" }),
      });

      const res = await deleteUser(req, { params: { id: secondSuperadmin.id } });
      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.error).toMatch(/SUPERADMIN не может удалять другого SUPERADMIN/);
    });

    it("successfully soft-deletes a regular user and frees contacts", async () => {
      const req = new Request(`http://localhost/api/platform/users/${regularUser.id}`, {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ reason: "User requested account removal" }),
      });

      const res = await deleteUser(req, { params: { id: regularUser.id } });
      expect(res.status).toBe(200);

      const dbUser = await db.platformUser.findUnique({ where: { id: regularUser.id } });
      expect(dbUser?.deletedAt).not.toBeNull();
      expect(dbUser?.isActive).toBe(false);
      expect(dbUser?.email).toContain("_del_");

      // Soft deleted user can no longer log in
      const loginReq = new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          login: regularUser.email, // original email
          password: "Password123!",
        }),
      });
      const loginRes = await loginRoute(loginReq);
      expect(loginRes.status).toBe(401);
    });
  });

  describe("6. Reset password and session revocation", () => {
    it("resets password, marks mustChangePassword, and revokes sessions", async () => {
      // Create active session
      await db.userSession.create({
        data: {
          userId: regularUser.id,
          jtiHash: "fake_hash_123",
          expiresAt: new Date(Date.now() + 3600000),
        },
      });

      const sessionsBefore = await db.userSession.count({ where: { userId: regularUser.id } });
      expect(sessionsBefore).toBeGreaterThan(0);

      const resetReq = new Request(`http://localhost/api/platform/users/${regularUser.id}/reset-password`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
        },
      });

      const res = await resetPasswordRoute(resetReq, { params: { id: regularUser.id } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.newPassword).toBeDefined();
      expect(json.newPassword.length).toBe(16);

      // Verify sessions revoked
      const sessionsAfter = await db.userSession.count({ where: { userId: regularUser.id } });
      expect(sessionsAfter).toBe(0);

      // Verify mustChangePassword is set
      const updatedUser = await db.platformUser.findUnique({ where: { id: regularUser.id } });
      expect(updatedUser?.mustChangePassword).toBe(true);
    });
  });

  describe("7. Platform Team Management", () => {
    it("allows SUPERADMIN to manage platform team members", async () => {
      const getReq = new Request("http://localhost/api/platform/team", {
        headers: { authorization: `Bearer ${superadminToken}` },
      });
      const getRes = await getTeam(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.members.length).toBeGreaterThan(0);

      // Add a platform support staff
      const ts = Date.now();
      const postReq = new Request("http://localhost/api/platform/team", {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          fullName: "Platform Support Person",
          email: `support_staff_${ts}@platform.uz`,
          role: "PLATFORM_SUPPORT",
        }),
      });
      const postRes = await addTeamMember(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.initialPassword).toBeDefined();
    });
  });
});
