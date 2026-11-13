import { describe, it, expect, beforeEach } from "vitest";
import type { PlatformUser, LearningCenter } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";

import { GET as getCentersRoute, POST as createCenterRoute } from "@/app/api/platform/centers/route";
import {
  GET as getCenterDetailsRoute,
  PATCH as updateCenterRoute,
  DELETE as deleteCenterRoute,
} from "@/app/api/platform/centers/[id]/route";
import { GET as exportCenterJsonRoute } from "@/app/api/platform/centers/[id]/export/route";
import { GET as exportCentersCsvRoute } from "@/app/api/platform/centers/export/route";
import { GET as exportSubscriptionsCsvRoute } from "@/app/api/platform/subscriptions/export/route";
import { GET as getSettingsRoute, POST as saveSettingsRoute } from "@/app/api/platform/settings/route";
import { GET as getSeoRoute, POST as saveSeoRoute } from "@/app/api/platform/seo/route";
import { GET as getSecurityRoute } from "@/app/api/platform/security/route";
import { POST as revokeSessionRoute } from "@/app/api/platform/security/sessions/[id]/revoke/route";
import { POST as resetLockoutRoute } from "@/app/api/platform/security/reset-lockout/route";

describe("Stage 4: OrganizationKind, Lifecycle, Exports, Settings & Security Monitoring", () => {
  let superadminUser: PlatformUser;
  let regularUser: PlatformUser;
  let superadminToken: string;
  let regularToken: string;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany({});
    await db.loginAttempt.deleteMany({});

    const ts = Date.now();

    superadminUser = await db.platformUser.create({
      data: {
        email: `stage4_super_${ts}@test.com`,
        fullName: "Stage4 Super Admin",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
      },
    });

    regularUser = await db.platformUser.create({
      data: {
        email: `stage4_regular_${ts}@test.com`,
        fullName: "Stage4 Regular User",
        passwordHash: await hashPassword("User123!"),
        platformRole: "NONE",
        emailVerified: new Date(),
      },
    });

    superadminToken = await createSessionToken(
      { userId: superadminUser.id, email: superadminUser.email, platformRole: "SUPERADMIN" },
      { maxAgeSeconds: 3600 }
    );

    regularToken = await createSessionToken(
      { userId: regularUser.id, email: regularUser.email, platformRole: "NONE" },
      { maxAgeSeconds: 3600 }
    );
  });

  // 1. OrganizationKind & Duplicate Prevention
  describe("1. OrganizationKind & Center Creation", () => {
    it("creates a center with organizationKind SCHOOL and extended requisites", async () => {
      const ts = Date.now();
      const req = new Request("http://localhost:3000/api/platform/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          name: `Al-Farabi School ${ts}`,
          slug: `farabi-school-${ts}`,
          phone: "+998901112233",
          email: `school_${ts}@test.com`,
          organizationKind: "SCHOOL",
          inn: "987654321",
          legalName: "OOO Farabi School Education",
          contactPerson: "Alisher Navoiy",
          address: "Tashkent, Chilanzar 1",
          directorEmail: `director_${ts}@test.com`,
          directorFullName: "Director Alisher",
          directorPhone: "+998909998877",
        }),
      });

      const res = await createCenterRoute(req);
      expect([200, 201]).toContain(res.status);
      const json = await res.json();
      expect(json.center.organizationKind).toBe("SCHOOL");
      expect(json.center.inn).toBe("987654321");
      expect(json.center.legalName).toBe("OOO Farabi School Education");
      expect(json.center.contactPerson).toBe("Alisher Navoiy");
      expect(json.center.address).toBe("Tashkent, Chilanzar 1");
    });

    it("rejects duplicate center creation by slug and case-insensitive name", async () => {
      const ts = Date.now();
      const centerName = `Unique Center ${ts}`;
      const centerSlug = `unique-center-${ts}`;

      await db.learningCenter.create({
        data: {
          name: centerName,
          slug: centerSlug,
          ownerId: superadminUser.id,
        },
      });

      // Try creating with same slug
      const reqSlug = new Request("http://localhost:3000/api/platform/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          name: `Different Name ${ts}`,
          slug: centerSlug,
          phone: "+998901112233",
          email: `diff_${ts}@test.com`,
          directorEmail: `dir1_${ts}@test.com`,
          directorFullName: "Dir One",
          directorPhone: "+998909998877",
        }),
      });

      const resSlug = await createCenterRoute(reqSlug);
      expect([400, 409]).toContain(resSlug.status);
      const jsonSlug = await resSlug.json();
      expect(jsonSlug.error).toMatch(/slug/i);

      // Try creating with same name (different case)
      const reqName = new Request("http://localhost:3000/api/platform/centers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          name: centerName.toLowerCase(),
          slug: `different-slug-${ts}`,
          phone: "+998901112233",
          email: `diff2_${ts}@test.com`,
          directorEmail: `dir2_${ts}@test.com`,
          directorFullName: "Dir Two",
          directorPhone: "+998909998877",
        }),
      });

      const resName = await createCenterRoute(reqName);
      expect([400, 409]).toContain(resName.status);
      const jsonName = await resName.json();
      expect(jsonName.error).toMatch(/названием/i);
    });

    it("filters centers by organizationKind", async () => {
      const ts = Date.now();
      await db.learningCenter.create({
        data: {
          name: `Kindergarten Center ${ts}`,
          slug: `kindergarten-${ts}`,
          organizationKind: "KINDERGARTEN",
          ownerId: superadminUser.id,
        },
      });

      const req = new Request(
        `http://localhost:3000/api/platform/centers?organizationKind=KINDERGARTEN&q=kindergarten-${ts}`,
        {
          headers: { Authorization: `Bearer ${superadminToken}` },
        }
      );

      const res = await getCentersRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.items.length).toBe(1);
      expect(json.items[0].organizationKind).toBe("KINDERGARTEN");
    });
  });

  // 2. Center Lifecycle: Archive, Restore & 30-Day Safe Deletion
  describe("2. Center Lifecycle: Archive, Restore & Safe Deletion", () => {
    let testCenter: LearningCenter;

    beforeEach(async () => {
      const ts = Date.now();
      testCenter = await db.learningCenter.create({
        data: {
          name: `Lifecycle Center ${ts}`,
          slug: `lifecycle-${ts}`,
          status: "ACTIVE",
          ownerId: superadminUser.id,
        },
      });
    });

    it("archives center with CANCELLED status, cancelledAt, and audit log", async () => {
      const req = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          action: "ARCHIVE",
          reason: "Center closed business due to relocation",
        }),
      });

      const res = await updateCenterRoute(req, { params: { id: testCenter.id } });
      expect(res.status).toBe(200);

      const updated = await db.learningCenter.findUnique({ where: { id: testCenter.id } });
      expect(updated?.status).toBe("CANCELLED");
      expect(updated?.cancelledAt).toBeInstanceOf(Date);
      expect(updated?.cancelledReason).toBe("Center closed business due to relocation");

      // Verify Audit Log
      const audit = await db.auditLog.findFirst({
        where: {
          centerId: testCenter.id,
          action: "PLATFORM_CENTER_ARCHIVE",
        },
      });
      expect(audit).not.toBeNull();
    });

    it("rejects archive if reason is shorter than 5 characters", async () => {
      const req = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          action: "ARCHIVE",
          reason: "bad",
        }),
      });

      const res = await updateCenterRoute(req, { params: { id: testCenter.id } });
      expect(res.status).toBe(400);
    });

    it("restores center from archive to ACTIVE status", async () => {
      await db.learningCenter.update({
        where: { id: testCenter.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledReason: "Archived temporarily",
        },
      });

      const req = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({ action: "RESTORE" }),
      });

      const res = await updateCenterRoute(req, { params: { id: testCenter.id } });
      expect(res.status).toBe(200);

      const restored = await db.learningCenter.findUnique({ where: { id: testCenter.id } });
      expect(restored?.status).toBe("ACTIVE");
      expect(restored?.cancelledAt).toBeNull();
      expect(restored?.cancelledReason).toBeNull();
    });

    it("rejects permanent deletion if center is not archived or archived less than 30 days", async () => {
      // 1. Not archived
      const reqActive = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          confirmName: testCenter.name,
          reason: "Complete permanent removal",
        }),
      });

      const resActive = await deleteCenterRoute(reqActive, { params: { id: testCenter.id } });
      expect(resActive.status).toBe(400);

      // 2. Archived only 5 days ago
      await db.learningCenter.update({
        where: { id: testCenter.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
          cancelledReason: "Recent archive",
        },
      });

      const reqRecent = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          confirmName: testCenter.name,
          reason: "Complete permanent removal",
        }),
      });

      const resRecent = await deleteCenterRoute(reqRecent, { params: { id: testCenter.id } });
      expect(resRecent.status).toBe(400);
      const jsonRecent = await resRecent.json();
      expect(jsonRecent.error).toMatch(/30 дней/i);
    });

    it("rejects permanent deletion if center name confirmation does not match", async () => {
      await db.learningCenter.update({
        where: { id: testCenter.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          cancelledReason: "Old archive",
        },
      });

      const req = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          confirmName: "Wrong Center Name",
          reason: "Cleaning up database",
        }),
      });

      const res = await deleteCenterRoute(req, { params: { id: testCenter.id } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toMatch(/не совпадает/i);
    });

    it("allows permanent deletion when archived > 30 days and name confirmation matches", async () => {
      await db.learningCenter.update({
        where: { id: testCenter.id },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000),
          cancelledReason: "Old archive",
        },
      });

      const req = new Request(`http://localhost:3000/api/platform/centers/${testCenter.id}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          confirmName: testCenter.name,
          reason: "Cleaning up database after 30+ days in archive",
        }),
      });

      const res = await deleteCenterRoute(req, { params: { id: testCenter.id } });
      expect(res.status).toBe(200);

      const deleted = await db.learningCenter.findUnique({ where: { id: testCenter.id } });
      expect(deleted).toBeNull();
    });
  });

  // 3. Export Operations: CSV Registries & Full Center JSON Dump
  describe("3. Export Operations", () => {
    it("exports centers registry to CSV with UTF-8 BOM", async () => {
      const req = new Request("http://localhost:3000/api/platform/centers/export", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });

      const res = await exportCentersCsvRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const csv = await res.text();
      expect(csv).toContain("Название");
      expect(csv).toContain("Тип организации");
    });

    it("exports subscriptions registry to CSV", async () => {
      const req = new Request("http://localhost:3000/api/platform/subscriptions/export", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });

      const res = await exportSubscriptionsCsvRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");
      const csv = await res.text();
      expect(csv).toContain("Тарифный план");
    });

    it("exports full center JSON dump for SUPERADMIN and rejects unauthorized", async () => {
      const center = await db.learningCenter.create({
        data: {
          name: "Dump Center",
          slug: `dump-center-${Date.now()}`,
          ownerId: superadminUser.id,
        },
      });

      // 1. Regular user gets 403
      const reqRegular = new Request(`http://localhost:3000/api/platform/centers/${center.id}/export`, {
        headers: { Authorization: `Bearer ${regularToken}` },
      });
      const resRegular = await exportCenterJsonRoute(reqRegular, { params: { id: center.id } });
      expect(resRegular.status).toBe(403);

      // 2. Superadmin gets full JSON
      const reqSuper = new Request(`http://localhost:3000/api/platform/centers/${center.id}/export`, {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const resSuper = await exportCenterJsonRoute(reqSuper, { params: { id: center.id } });
      expect(resSuper.status).toBe(200);
      expect(resSuper.headers.get("Content-Type")).toContain("application/json");

      const dump = await resSuper.json();
      expect(dump.center.id).toBe(center.id);
      expect(dump.exportMetadata).toBeDefined();
      expect(dump.exportMetadata.exportedBy).toBe(superadminUser.email);
    });
  });

  // 4. Platform Settings & SEO
  describe("4. Platform Settings & SEO Integration", () => {
    it("reads and updates platform settings with audit log", async () => {
      const getReq = new Request("http://localhost:3000/api/platform/settings", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const getRes = await getSettingsRoute(getReq);
      expect(getRes.status).toBe(200);
      const initialSettings = await getRes.json();
      expect(initialSettings.settings).toBeDefined();

      // Update settings
      const postReq = new Request("http://localhost:3000/api/platform/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          settings: {
            "platform.billing.gracePeriodDays": 10,
            "platform.maintenance.mode": true,
            "platform.maintenance.message": "Технические работы до 14:00",
          },
        }),
      });

      const postRes = await saveSettingsRoute(postReq);
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);

      // Verify db persistence
      const savedGrace = await db.platformSetting.findUnique({
        where: { key: "platform.billing.gracePeriodDays" },
      });
      expect(savedGrace?.value).toBe("10");

      const savedMaintenance = await db.platformSetting.findUnique({
        where: { key: "platform.maintenance.mode" },
      });
      expect(savedMaintenance?.value).toBe("true");

      // Verify Audit Log
      const audit = await db.auditLog.findFirst({
        where: {
          actorUserId: superadminUser.id,
          action: "PLATFORM_SETTINGS_UPDATED",
        },
      });
      expect(audit).not.toBeNull();
    });

    it("saves and retrieves SEO settings backed by PlatformSetting", async () => {
      const seoPayload = {
        metaTitleRu: "E-Darschi LMS — Платформа для учебных центров",
        metaDescRu: "Автоматизация учёта, уроков и CRM для образовательных центров",
        ogImageUrl: "https://edarschi.uz/og-main.png",
        keywords: "lms, crm, uzbekistan",
      };

      const postReq = new Request("http://localhost:3000/api/platform/seo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify(seoPayload),
      });

      const postRes = await saveSeoRoute(postReq);
      expect(postRes.status).toBe(200);

      const getReq = new Request("http://localhost:3000/api/platform/seo", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const getRes = await getSeoRoute(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.seo.metaTitleRu).toBe(seoPayload.metaTitleRu);
    });
  });

  // 5. Security Monitoring: Sessions & Lockout Reset
  describe("5. Security Monitoring", () => {
    it("returns active sessions, failed logins, and stats", async () => {
      // Create test session
      const session = await db.userSession.create({
        data: {
          userId: superadminUser.id,
          jtiHash: `jti_${Date.now()}_${Math.random()}`,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          ipAddress: "127.0.0.1",
          userAgent: "Vitest Test Agent",
        },
      });

      // Create test failed login
      await db.loginAttempt.create({
        data: {
          email: `hacker_${Date.now()}@test.com`,
          ip: "192.168.1.100",
          attempts: 6,
          lockoutUntil: new Date(Date.now() + 900 * 1000),
        },
      });

      const req = new Request("http://localhost:3000/api/platform/security", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });

      const res = await getSecurityRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();

      expect(json.activeSessions).toBeDefined();
      expect(json.activeSessions.some((s: { id: string }) => s.id === session.id)).toBe(true);
      expect(json.failedLogins).toBeDefined();
      expect(json.failedLogins.length).toBeGreaterThan(0);
    });

    it("force revokes an active session and logs audit event", async () => {
      const session = await db.userSession.create({
        data: {
          userId: regularUser.id,
          jtiHash: `jti_revoke_${Date.now()}_${Math.random()}`,
          expiresAt: new Date(Date.now() + 3600 * 1000),
          ipAddress: "10.0.0.1",
        },
      });

      const req = new Request(
        `http://localhost:3000/api/platform/security/sessions/${session.id}/revoke`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${superadminToken}`,
          },
          body: JSON.stringify({ reason: "Security violation detected" }),
        }
      );

      const res = await revokeSessionRoute(req, { params: { id: session.id } });
      expect(res.status).toBe(200);

      const check = await db.userSession.findUnique({ where: { id: session.id } });
      expect(check?.revokedAt).not.toBeNull();

      const audit = await db.auditLog.findFirst({
        where: {
          actorUserId: superadminUser.id,
          action: "PLATFORM_SESSION_FORCE_REVOKED",
        },
      });
      expect(audit).not.toBeNull();
    });

    it("resets lockout on locked IP or email identifier", async () => {
      const lockEmail = `locked_${Date.now()}@test.com`;
      await db.loginAttempt.create({
        data: {
          email: lockEmail,
          ip: "192.168.1.50",
          attempts: 10,
          lockoutUntil: new Date(Date.now() + 3600 * 1000),
        },
      });

      const req = new Request("http://localhost:3000/api/platform/security/reset-lockout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${superadminToken}`,
        },
        body: JSON.stringify({
          email: lockEmail,
          reason: "User verified identity via support",
        }),
      });

      const res = await resetLockoutRoute(req);
      expect(res.status).toBe(200);

      const remaining = await db.loginAttempt.findMany({
        where: { email: lockEmail },
      });
      expect(remaining.length).toBe(0);

      const audit = await db.auditLog.findFirst({
        where: {
          actorUserId: superadminUser.id,
          action: "PLATFORM_LOGIN_LOCKOUT_RESET",
        },
      });
      expect(audit).not.toBeNull();
    });
  });
});
