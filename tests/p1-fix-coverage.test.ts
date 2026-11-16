import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fontkit from "@pdf-lib/fontkit";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { roundUzs, isSameUzsAmount, formatUzs } from "../src/lib/money";
import {
  addCalendarMonths,
  computeNextPaidUntil,
  createChargeForEnrollment,
  recordBillingPayment,
  refundBillingPayment,
  completeManualOnlineRefund,
  freezeEnrollment,
  unfreezeEnrollment,
  calculateDroppedRemaining,
  calculateCenterStudentBalances,
  calculateStudentDebtsSummary,
  fromTashkentParts,
  formatTashkentYMD,
  endOfTashkentDay,
} from "../src/lib/billing";
import { calculateStudentBalances } from "../src/lib/student-balance";
import { backfillBillingData } from "../src/lib/backfill-billing";
import { generateReceiptPdf } from "../src/lib/receipt-pdf";
import {
  CLICK_ERROR,
  verifyClickSignature,
  computeClickPrepareSign,
  computeClickCompleteSign,
  createClickPaymentIntent,
  processClickWebhook,
} from "../src/lib/click";
import { encryptSecret } from "../src/lib/crypto-cipher";

import { GET as getMyBalanceRoute } from "../src/app/api/my/balance/route";
import { GET as getMobileStudentDashboard } from "../src/app/api/mobile/student/dashboard/route";
import { GET as getMobileParentDashboard } from "../src/app/api/mobile/parent/dashboard/route";
import { GET as downloadReceiptPdf } from "../src/app/api/payments/[id]/receipt/route";
import { POST as refundPaymentRoute } from "../src/app/api/center-payments/[id]/refund/route";
import { POST as completeManualRefundRoute } from "../src/app/api/center-payments/[id]/manual-refund-complete/route";
import { GET as getOnlinePaymentsRoute } from "../src/app/api/finance/online-payments/route";
import {
  GET as onboardingGet,
  POST as onboardingPost,
  PUT as onboardingPut,
  PATCH as onboardingPatch,
  DELETE as onboardingDelete,
} from "../src/app/api/tenant/onboarding/route";
import CenterPaymentsPage from "../src/app/center/payments/page";
import CenterReportsPage from "../src/app/center/reports/page";
import CenterDashboardPage from "../src/app/center/page";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      if (name === "locale" || name === "NEXT_LOCALE") return { value: "ru" };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/center",
  useSearchParams: () => new URLSearchParams(),
}));

function makeReq(url: string, method: string, body?: unknown, ipSuffix = "10") {
  return new Request(`http://localhost${url}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": `198.51.100.${ipSuffix}`,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function findReactElementByName(
  node: unknown,
  name: string
): { props: Record<string, unknown> } | null {
  if (node === null || node === undefined || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findReactElementByName(child, name);
      if (found) return found;
    }
    return null;
  }
  const el = node as { type?: unknown; props?: { children?: unknown } };
  if (
    (typeof el.type === "function" || (el.type && typeof el.type === "object")) &&
    (el.type as { name?: string }).name === name
  ) {
    return el as { props: Record<string, unknown> };
  }
  if (el.props !== undefined) {
    return findReactElementByName(el.props.children, name);
  }
  return null;
}

function collectRenderedText(node: unknown, out: string[] = []): string[] {
  if (node === null || node === undefined || typeof node === "boolean") return out;
  if (typeof node === "string" || typeof node === "number") {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectRenderedText(item, out);
    }
    return out;
  }
  if (typeof node === "object") {
    const obj = node as { props?: { children?: unknown } };
    if (obj.props && obj.props.children !== undefined) {
      collectRenderedText(obj.props.children, out);
    }
  }
  return out;
}

function normalizeDisplaySpaces(s: string): string {
  return s.replace(/[\u00A0\u202F]/g, " ");
}

describe("P1-fix comprehensive verification & edge-case coverage", () => {
  const ts = Date.now();
  const createdUserIds: string[] = [];
  const createdCenterIds: string[] = [];
  const clickSecretPlain = `clk_sec_p1fix_${ts}`;
  const serviceIdA = `771${String(ts).slice(-4)}`;
  const serviceIdB = `772${String(ts).slice(-4)}`;
  const merchantIdA = `881${String(ts).slice(-4)}`;
  const merchantIdB = `882${String(ts).slice(-4)}`;

  let centerAId = "";
  let centerBId = "";

  let dirAUser: { id: string; email: string };
  let unverifiedDirAUser: { id: string; email: string };
  let studentA1User: { id: string; email: string };
  let studentA2User: { id: string; email: string };
  let parentConfirmedUser: { id: string; email: string };
  let parentPendingUser: { id: string; email: string };
  let teacherAUser: { id: string; email: string };
  let noneUser: { id: string; email: string };
  let superAdminUser: { id: string; email: string };
  let supportUser: { id: string; email: string };
  let dirBUser: { id: string; email: string };

  let dirAMemberId = "";
  let studentA1MemberId = "";
  let studentA2MemberId = "";
  let parentConfirmedMemberId = "";
  let parentPendingMemberId = "";

  let groupA1Id = "";
  let enrollmentA2Id = "";
  let onlinePaymentIdForManualRefund = "";

  function setAuth(
    user: { id: string; email: string },
    centerId: string,
    role: string,
    extra?: { platformRole?: string; impersonatedBy?: string; allowWrite?: boolean }
  ) {
    mockToken = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: extra?.platformRole ?? "NONE",
      ...(centerId ? { activeCenterId: centerId } : {}),
      ...(role && role !== "NONE" ? { activeCenterRole: role } : {}),
      ...(extra?.impersonatedBy ? { impersonatedBy: extra.impersonatedBy } : {}),
      ...(extra?.allowWrite !== undefined ? { allowWrite: extra.allowWrite } : {}),
    });
  }

  beforeAll(async () => {
    const passHash = await hashPassword("P1FixPass!2026");

    const mkUser = async (
      prefix: string,
      name: string,
      emailVerified = true,
      platformRole: "NONE" | "SUPERADMIN" | "PLATFORM_SUPPORT" = "NONE"
    ) => {
      const u = await db.platformUser.create({
        data: {
          email: `${prefix}_${ts}@p1fix.test`,
          fullName: name,
          passwordHash: passHash,
          emailVerified: emailVerified ? new Date() : null,
          platformRole,
        },
      });
      createdUserIds.push(u.id);
      return u;
    };

    dirAUser = await mkUser("dirA", "Директор А", true);
    unverifiedDirAUser = await mkUser("unvDirA", "Unverified Director", false);
    studentA1User = await mkUser("stuA1", "Азизбек Ўринбоев", true);
    studentA2User = await mkUser("stuA2", "Сардор Каримов", true);
    parentConfirmedUser = await mkUser("parOk", "Малика Ўринбоева", true);
    parentPendingUser = await mkUser("parWait", "Отабек Pending", true);
    teacherAUser = await mkUser("tchA", "Преподаватель А", true);
    noneUser = await mkUser("noneU", "Пользователь Без Центра", true);
    superAdminUser = await mkUser("sa", "Суперадмин", true, "SUPERADMIN");
    supportUser = await mkUser("sup", "Саппорт", true, "PLATFORM_SUPPORT");
    dirBUser = await mkUser("dirB", "Директор B", true);

    const cA = await db.learningCenter.create({
      data: {
        name: "Tashkent Oʻzbek Markazi",
        slug: `p1fix-a-${ts}`,
        ownerId: dirAUser.id,
        status: "ACTIVE",
        partialPaymentExtendsPeriod: false,
      },
    });
    const cB = await db.learningCenter.create({
      data: {
        name: "Samarkand Markaz B",
        slug: `p1fix-b-${ts}`,
        ownerId: dirBUser.id,
        status: "ACTIVE",
      },
    });
    centerAId = cA.id;
    centerBId = cB.id;
    createdCenterIds.push(cA.id, cB.id);

    const mkMember = (centerId: string, userId: string, role: "DIRECTOR" | "STUDENT" | "PARENT" | "TEACHER") =>
      db.centerMembership.create({
        data: { centerId, userId, role, status: "ACTIVE" },
      });

    const mDirA = await mkMember(centerAId, dirAUser.id, "DIRECTOR");
    dirAMemberId = mDirA.id;
    await mkMember(centerAId, unverifiedDirAUser.id, "DIRECTOR");
    await mkMember(centerAId, teacherAUser.id, "TEACHER");
    const mS1 = await mkMember(centerAId, studentA1User.id, "STUDENT");
    const mS2 = await mkMember(centerAId, studentA2User.id, "STUDENT");
    const mPOk = await mkMember(centerAId, parentConfirmedUser.id, "PARENT");
    const mPWait = await mkMember(centerAId, parentPendingUser.id, "PARENT");
    await mkMember(centerBId, dirBUser.id, "DIRECTOR");

    studentA1MemberId = mS1.id;
    studentA2MemberId = mS2.id;
    parentConfirmedMemberId = mPOk.id;
    parentPendingMemberId = mPWait.id;

    await db.parentLink.createMany({
      data: [
        {
          parentMembershipId: parentConfirmedMemberId,
          studentMembershipId: studentA1MemberId,
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
        {
          parentMembershipId: parentPendingMemberId,
          studentMembershipId: studentA1MemberId,
          status: "PENDING",
        },
      ],
    });

    const course = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Ingliz tili",
        priceMonthly: 600_000,
        createdByMembershipId: dirAMemberId,
      },
    });

    const grp = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: course.id,
        name: "Guruh Oʻzbekiston-1",
      },
    });
    groupA1Id = grp.id;

    await db.groupPricingPlan.createMany({
      data: [
        { centerId: centerAId, groupId: grp.id, periodMonths: 1, price: 600_000, isActive: true },
        { centerId: centerAId, groupId: grp.id, periodMonths: 2, price: 1_140_000, isActive: true },
        { centerId: centerAId, groupId: grp.id, periodMonths: 3, price: 1_620_000, isActive: true },
      ],
    });

    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: grp.id,
        status: "ACTIVE",
        enrolledAt: thirtyFiveDaysAgo,
      },
    });

    const e2 = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MemberId,
        groupId: grp.id,
        status: "ACTIVE",
        enrolledAt: thirtyFiveDaysAgo,
      },
    });
    enrollmentA2Id = e2.id;

    await db.centerMerchantConfig.createMany({
      data: [
        {
          centerId: centerAId,
          provider: "CLICK",
          merchantId: merchantIdA,
          serviceId: serviceIdA,
          encryptedSecretKey: encryptSecret(clickSecretPlain, { purpose: "payment" }),
          isActive: true,
          isVerified: true,
          verifiedByUserId: dirAUser.id,
          verifiedAt: new Date(),
        },
        {
          centerId: centerBId,
          provider: "CLICK",
          merchantId: merchantIdB,
          serviceId: serviceIdB,
          encryptedSecretKey: encryptSecret(`clk_other_${ts}`, { purpose: "payment" }),
          isActive: true,
          isVerified: true,
          verifiedByUserId: dirBUser.id,
          verifiedAt: new Date(),
        },
      ],
    });
  });

  afterAll(async () => {
    for (const cId of createdCenterIds) {
      await db.learningCenter.delete({ where: { id: cId } }).catch(() => null);
    }
    for (const uId of createdUserIds) {
      await db.platformUser.delete({ where: { id: uId } }).catch(() => null);
    }
  });

  it("1. addCalendarMonths calendar clamping, leap years, year transitions, and UTC+5 Tashkent boundary", () => {
    const jan31_2026 = fromTashkentParts(2026, 1, 31, 12, 0, 0);
    expect(formatTashkentYMD(addCalendarMonths(jan31_2026, 1))).toBe("2026-02-28");
    expect(formatTashkentYMD(addCalendarMonths(jan31_2026, 3))).toBe("2026-04-30");

    const jan31_2024 = fromTashkentParts(2024, 1, 31, 12, 0, 0);
    expect(formatTashkentYMD(addCalendarMonths(jan31_2024, 1))).toBe("2024-02-29");

    const feb29_2024 = fromTashkentParts(2024, 2, 29, 10, 0, 0);
    expect(formatTashkentYMD(addCalendarMonths(feb29_2024, 1))).toBe("2024-03-29");
    expect(formatTashkentYMD(addCalendarMonths(feb29_2024, 12))).toBe("2025-02-28");

    expect(formatTashkentYMD(addCalendarMonths(fromTashkentParts(2026, 12, 15, 10, 0, 0), 1))).toBe("2027-01-15");
    expect(formatTashkentYMD(addCalendarMonths(fromTashkentParts(2026, 12, 31, 10, 0, 0), 2))).toBe("2027-02-28");

    // Asia/Tashkent UTC+5 midnight boundary: 18:59:59Z -> Mar 31, 19:00:00Z -> Apr 01
    const beforeMidnightUzb = new Date("2026-03-31T18:59:59.000Z");
    const atMidnightUzb = new Date("2026-03-31T19:00:00.000Z");
    expect(formatTashkentYMD(beforeMidnightUzb)).toBe("2026-03-31");
    expect(formatTashkentYMD(atMidnightUzb)).toBe("2026-04-01");
    expect(formatTashkentYMD(addCalendarMonths(beforeMidnightUzb, 1))).toBe("2026-04-30");
    expect(formatTashkentYMD(addCalendarMonths(atMidnightUzb, 1))).toBe("2026-05-01");
  });

  it("2. PaidUntil extension (future vs past), partial payment without extension, freeze/overlap 409, partial refund, and DROPPED remainder", async () => {
    const payDate = fromTashkentParts(2026, 5, 10, 14, 0, 0);
    const futurePaidUntil = endOfTashkentDay(fromTashkentParts(2026, 5, 25, 0, 0, 0));
    const extFuture = computeNextPaidUntil(futurePaidUntil, payDate, 1);
    expect(formatTashkentYMD(extFuture.periodStart)).toBe("2026-05-26");
    expect(formatTashkentYMD(extFuture.periodEnd)).toBe("2026-06-25");

    const pastPaidUntil = endOfTashkentDay(fromTashkentParts(2026, 5, 1, 0, 0, 0));
    const extPast = computeNextPaidUntil(pastPaidUntil, payDate, 2);
    expect(formatTashkentYMD(extPast.periodStart)).toBe("2026-05-10");
    expect(formatTashkentYMD(extPast.periodEnd)).toBe("2026-07-10");

    // Partial payment on Charge must not extend paidUntil
    const charge = await createChargeForEnrollment({
      centerId: centerAId,
      enrollmentId: enrollmentA2Id,
      periodMonths: 1,
      actorUserId: dirAUser.id,
      actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
    });
    expect(charge.amount).toBe(600_000);

    const partialPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA2MemberId,
      chargeId: charge.id,
      amount: 250_000,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
    });
    expect(partialPay.status).toBe("PARTIALLY_PAID");

    const enAfterPartial = await db.enrollment.findUnique({ where: { id: enrollmentA2Id } });
    expect(enAfterPartial?.paidUntil).toBeNull();

    // Pay remainder -> CHARGE becomes PAID and paidUntil advances
    const completionPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA2MemberId,
      chargeId: charge.id,
      amount: 350_000,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
    });
    expect(completionPay.status).toBe("PAID");

    const enAfterFull = await db.enrollment.findUnique({ where: { id: enrollmentA2Id } });
    expect(enAfterFull?.paidUntil).not.toBeNull();
    const initialPaidUntil = enAfterFull!.paidUntil!;

    // Freeze +10 days -> shifts paidUntil forward
    const freezeStart = new Date();
    const freezeEnd = new Date(freezeStart.getTime() + 10 * 24 * 60 * 60 * 1000);
    const frozenRes = await freezeEnrollment({
      centerId: centerAId,
      enrollmentId: enrollmentA2Id,
      startDate: freezeStart,
      plannedEndDate: freezeEnd,
      reason: "Каникулы",
      actorUserId: dirAUser.id,
    });
    expect(frozenRes.freeze.creditedDays).toBeGreaterThanOrEqual(9);
    const enFrozen = await db.enrollment.findUnique({ where: { id: enrollmentA2Id } });
    expect(enFrozen?.status).toBe("FROZEN");
    expect(enFrozen!.paidUntil!.getTime()).toBeGreaterThan(initialPaidUntil.getTime());

    // Early unfreeze after 3 days -> shrinks paidUntil shift
    const earlyEnd = new Date(freezeStart.getTime() + 3 * 24 * 60 * 60 * 1000);
    const unfrozenRes = await unfreezeEnrollment({
      centerId: centerAId,
      enrollmentId: enrollmentA2Id,
      actualEndDate: earlyEnd,
      actorUserId: dirAUser.id,
    });
    expect(unfrozenRes.enrollment.status).toBe("ACTIVE");
    expect(unfrozenRes.enrollment.paidUntil!.getTime()).toBeLessThan(enFrozen!.paidUntil!.getTime());

    // Second overlapping freeze blocked with 409 FREEZE_OVERLAP
    await expect(
      freezeEnrollment({
        centerId: centerAId,
        enrollmentId: enrollmentA2Id,
        startDate: freezeStart,
        plannedEndDate: new Date(freezeStart.getTime() + 5 * 24 * 60 * 60 * 1000),
        reason: "Повторная заморозка",
        actorUserId: dirAUser.id,
      })
    ).rejects.toMatchObject({ status: 409, code: "FREEZE_OVERLAP" });

    // Partial refund rolls back paidUntil proportionally without leaving status REFUNDED yet
    const beforePartialRefundPaidUntil = unfrozenRes.enrollment.paidUntil!;
    const partRefund = await refundBillingPayment({
      centerId: centerAId,
      paymentId: completionPay.id,
      refundAmount: 100_000,
      reason: "Частичный перерасчёт",
      actorUserId: dirAUser.id,
    });
    expect(partRefund.refundedAmount).toBe(100_000);
    expect(partRefund.status).toBe("PAID");
    const enAfterPartRefund = await db.enrollment.findUnique({ where: { id: enrollmentA2Id } });
    expect(enAfterPartRefund!.paidUntil!.getTime()).toBeLessThan(beforePartialRefundPaidUntil.getTime());

    // Over-refund (> remaining) -> 400 REFUND_EXCEEDS_PAID
    await expect(
      refundBillingPayment({
        centerId: centerAId,
        paymentId: completionPay.id,
        refundAmount: 260_000,
        reason: "Слишком много",
        actorUserId: dirAUser.id,
      })
    ).rejects.toMatchObject({ status: 400, code: "REFUND_EXCEEDS_PAID" });

    // Full remaining refund -> REFUNDED; double refund -> 409 ALREADY_REFUNDED
    const fullFinish = await refundBillingPayment({
      centerId: centerAId,
      paymentId: completionPay.id,
      reason: "Полный остаток",
      actorUserId: dirAUser.id,
    });
    expect(fullFinish.status).toBe("REFUNDED");

    await expect(
      refundBillingPayment({
        centerId: centerAId,
        paymentId: completionPay.id,
        reason: "Дубль",
        actorUserId: dirAUser.id,
      })
    ).rejects.toMatchObject({ status: 409, code: "ALREADY_REFUNDED" });

    // Give enrollmentA2 an active paid period and check DROPPED remaining calculation
    await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA2MemberId,
      groupId: groupA1Id,
      periodMonths: 1,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
    });
    const droppedPreview = await calculateDroppedRemaining(centerAId, enrollmentA2Id);
    expect(droppedPreview.hasPaidRemaining).toBe(true);
    expect(droppedPreview.remainingDays).toBeGreaterThan(0);
    expect(droppedPreview.remainingAmount).toBeGreaterThan(0);
  });

  it("3. Single source of truth: ONE student debt integer matches across billing, pages (/center/payments, /center/reports, /center), /api/my/balance, mobile APIs, and isolation holds", async () => {
    const balances = await calculateCenterStudentBalances({
      centerId: centerAId,
      studentMembershipIds: [studentA1MemberId],
    });
    const expectedDebt = balances[0]?.debtAmount ?? -1;
    expect(expectedDebt).toBeGreaterThan(0);

    const debtsSummary = await calculateStudentDebtsSummary(centerAId);
    expect(debtsSummary.debts.find((d) => d.studentId === studentA1MemberId)?.debtAmount).toBe(expectedDebt);

    const stdBalanceHelper = await calculateStudentBalances({
      centerId: centerAId,
      studentMembershipIds: [studentA1MemberId],
    });
    expect(stdBalanceHelper[0]?.debtAmount).toBe(expectedDebt);

    // /center/payments as Director AND as Student
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const paymentsPageAsDirector = await CenterPaymentsPage();
    const mgrAsDirector = findReactElementByName(paymentsPageAsDirector, "PaymentsManager");
    const dirBalancesProp = mgrAsDirector?.props.studentBalances as Array<{
      studentMembershipId: string;
      debtAmount: number;
    }>;
    expect(dirBalancesProp.find((s) => s.studentMembershipId === studentA1MemberId)?.debtAmount).toBe(
      expectedDebt
    );

    setAuth(studentA1User, centerAId, "STUDENT");
    const paymentsPageAsStudent = await CenterPaymentsPage();
    const mgrAsStudent = findReactElementByName(paymentsPageAsStudent, "PaymentsManager");
    const stuBalancesProp = mgrAsStudent?.props.studentBalances as Array<{
      studentMembershipId: string;
      debtAmount: number;
    }>;
    expect(stuBalancesProp[0]?.debtAmount).toBe(expectedDebt);

    // /center/reports as Director
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const reportsTree = await CenterReportsPage({});
    const reportsText = normalizeDisplaySpaces(
      renderToStaticMarkup(reportsTree as ReactElement)
    );
    const expectedDebtFormatted = normalizeDisplaySpaces(
      formatUzs(expectedDebt, { locale: "ru" })
    );
    expect(reportsText).toContain(expectedDebtFormatted);

    // /center dashboard as Student renders studentBalanceSummary.debtAmount
    setAuth(studentA1User, centerAId, "STUDENT");
    const studentDashboardTree = await CenterDashboardPage({});
    const studentDashText = normalizeDisplaySpaces(
      renderToStaticMarkup(studentDashboardTree as ReactElement)
    );
    expect(studentDashText).toContain(expectedDebtFormatted);

    // /center dashboard as Director renders center total debt sum
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const dirDashboardTree = await CenterDashboardPage({});
    const dirDashText = normalizeDisplaySpaces(
      renderToStaticMarkup(dirDashboardTree as ReactElement)
    );
    const centerTotalDebtFormatted = normalizeDisplaySpaces(
      formatUzs(debtsSummary.summary.totalDebt, { locale: "ru" })
    );
    expect(dirDashText).toContain(centerTotalDebtFormatted);

    // /api/my/balance as STUDENT and confirmed PARENT
    setAuth(studentA1User, centerAId, "STUDENT");
    const myBalRes = await getMyBalanceRoute(makeReq("/api/my/balance", "GET", undefined, "11"));
    expect(myBalRes.status).toBe(200);
    const myBalJson = await myBalRes.json();
    expect(myBalJson.balance.debtAmount).toBe(expectedDebt);

    setAuth(parentConfirmedUser, centerAId, "PARENT");
    const parentBalRes = await getMyBalanceRoute(makeReq("/api/my/balance", "GET", undefined, "12"));
    expect(parentBalRes.status).toBe(200);
    const parentBalJson = await parentBalRes.json();
    expect(parentBalJson.balance.debtAmount).toBe(expectedDebt);

    // /api/mobile/student/dashboard and /api/mobile/parent/dashboard
    setAuth(studentA1User, centerAId, "STUDENT");
    const mobStuRes = await getMobileStudentDashboard(
      makeReq("/api/mobile/student/dashboard", "GET", undefined, "13")
    );
    expect(mobStuRes.status).toBe(200);
    const mobStuJson = await mobStuRes.json();
    expect(mobStuJson.billing.debtAmount).toBe(expectedDebt);

    setAuth(parentConfirmedUser, centerAId, "PARENT");
    const mobParRes = await getMobileParentDashboard(
      makeReq("/api/mobile/parent/dashboard", "GET", undefined, "14")
    );
    expect(mobParRes.status).toBe(200);
    const mobParJson = await mobParRes.json();
    expect(mobParJson.activeChild.billing.debtAmount).toBe(expectedDebt);

    // Isolation checks: Student A2 cannot read Student A1 balance -> 403
    setAuth(studentA2User, centerAId, "STUDENT");
    const stuIdor = await getMyBalanceRoute(
      makeReq(`/api/my/balance?studentId=${studentA1MemberId}`, "GET", undefined, "15")
    );
    expect(stuIdor.status).toBe(403);

    // Pending (unconfirmed) parent cannot view Student A1 -> 403 / empty children
    setAuth(parentPendingUser, centerAId, "PARENT");
    const pendingParBal = await getMyBalanceRoute(
      makeReq(`/api/my/balance?studentId=${studentA1MemberId}`, "GET", undefined, "16")
    );
    expect(pendingParBal.status).toBe(403);
    const pendingMobPar = await getMobileParentDashboard(
      makeReq("/api/mobile/parent/dashboard", "GET", undefined, "17")
    );
    const pendingMobJson = await pendingMobPar.json();
    expect(pendingMobJson.children).toHaveLength(0);

    // Foreign center Director cannot access Student A1 receipt -> 403/404
    const receiptPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA1MemberId,
      groupId: groupA1Id,
      periodMonths: 1,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
    });

    setAuth(studentA2User, centerAId, "STUDENT");
    const stuOtherReceipt = await downloadReceiptPdf(
      makeReq(`/api/payments/${receiptPay.id}/receipt`, "GET", undefined, "18"),
      { params: { id: receiptPay.id } }
    );
    expect(stuOtherReceipt.status).toBe(403);

    setAuth(dirBUser, centerBId, "DIRECTOR");
    const foreignReceipt = await downloadReceiptPdf(
      makeReq(`/api/payments/${receiptPay.id}/receipt`, "GET", undefined, "19"),
      { params: { id: receiptPay.id } }
    );
    expect([403, 404]).toContain(foreignReceipt.status);
  });

  it("4. Float -> Int money helpers and legacy Float Course.priceMonthly + FinanceTransaction rounding", async () => {
    expect(roundUzs(1500.5)).toBe(1501);
    expect(1000 * (0.1 + 0.2)).not.toBe(300);
    expect(isSameUzsAmount(1000 * (0.1 + 0.2), 300)).toBe(true);
    expect(isSameUzsAmount(299999.6, 300000)).toBe(true);

    const floatCourse = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Float Price Course",
        priceMonthly: 299999.6,
        createdByMembershipId: dirAMemberId,
      },
    });
    const floatGroup = await db.group.create({
      data: { centerId: centerAId, courseId: floatCourse.id, name: "Float Course Group" },
    });
    const floatEnroll = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MemberId,
        groupId: floatGroup.id,
        status: "ACTIVE",
      },
    });

    const charge = await createChargeForEnrollment({
      centerId: centerAId,
      enrollmentId: floatEnroll.id,
      periodMonths: 1,
      actorUserId: dirAUser.id,
      actor: { centerRole: "DIRECTOR", platformRole: "NONE" },
    });
    expect(charge.amount).toBe(300_000);

    const floatPay = await recordBillingPayment({
      centerId: centerAId,
      studentMembershipId: studentA1MemberId,
      chargeId: charge.id,
      paymentMethod: "CASH",
      actorUserId: dirAUser.id,
    });
    expect(floatPay.amount).toBe(300_000);

    const finTx = await db.financeTransaction.findFirst({
      where: { centerId: centerAId, centerPaymentId: floatPay.id },
    });
    expect(finTx).not.toBeNull();
    expect(roundUzs(finTx!.amount)).toBe(300_000);
  });

  it("5. Click webhook hardening: verifyClickSignature mismatch lengths, strict integer amounts, foreign serviceId rejection, and error masking", async () => {
    expect(verifyClickSignature("", "abc")).toBe(false);
    expect(verifyClickSignature("a".repeat(32), "short")).toBe(false);
    expect(verifyClickSignature("0123456789abcdef0123456789abcdef", "0123456789ABCDEF0123456789ABCDEF")).toBe(
      true
    );

    const { intent } = await createClickPaymentIntent({
      centerId: centerAId,
      studentMembershipId: studentA1MemberId,
      groupId: groupA1Id,
      periodMonths: 1,
      actorUserId: studentA1User.id,
    });

    const signTime = "2026-11-16 12:00:00";

    const badFracAmt = "600000.5";
    const badFracSign = computeClickPrepareSign({
      clickTransId: `clk_frac_${ts}`,
      serviceId: serviceIdA,
      secretKey: clickSecretPlain,
      merchantTransId: intent.merchantTransId,
      amount: badFracAmt,
      action: "0",
      signTime,
    });
    const fracResp = await processClickWebhook({
      payload: {
        click_trans_id: `clk_frac_${ts}`,
        service_id: serviceIdA,
        click_paydoc_id: "9001",
        merchant_trans_id: intent.merchantTransId,
        amount: badFracAmt,
        action: "0",
        sign_time: signTime,
        sign_string: badFracSign,
      },
      ipAddress: "127.0.0.1",
    });
    expect(fracResp.error).toBe(CLICK_ERROR.INCORRECT_AMOUNT);

    // Spoofed foreign Center B service_id for Center A merchant_trans_id rejected cleanly
    const spoofSign = computeClickPrepareSign({
      clickTransId: `clk_spoof_${ts}`,
      serviceId: serviceIdB,
      secretKey: clickSecretPlain,
      merchantTransId: intent.merchantTransId,
      amount: String(intent.amount),
      action: "0",
      signTime,
    });
    const spoofResp = await processClickWebhook({
      payload: {
        click_trans_id: `clk_spoof_${ts}`,
        service_id: serviceIdB,
        click_paydoc_id: "9002",
        merchant_trans_id: intent.merchantTransId,
        amount: String(intent.amount),
        action: "0",
        sign_time: signTime,
        sign_string: spoofSign,
      },
      ipAddress: "127.0.0.1",
    });
    expect(spoofResp.error).toBe(CLICK_ERROR.ORDER_NOT_FOUND);

    // Valid integer string "600000.00" accepted for Prepare
    const validAmtStr = `${intent.amount}.00`;
    const prepTxId = `clk_ok_${ts}`;
    const prepSign = computeClickPrepareSign({
      clickTransId: prepTxId,
      serviceId: serviceIdA,
      secretKey: clickSecretPlain,
      merchantTransId: intent.merchantTransId,
      amount: validAmtStr,
      action: "0",
      signTime,
    });
    const prepResp = await processClickWebhook({
      payload: {
        click_trans_id: prepTxId,
        service_id: serviceIdA,
        click_paydoc_id: "9003",
        merchant_trans_id: intent.merchantTransId,
        amount: validAmtStr,
        action: "0",
        sign_time: signTime,
        sign_string: prepSign,
      },
      ipAddress: "127.0.0.1",
    });
    expect(prepResp.error).toBe(CLICK_ERROR.SUCCESS);
    expect(prepResp.merchant_prepare_id).toBe(intent.id);

    // Simulated unexpected internal failure inside db.$transaction is masked externally
    const completeSign = computeClickCompleteSign({
      clickTransId: prepTxId,
      serviceId: serviceIdA,
      secretKey: clickSecretPlain,
      merchantTransId: intent.merchantTransId,
      merchantPrepareId: intent.id,
      amount: validAmtStr,
      action: "1",
      signTime,
    });
    const txSpy = vi
      .spyOn(db, "$transaction")
      .mockRejectedValueOnce(new Error("INTERNAL_SQL_LEAK_SECRET_KEY_VALUE"));
    const maskedResp = await processClickWebhook({
      payload: {
        click_trans_id: prepTxId,
        service_id: serviceIdA,
        click_paydoc_id: "9003",
        merchant_trans_id: intent.merchantTransId,
        merchant_prepare_id: intent.id,
        amount: validAmtStr,
        action: "1",
        sign_time: signTime,
        sign_string: completeSign,
      },
      ipAddress: "127.0.0.1",
    });
    txSpy.mockRestore();
    expect(maskedResp.error).toBe(CLICK_ERROR.REQUEST_ERROR);
    expect(maskedResp.error_note).toBe("Payment cannot be processed");
    expect(JSON.stringify(maskedResp)).not.toContain("INTERNAL_SQL_LEAK");

    // Genuine Complete webhook succeeds -> produces ONLINE CenterPayment for Manual Refund test
    const compResp = await processClickWebhook({
      payload: {
        click_trans_id: prepTxId,
        service_id: serviceIdA,
        click_paydoc_id: "9003",
        merchant_trans_id: intent.merchantTransId,
        merchant_prepare_id: intent.id,
        amount: validAmtStr,
        action: "1",
        sign_time: signTime,
        sign_string: completeSign,
      },
      ipAddress: "127.0.0.1",
    });
    expect(compResp.error).toBe(CLICK_ERROR.SUCCESS);
    onlinePaymentIdForManualRefund = compResp.merchant_confirm_id!;
    expect(onlinePaymentIdForManualRefund).toBeTruthy();
  });

  it("6. PDF DejaVuSans font has all Uzbek Latin/Cyrillic glyphs and generates ru & uz-Latn PDFs", async () => {
    const fontPath = path.join(process.cwd(), "src", "assets", "fonts", "DejaVuSans.ttf");
    const fontBytes = fs.readFileSync(fontPath);
    const fkFont = fontkit.create(new Uint8Array(fontBytes));

    const testPhrase = "Oʻzbekiston, Gʻafur, Раҳмат ʼ Ўринбоев Қўшработ Ғиждувон";
    for (const ch of testPhrase) {
      if (ch.trim().length === 0) continue;
      const cp = ch.codePointAt(0)!;
      expect(
        fkFont.hasGlyphForCodePoint(cp),
        `Missing glyph in DejaVuSans.ttf for "${ch}" (U+${cp.toString(16).toUpperCase()})`
      ).toBe(true);
    }

    for (const lang of ["ru", "uz-Latn"] as const) {
      const pdfBytes = await generateReceiptPdf({
        receiptNumber: `RCP-TEST-${lang.toUpperCase()}`,
        verifyUrl: "http://localhost/verify/receipt/UZ123",
        verifyCode: "UZ123",
        lang,
        centerName: "Oʻzbekiston Gʻafur Markazi",
        centerInn: "305678901",
        studentName: "Раҳмат ʼ Азизбек",
        groupName: "Oʻzbek tili",
        originalAmount: 600_000,
        discountAmount: 50_000,
        discountReason: "Chegirma ʼ",
        paidAmount: 550_000,
        refundedAmount: 0,
        currency: "UZS",
        paymentMethod: "ONLINE",
        status: "PAID",
        paidAt: new Date(),
        createdAt: new Date(),
      });
      expect(Buffer.from(pdfBytes).subarray(0, 5).toString("ascii")).toBe("%PDF-");
      expect(pdfBytes.byteLength).toBeGreaterThan(5000);
    }
  });

  it("7. ONLINE manual Click refund workflow: PENDING_MANUAL -> API/Dashboard visibility -> Director confirmation -> AuditLog + RBAC", async () => {
    expect(onlinePaymentIdForManualRefund).toBeTruthy();

    setAuth(dirAUser, centerAId, "DIRECTOR");
    const refRes = await refundPaymentRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/refund`,
        "POST",
        { reason: "Ученик передумал" },
        "21"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect(refRes.status).toBe(200);
    const refJson = await refRes.json();
    expect(refJson.payment.manualRefundStatus).toBe("PENDING_MANUAL");

    const finOnlineRes = await getOnlinePaymentsRoute(
      makeReq("/api/finance/online-payments", "GET", undefined, "22")
    );
    expect(finOnlineRes.status).toBe(200);
    const finOnlineJson = await finOnlineRes.json();
    expect(finOnlineJson.pendingManualRefundsCount).toBeGreaterThanOrEqual(1);
    expect(
      finOnlineJson.manualRefunds.some((r: { id: string }) => r.id === onlinePaymentIdForManualRefund)
    ).toBe(true);

    const dirDash = await CenterDashboardPage({});
    const dashText = renderToStaticMarkup(dirDash as ReactElement);
    expect(dashText).toContain("Click");

    // Unverified director -> 403
    setAuth(unverifiedDirAUser, centerAId, "DIRECTOR");
    const unvRes = await completeManualRefundRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/manual-refund-complete`,
        "POST",
        { note: "Возвращено в Click" },
        "23"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect(unvRes.status).toBe(403);

    // Impersonating staff -> 403
    setAuth(dirAUser, centerAId, "DIRECTOR", {
      impersonatedBy: superAdminUser.id,
      allowWrite: false,
    });
    const impRes = await completeManualRefundRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/manual-refund-complete`,
        "POST",
        { note: "Возвращено в Click" },
        "24"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect(impRes.status).toBe(403);

    // Foreign center director -> 403/404
    setAuth(dirBUser, centerBId, "DIRECTOR");
    const foreignRes = await completeManualRefundRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/manual-refund-complete`,
        "POST",
        { note: "Чужой центр" },
        "25"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect([403, 404]).toContain(foreignRes.status);

    // Teacher -> 403
    setAuth(teacherAUser, centerAId, "TEACHER");
    const tchRes = await completeManualRefundRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/manual-refund-complete`,
        "POST",
        { note: "Учитель" },
        "26"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect(tchRes.status).toBe(403);

    // Valid verified Director confirms Click refund -> 200 + AuditLog
    setAuth(dirAUser, centerAId, "DIRECTOR");
    const compAt = "2026-11-16T10:30:00.000Z";
    const okCompRes = await completeManualRefundRoute(
      makeReq(
        `/api/center-payments/${onlinePaymentIdForManualRefund}/manual-refund-complete`,
        "POST",
        { note: "Возврат проведён в мерчанте Click #TR-88", completedAt: compAt },
        "27"
      ),
      { params: { id: onlinePaymentIdForManualRefund } }
    );
    expect(okCompRes.status).toBe(200);
    const okCompJson = await okCompRes.json();
    expect(okCompJson.payment.manualRefundStatus).toBe("COMPLETED");
    expect(okCompJson.payment.manualRefundCompletedById).toBe(dirAUser.id);

    const audit = await db.auditLog.findFirst({
      where: {
        centerId: centerAId,
        action: "ONLINE_MANUAL_REFUND_COMPLETED",
        resourceId: onlinePaymentIdForManualRefund,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.detailsJson).toContain("Click #TR-88");

    // Duplicate confirmation -> 409
    await expect(
      completeManualOnlineRefund({
        centerId: centerAId,
        paymentId: onlinePaymentIdForManualRefund,
        note: "Повторно",
        actorUserId: dirAUser.id,
      })
    ).rejects.toMatchObject({ status: 409, code: "MANUAL_REFUND_ALREADY_COMPLETED" });
  });

  it("8. /api/tenant/onboarding returns 403 in production for ALL HTTP methods and roles", async () => {
    const envObj = process.env as Record<string, string | undefined>;
    const prevNodeEnv = envObj.NODE_ENV;
    envObj.NODE_ENV = "production";
    try {
      const roles: Array<() => void> = [
        () => {
          mockToken = "";
        },
        () => setAuth(noneUser, "", "NONE"),
        () => setAuth(dirAUser, centerAId, "DIRECTOR"),
        () => setAuth(studentA1User, centerAId, "STUDENT"),
        () => setAuth(supportUser, "", "NONE", { platformRole: "PLATFORM_SUPPORT" }),
        () => setAuth(superAdminUser, "", "NONE", { platformRole: "SUPERADMIN" }),
      ];

      for (const setupRole of roles) {
        setupRole();
        const rGet = await onboardingGet();
        const rPost = await onboardingPost(
          makeReq("/api/tenant/onboarding", "POST", { centerName: "Blocked" }, "31")
        );
        const rPut = await onboardingPut();
        const rPatch = await onboardingPatch();
        const rDel = await onboardingDelete();
        for (const r of [rGet, rPost, rPut, rPatch, rDel]) {
          expect(r.status).toBe(403);
        }
      }
    } finally {
      envObj.NODE_ENV = prevNodeEnv;
    }
  });

  it("9. backfillBillingData --dry-run reports debtBefore/debtAfter without mutating DB and live repeat is idempotent", async () => {
    const legacyCourse = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Legacy Course P1Fix",
        priceMonthly: 450_000,
        createdByMembershipId: dirAMemberId,
      },
    });
    const legacyGroup = await db.group.create({
      data: { centerId: centerAId, courseId: legacyCourse.id, name: "Legacy Group P1Fix" },
    });
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MemberId,
        groupId: legacyGroup.id,
        status: "ACTIVE",
        enrolledAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      },
    });
    const legacyPay = await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MemberId,
        groupId: legacyGroup.id,
        amount: 450_000,
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      },
    });

    const dry = await backfillBillingData({ dryRun: true, centerId: centerAId });
    expect(dry.dryRun).toBe(true);
    expect(dry.totals.pricingPlansCreated).toBe(0);
    expect(dry.centers[0]?.pricingPlansToCreate).toBeGreaterThanOrEqual(3);
    expect(dry.centers[0]?.paymentsToBackfillReceipt).toBeGreaterThanOrEqual(1);
    expect(typeof dry.centers[0]?.debtBeforeUzs).toBe("number");
    expect(typeof dry.centers[0]?.debtAfterUzs).toBe("number");

    const afterDry = await db.centerPayment.findUnique({ where: { id: legacyPay.id } });
    expect(afterDry?.receiptNumber).toBeNull();

    const live1 = await backfillBillingData({ dryRun: false, centerId: centerAId });
    expect(live1.totals.pricingPlansCreated).toBeGreaterThanOrEqual(3);
    expect(live1.totals.receiptsBackfilled).toBeGreaterThanOrEqual(1);
    expect(typeof live1.centers[0]?.debtAfterUzs).toBe("number");

    const live2 = await backfillBillingData({ dryRun: false, centerId: centerAId });
    expect(live2.totals.pricingPlansCreated).toBe(0);
    expect(live2.totals.receiptsBackfilled).toBe(0);
    expect(live2.totals.chargesCreated).toBe(0);
    expect(live2.totals.allocationsCreated).toBe(0);
  });
});
