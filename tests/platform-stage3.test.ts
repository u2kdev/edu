import { describe, it, expect, beforeEach } from "vitest";
import type { PlatformUser, LearningCenter } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";

import { GET as getRegistrationsRoute } from "@/app/api/platform/registrations/route";
import { GET as exportRegistrationsRoute } from "@/app/api/platform/registrations/export/route";
import { GET as getAuditRoute } from "@/app/api/platform/audit/route";
import { GET as exportAuditRoute } from "@/app/api/platform/audit/export/route";
import { GET as getSupportRoute, POST as createTicketRoute } from "@/app/api/platform/support/route";
import { GET as getTicketDetailsRoute, PATCH as updateTicketRoute } from "@/app/api/platform/support/[id]/route";
import { POST as createTicketMessageRoute } from "@/app/api/platform/support/[id]/messages/route";
import { GET as getAnnouncementsRoute, POST as createAnnouncementRoute } from "@/app/api/platform/announcements/route";
import { POST as markAnnouncementReadRoute } from "@/app/api/platform/announcements/[id]/read/route";
import { GET as getDashboardRoute } from "@/app/api/platform/dashboard/route";

describe("Stage 3: Management Center, Registrations, Audit, Support & Announcements", () => {
  let superadminUser: PlatformUser;
  let platformAdminUser: PlatformUser;
  let regularUser: PlatformUser;

  let superadminToken: string;
  let platformAdminToken: string;
  let regularToken: string;

  let testCenter: LearningCenter;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany({});
    await db.loginAttempt.deleteMany({});

    const ts = Date.now();

    // 1. Superadmin
    superadminUser = await db.platformUser.create({
      data: {
        email: `stage3_super_${ts}@test.com`,
        fullName: "Super Admin Control",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "SUPERADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 2. Platform Admin
    platformAdminUser = await db.platformUser.create({
      data: {
        email: `stage3_pladmin_${ts}@test.com`,
        fullName: "Platform Admin Support",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "PLATFORM_ADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 3. Regular User
    regularUser = await db.platformUser.create({
      data: {
        email: `stage3_regular_${ts}@test.com`,
        fullName: "Regular Student",
        passwordHash: await hashPassword("User123!"),
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

    testCenter = await db.learningCenter.create({
      data: {
        name: `Stage3 Academy ${ts}`,
        slug: `stage3-acad-${ts}`,
        centerType: "HYBRID",
        status: "ACTIVE",
        ownerId: superadminUser.id,
      },
    });
  });

  // ==========================================
  // 1. REGISTRATIONS & EXPORT
  // ==========================================
  describe("Registrations Feed & Export", () => {
    it("returns registrations list with users and centers for platform admin", async () => {
      const req = new Request("http://localhost/api/platform/registrations?limit=50", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await getRegistrationsRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.registrations)).toBe(true);
      expect(json.registrations.length).toBeGreaterThanOrEqual(1);

      // Verify center item presence
      const centerItem = json.registrations.find((r: { id: string }) => r.id === testCenter.id);
      expect(centerItem).toBeDefined();
      expect(centerItem.kind).toBe("CENTER");
    });

    it("filters registrations by type=CENTER", async () => {
      const req = new Request("http://localhost/api/platform/registrations?type=CENTER", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await getRegistrationsRoute(req);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.registrations.every((r: { kind: string }) => r.kind === "CENTER")).toBe(true);
    });

    it("exports registrations to CSV with UTF-8 BOM", async () => {
      const req = new Request("http://localhost/api/platform/registrations/export", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await exportRegistrationsRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");

      const text = await res.text();
      expect(text).toContain("Тип объекта");
      expect(text).toContain("ФИО / Название");
    });
  });

  // ==========================================
  // 2. AUDIT LOG & PERMISSION ENFORCEMENT
  // ==========================================
  describe("Audit Log & Security", () => {
    it("allows SUPERADMIN to view audit log", async () => {
      // Create a test audit log
      await db.auditLog.create({
        data: {
          action: "TEST_STAGE3_ACTION",
          resource: "TestResource",
          actorUserId: superadminUser.id,
          centerId: testCenter.id,
          detailsJson: JSON.stringify({ note: "test-audit" }),
        },
      });

      const req = new Request("http://localhost/api/platform/audit?limit=25", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await getAuditRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.logs.some((l: { action: string }) => l.action === "TEST_STAGE3_ACTION")).toBe(true);
    });

    it("denies PLATFORM_ADMIN (no platform.audit.read permission) from viewing audit log", async () => {
      const req = new Request("http://localhost/api/platform/audit", {
        headers: { Authorization: `Bearer ${platformAdminToken}` },
      });
      const res = await getAuditRoute(req);
      expect(res.status).toBe(403);
    });

    it("exports audit log to CSV for SUPERADMIN", async () => {
      const req = new Request("http://localhost/api/platform/audit/export", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await exportAuditRoute(req);
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("text/csv");

      const text = await res.text();
      expect(text).toContain("Дата и время");
      expect(text).toContain("Действие");
    });
  });

  // ==========================================
  // 3. SUPPORT TICKETS, MESSAGES & INTERNAL NOTES
  // ==========================================
  describe("Support Ticket Workflow", () => {
    it("creates a support ticket and retrieves it", async () => {
      const req = new Request("http://localhost/api/platform/support", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${regularToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: "Stage 3 Ticket Question",
          message: "Initial client message explaining issue",
          priority: "HIGH",
          centerId: testCenter.id,
        }),
      });

      const res = await createTicketRoute(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.ticket.id).toBeDefined();

      const ticketId = json.ticket.id;

      // Staff assigns ticket and changes priority
      const patchReq = new Request(`http://localhost/api/platform/support/${ticketId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${superadminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedToId: platformAdminUser.id,
          priority: "URGENT",
        }),
      });

      const patchRes = await updateTicketRoute(patchReq, { params: { id: ticketId } });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.ticket.assignedToId).toBe(platformAdminUser.id);
      expect(patchJson.ticket.priority).toBe("URGENT");
    });

    it("staff replies to ticket: updates status and creates notification/email", async () => {
      // 1. Create ticket by regular user
      const ticket = await db.supportTicket.create({
        data: {
          subject: "Staff Reply Test Ticket",
          creatorUserId: regularUser.id,
          centerId: testCenter.id,
          status: "OPEN",
          priority: "MEDIUM",
        },
      });

      // 2. Staff replies
      const msgReq = new Request(`http://localhost/api/platform/support/${ticket.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${platformAdminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Hello! We have reviewed your request and will assist you.",
          isInternal: false,
        }),
      });

      const msgRes = await createTicketMessageRoute(msgReq, { params: { id: ticket.id } });
      expect(msgRes.status).toBe(201);

      // Verify notification created for ticket creator
      const notif = await db.notification.findFirst({
        where: {
          userId: regularUser.id,
          type: "GENERAL",
        },
        orderBy: { createdAt: "desc" },
      });
      expect(notif).toBeDefined();

      // Verify email outbox queued
      const email = await db.emailOutbox.findFirst({
        where: { to: regularUser.email },
        orderBy: { createdAt: "desc" },
      });
      expect(email).toBeDefined();
    });

    it("staff internal note: isInternal is true and does not notify client", async () => {
      const ticket = await db.supportTicket.create({
        data: {
          subject: "Internal Note Test",
          creatorUserId: regularUser.id,
          centerId: testCenter.id,
          status: "OPEN",
        },
      });

      const emailCountBefore = await db.emailOutbox.count({ where: { to: regularUser.email } });

      const msgReq = new Request(`http://localhost/api/platform/support/${ticket.id}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${superadminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Internal staff note: check client center subscription first.",
          isInternal: true,
        }),
      });

      const msgRes = await createTicketMessageRoute(msgReq, { params: { id: ticket.id } });
      expect(msgRes.status).toBe(201);

      const msgJson = await msgRes.json();
      expect(msgJson.ticketMessage.isInternal).toBe(true);

      const emailCountAfter = await db.emailOutbox.count({ where: { to: regularUser.email } });
      expect(emailCountAfter).toBe(emailCountBefore);
    });
  });

  // ==========================================
  // 4. ANNOUNCEMENTS & READ TRACKING
  // ==========================================
  describe("Platform Announcements & Read Tracking", () => {
    it("creates announcement and tracks read status", async () => {
      const createReq = new Request("http://localhost/api/platform/announcements", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${superadminToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "System Maintenance Tonight",
          body: "Scheduled maintenance will happen from 02:00 to 03:00.",
          audience: "ALL_CENTERS",
        }),
      });

      const createRes = await createAnnouncementRoute(createReq);
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      const announcementId = createJson.announcement.id;

      // Regular user marks announcement as read
      const readReq = new Request(`http://localhost/api/platform/announcements/${announcementId}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${regularToken}` },
      });

      const readRes = await markAnnouncementReadRoute(readReq, { params: { id: announcementId } });
      expect(readRes.status).toBe(200);

      // Verify read entry in DB
      const readEntry = await db.platformAnnouncementRead.findUnique({
        where: {
          announcementId_userId: {
            announcementId,
            userId: regularUser.id,
          },
        },
      });
      expect(readEntry).toBeDefined();

      // Verify GET announcements includes read count
      const listReq = new Request("http://localhost/api/platform/announcements", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const listRes = await getAnnouncementsRoute(listReq);
      const listJson = await listRes.json();
      const target = listJson.announcements.find((a: { id: string }) => a.id === announcementId);
      expect(target).toBeDefined();
      expect(target._count?.reads).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================
  // 5. DASHBOARD AGGREGATIONS (6 BLOCKS)
  // ==========================================
  describe("Dashboard 6-Blocks API", () => {
    it("aggregates all 6 blocks correctly for SUPERADMIN", async () => {
      const req = new Request("http://localhost/api/platform/dashboard?period=30d", {
        headers: { Authorization: `Bearer ${superadminToken}` },
      });
      const res = await getDashboardRoute(req);
      expect(res.status).toBe(200);

      const json = await res.json();
      expect(json.success).toBe(true);

      // Block 1: Finance
      expect(json.finance).toBeDefined();
      expect(typeof json.finance.mrr).toBe("number");
      expect(typeof json.finance.currentMonthNetRevenue).toBe("number");
      expect(json.finance.dueNext7Days).toBeDefined();
      expect(json.finance.overdueDebtors).toBeDefined();

      // Block 2: Growth
      expect(json.growth).toBeDefined();
      expect(Array.isArray(json.growth.timeline)).toBe(true);
      expect(json.growth.funnel).toBeDefined();
      expect(typeof json.growth.churnRate).toBe("number");

      // Block 3: Numbers
      expect(json.numbers).toBeDefined();
      expect(json.numbers.centers.total).toBeGreaterThanOrEqual(1);
      expect(typeof json.numbers.users.total).toBe("number");
      expect(Array.isArray(json.numbers.topCenters)).toBe(true);

      // Block 4: Attention Items
      expect(Array.isArray(json.attentionItems)).toBe(true);

      // Block 5: Events
      expect(Array.isArray(json.events)).toBe(true);

      // Block 6: Health
      expect(json.health).toBeDefined();
      expect(typeof json.health.dbPingMs).toBe("number");
      expect(json.health.dbStatus).toBe("HEALTHY");
      expect(typeof json.health.uptimeSeconds).toBe("number");
    });

    it("denies access to platform dashboard for regular user (403)", async () => {
      const req = new Request("http://localhost/api/platform/dashboard", {
        headers: { Authorization: `Bearer ${regularToken}` },
      });
      const res = await getDashboardRoute(req);
      expect(res.status).toBe(403);
    });
  });
});
