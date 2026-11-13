import { describe, it, expect, beforeEach } from "vitest";
import type { PlatformUser, LearningCenter, SubscriptionPlan, Subscription } from "@prisma/client";
import { db } from "@/lib/db";
import { createSessionToken, hashPassword } from "@/lib/auth";
import { calculatePlatformMRR, generateNextInvoiceNumber } from "@/lib/platform-finance";
import { processSubscriptionCron } from "@/lib/platform-subscription-cron";
import { POST as recordPaymentRoute } from "@/app/api/platform/finance/payments/route";
import { POST as refundPaymentRoute } from "@/app/api/platform/finance/payments/[id]/refund/route";
import { POST as createExpenseRoute } from "@/app/api/platform/finance/expenses/route";
import { POST as stornoExpenseRoute } from "@/app/api/platform/finance/expenses/[id]/storno/route";
import { PATCH as updateSubscriptionRoute } from "@/app/api/platform/subscriptions/[id]/route";

describe("Stage 2: Subscriptions & Platform Finance", () => {
  let superadminUser: PlatformUser;
  let platformAdminUser: PlatformUser;
  let regularUser: PlatformUser;

  let superadminToken: string;
  let platformAdminToken: string;
  let regularToken: string;

  let testCenter: LearningCenter;
  let smallPlan: SubscriptionPlan;
  let largePlan: SubscriptionPlan;
  let testSubscription: Subscription;

  beforeEach(async () => {
    await db.rateLimitRecord.deleteMany({});
    await db.loginAttempt.deleteMany({});

    const ts = Date.now();

    // 1. Superadmin
    superadminUser = await db.platformUser.create({
      data: {
        email: `stage2_super_${ts}@test.com`,
        fullName: "Super Admin Finance",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "SUPERADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 2. Platform Admin
    platformAdminUser = await db.platformUser.create({
      data: {
        email: `stage2_pladmin_${ts}@test.com`,
        fullName: "Platform Admin Finance",
        passwordHash: await hashPassword("Admin123!"),
        platformRole: "PLATFORM_ADMIN",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    // 3. Regular User
    regularUser = await db.platformUser.create({
      data: {
        email: `stage2_regular_${ts}@test.com`,
        fullName: "Regular User",
        passwordHash: await hashPassword("Password123!"),
        platformRole: "NONE",
        preferredLanguage: "ru",
        emailVerified: new Date(),
      },
    });

    superadminToken = await createSessionToken(
      { userId: superadminUser.id, email: superadminUser.email, platformRole: "SUPERADMIN" },
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

    // Plans
    smallPlan = await db.subscriptionPlan.create({
      data: {
        name: `Small Plan ${ts}`,
        maxStudents: 5,
        maxTeachers: 2,
        maxCourses: 3,
        priceMonthly: 300000,
      },
    });

    largePlan = await db.subscriptionPlan.create({
      data: {
        name: `Large Plan ${ts}`,
        maxStudents: 100,
        maxTeachers: 20,
        maxCourses: 50,
        priceMonthly: 1200000,
      },
    });

    // Center
    testCenter = await db.learningCenter.create({
      data: {
        name: `Finance Test Center ${ts}`,
        slug: `finance-center-${ts}`,
        status: "TRIAL",
        ownerId: regularUser.id,
      },
    });

    // Subscription
    testSubscription = await db.subscription.create({
      data: {
        centerId: testCenter.id,
        planId: largePlan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  });

  describe("1. Subscription limits & plan change", () => {
    it("checks student limit and warns when downgrading without force", async () => {
      // Add 10 student memberships to testCenter (exceeding smallPlan maxStudents of 5)
      for (let i = 0; i < 7; i++) {
        const u = await db.platformUser.create({
          data: {
            email: `stud_${i}_${Date.now()}@test.com`,
            fullName: `Student ${i}`,
            passwordHash: "hash",
          },
        });
        await db.centerMembership.create({
          data: {
            userId: u.id,
            centerId: testCenter.id,
            role: "STUDENT",
            status: "ACTIVE",
          },
        });
      }

      // Try to downgrade without force
      const req = new Request(`http://localhost/api/platform/subscriptions/${testSubscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({ planId: smallPlan.id }),
      });

      const res = await updateSubscriptionRoute(req, { params: { id: testSubscription.id } });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.requiresOverride).toBe(true);

      // Now with force: true
      const forceReq = new Request(`http://localhost/api/platform/subscriptions/${testSubscription.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({ planId: smallPlan.id, force: true }),
      });

      const forceRes = await updateSubscriptionRoute(forceReq, { params: { id: testSubscription.id } });
      expect(forceRes.status).toBe(200);
      const updatedSub = await db.subscription.findUnique({ where: { id: testSubscription.id } });
      expect(updatedSub?.planId).toBe(smallPlan.id);
    });
  });

  describe("2. Payment Recording & Subscription Auto-Extension", () => {
    it("records payment, generates invoice INV-YYYY-XXXX, extends subscription, and sets center to ACTIVE", async () => {
      const prevEnd = testSubscription.currentPeriodEndsAt.getTime();

      const req = new Request("http://localhost/api/platform/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          centerId: testCenter.id,
          planId: largePlan.id,
          amount: 1200000,
          paymentMethod: "BANK_TRANSFER",
          paymentType: "SUBSCRIPTION",
          status: "PAID",
          notes: "Оплата по договору №102",
        }),
      });

      const res = await recordPaymentRoute(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.payment.invoiceNumber).toMatch(/^INV-\d{4}-\d{4}$/);
      expect(json.payment.amount).toBe(1200000);

      // Verify subscription extended
      const sub = await db.subscription.findUnique({ where: { id: testSubscription.id } });
      expect(sub?.status).toBe("ACTIVE");
      expect(sub!.currentPeriodEndsAt.getTime()).toBeGreaterThan(prevEnd);

      // Verify center status became ACTIVE
      const center = await db.learningCenter.findUnique({ where: { id: testCenter.id } });
      expect(center?.status).toBe("ACTIVE");

      // Verify AuditLog
      const audit = await db.auditLog.findFirst({
        where: { action: "PLATFORM_PAYMENT_RECORDED", resourceId: json.payment.id },
      });
      expect(audit).toBeTruthy();
    });
  });

  describe("3. Payment Refunds & Permissions", () => {
    it("blocks PLATFORM_ADMIN from making refunds (SUPERADMIN only)", async () => {
      const payment = await db.platformPayment.create({
        data: {
          centerId: testCenter.id,
          amount: 500000,
          status: "PAID",
          invoiceNumber: "INV-TEST-0001",
        },
      });

      const req = new Request(`http://localhost/api/platform/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${platformAdminToken}` },
        body: JSON.stringify({
          refundAmount: 200000,
          reason: "Ошибочный перевод средств клиентом",
        }),
      });

      const res = await refundPaymentRoute(req, { params: { id: payment.id } });
      expect(res.status).toBe(403);
    });

    it("allows SUPERADMIN to refund partially and fully with mandatory reason >= 5 chars", async () => {
      const payment = await db.platformPayment.create({
        data: {
          centerId: testCenter.id,
          amount: 500000,
          status: "PAID",
          invoiceNumber: "INV-TEST-0002",
        },
      });

      // Reason too short (< 5 chars)
      const shortReasonReq = new Request(`http://localhost/api/platform/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          refundAmount: 100000,
          reason: "Err",
        }),
      });
      const shortRes = await refundPaymentRoute(shortReasonReq, { params: { id: payment.id } });
      expect(shortRes.status).toBe(400);

      // Partial refund: 200,000 UZS
      const partialReq = new Request(`http://localhost/api/platform/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          refundAmount: 200000,
          reason: "Частичный возврат по согласованию сторон",
        }),
      });
      const partRes = await refundPaymentRoute(partialReq, { params: { id: payment.id } });
      expect(partRes.status).toBe(200);

      let p = await db.platformPayment.findUnique({ where: { id: payment.id } });
      expect(p?.refundAmount).toBe(200000);
      expect(p?.status).toBe("PAID"); // still partially paid

      // Refund exceeding available (400,000 > 300,000 remaining)
      const overReq = new Request(`http://localhost/api/platform/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          refundAmount: 400000,
          reason: "Попытка превышения лимита возврата",
        }),
      });
      const overRes = await refundPaymentRoute(overReq, { params: { id: payment.id } });
      expect(overRes.status).toBe(400);

      // Full remaining refund: 300,000 UZS
      const fullReq = new Request(`http://localhost/api/platform/finance/payments/${payment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          refundAmount: 300000,
          reason: "Окончательный возврат остатка",
        }),
      });
      const fullRes = await refundPaymentRoute(fullReq, { params: { id: payment.id } });
      expect(fullRes.status).toBe(200);

      p = await db.platformPayment.findUnique({ where: { id: payment.id } });
      expect(p?.refundAmount).toBe(500000);
      expect(p?.status).toBe("REFUNDED");
    });
  });

  describe("4. Platform Expenses & Storno", () => {
    it("creates expense and performs storno reversal without deleting", async () => {
      const cat = await db.platformExpenseCategory.upsert({
        where: { name: "Хостинг и сервера" },
        update: {},
        create: { name: "Хостинг и сервера", code: "HOSTING" },
      });

      // Create expense
      const createReq = new Request("http://localhost/api/platform/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          categoryId: cat.id,
          amount: 450000,
          title: "Оплата серверов Hetzner",
          counterparty: "Hetzner Online",
        }),
      });

      const createRes = await createExpenseRoute(createReq);
      expect(createRes.status).toBe(200);
      const expJson = await createRes.json();
      const expenseId = expJson.expense.id;

      // Storno reversal
      const stornoReq = new Request(`http://localhost/api/platform/finance/expenses/${expenseId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          reason: "Ошибочное двойное списание средств",
        }),
      });

      const stornoRes = await stornoExpenseRoute(stornoReq, { params: { id: expenseId } });
      expect(stornoRes.status).toBe(200);
      const stornoJson = await stornoRes.json();
      expect(stornoJson.reversal.isReversal).toBe(true);
      expect(stornoJson.reversal.reversalOfId).toBe(expenseId);
      expect(stornoJson.reversal.amount).toBe(450000);

      // Verify cannot storno again
      const repeatReq = new Request(`http://localhost/api/platform/finance/expenses/${expenseId}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          reason: "Повторная попытка сторно",
        }),
      });
      const repeatRes = await stornoExpenseRoute(repeatReq, { params: { id: expenseId } });
      expect(repeatRes.status).toBe(400);

      // Verify cannot storno the reversal itself
      const stornoReversalReq = new Request(`http://localhost/api/platform/finance/expenses/${stornoJson.reversal.id}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: `session=${superadminToken}` },
        body: JSON.stringify({
          reason: "Попытка сторнировать сторно",
        }),
      });
      const stornoRevRes = await stornoExpenseRoute(stornoReversalReq, { params: { id: stornoJson.reversal.id } });
      expect(stornoRevRes.status).toBe(400);
    });
  });

  describe("5. Subscriptions Cron & Center Transitions", () => {
    it("handles expired subscriptions, idempotency, and transitions center to OVERDUE and PAUSED", async () => {
      // Create an expired subscription
      const expiredCenter = await db.learningCenter.create({
        data: {
          name: `Expired Center ${Date.now()}`,
          slug: `exp-center-${Date.now()}`,
          status: "ACTIVE",
          ownerId: regularUser.id,
        },
      });

      const expiredSub = await db.subscription.create({
        data: {
          centerId: expiredCenter.id,
          planId: smallPlan.id,
          status: "ACTIVE",
          currentPeriodStartsAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
          currentPeriodEndsAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // expired 10 days ago
        },
      });

      // Run cron: moves to PAST_DUE & OVERDUE, and since > 5 days grace period -> moves to PAUSED
      const res1 = await processSubscriptionCron({ now: new Date(), gracePeriodDays: 5 });
      expect(res1.overdueCount).toBeGreaterThanOrEqual(1);

      const subAfter = await db.subscription.findUnique({ where: { id: expiredSub.id } });
      expect(subAfter?.status).toBe("PAST_DUE");

      const centerAfter = await db.learningCenter.findUnique({ where: { id: expiredCenter.id } });
      expect(centerAfter?.status).toBe("PAUSED");

      // Idempotency check: running cron again should not resend duplicate notifications
      const notifCount1 = await db.notification.count({ where: { centerId: expiredCenter.id } });
      const res2 = await processSubscriptionCron({ now: new Date(), gracePeriodDays: 5 });
      const notifCount2 = await db.notification.count({ where: { centerId: expiredCenter.id } });
      expect(notifCount2).toBe(notifCount1);
    });
  });

  describe("6. Platform MRR and Financial Metrics", () => {
    it("calculates accurate MRR, ARR, and ARPU based on active paid plans", async () => {
      const stats = await calculatePlatformMRR();
      expect(stats.mrr).toBeGreaterThan(0);
      expect(stats.arr).toBe(stats.mrr * 12);
      expect(stats.activeSubscriptionsCount).toBeGreaterThan(0);
      expect(stats.arpu).toBe(Math.round(stats.mrr / stats.activeSubscriptionsCount));
    });
  });
});
