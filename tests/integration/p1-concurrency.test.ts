import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../../src/lib/db";
import { hashPassword } from "../../src/lib/auth";
import { encryptSecret } from "../../src/lib/crypto-cipher";
import {
  createChargeForEnrollment,
  recordBillingPayment,
  fromTashkentParts,
  endOfTashkentDay,
  startOfTashkentDay,
  addCalendarMonths,
  BillingError,
} from "../../src/lib/billing";
import {
  CLICK_ERROR,
  computeClickPrepareSign,
  computeClickCompleteSign,
  createClickPaymentIntent,
  processClickWebhook,
} from "../../src/lib/click";
import { backfillBillingData } from "../../src/lib/backfill-billing";

describe("PostgreSQL Concurrency Integration Tests (P1-fix)", () => {
  const ts = Date.now();
  const clickSecret = `pg_int_click_sec_${ts}`;
  const serviceId = `55${String(ts).slice(-5)}`;
  const merchantId = `66${String(ts).slice(-5)}`;
  const createdCenterIds: string[] = [];
  const createdUserIds: string[] = [];

  let centerId = "";
  let dirUserId = "";
  let dirMemberId = "";
  let courseId = "";
  let groupId = "";
  let studentIds: string[] = [];
  let enrollmentIds: string[] = [];

  beforeAll(async () => {
    const passHash = await hashPassword("PgIntegration!123");

    const dir = await db.platformUser.create({
      data: {
        email: `pg_dir_${ts}@integration.test`,
        fullName: "PG Director",
        passwordHash: passHash,
        emailVerified: new Date(),
      },
    });
    createdUserIds.push(dir.id);
    dirUserId = dir.id;

    const center = await db.learningCenter.create({
      data: {
        name: "PostgreSQL Concurrency Academy",
        slug: `pg-int-${ts}`,
        ownerId: dir.id,
        status: "ACTIVE",
      },
    });
    centerId = center.id;
    createdCenterIds.push(centerId);

    const dirMem = await db.centerMembership.create({
      data: { centerId, userId: dir.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    dirMemberId = dirMem.id;

    await db.centerMerchantConfig.create({
      data: {
        centerId,
        provider: "CLICK",
        merchantId,
        serviceId,
        encryptedSecretKey: encryptSecret(clickSecret, { purpose: "payment" }),
        isActive: true,
        isVerified: true,
        verifiedByUserId: dir.id,
        verifiedAt: new Date(),
      },
    });

    const course = await db.course.create({
      data: {
        centerId,
        title: "Concurrency Math",
        priceMonthly: 500_000,
        createdByMembershipId: dirMemberId,
      },
    });
    courseId = course.id;

    const grp = await db.group.create({
      data: { centerId, courseId, name: "Concurrency Group 1" },
    });
    groupId = grp.id;

    await db.groupPricingPlan.createMany({
      data: [
        { centerId, groupId, periodMonths: 1, price: 500_000, isActive: true },
        { centerId, groupId, periodMonths: 2, price: 950_000, isActive: true },
        { centerId, groupId, periodMonths: 3, price: 1_350_000, isActive: true },
      ],
    });

    studentIds = [];
    enrollmentIds = [];
    for (let i = 0; i < 6; i++) {
      const su = await db.platformUser.create({
        data: {
          email: `pg_stu_${i}_${ts}@integration.test`,
          fullName: `PG Student ${i}`,
          passwordHash: passHash,
          emailVerified: new Date(),
        },
      });
      createdUserIds.push(su.id);
      const sm = await db.centerMembership.create({
        data: { centerId, userId: su.id, role: "STUDENT", status: "ACTIVE" },
      });
      studentIds.push(sm.id);
      const en = await db.enrollment.create({
        data: {
          centerId,
          studentMembershipId: sm.id,
          groupId,
          status: "ACTIVE",
        },
      });
      enrollmentIds.push(en.id);
    }
  });

  afterAll(async () => {
    for (const cId of createdCenterIds) {
      await db.learningCenter.delete({ where: { id: cId } }).catch(() => null);
    }
    for (const uId of createdUserIds) {
      await db.platformUser.delete({ where: { id: uId } }).catch(() => null);
    }
  });

  it("Case 1: Two parallel Click Complete webhooks with the SAME click_trans_id yield strictly 1 CenterPayment and 1 paidUntil extension", async () => {
    const stuId = studentIds[0];
    const enId = enrollmentIds[0];
    const { intent } = await createClickPaymentIntent({
      centerId,
      studentMembershipId: stuId,
      groupId,
      periodMonths: 1,
      actorUserId: dirUserId,
    });

    const clickTransId = `clk_same_${ts}`;
    const signTime = "2026-11-16 14:00:00";
    const prepSign = computeClickPrepareSign({
      clickTransId,
      serviceId,
      secretKey: clickSecret,
      merchantTransId: intent.merchantTransId,
      amount: String(intent.amount),
      action: "0",
      signTime,
    });
    const prep = await processClickWebhook({
      payload: {
        click_trans_id: clickTransId,
        service_id: serviceId,
        click_paydoc_id: "1001",
        merchant_trans_id: intent.merchantTransId,
        amount: String(intent.amount),
        action: "0",
        sign_time: signTime,
        sign_string: prepSign,
      },
      ipAddress: "127.0.0.1",
    });
    expect(prep.error).toBe(CLICK_ERROR.SUCCESS);

    const compSign = computeClickCompleteSign({
      clickTransId,
      serviceId,
      secretKey: clickSecret,
      merchantTransId: intent.merchantTransId,
      merchantPrepareId: intent.id,
      amount: String(intent.amount),
      action: "1",
      signTime,
    });
    const payload = {
      click_trans_id: clickTransId,
      service_id: serviceId,
      click_paydoc_id: "1001",
      merchant_trans_id: intent.merchantTransId,
      merchant_prepare_id: intent.id,
      amount: String(intent.amount),
      action: "1",
      sign_time: signTime,
      sign_string: compSign,
    };

    const [r1, r2] = await Promise.all([
      processClickWebhook({ payload, ipAddress: "127.0.0.1" }),
      processClickWebhook({ payload, ipAddress: "127.0.0.1" }),
    ]);

    const codes = [r1.error, r2.error].sort((a, b) => b - a);
    expect(codes).toEqual([CLICK_ERROR.SUCCESS, CLICK_ERROR.ALREADY_PAID]);

    const payments = await db.centerPayment.findMany({
      where: { paymentIntentId: intent.id },
    });
    expect(payments).toHaveLength(1);

    const enAfter = await db.enrollment.findUniqueOrThrow({ where: { id: enId } });
    expect(enAfter.paidUntil).not.toBeNull();
    const expectedMaxBound = addCalendarMonths(new Date(), 1).getTime() + 48 * 3600 * 1000;
    expect(enAfter.paidUntil!.getTime()).toBeLessThanOrEqual(expectedMaxBound);
  });

  it("Case 2: Two parallel Click Complete webhooks with DIFFERENT click_trans_ids on 1 PaymentIntent yield strictly 1 CenterPayment", async () => {
    const stuId = studentIds[1];
    const enId = enrollmentIds[1];
    const { intent } = await createClickPaymentIntent({
      centerId,
      studentMembershipId: stuId,
      groupId,
      periodMonths: 1,
      actorUserId: dirUserId,
    });

    const signTime = "2026-11-16 14:05:00";
    const prepTx = `clk_diff_prep_${ts}`;
    const prep = await processClickWebhook({
      payload: {
        click_trans_id: prepTx,
        service_id: serviceId,
        click_paydoc_id: "2001",
        merchant_trans_id: intent.merchantTransId,
        amount: String(intent.amount),
        action: "0",
        sign_time: signTime,
        sign_string: computeClickPrepareSign({
          clickTransId: prepTx,
          serviceId,
          secretKey: clickSecret,
          merchantTransId: intent.merchantTransId,
          amount: String(intent.amount),
          action: "0",
          signTime,
        }),
      },
      ipAddress: "127.0.0.1",
    });
    expect(prep.error).toBe(CLICK_ERROR.SUCCESS);

    const makeComplete = (clkTxId: string, paydoc: string) => ({
      click_trans_id: clkTxId,
      service_id: serviceId,
      click_paydoc_id: paydoc,
      merchant_trans_id: intent.merchantTransId,
      merchant_prepare_id: intent.id,
      amount: String(intent.amount),
      action: "1",
      sign_time: signTime,
      sign_string: computeClickCompleteSign({
        clickTransId: clkTxId,
        serviceId,
        secretKey: clickSecret,
        merchantTransId: intent.merchantTransId,
        merchantPrepareId: intent.id,
        amount: String(intent.amount),
        action: "1",
        signTime,
      }),
    });

    const [r1, r2] = await Promise.all([
      processClickWebhook({ payload: makeComplete(`clk_diff_A_${ts}`, "2002"), ipAddress: "127.0.0.1" }),
      processClickWebhook({ payload: makeComplete(`clk_diff_B_${ts}`, "2003"), ipAddress: "127.0.0.1" }),
    ]);

    const errors = [r1.error, r2.error].sort((a, b) => b - a);
    expect(errors).toEqual([CLICK_ERROR.SUCCESS, CLICK_ERROR.ALREADY_PAID]);

    const payments = await db.centerPayment.findMany({ where: { paymentIntentId: intent.id } });
    expect(payments).toHaveLength(1);

    const enAfter = await db.enrollment.findUniqueOrThrow({ where: { id: enId } });
    const expectedMaxBound = addCalendarMonths(new Date(), 1).getTime() + 48 * 3600 * 1000;
    expect(enAfter.paidUntil!.getTime()).toBeLessThanOrEqual(expectedMaxBound);
  });

  it("Case 3: PromoCode maxUses=1 with 5 parallel applications allows strictly 1 redemption", async () => {
    const code = `RACE1_${ts}`;
    const promo = await db.promoCode.create({
      data: {
        centerId,
        code,
        discountType: "PERCENT",
        value: 10,
        maxUses: 1,
        isActive: true,
        createdByUserId: dirUserId,
      },
    });

    const targetEnrollments = enrollmentIds.slice(0, 5);
    const results = await Promise.allSettled(
      targetEnrollments.map((enId) =>
        createChargeForEnrollment({
          centerId,
          enrollmentId: enId,
          periodMonths: 1,
          promoCode: code,
          actorUserId: dirUserId,
          actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(4);

    const promoAfter = await db.promoCode.findUniqueOrThrow({ where: { id: promo.id } });
    expect(promoAfter.usesCount).toBe(1);

    const redemptions = await db.promoCodeRedemption.findMany({
      where: { promoCodeId: promo.id },
    });
    expect(redemptions).toHaveLength(1);
  });

  it("Case 4: Parallel duplicate Charge creation for same period hits unique index & rejects duplicates", async () => {
    const enId = enrollmentIds[2];
    const stuId = studentIds[2];
    const pStart = startOfTashkentDay(fromTashkentParts(2027, 3, 1, 10, 0, 0));
    const pEnd = endOfTashkentDay(fromTashkentParts(2027, 4, 1, 10, 0, 0));

    // A) Service-level parallel createChargeForEnrollment -> strictly 1 charge
    const serviceResults = await Promise.allSettled([
      createChargeForEnrollment({
        centerId,
        enrollmentId: enId,
        periodMonths: 1,
        actorUserId: dirUserId,
        actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
      }),
      createChargeForEnrollment({
        centerId,
        enrollmentId: enId,
        periodMonths: 1,
        actorUserId: dirUserId,
        actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
      }),
    ]);
    expect(serviceResults.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rej = serviceResults.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rej.reason).toBeInstanceOf(BillingError);
    expect((rej.reason as BillingError).status).toBe(409);

    // B) Direct Postgres partial unique index race (Charge_active_enrollment_period_uq)
    const rawResults = await Promise.allSettled([
      db.charge.create({
        data: {
          centerId,
          enrollmentId: enId,
          studentMembershipId: stuId,
          groupId,
          invoiceNumber: `INV-RACE-1-${ts}`,
          periodMonths: 1,
          periodStart: pStart,
          periodEnd: pEnd,
          originalAmount: 500_000,
          amount: 500_000,
          dueDate: pStart,
          status: "PENDING",
          createdByUserId: dirUserId,
        },
      }),
      db.charge.create({
        data: {
          centerId,
          enrollmentId: enId,
          studentMembershipId: stuId,
          groupId,
          invoiceNumber: `INV-RACE-2-${ts}`,
          periodMonths: 1,
          periodStart: pStart,
          periodEnd: pEnd,
          originalAmount: 500_000,
          amount: 500_000,
          dueDate: pStart,
          status: "PENDING",
          createdByUserId: dirUserId,
        },
      }),
    ]);
    expect(rawResults.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(rawResults.filter((r) => r.status === "rejected")).toHaveLength(1);

    const activeChargesForPeriod = await db.charge.findMany({
      where: { enrollmentId: enId, periodStart: pStart, status: { not: "CANCELLED" } },
    });
    expect(activeChargesForPeriod).toHaveLength(1);

    await db.charge.update({
      where: { id: activeChargesForPeriod[0].id },
      data: { status: "CANCELLED" },
    });
    const replacement = await db.charge.create({
      data: {
        centerId,
        enrollmentId: enId,
        studentMembershipId: stuId,
        groupId,
        invoiceNumber: `INV-RACE-3-${ts}`,
        periodMonths: 1,
        periodStart: pStart,
        periodEnd: pEnd,
        originalAmount: 500_000,
        amount: 500_000,
        dueDate: pStart,
        status: "PENDING",
        createdByUserId: dirUserId,
      },
    });
    expect(replacement.status).toBe("PENDING");
  });

  it("Case 5: Parallel double payment of the same Charge results in strictly 1 payment and 1 allocation", async () => {
    const enId = enrollmentIds[3];
    const stuId = studentIds[3];
    const charge = await createChargeForEnrollment({
      centerId,
      enrollmentId: enId,
      periodMonths: 1,
      actorUserId: dirUserId,
      actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
    });

    const results = await Promise.allSettled([
      recordBillingPayment({
        centerId,
        studentMembershipId: stuId,
        chargeId: charge.id,
        paymentMethod: "CASH",
        actorUserId: dirUserId,
      }),
      recordBillingPayment({
        centerId,
        studentMembershipId: stuId,
        chargeId: charge.id,
        paymentMethod: "BANK_TRANSFER",
        actorUserId: dirUserId,
      }),
    ]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((failed.reason as BillingError).code).toBe("CHARGE_ALREADY_PAID");

    const allocs = await db.chargePaymentAllocation.findMany({
      where: { chargeId: charge.id },
    });
    expect(allocs).toHaveLength(1);

    const chargeAfter = await db.charge.findUniqueOrThrow({ where: { id: charge.id } });
    expect(chargeAfter.paidAmount).toBe(charge.amount);
    expect(chargeAfter.status).toBe("PAID");
  });

  it("Case 6: Parallel backfill calls serialize cleanly without duplicate plans, receipts, or charges", async () => {
    const legacyGroup = await db.group.create({
      data: { centerId, courseId, name: `PG Legacy Group ${ts}` },
    });
    const stuId = studentIds[5];
    await db.enrollment.create({
      data: {
        centerId,
        studentMembershipId: stuId,
        groupId: legacyGroup.id,
        status: "ACTIVE",
      },
    });
    const legacyPayment = await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: stuId,
        groupId: legacyGroup.id,
        amount: 500_000,
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: new Date(),
      },
    });

    const [b1, b2] = await Promise.all([
      backfillBillingData({ dryRun: false, centerId }),
      backfillBillingData({ dryRun: false, centerId }),
    ]);

    const plansCreatedSum = b1.totals.pricingPlansCreated + b2.totals.pricingPlansCreated;
    const receiptsCreatedSum = b1.totals.receiptsBackfilled + b2.totals.receiptsBackfilled;
    const chargesCreatedSum = b1.totals.chargesCreated + b2.totals.chargesCreated;

    expect(plansCreatedSum).toBe(3);
    expect(receiptsCreatedSum).toBe(1);
    expect(chargesCreatedSum).toBeGreaterThanOrEqual(1);

    expect(
      Math.min(b1.totals.pricingPlansCreated, b2.totals.pricingPlansCreated)
    ).toBe(0);

    const legacyAfter = await db.centerPayment.findUniqueOrThrow({
      where: { id: legacyPayment.id },
    });
    expect(legacyAfter.receiptNumber).toBeTruthy();

    const grpPlans = await db.groupPricingPlan.findMany({
      where: { groupId: legacyGroup.id },
    });
    expect(grpPlans).toHaveLength(3);
  });
});
