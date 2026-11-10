import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { Currency, PlatformPaymentStatus, PlatformPaymentType, PaymentMethod } from "@prisma/client";

describe("ACC-3 Item 1: Platform Finance Schema & Migrations (MRR, Center Payments, Tariffs, Platform Expenses)", () => {
  let superAdminId: string;
  let centerId: string;
  let planId: string;
  let subscriptionId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const sa = await db.platformUser.create({
      data: {
        email: `acc3_sa_${ts}@platform.com`,
        passwordHash: "hash",
        fullName: "Platform SuperAdmin",
        platformRole: "SUPERADMIN",
        emailVerified: new Date(),
      },
    });
    superAdminId = sa.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Platform Billing Center",
        slug: `pb-center-${ts}`,
        ownerId: superAdminId,
        status: "ACTIVE",
      },
    });
    centerId = center.id;

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Pro Tariff ${ts}`,
        maxStudents: 500,
        maxTeachers: 50,
        maxCourses: 100,
        maxBranches: 5,
        maxStorage: 10240,
        priceMonthly: 750000, // 750,000 UZS/month
        featuresJson: JSON.stringify({ analytics: true, customBranding: true }),
        isActive: true,
      },
    });
    planId = plan.id;

    const sub = await db.subscription.create({
      data: {
        centerId,
        planId,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date("2026-11-01T00:00:00+05:00"),
        currentPeriodEndsAt: new Date("2026-11-30T23:59:59+05:00"),
      },
    });
    subscriptionId = sub.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.platformPayment.deleteMany({ where: { centerId } });
      await db.subscription.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (planId) {
      await db.subscriptionPlan.deleteMany({ where: { id: planId } });
    }
    if (superAdminId) {
      await db.platformExpense.deleteMany({ where: { createdBy: superAdminId } });
      await db.platformUser.deleteMany({ where: { id: superAdminId } });
    }
    await db.platformExpenseCategory.deleteMany({
      where: { code: { in: ["INFRASTRUCTURE_TEST", "SMS_GATEWAY_TEST"] } },
    });
  });

  it("1. creates and manages PlatformExpenseCategory with unique constraints on name and code", async () => {
    const cat = await db.platformExpenseCategory.create({
      data: {
        name: "Серверная инфраструктура (Тест)",
        code: "INFRASTRUCTURE_TEST",
        description: "Облачные серверы, базы данных, CDN",
        isActive: true,
      },
    });
    expect(cat.id).toBeDefined();
    expect(cat.name).toBe("Серверная инфраструктура (Тест)");
    expect(cat.code).toBe("INFRASTRUCTURE_TEST");

    // Duplicate name rejected
    await expect(
      db.platformExpenseCategory.create({
        data: {
          name: "Серверная инфраструктура (Тест)",
          code: "INFRA_OTHER",
        },
      })
    ).rejects.toThrow();

    // Duplicate code rejected
    await expect(
      db.platformExpenseCategory.create({
        data: {
          name: "Другое имя",
          code: "INFRASTRUCTURE_TEST",
        },
      })
    ).rejects.toThrow();
  });

  it("2. creates PlatformExpense with integer amount in UZS and verifies storno reversal immutability", async () => {
    const cat = await db.platformExpenseCategory.create({
      data: {
        name: "SMS-шлюз (Тест)",
        code: "SMS_GATEWAY_TEST",
        description: "Отправка OTP и уведомлений родителям",
      },
    });

    const expense = await db.platformExpense.create({
      data: {
        categoryId: cat.id,
        amount: 1500000, // 1,500,000 UZS
        currency: Currency.UZS,
        date: new Date("2026-11-05T12:00:00+05:00"),
        title: "Оплата пакета SMS на ноябрь 2026",
        counterparty: "Eskiz SMS Provider",
        description: "Пакет 50,000 SMS сообщений",
        createdBy: superAdminId,
      },
    });

    expect(expense.id).toBeDefined();
    expect(expense.amount).toBe(1500000);
    expect(expense.isReversal).toBe(false);
    expect(expense.currency).toBe("UZS");

    // Storno compensating entry
    const reversal = await db.platformExpense.create({
      data: {
        categoryId: cat.id,
        amount: expense.amount,
        currency: Currency.UZS,
        date: new Date("2026-11-06T10:00:00+05:00"),
        title: "Сторно: Оплата пакета SMS на ноябрь 2026",
        counterparty: "Eskiz SMS Provider",
        isReversal: true,
        reversalOfId: expense.id,
        reversalReason: "Ошибочное дублирование счёта от провайдера",
        createdBy: superAdminId,
      },
    });

    expect(reversal.id).toBeDefined();
    expect(reversal.isReversal).toBe(true);
    expect(reversal.reversalOfId).toBe(expense.id);

    // Second reversal of the same original expense rejected by unique constraint on reversalOfId
    await expect(
      db.platformExpense.create({
        data: {
          categoryId: cat.id,
          amount: expense.amount,
          currency: Currency.UZS,
          isReversal: true,
          reversalOfId: expense.id,
          reversalReason: "Повторная попытка сторно",
          title: "Дубликат сторно",
          createdBy: superAdminId,
        },
      })
    ).rejects.toThrow();
  });

  it("3. creates PlatformPayment for center subscriptions with relations and refund tracking", async () => {
    const payment = await db.platformPayment.create({
      data: {
        centerId,
        subscriptionId,
        planId,
        amount: 750000, // 750,000 UZS
        currency: Currency.UZS,
        status: PlatformPaymentStatus.PAID,
        paymentType: PlatformPaymentType.SUBSCRIPTION,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        periodStartsAt: new Date("2026-11-01T00:00:00+05:00"),
        periodEndsAt: new Date("2026-11-30T23:59:59+05:00"),
        paidAt: new Date("2026-11-01T10:30:00+05:00"),
        invoiceNumber: "INV-PLATFORM-2026-0001",
        notes: "Оплата по счёту №42 от учебного центра",
        recordedBy: superAdminId,
      },
      include: {
        center: { select: { id: true, name: true, slug: true } },
        plan: { select: { id: true, name: true, priceMonthly: true } },
        subscription: { select: { id: true, status: true } },
        recorder: { select: { id: true, fullName: true, email: true } },
      },
    });

    expect(payment.id).toBeDefined();
    expect(payment.amount).toBe(750000);
    expect(payment.currency).toBe("UZS");
    expect(payment.status).toBe("PAID");
    expect(payment.center.id).toBe(centerId);
    expect(payment.plan?.id).toBe(planId);
    expect(payment.subscription?.id).toBe(subscriptionId);
    expect(payment.recorder?.id).toBe(superAdminId);

    // Partial refund tracking on the payment
    const updated = await db.platformPayment.update({
      where: { id: payment.id },
      data: {
        status: PlatformPaymentStatus.REFUNDED,
        refundedAt: new Date("2026-11-03T15:00:00+05:00"),
        refundAmount: 750000,
        refundReason: "Возврат по заявке центра при переходе на годовой тариф",
      },
    });

    expect(updated.status).toBe("REFUNDED");
    expect(updated.refundAmount).toBe(750000);
    expect(updated.refundReason).toContain("Возврат");
  });

  it("4. verifies MRR calculation from active subscriptions and platform P&L aggregations", async () => {
    // 1. Calculate MRR from active subscriptions
    const activeSubs = await db.subscription.findMany({
      where: { status: "ACTIVE", center: { status: "ACTIVE" } },
      include: { plan: true },
    });

    const mrr = activeSubs.reduce((acc, s) => acc + (s.plan ? s.plan.priceMonthly : 0), 0);
    expect(mrr).toBeGreaterThanOrEqual(750000);

    // 2. Aggregate platform payments (Revenue) in November 2026
    const payments = await db.platformPayment.findMany({
      where: {
        centerId,
        paidAt: {
          gte: new Date("2026-11-01T00:00:00+05:00"),
          lte: new Date("2026-11-30T23:59:59+05:00"),
        },
      },
    });
    expect(payments.length).toBeGreaterThanOrEqual(1);

    // 3. Aggregate platform expenses in November 2026
    const expenses = await db.platformExpense.findMany({
      where: {
        createdBy: superAdminId,
        date: {
          gte: new Date("2026-11-01T00:00:00+05:00"),
          lte: new Date("2026-11-30T23:59:59+05:00"),
        },
      },
    });
    expect(expenses.length).toBe(2); // 1 original + 1 reversal
    const netExpense = expenses.reduce(
      (sum, e) => sum + (e.isReversal ? -e.amount : e.amount),
      0
    );
    // 1,500,000 - 1,500,000 = 0
    expect(netExpense).toBe(0);
  });
});
