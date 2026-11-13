import { describe, it, expect, beforeEach } from "vitest";
import type { PlatformUser } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, signJWT } from "@/lib/auth";
import { requireDeveloper, requirePlatformPermission } from "@/lib/platformAuth";
import { POST as stopImpersonate } from "@/app/api/platform/impersonate/stop/route";
import { POST as createCenter } from "@/app/api/platform/centers/route";
import { POST as changeDirector } from "@/app/api/platform/centers/[id]/director/route";
import { GET as getAnnouncements, POST as createAnnouncement, PATCH as patchAnnouncement, DELETE as deleteAnnouncement } from "@/app/api/platform/announcements/route";
import { ORIGINAL_SESSION_COOKIE } from "@/lib/impersonation";
import { isEmailConfigured } from "@/lib/email";

describe("Stage 0: Platform Defect Fixes & Hardening", () => {
  let superadminUser: PlatformUser;
  let devUser: PlatformUser;
  let platformAdminUser: PlatformUser;
  let regularUser: PlatformUser;
  let superadminToken: string;
  let devToken: string;
  let platformAdminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany({});
    await db.loginAttempt.deleteMany({});

    const ts = Date.now();

    superadminUser = await db.platformUser.create({
      data: {
        email: `super_${ts}@platform.com`,
        fullName: "Test Superadmin",
        passwordHash: "hash123",
        platformRole: "SUPERADMIN",
      },
    });

    devUser = await db.platformUser.create({
      data: {
        email: `dev_${ts}@platform.com`,
        fullName: "Test Developer",
        passwordHash: "hash123",
        platformRole: "DEVELOPER",
      },
    });

    platformAdminUser = await db.platformUser.create({
      data: {
        email: `admin_${ts}@platform.com`,
        fullName: "Test Platform Admin",
        passwordHash: "hash123",
        platformRole: "PLATFORM_ADMIN",
      },
    });

    regularUser = await db.platformUser.create({
      data: {
        email: `user_${ts}@example.com`,
        fullName: "Regular User",
        passwordHash: "hash123",
        platformRole: "NONE",
      },
    });

    superadminToken = await createSessionToken(
      { userId: superadminUser.id, email: superadminUser.email, platformRole: "SUPERADMIN" },
      { maxAgeSeconds: 3600 }
    );
    devToken = await createSessionToken(
      { userId: devUser.id, email: devUser.email, platformRole: "DEVELOPER" },
      { maxAgeSeconds: 3600 }
    );
    platformAdminToken = await createSessionToken(
      { userId: platformAdminUser.id, email: platformAdminUser.email, platformRole: "PLATFORM_ADMIN" },
      { maxAgeSeconds: 3600 }
    );
    regularToken = await createSessionToken(
      { userId: regularUser.id, email: regularUser.email, platformRole: "NONE" },
      { maxAgeSeconds: 3600 }
    );
  });

  describe("1. requireDeveloper only allows DEVELOPER", () => {
    it("allows DEVELOPER", async () => {
      const req = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${devToken}` },
      });
      const session = await requireDeveloper(req);
      expect(session.user.platformRole).toBe("DEVELOPER");
    });

    it("rejects SUPERADMIN with Forbidden error", async () => {
      const req = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${superadminToken}` },
      });
      await expect(requireDeveloper(req)).rejects.toThrow("Forbidden: Developer privileges required");
    });

    it("rejects PLATFORM_ADMIN and regular users", async () => {
      const reqAdmin = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${platformAdminToken}` },
      });
      await expect(requireDeveloper(reqAdmin)).rejects.toThrow("Forbidden");

      const reqUser = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${regularToken}` },
      });
      await expect(requireDeveloper(reqUser)).rejects.toThrow("Forbidden");
    });
  });

  describe("2. requirePlatformPermission", () => {
    it("checks granular permission against user role", async () => {
      const reqSuper = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${superadminToken}` },
      });
      const session = await requirePlatformPermission("platform.plans.manage", reqSuper);
      expect(session.user.id).toBe(superadminUser.id);
    });

    it("throws Forbidden if role lacks permission", async () => {
      const reqUser = new Request("http://localhost/api/test", {
        headers: { authorization: `Bearer ${regularToken}` },
      });
      await expect(requirePlatformPermission("platform.plans.manage", reqUser)).rejects.toThrow(
        "Forbidden: platform.plans.manage required"
      );
    });
  });

  describe("3. Stop Impersonation API", () => {
    it("fails with 400 when no impersonation cookie exists", async () => {
      const req = new Request("http://localhost/api/platform/impersonate/stop", {
        method: "POST",
      });
      const res = await stopImpersonate(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/No active impersonation session/);
    });

    it("successfully stops impersonation, restores original session and writes audit log", async () => {
      const originalWrapper = signJWT(
        {
          userId: superadminUser.id,
          email: superadminUser.email,
          platformRole: "SUPERADMIN",
          impersonatedUserId: regularUser.id,
          startedAt: Date.now(),
        },
        "60m"
      );

      const req = new Request("http://localhost/api/platform/impersonate/stop", {
        method: "POST",
        headers: {
          cookie: `${ORIGINAL_SESSION_COOKIE}=${originalWrapper}`,
        },
      });

      const res = await stopImpersonate(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.redirectUrl).toBe("/platform-admin");

      // Verify audit log recorded
      const log = await db.auditLog.findFirst({
        where: {
          action: "PLATFORM_IMPERSONATION_STOPPED",
          actorUserId: superadminUser.id,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(log).toBeDefined();
    });
  });

  describe("4. resetUrl in centers creation & director change", () => {
    it("returns resetUrl to SUPERADMIN on center creation", async () => {
      const slug = `ts0-c-${Date.now()}`;
      const directorEmail = `ts0_dir_${Date.now()}@example.com`;
      const req = new Request("http://localhost/api/platform/centers", {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Test Center Stage 0",
          slug,
          directorEmail,
          directorFullName: "Stage 0 Director",
        }),
      });

      const res = await createCenter(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.resetUrl).toBeDefined();
      expect(json.resetUrl).toContain("/reset-password?token=");
    });

    it("does NOT return resetUrl to non-SUPERADMIN on center creation", async () => {
      const slug = `ts0-padmin-${Date.now()}`;
      const directorEmail = `ts0_padm_dir_${Date.now()}@example.com`;
      const req = new Request("http://localhost/api/platform/centers", {
        method: "POST",
        headers: {
          authorization: `Bearer ${platformAdminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: "Admin Center Stage 0",
          slug,
          directorEmail,
          directorFullName: "Admin Director",
        }),
      });

      const res = await createCenter(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.resetUrl).toBeUndefined();
    });

    it("returns resetUrl to SUPERADMIN when changing director to new email", async () => {
      // First create a center
      const center = await db.learningCenter.create({
        data: {
          name: `Director Change Center ${Date.now()}`,
          slug: `dc-center-${Date.now()}`,
          ownerId: regularUser.id,
        },
      });

      const newEmail = `brand_new_dir_${Date.now()}@example.com`;
      const req = new Request(`http://localhost/api/platform/centers/${center.id}/director`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: newEmail }),
      });

      const res = await changeDirector(req, { params: { id: center.id } });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.resetUrl).toBeDefined();
      expect(json.resetUrl).toContain("/reset-password?token=");
    });
  });

  describe("5. PlatformAnnouncement API CRUD", () => {
    it("creates, reads, updates, and deletes platform announcements", async () => {
      // 1. Create
      const postReq = new Request("http://localhost/api/platform/announcements", {
        method: "POST",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "System Maintenance Notice",
          body: "Scheduled database upgrade tonight from 02:00 to 03:00 UTC",
          audience: "ALL_CENTERS",
        }),
      });

      const postRes = await createAnnouncement(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      const announcementId = postJson.announcement.id;

      // 2. Read
      const getReq = new Request("http://localhost/api/platform/announcements", {
        headers: { authorization: `Bearer ${superadminToken}` },
      });
      const getRes = await getAnnouncements(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.announcements.some((a: { id: string }) => a.id === announcementId)).toBe(true);

      // 3. Update
      const patchReq = new Request("http://localhost/api/platform/announcements", {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          id: announcementId,
          title: "Updated Maintenance Notice",
        }),
      });
      const patchRes = await patchAnnouncement(patchReq);
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.announcement.title).toBe("Updated Maintenance Notice");

      // 4. Delete requires reason
      const badDeleteReq = new Request("http://localhost/api/platform/announcements", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: announcementId, reason: "bad" }),
      });
      const badDeleteRes = await deleteAnnouncement(badDeleteReq);
      expect(badDeleteRes.status).toBe(400);

      // 5. Valid Delete
      const deleteReq = new Request("http://localhost/api/platform/announcements", {
        method: "DELETE",
        headers: {
          authorization: `Bearer ${superadminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ id: announcementId, reason: "Announcement is no longer relevant" }),
      });
      const deleteRes = await deleteAnnouncement(deleteReq);
      expect(deleteRes.status).toBe(200);
      const deleteJson = await deleteRes.json();
      expect(deleteJson.success).toBe(true);
    });

    it("rejects non-platform roles from managing announcements", async () => {
      const postReq = new Request("http://localhost/api/platform/announcements", {
        method: "POST",
        headers: {
          authorization: `Bearer ${regularToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Hack announcement",
          body: "This should fail",
        }),
      });

      const res = await createAnnouncement(postReq);
      expect(res.status).toBe(403);
    });
  });

  describe("6. Email configuration check", () => {
    it("isEmailConfigured returns false when EMAIL_PROVIDER=memory in production", () => {
      const origProvider = process.env.EMAIL_PROVIDER;
      const origEnv = process.env.NODE_ENV;

      process.env.EMAIL_PROVIDER = "memory";
      (process.env as Record<string, string | undefined>).NODE_ENV = "production";
      expect(isEmailConfigured()).toBe(false);

      process.env.EMAIL_PROVIDER = "resend";
      delete process.env.RESEND_API_KEY;
      expect(isEmailConfigured()).toBe(false);

      process.env.RESEND_API_KEY = "re_test_key_123";
      expect(isEmailConfigured()).toBe(true);

      process.env.EMAIL_PROVIDER = origProvider;
      (process.env as Record<string, string | undefined>).NODE_ENV = origEnv;
    });
  });
});
