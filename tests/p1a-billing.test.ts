import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import {
  addCalendarMonths,
  computeNextPaidUntil,
  formatTashkentYMD,
  fromTashkentParts,
  recordBillingPayment,
  BillingError,
} from "../src/lib/billing";
import { backfillBillingData } from "../src/lib/backfill-billing";
import { generateReceiptPdf } from "../src/lib/receipt-pdf";
import { computeReceiptVerifyCode, verifyReceiptByCode } from "../src/lib/receipt-verify";
import { PUT as putGroupPricing } from "../src/app/api/groups/[id]/pricing/route";
import { POST as postPayment, GET as getPayments } from "../src/app/api/center-payments/route";
import { POST as refundPaymentRoute } from "../src/app/api/center-payments/[id]/refund/route";
import { GET as downloadReceiptPdf } from "../src/app/api/payments/[id]/receipt/route";
import { POST as postPromo } from "../src/app/api/promo-codes/route";
import { PATCH as patchPromo } from "../src/app/api/promo-codes/[id]/route";
import { POST as freezeRoute, DELETE as unfreezeRoute } from "../src/app/api/enrollments/[id]/freeze/route";
import { GET as droppedPreviewRoute } from "../src/app/api/enrollments/[id]/dropped-preview/route";
import { DELETE as dropStudentRoute } from "../src/app/api/groups/[id]/enrollments/route";
import { POST as markAttendance } from "../src/app/api/attendance/route";
import { POST as createChargeRoute } from "../src/app/api/charges/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

function makeReq(url: string, method: string, body?: unknown) {
  return new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("P1a Unified 1/2/3-Month Billing Core", () => {
  const ts = Date.now();
  const createdUserIds: string[] = [];
  const createdCenterIds: string[] = [];

  let centerAId = "";
  let centerBId = "";

  let dirAUser: { id: string; email: string };
  let adminAUser: { id: string; email: string };
  let teacherAUser: { id: string; email: string };
  let studentA1User: { id: string; email: string };
  let studentA2User: { id: string; email: string };
  let parentA1User: { id: string; email: string };
  let unrelatedParentUser: { id: string; email: string };
  let dirBUser: { id: string; email: string };

  let teacherAMemberId = "";
  let studentA1MemberId = "";
  let studentA2MemberId = "";

  let courseAId = "";
  let groupAId = "";
  let groupA2Id = "";
  let enrollmentA1Id = "";
  let enrollmentA2Id = "";
  let lessonA1Id = "";
  let moduleAId = "";

  let courseBId = "";
  let groupBId = "";
  let enrollmentBId = "";

  function setAuth(user: { id: string; email: string }, centerId: string, role: string) {
    mockToken = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: role,
    });
  }

  beforeAll(async () => {
    const pwdHash = await hashPassword("Secret123!");
    const now = new Date();

    const makeUser = async (prefix: string, fullName: string) => {
      const u = await db.platformUser.create({
        data: {
          email: `p1a_${prefix}_${ts}@test.uz`,
          fullName,
          passwordHash: pwdHash,
          emailVerified: now,
        },
      });
      createdUserIds.push(u.id);
      return u;
    };

    dirAUser = await makeUser("dira", "Director A");
    adminAUser = await makeUser("adma", "Center Admin A");
    teacherAUser = await makeUser("tcha", "Teacher A");
    studentA1User = await makeUser("stda1", "Азизбек Ўринбоев");
    studentA2User = await makeUser("stda2", "Dilnoza Karimova");
    parentA1User = await makeUser("para1", "Parent A1");
    unrelatedParentUser = await makeUser("para2", "Parent Unrelated");
    dirBUser = await makeUser("dirb", "Director B");

    const centerA = await db.learningCenter.create({
      data: {
        name: "Toshkent Academy",
        legalName: "Toshkent Academy LLC",
        inn: "301234567",
        slug: `p1a-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUser.id,
        allowAdminDiscount: false,
        partialPaymentExtendsPeriod: false,
      },
    });
    centerAId = centerA.id;
    createdCenterIds.push(centerAId);

    const centerB = await db.learningCenter.create({
      data: {
        name: "Samarkand Tech",
        slug: `p1a-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUser.id,
      },
    });
    centerBId = centerB.id;
    createdCenterIds.push(centerBId);

    const dirAMem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: dirAUser.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    await db.centerMembership.create({
      data: { centerId: centerAId, userId: adminAUser.id, role: "CENTER_ADMIN", status: "ACTIVE" },
    });
    const tchAMem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: teacherAUser.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherAMemberId = tchAMem.id;

    const s1Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: studentA1User.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentA1MemberId = s1Mem.id;

    const s2Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: studentA2User.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentA2MemberId = s2Mem.id;

    const p1Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: parentA1User.id, role: "PARENT", status: "ACTIVE" },
    });
    await db.parentLink.create({
      data: {
        parentMembershipId: p1Mem.id,
        studentMembershipId: studentA1MemberId,
        status: "CONFIRMED",
      },
    });
    await db.centerMembership.create({
      data: { centerId: centerAId, userId: unrelatedParentUser.id, role: "PARENT", status: "ACTIVE" },
    });

    const dirBMem = await db.centerMembership.create({
      data: { centerId: centerBId, userId: dirBUser.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    const sBMem = await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: (await makeUser("stdb", "Student B")).id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });

    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "O'zbek tili va IELTS",
        priceMonthly: 500_000,
        createdByMembershipId: dirAMem.id,
      },
    });
    courseAId = courseA.id;

    const modA = await db.courseModule.create({
      data: { centerId: centerAId, courseId: courseAId, title: "Mod 1" },
    });
    moduleAId = modA.id;

    const grpA1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        name: "IELTS Morning",
        teacherMembershipId: teacherAMemberId,
      },
    });
    groupAId = grpA1.id;

    const grpA2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        name: "IELTS Evening",
        teacherMembershipId: teacherAMemberId,
      },
    });
    groupA2Id = grpA2.id;

    const lsnA = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: moduleAId,
        title: "Lesson 1",
        scheduledAt: new Date(),
      },
    });
    lessonA1Id = lsnA.id;

    const enrA1 = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        status: "ACTIVE",
      },
    });
    enrollmentA1Id = enrA1.id;

    const enrA2 = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MemberId,
        groupId: groupA2Id,
        status: "ACTIVE",
      },
    });
    enrollmentA2Id = enrA2.id;

    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Python",
        priceMonthly: 700_000,
        createdByMembershipId: dirBMem.id,
      },
    });
    courseBId = courseB.id;

    const grpB = await db.group.create({
      data: { centerId: centerBId, courseId: courseBId, name: "Py-1" },
    });
    groupBId = grpB.id;

    const enrB = await db.enrollment.create({
      data: {
        centerId: centerBId,
        studentMembershipId: sBMem.id,
        groupId: groupBId,
        status: "ACTIVE",
      },
    });
    enrollmentBId = enrB.id;
  });

  afterAll(async () => {
    for (const cid of createdCenterIds) {
      await db.promoCodeRedemption.deleteMany({ where: { centerId: cid } });
      await db.chargePaymentAllocation.deleteMany({ where: { centerId: cid } });
      await db.financeTransaction.deleteMany({ where: { centerId: cid } });
      await db.centerPayment.deleteMany({ where: { centerId: cid } });
      await db.charge.deleteMany({ where: { centerId: cid } });
      await db.enrollmentFreeze.deleteMany({ where: { centerId: cid } });
      await db.attendance.deleteMany({ where: { student: { centerId: cid } } });
      await db.enrollment.deleteMany({ where: { centerId: cid } });
      await db.groupPricingPlan.deleteMany({ where: { centerId: cid } });
      await db.lesson.deleteMany({ where: { centerId: cid } });
      await db.courseModule.deleteMany({ where: { centerId: cid } });
      await db.group.deleteMany({ where: { centerId: cid } });
      await db.course.deleteMany({ where: { centerId: cid } });
      await db.account.deleteMany({ where: { centerId: cid } });
      await db.financeCategory.deleteMany({ where: { centerId: cid } });
      await db.promoCode.deleteMany({ where: { centerId: cid } });
      await db.invoiceCounter.deleteMany({ where: { centerId: cid } });
      await db.auditLog.deleteMany({ where: { centerId: cid } });
      await db.parentLink.deleteMany({ where: { student: { centerId: cid } } });
      await db.centerMembership.deleteMany({ where: { centerId: cid } });
      await db.learningCenter.deleteMany({ where: { id: cid } });
    }
    if (createdUserIds.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } });
    }
  });

  it("1. Asia/Tashkent calendar math: Jan 31, leap year & paidUntil extend vs restart", () => {
    const jan31_2025 = fromTashkentParts(2025, 1, 31, 10, 0, 0);
    expect(formatTashkentYMD(addCalendarMonths(jan31_2025, 1))).toBe("2025-02-28");

    const jan31_2024 = fromTashkentParts(2024, 1, 31, 10, 0, 0);
    expect(formatTashkentYMD(addCalendarMonths(jan31_2024, 1))).toBe("2024-02-29");

    // Active paidUntil extends forward from day after paidUntil
    const activeUntil = fromTashkentParts(2026, 6, 15, 23, 59, 59, 999);
    const payEarly = fromTashkentParts(2026, 6, 10, 14, 0, 0);
    const extended = computeNextPaidUntil(activeUntil, payEarly, 2);
    expect(formatTashkentYMD(extended.periodStart)).toBe("2026-06-16");
    expect(formatTashkentYMD(extended.periodEnd)).toBe("2026-08-15");

    // Expired paidUntil restarts from paymentDate
    const expiredUntil = fromTashkentParts(2026, 5, 1, 23, 59, 59, 999);
    const payLate = fromTashkentParts(2026, 6, 10, 9, 0, 0);
    const restarted = computeNextPaidUntil(expiredUntil, payLate, 1);
    expect(formatTashkentYMD(restarted.periodStart)).toBe("2026-06-10");
    expect(formatTashkentYMD(restarted.periodEnd)).toBe("2026-07-10");
  });

  it("2. 1/2/3-month GroupPricingPlan API saves plans, warns on 3m > 3*1m, and falls back to course price", async () => {
    setAuth(dirAUser, centerAId, "DIRECTOR");

    const res = await putGroupPricing(
      makeReq(`/api/groups/${groupAId}/pricing`, "PUT", {
        plans: [
          { periodMonths: 1, price: 500_000, isActive: true },
          { periodMonths: 2, price: 950_000, isActive: true },
          { periodMonths: 3, price: 1_600_000, isActive: true }, // > 3 * 500k triggers warning
        ],
      }),
      { params: { id: groupAId } }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const p3 = (body.pricing.periods as Array<{ periodMonths: number; exceedsSingleMultiple: boolean }>).find(
      (p) => p.periodMonths === 3
    );
    expect(p3?.exceedsSingleMultiple).toBe(true);

    // Group A2 has no plans -> course.priceMonthly * 2 fallback via payment
    const fallbackPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA2MemberId,
      groupId: groupA2Id,
      periodMonths: 2,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
      actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
    });
    expect(Math.round(fallbackPay.amount)).toBe(1_000_000);
  });

  it("3. PENDING status leaves paidAt null; partialPaymentExtendsPeriod controls paidUntil progression", async () => {
    setAuth(dirAUser, centerAId, "DIRECTOR");

    const pendingRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        amount: 200_000,
        paymentMethod: "CASH",
        status: "PENDING",
      })
    );
    expect(pendingRes.status).toBe(200);
    const pendingData = await pendingRes.json();
    expect(pendingData.payment.paidAt).toBeNull();

    // Partial payment with partialPaymentExtendsPeriod = false should NOT set paidUntil
    const partialRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        amount: 250_000,
        paymentMethod: "CASH",
      })
    );
    expect(partialRes.status).toBe(200);
    const partialBody = await partialRes.json();
    expect(partialBody.payment.status).toBe("PARTIALLY_PAID");
    expect(partialBody.payment.paidAt).not.toBeNull();

    const enrAfterPartial = await db.enrollment.findUnique({ where: { id: enrollmentA1Id } });
    expect(enrAfterPartial?.paidUntil).toBeNull();

    // Now pay the remaining charge amount with partialPaymentExtendsPeriod still false -> now paidUntil extends!
    const openCharge = await db.charge.findFirst({
      where: { enrollmentId: enrollmentA1Id, status: "PARTIAL" },
    });
    expect(openCharge).not.toBeNull();
    expect(openCharge!.paidAmount).toBe(250_000);

    const settleRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        chargeId: openCharge!.id,
        amount: 250_000,
        paymentMethod: "BANK_TRANSFER",
      })
    );
    expect(settleRes.status).toBe(200);
    const enrAfterSettle = await db.enrollment.findUnique({ where: { id: enrollmentA1Id } });
    expect(enrAfterSettle?.paidUntil).not.toBeNull();

    // Enable partialPaymentExtendsPeriod = true -> partial payment extends paidUntil immediately
    await db.learningCenter.update({
      where: { id: centerAId },
      data: { partialPaymentExtendsPeriod: true },
    });
    const partialExtPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA1MemberId,
      groupId: groupAId,
      periodMonths: 1,
      amount: 100_000,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
      actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
    });
    expect(partialExtPay.status).toBe("PARTIALLY_PAID");
    const enrAfterExt = await db.enrollment.findUnique({ where: { id: enrollmentA1Id } });
    expect(enrAfterExt!.paidUntil!.getTime()).toBeGreaterThan(
      enrAfterSettle!.paidUntil!.getTime()
    );
    await db.learningCenter.update({
      where: { id: centerAId },
      data: { partialPaymentExtendsPeriod: false },
    });
  });

  it("4. Promo code validation + Promise.all(10) concurrency race enforces maxUses = 1", async () => {
    setAuth(dirAUser, centerAId, "DIRECTOR");

    // Expired promo rejected
    const expRes = await postPromo(
      makeReq("/api/promo-codes", "POST", {
        code: "EXPIRED99",
        discountType: "PERCENT",
        value: 20,
        validFrom: new Date(Date.now() - 2 * 86_400_000).toISOString(),
        validUntil: new Date(Date.now() - 86_400_000).toISOString(),
      })
    );
    expect(expRes.status).toBe(201);

    await expect(
      recordBillingPayment({
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        promoCode: "EXPIRED99",
        actorUserId: dirAUser.id,
        actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
      })
    ).rejects.toThrow(BillingError);

    // Wrong group promo rejected
    const wrongGrpPromo = await db.promoCode.create({
      data: {
        centerId: centerAId,
        code: `ONLYGRP2_${ts}`,
        discountType: "FIXED",
        value: 50_000,
        applicableGroupId: groupA2Id,
        createdByUserId: dirAUser.id,
      },
    });
    await expect(
      recordBillingPayment({
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        promoCode: wrongGrpPromo.code,
        actorUserId: dirAUser.id,
        actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
      })
    ).rejects.toThrow(BillingError);

    // Concurrent race on maxUses = 1
    const racePromoRes = await postPromo(
      makeReq("/api/promo-codes", "POST", {
        code: `RACE1_${ts}`,
        discountType: "FIXED",
        value: 100_000,
        maxUses: 1,
      })
    );
    expect(racePromoRes.status).toBe(201);
    const { promoCode: racePromo } = await racePromoRes.json();

    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () =>
        recordBillingPayment({
          centerId: centerAId,
          studentMembershipId: studentA2MemberId,
          groupId: groupA2Id,
          periodMonths: 1,
          promoCode: racePromo.code,
          paymentMethod: "CASH",
          actorUserId: dirAUser.id,
          actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
        })
      )
    );

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(9);

    const refreshed = await db.promoCode.findUnique({ where: { id: racePromo.id } });
    expect(refreshed?.usesCount).toBe(1);
    const redemptions = await db.promoCodeRedemption.count({ where: { promoCodeId: racePromo.id } });
    expect(redemptions).toBe(1);

    // Toggle inactive via PATCH
    const patchRes = await patchPromo(
      makeReq(`/api/promo-codes/${racePromo.id}`, "PATCH", { isActive: false }),
      { params: { id: racePromo.id } }
    );
    expect(patchRes.status).toBe(200);
  });

  it("5. Discount RBAC: DIRECTOR allowed with reason, CENTER_ADMIN blocked when allowAdminDiscount=false, reason required", async () => {
    // Admin with allowAdminDiscount = false -> 403
    setAuth(adminAUser, centerAId, "CENTER_ADMIN");
    const adminBlocked = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        manualDiscountAmount: 50_000,
        discountReason: "Admin discount attempt",
        paymentMethod: "CASH",
      })
    );
    expect(adminBlocked.status).toBe(403);

    // Teacher -> 403
    setAuth(teacherAUser, centerAId, "TEACHER");
    const teacherBlocked = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        manualDiscountAmount: 50_000,
        discountReason: "Teacher discount attempt",
        paymentMethod: "CASH",
      })
    );
    expect(teacherBlocked.status).toBe(403);

    // Director without reason -> 400
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const noReasonRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        manualDiscountAmount: 50_000,
        paymentMethod: "CASH",
      })
    );
    expect(noReasonRes.status).toBe(400);

    // Director with reason -> 200 and discounted amount
    const dirOkRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA1MemberId,
        groupId: groupAId,
        periodMonths: 1,
        manualDiscountAmount: 50_000,
        discountReason: "Многодетная семья",
        paymentMethod: "CASH",
      })
    );
    expect(dirOkRes.status).toBe(200);
    const dirBody = await dirOkRes.json();
    expect(Math.round(dirBody.payment.amount)).toBe(450_000);
    expect(Math.round(dirBody.payment.discountAmount)).toBe(50_000);
  });

  it("6. Enrollment freeze shifts paidUntil, blocks attendance marking, and unfreeze applies exact delta", async () => {
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const beforeEnr = await db.enrollment.findUnique({ where: { id: enrollmentA1Id } });
    const paidUntilBefore = beforeEnr!.paidUntil!;

    const tenDaysLater = new Date(Date.now() + 10 * 24 * 3600 * 1000);
    const freezeRes = await freezeRoute(
      makeReq(`/api/enrollments/${enrollmentA1Id}/freeze`, "POST", {
        frozenUntil: tenDaysLater.toISOString(),
        reason: "Болезнь / отпуск",
      }),
      { params: { id: enrollmentA1Id } }
    );
    expect(freezeRes.status).toBe(200);
    const frozenBody = await freezeRes.json();
    expect(frozenBody.enrollment.status).toBe("FROZEN");
    expect(frozenBody.enrollment.paidUntil).not.toBeNull();
    expect(new Date(frozenBody.enrollment.paidUntil).getTime()).toBeGreaterThan(
      paidUntilBefore.getTime()
    );

    // Attendance marking on FROZEN enrollment is blocked
    const attRes = await markAttendance(
      makeReq("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        groupId: groupAId,
        records: [{ studentMembershipId: studentA1MemberId, status: "PRESENT" }],
      })
    );
    expect(attRes.status).toBe(400);

    // Immediate early unfreeze (0 actual days elapsed) adjusts paidUntil back by delta
    const unfreezeRes = await unfreezeRoute(
      makeReq(`/api/enrollments/${enrollmentA1Id}/freeze`, "DELETE"),
      { params: { id: enrollmentA1Id } }
    );
    expect(unfreezeRes.status).toBe(200);
    const unfreezeBody = await unfreezeRes.json();
    expect(unfreezeBody.enrollment.status).toBe("ACTIVE");
    expect(formatTashkentYMD(new Date(unfreezeBody.enrollment.paidUntil))).toBe(
      formatTashkentYMD(paidUntilBefore)
    );
  });

  it("7. Partial/full refund updates FinanceTransaction & paidUntil; DROPPED proration & refund works", async () => {
    setAuth(dirAUser, centerAId, "DIRECTOR");

    const payRes = await postPayment(
      makeReq("/api/center-payments", "POST", {
        studentMembershipId: studentA2MemberId,
        groupId: groupA2Id,
        periodMonths: 2,
        paymentMethod: "CASH",
      })
    );
    expect(payRes.status).toBe(200);
    const { payment: paid2m } = await payRes.json();

    // Dropped preview shows unused positive balance
    const previewRes = await droppedPreviewRoute(
      makeReq(`/api/enrollments/${enrollmentA2Id}/dropped-preview`, "GET"),
      { params: { id: enrollmentA2Id } }
    );
    expect(previewRes.status).toBe(200);
    const previewData = await previewRes.json();
    expect(previewData.preview.remainingAmount).toBeGreaterThan(0);

    // Direct partial refund
    const refRes = await refundPaymentRoute(
      makeReq(`/api/center-payments/${paid2m.id}/refund`, "POST", {
        amount: 200_000,
        reason: "Частичный возврат по заявлению",
      }),
      { params: { id: paid2m.id } }
    );
    expect(refRes.status).toBe(200);
    const refundTxs = await db.financeTransaction.findMany({
      where: { centerId: centerAId, refundPaymentId: paid2m.id },
    });
    expect(refundTxs.length).toBe(1);
    expect(refundTxs[0].amount).toBe(200_000);

    // Drop student with refundAction = "refund"
    const dropRes = await dropStudentRoute(
      makeReq(`/api/groups/${groupA2Id}/enrollments`, "DELETE", {
        studentMembershipId: studentA2MemberId,
        reason: "Переезд",
        refundAction: "refund",
      }),
      { params: { id: groupA2Id } }
    );
    expect(dropRes.status).toBe(200);
    const dropBody = await dropRes.json();
    expect(dropBody.enrollment.status).toBe("DROPPED");
    expect(dropBody.refundResult).not.toBeNull();
  });

  it("8. PDF receipt (Cyrillic/Uzbek), QR zero-PII verify, no-store header, and parent IDOR check", async () => {
    const payment = await db.centerPayment.findFirst({
      where: { centerId: centerAId, studentMembershipId: studentA1MemberId, status: "PAID" },
      orderBy: { createdAt: "desc" },
    });
    expect(payment).not.toBeNull();

    // Direct PDF render smoke test
    const pdfBytes = await generateReceiptPdf({
      receiptNumber: payment!.receiptNumber || "RCP-2026-0001",
      verifyUrl: "http://localhost/verify/receipt/DEMO",
      verifyCode: "DEMO",
      centerName: "Toshkent Academy",
      centerInn: "301234567",
      studentName: "Азизбек Ўринбоев",
      groupName: "O'zbek tili",
      originalAmount: 500_000,
      discountAmount: 50_000,
      discountReason: "Льгота",
      paidAmount: 450_000,
      refundedAmount: 0,
      currency: "UZS",
      paymentMethod: "CASH",
      status: "PAID",
      paidAt: new Date(),
      createdAt: new Date(),
    });
    expect(Buffer.from(pdfBytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");

    // Confirmed parent can download own child's PDF receipt
    setAuth(parentA1User, centerAId, "PARENT");
    const okPdf = await downloadReceiptPdf(
      makeReq(`/api/payments/${payment!.id}/receipt`, "GET"),
      { params: { id: payment!.id } }
    );
    expect(okPdf.status).toBe(200);
    expect(okPdf.headers.get("content-type")).toBe("application/pdf");
    expect(okPdf.headers.get("cache-control")).toBe("no-store");

    // Unrelated parent in same center -> 403
    setAuth(unrelatedParentUser, centerAId, "PARENT");
    const forbidPdf = await downloadReceiptPdf(
      makeReq(`/api/payments/${payment!.id}/receipt`, "GET"),
      { params: { id: payment!.id } }
    );
    expect(forbidPdf.status).toBe(403);

    // Public verification contains zero PII
    const verifyCode = computeReceiptVerifyCode(payment!.id);
    const verifyResult = await verifyReceiptByCode(verifyCode);
    expect(verifyResult.valid).toBe(true);
    const serialized = JSON.stringify(verifyResult);
    expect(serialized).not.toContain("Азизбек");
    expect(serialized).not.toContain("Ўринбоев");
    expect(serialized).not.toContain("301234567");
    expect(serialized).not.toContain(payment!.id);
  });

  it("9. Backfill script --dry-run does not mutate DB, and live backfill is idempotent", async () => {
    const legacyGroup = await db.group.create({
      data: { centerId: centerAId, courseId: courseAId, name: "Legacy Backfill Group" },
    });
    const legacyPay = await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: legacyGroup.id,
        amount: 500_000,
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: new Date(),
      },
    });
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: legacyGroup.id,
        status: "ACTIVE",
      },
    });

    const dry = await backfillBillingData({ dryRun: true, centerId: centerAId });
    expect(dry.dryRun).toBe(true);
    expect(dry.totals.pricingPlansCreated).toBe(0);
    expect(dry.centers[0]?.pricingPlansToCreate).toBeGreaterThanOrEqual(3);
    expect(dry.centers[0]?.paymentsToBackfillReceipt).toBeGreaterThanOrEqual(1);

    // Confirm legacy payment still has no receiptNumber after dry-run
    const afterDry = await db.centerPayment.findUnique({ where: { id: legacyPay.id } });
    expect(afterDry?.receiptNumber).toBeNull();

    // Run live backfill twice
    const run1 = await backfillBillingData({ dryRun: false, centerId: centerAId });
    expect(run1.totals.pricingPlansCreated).toBeGreaterThanOrEqual(3);
    expect(run1.totals.receiptsBackfilled).toBeGreaterThanOrEqual(1);

    const run2 = await backfillBillingData({ dryRun: false, centerId: centerAId });
    expect(run2.totals.pricingPlansCreated).toBe(0);
    expect(run2.totals.receiptsBackfilled).toBe(0);
    expect(run2.totals.chargesCreated).toBe(0);
    expect(run2.totals.allocationsCreated).toBe(0);
  });

  it("10. Cross-center tenant isolation across pricing, charges, payments, freeze, and receipts", async () => {
    const payA = await db.centerPayment.findFirst({ where: { centerId: centerAId, status: "PAID" } });
    expect(payA).not.toBeNull();

    setAuth(dirBUser, centerBId, "DIRECTOR");

    const rPricing = await putGroupPricing(
      makeReq(`/api/groups/${groupAId}/pricing`, "PUT", {
        plans: [{ periodMonths: 1, price: 100_000, isActive: true }],
      }),
      { params: { id: groupAId } }
    );
    expect([403, 404]).toContain(rPricing.status);

    const rFreeze = await freezeRoute(
      makeReq(`/api/enrollments/${enrollmentA1Id}/freeze`, "POST", {
        frozenUntil: new Date(Date.now() + 86_400_000).toISOString(),
        reason: "Cross tenant",
      }),
      { params: { id: enrollmentA1Id } }
    );
    expect([403, 404]).toContain(rFreeze.status);

    const rRefund = await refundPaymentRoute(
      makeReq(`/api/center-payments/${payA!.id}/refund`, "POST", {
        amount: 10_000,
        reason: "Cross tenant refund",
      }),
      { params: { id: payA!.id } }
    );
    expect([403, 404]).toContain(rRefund.status);

    const rPdf = await downloadReceiptPdf(
      makeReq(`/api/payments/${payA!.id}/receipt`, "GET"),
      { params: { id: payA!.id } }
    );
    expect([403, 404]).toContain(rPdf.status);

    const rCharge = await createChargeRoute(
      makeReq("/api/charges", "POST", {
        enrollmentId: enrollmentA1Id,
        periodMonths: 1,
      })
    );
    expect([403, 404]).toContain(rCharge.status);

    const rList = await getPayments(makeReq("/api/center-payments", "GET"));
    expect(rList.status).toBe(200);
    const listBody = await rList.json();
    const leaked = (listBody.payments as Array<{ centerId: string }>).some(
      (p) => p.centerId === centerAId
    );
    expect(leaked).toBe(false);

    // Unused var check
    expect(enrollmentBId).toBeTruthy();
  });
});
