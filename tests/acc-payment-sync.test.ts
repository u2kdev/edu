import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import {
  calculateAccountBalance,
  syncCenterPaymentToFinance,
  syncCenterPaymentRefundToFinance,
} from "../src/lib/finance";

describe("ACC-1 Item 2: CenterPayment <-> FinanceTransaction Idempotent Sync & Refund Storno", () => {
  let centerId: string;
  let directorUserId: string;
  let studentUserId: string;
  let studentMemberId: string;
  let groupId: string;
  let courseId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const director = await db.platformUser.create({
      data: {
        email: `acc2_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Payment Sync",
        emailVerified: new Date(),
      },
    });
    directorUserId = director.id;

    const student = await db.platformUser.create({
      data: {
        email: `acc2_std_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Student Payment Sync",
        emailVerified: new Date(),
      },
    });
    studentUserId = student.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Payment Sync Center",
        slug: `pay-sync-${ts}`,
        status: "ACTIVE",
        ownerId: directorUserId,
      },
    });
    centerId = center.id;

    const dirMember = await db.centerMembership.create({
      data: {
        centerId,
        userId: directorUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const stdMember = await db.centerMembership.create({
      data: {
        centerId,
        userId: studentUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMemberId = stdMember.id;

    const course = await db.course.create({
      data: {
        centerId,
        title: "English B2",
        priceMonthly: 600000,
        createdByMembershipId: dirMember.id,
      },
    });
    courseId = course.id;

    const group = await db.group.create({
      data: {
        centerId,
        courseId,
        name: "ENG-B2-01",
      },
    });
    groupId = group.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.centerPayment.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    const uIds = [directorUserId, studentUserId].filter(Boolean);
    if (uIds.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: uIds } } });
    }
  });

  it("1. concurrent Promise.all calls to syncCenterPaymentToFinance create exactly ONE INCOME FinanceTransaction (no duplicates)", async () => {
    const tenantDb = getTenantDb(centerId);
    const payment = await tenantDb.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: studentMemberId,
        groupId,
        amount: 600000,
        originalAmount: 600000,
        discountAmount: 0,
        currency: "UZS",
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: new Date("2026-10-05T10:00:00+05:00"),
      },
    });

    // Fire 5 concurrent sync calls via Promise.all
    const results = await Promise.all([
      syncCenterPaymentToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
      }),
      syncCenterPaymentToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
      }),
      syncCenterPaymentToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
      }),
      syncCenterPaymentToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
      }),
      syncCenterPaymentToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
      }),
    ]);

    const nonNull = results.filter(Boolean);
    expect(nonNull.length).toBe(5);
    const uniqueTxIds = new Set(nonNull.map((r) => r!.id));
    expect(uniqueTxIds.size).toBe(1);

    const txsInDb = await tenantDb.financeTransaction.findMany({
      where: { centerPaymentId: payment.id, isReversal: false },
    });
    expect(txsInDb.length).toBe(1);
    expect(txsInDb[0].amount).toBe(600000);
    expect(txsInDb[0].type).toBe("INCOME");
    expect(txsInDb[0].groupId).toBe(groupId);
    expect(txsInDb[0].courseId).toBe(courseId);

    const balance = await calculateAccountBalance(centerId, txsInDb[0].accountId);
    expect(balance).toBe(600000);
  });

  it("2. refunding a CenterPayment creates a reversal (storno) transaction once and restores account balance to 0", async () => {
    const tenantDb = getTenantDb(centerId);
    const payment = await tenantDb.centerPayment.findFirstOrThrow({
      where: { studentMembershipId: studentMemberId },
    });

    await tenantDb.centerPayment.update({
      where: { id: payment.id },
      data: {
        status: "REFUNDED",
        refundedAt: new Date("2026-10-06T12:00:00+05:00"),
      },
    });

    // Fire 3 concurrent refund syncs via Promise.all
    const refundResults = await Promise.all([
      syncCenterPaymentRefundToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
        reason: "Возврат оплаты студенту",
      }),
      syncCenterPaymentRefundToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
        reason: "Возврат оплаты студенту",
      }),
      syncCenterPaymentRefundToFinance({
        centerId,
        paymentId: payment.id,
        actorUserId: directorUserId,
        reason: "Возврат оплаты студенту",
      }),
    ]);

    const nonNull = refundResults.filter(Boolean);
    expect(nonNull.length).toBe(3);
    const uniqueReversalIds = new Set(nonNull.map((r) => r!.id));
    expect(uniqueReversalIds.size).toBe(1);

    const reversals = await tenantDb.financeTransaction.findMany({
      where: { centerPaymentId: payment.id, isReversal: true },
    });
    expect(reversals.length).toBe(1);
    expect(reversals[0].isReversal).toBe(true);
    expect(reversals[0].amount).toBe(600000);

    const balanceAfterRefund = await calculateAccountBalance(centerId, reversals[0].accountId);
    expect(balanceAfterRefund).toBe(0);
  });
});
