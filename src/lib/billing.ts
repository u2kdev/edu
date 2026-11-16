import crypto from "crypto";
import {
  CenterPaymentStatus,
  Currency,
  PaymentMethod,
  Prisma,
  PromoDiscountType,
} from "@prisma/client";
import { db } from "./db";
import { getTenantDb } from "./db-tenant";
import {
  ensureDefaultPaymentAccountAndCategory,
  ensureDefaultRefundCategory,
  recordFinanceTransaction,
  syncCenterPaymentRefundToFinance,
  syncCenterPaymentToFinance,
} from "./finance";
import { invalidateFinanceReportCache } from "./finance-reports-cache";
import { hasPermission } from "./permissions";
import { computeReceiptVerifyCode, computeReceiptVerifyHash } from "./receipt-verify";
import { isSameUzsAmount, roundUzs } from "./money";

export { isSameUzsAmount, roundUzs };

export const TASHKENT_OFFSET_MS = 5 * 3600 * 1000;
const DAY_MS = 24 * 3600 * 1000;
export type BillingPeriodMonths = 1 | 2 | 3;

export class BillingError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = "BILLING_ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ============================================================
// 1. Asia/Tashkent (UTC+5) Calendar Date Math
// ============================================================

export interface TashkentDateParts {
  year: number;
  month: number; // 1..12
  day: number; // 1..31
  hour: number;
  minute: number;
  second: number;
  ms: number;
}

export function toTashkentParts(date: Date): TashkentDateParts {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
  };
}

export function daysInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

export function fromTashkentParts(
  year: number,
  month1To12: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0
): Date {
  const utcMs =
    Date.UTC(year, month1To12 - 1, day, hour, minute, second, ms) - TASHKENT_OFFSET_MS;
  return new Date(utcMs);
}

export function startOfTashkentDay(date: Date): Date {
  const p = toTashkentParts(date);
  return fromTashkentParts(p.year, p.month, p.day, 0, 0, 0, 0);
}

export function endOfTashkentDay(date: Date): Date {
  const p = toTashkentParts(date);
  return fromTashkentParts(p.year, p.month, p.day, 23, 59, 59, 999);
}

export function formatTashkentYearMonth(date: Date): string {
  const p = toTashkentParts(date);
  return `${p.year}${String(p.month).padStart(2, "0")}`;
}

export function formatTashkentYMD(date: Date): string {
  const p = toTashkentParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * Adds `months` calendar months in Asia/Tashkent with end-of-month clamping
 * (e.g. Jan 31 + 1m => Feb 28 in non-leap year, Feb 29 in leap year; Feb 29 + 12m => Feb 28).
 */
export function addCalendarMonths(date: Date, months: number): Date {
  if (!Number.isInteger(months) || months < 0 || months > 120) {
    throw new BillingError(400, "Период оплаты должен быть целым числом месяцев", "INVALID_PERIOD");
  }
  const p = toTashkentParts(date);
  const totalMonths = p.year * 12 + (p.month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const maxDay = daysInMonth(targetYear, targetMonth);
  const targetDay = Math.min(p.day, maxDay);
  return fromTashkentParts(targetYear, targetMonth, targetDay, p.hour, p.minute, p.second, p.ms);
}

/**
 * Adds signed calendar days in Asia/Tashkent safely across month/year boundaries.
 */
export function addCalendarDays(date: Date, days: number): Date {
  if (!Number.isInteger(days)) {
    throw new BillingError(400, "Количество дней должно быть целым числом", "INVALID_DAYS");
  }
  const p = toTashkentParts(date);
  const utcDayMs =
    Date.UTC(p.year, p.month - 1, p.day + days, p.hour, p.minute, p.second, p.ms) -
    TASHKENT_OFFSET_MS;
  return new Date(utcDayMs);
}

/**
 * Signed integer calendar day delta in Asia/Tashkent (`to - from`).
 */
export function diffTashkentCalendarDays(fromDate: Date, toDate: Date): number {
  const startFrom = startOfTashkentDay(fromDate);
  const startTo = startOfTashkentDay(toDate);
  return Math.round((startTo.getTime() - startFrom.getTime()) / DAY_MS);
}

/**
 * Computes the next `paidUntil` window for a period payment:
 * - If `currentPaidUntil` is on or after `paymentDate` in Tashkent calendar days, extends from `currentPaidUntil`.
 * - Otherwise starts fresh from `paymentDate`.
 */
export function computeNextPaidUntil(
  currentPaidUntil: Date | null | undefined,
  paymentDate: Date,
  periodMonths: number
): { periodStart: Date; periodEnd: Date } {
  const payStart = startOfTashkentDay(paymentDate);
  const isNotExpired =
    currentPaidUntil != null &&
    endOfTashkentDay(currentPaidUntil).getTime() >= payStart.getTime();

  if (isNotExpired && currentPaidUntil) {
    const periodStart = addCalendarDays(startOfTashkentDay(currentPaidUntil), 1);
    const periodEnd = endOfTashkentDay(addCalendarMonths(currentPaidUntil, periodMonths));
    return { periodStart, periodEnd };
  }

  const periodStart = payStart;
  const periodEnd = endOfTashkentDay(addCalendarMonths(payStart, periodMonths));
  return { periodStart, periodEnd };
}

// ============================================================
// 2. Atomic Sequential Invoice & Receipt Numbering
// ============================================================

async function nextCenterSequence(
  tx: Prisma.TransactionClient,
  centerId: string,
  prefix: "INV" | "RCP",
  date: Date
): Promise<string> {
  const ym = formatTashkentYearMonth(date);
  const bucket = `${prefix}-${ym}`;
  const id = crypto.randomUUID();

  const rows = await tx.$queryRaw<Array<{ lastSeq: number }>>`
    INSERT INTO "InvoiceCounter" ("id", "centerId", "yearMonth", "lastSeq", "updatedAt")
    VALUES (${id}, ${centerId}, ${bucket}, 1, NOW())
    ON CONFLICT ("centerId", "yearMonth")
    DO UPDATE SET "lastSeq" = "InvoiceCounter"."lastSeq" + 1, "updatedAt" = NOW()
    RETURNING "lastSeq"
  `;

  const seq = rows[0]?.lastSeq ?? 1;
  return `${prefix}-${ym}-${String(seq).padStart(4, "0")}`;
}

export async function generateCenterInvoiceNumber(
  tx: Prisma.TransactionClient,
  centerId: string,
  date = new Date()
): Promise<string> {
  return nextCenterSequence(tx, centerId, "INV", date);
}

export async function generateCenterReceiptNumber(
  tx: Prisma.TransactionClient,
  centerId: string,
  date = new Date()
): Promise<string> {
  return nextCenterSequence(tx, centerId, "RCP", date);
}

// ============================================================
// 3. Group 1/2/3-Month Pricing Engine
// ============================================================

export interface GroupPeriodPriceDTO {
  periodMonths: BillingPeriodMonths;
  price: number;
  isCustom: boolean;
  exceedsSingleMultiple: boolean;
}

export interface GroupPricingOverviewDTO {
  groupId: string;
  courseId: string;
  coursePriceMonthly: number;
  periods: GroupPeriodPriceDTO[];
}

export function buildGroupPricingOverview(
  groupId: string,
  courseId: string,
  coursePriceMonthly: number,
  plans: Array<{ periodMonths: number; price: number; isActive: boolean }>
): GroupPricingOverviewDTO {
  const baseCoursePrice = Math.max(0, roundUzs(coursePriceMonthly || 0));
  const activePlans = new Map<number, number>();
  for (const plan of plans) {
    if (plan.isActive && (plan.periodMonths === 1 || plan.periodMonths === 2 || plan.periodMonths === 3)) {
      activePlans.set(plan.periodMonths, Math.max(0, roundUzs(plan.price)));
    }
  }

  const price1 = activePlans.has(1) ? activePlans.get(1)! : baseCoursePrice;
  const periods: GroupPeriodPriceDTO[] = ([1, 2, 3] as const).map((periodMonths) => {
    const isCustom = activePlans.has(periodMonths);
    const price = isCustom ? activePlans.get(periodMonths)! : roundUzs(baseCoursePrice * periodMonths);
    const exceedsSingleMultiple = periodMonths > 1 && price1 > 0 && price > price1 * periodMonths;
    return { periodMonths, price, isCustom, exceedsSingleMultiple };
  });

  return {
    groupId,
    courseId,
    coursePriceMonthly: baseCoursePrice,
    periods,
  };
}

export async function getGroupPricingOverview(
  centerId: string,
  groupId: string
): Promise<GroupPricingOverviewDTO> {
  const tenantDb = getTenantDb(centerId);
  const group = await tenantDb.group.findFirst({
    where: { id: groupId, centerId },
    select: {
      id: true,
      courseId: true,
      course: { select: { priceMonthly: true } },
      pricingPlans: {
        where: { centerId },
        select: { periodMonths: true, price: true, isActive: true },
      },
    },
  });

  if (!group) {
    throw new BillingError(404, "Группа не найдена в этом центре", "GROUP_NOT_FOUND");
  }

  return buildGroupPricingOverview(
    group.id,
    group.courseId,
    group.course?.priceMonthly || 0,
    group.pricingPlans
  );
}

export async function upsertGroupPricingPlans(params: {
  centerId: string;
  groupId: string;
  plans: Array<{ periodMonths: BillingPeriodMonths; price: number }>;
  actorUserId: string;
}): Promise<GroupPricingOverviewDTO> {
  const tenantDb = getTenantDb(params.centerId);
  const group = await tenantDb.group.findFirst({
    where: { id: params.groupId, centerId: params.centerId },
    select: { id: true, name: true, courseId: true, course: { select: { priceMonthly: true } } },
  });
  if (!group) {
    throw new BillingError(404, "Группа не найдена в этом центре", "GROUP_NOT_FOUND");
  }

  await db.$transaction(async (tx) => {
    for (const item of params.plans) {
      if (![1, 2, 3].includes(item.periodMonths)) {
        throw new BillingError(400, "Допустимый период оплаты: 1, 2 или 3 месяца", "INVALID_PERIOD");
      }
      if (!Number.isInteger(item.price) || item.price < 0) {
        throw new BillingError(400, "Цена должна быть целым неотрицательным числом в UZS", "INVALID_PRICE");
      }

      await tx.groupPricingPlan.upsert({
        where: {
          groupId_periodMonths: {
            groupId: group.id,
            periodMonths: item.periodMonths,
          },
        },
        update: {
          price: item.price,
          isActive: true,
        },
        create: {
          centerId: params.centerId,
          groupId: group.id,
          periodMonths: item.periodMonths,
          price: item.price,
          isActive: true,
        },
      });
    }

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "GROUP_PRICING_UPDATED",
        resource: "GroupPricingPlan",
        resourceId: group.id,
        detailsJson: JSON.stringify({
          groupName: group.name,
          plans: params.plans,
        }),
      },
    });
  });

  invalidateFinanceReportCache(params.centerId);
  return getGroupPricingOverview(params.centerId, group.id);
}

export async function resolveGroupPeriodPrice(
  txOrClient: Prisma.TransactionClient | typeof db,
  centerId: string,
  groupId: string,
  periodMonths: BillingPeriodMonths
): Promise<{ price: number; isCustom: boolean; courseId: string }> {
  if (![1, 2, 3].includes(periodMonths)) {
    throw new BillingError(400, "Период оплаты должен быть 1, 2 или 3 месяца", "INVALID_PERIOD");
  }

  const group = await txOrClient.group.findFirst({
    where: { id: groupId, centerId },
    select: {
      id: true,
      courseId: true,
      course: { select: { priceMonthly: true } },
      pricingPlans: {
        where: { centerId, periodMonths, isActive: true },
        select: { price: true },
        take: 1,
      },
    },
  });

  if (!group) {
    throw new BillingError(404, "Группа не найдена в этом центре", "GROUP_NOT_FOUND");
  }

  if (group.pricingPlans.length > 0) {
    return {
      price: Math.max(0, roundUzs(group.pricingPlans[0].price)),
      isCustom: true,
      courseId: group.courseId,
    };
  }

  return {
    price: Math.max(0, roundUzs((group.course?.priceMonthly || 0) * periodMonths)),
    isCustom: false,
    courseId: group.courseId,
  };
}

// ============================================================
// 4. Discount Permissions & Promo Code Resolution (Atomic)
// ============================================================

export interface DiscountActorContext {
  platformRole: string;
  centerRole: string;
  membershipPermissions?: string | null;
}

export async function assertActorCanApplyDiscount(
  txOrClient: Prisma.TransactionClient | typeof db,
  centerId: string,
  actor: DiscountActorContext
): Promise<void> {
  const permitted = hasPermission(
    "payments.discount",
    actor.platformRole,
    actor.centerRole,
    actor.membershipPermissions
  );
  if (!permitted) {
    throw new BillingError(403, "Недостаточно прав для применения скидки (payments.discount)", "DISCOUNT_FORBIDDEN");
  }
  if (actor.centerRole === "CENTER_ADMIN" && actor.platformRole !== "SUPERADMIN" && actor.platformRole !== "FULL_ACCESS") {
    const center = await txOrClient.learningCenter.findUnique({
      where: { id: centerId },
      select: { allowAdminDiscount: true },
    });
    if (!center?.allowAdminDiscount) {
      throw new BillingError(
        403,
        "Применение скидок администратором отключено настройками учебного центра",
        "ADMIN_DISCOUNT_DISABLED"
      );
    }
  }
}

export function computePromoDiscountAmount(
  subtotal: number,
  discountType: PromoDiscountType,
  value: number
): number {
  const cleanSubtotal = Math.max(0, roundUzs(subtotal));
  if (cleanSubtotal === 0) return 0;
  if (discountType === "PERCENT") {
    const pct = Math.min(100, Math.max(0, value));
    return Math.min(cleanSubtotal, roundUzs((cleanSubtotal * pct) / 100));
  }
  return Math.min(cleanSubtotal, Math.max(0, roundUzs(value)));
}

export async function validatePromoCodeEligibility(params: {
  txOrClient?: Prisma.TransactionClient | typeof db;
  centerId: string;
  code: string;
  courseId?: string | null;
  groupId?: string | null;
  subtotal: number;
  now?: Date;
}) {
  const client = params.txOrClient ?? db;
  const normalizedCode = params.code.trim().toUpperCase();
  if (!normalizedCode) {
    throw new BillingError(400, "Промокод не может быть пустым", "INVALID_PROMO");
  }
  const now = params.now ?? new Date();

  const promo = await client.promoCode.findFirst({
    where: { centerId: params.centerId, code: normalizedCode },
  });

  if (!promo) {
    throw new BillingError(404, "Промокод не найден", "PROMO_NOT_FOUND");
  }
  if (!promo.isActive) {
    throw new BillingError(400, "Промокод деактивирован", "PROMO_INACTIVE");
  }
  if (promo.validFrom && promo.validFrom > now) {
    throw new BillingError(400, "Срок действия промокода ещё не наступил", "PROMO_NOT_STARTED");
  }
  if (promo.validUntil && promo.validUntil < now) {
    throw new BillingError(400, "Срок действия промокода истёк", "PROMO_EXPIRED");
  }
  if (promo.maxUses !== null && promo.usesCount >= promo.maxUses) {
    throw new BillingError(409, "Лимит использований промокода исчерпан", "PROMO_LIMIT_REACHED");
  }
  if (promo.applicableGroupId && params.groupId && promo.applicableGroupId !== params.groupId) {
    throw new BillingError(400, "Промокод не действует для выбранной группы", "PROMO_WRONG_GROUP");
  }
  if (promo.applicableGroupId && !params.groupId) {
    throw new BillingError(400, "Для этого промокода требуется указать целевую группу", "PROMO_REQUIRES_GROUP");
  }
  if (promo.applicableCourseId && params.courseId && promo.applicableCourseId !== params.courseId) {
    throw new BillingError(400, "Промокод не действует для выбранного курса", "PROMO_WRONG_COURSE");
  }
  if (promo.applicableCourseId && !params.courseId) {
    throw new BillingError(400, "Для этого промокода требуется указать курс/группу", "PROMO_REQUIRES_COURSE");
  }

  const discountAmount = computePromoDiscountAmount(params.subtotal, promo.discountType, promo.value);
  return { promo, discountAmount };
}

/**
 * Atomically consumes 1 use of a promo code using row-level UPDATE guard (`usesCount < maxUses`).
 * Prevents race conditions even when multiple concurrent checkouts target the last slot.
 */
export async function consumePromoCodeAtomic(params: {
  tx: Prisma.TransactionClient;
  centerId: string;
  promoId: string;
  courseId?: string | null;
  groupId?: string | null;
  subtotal: number;
  now?: Date;
}) {
  const now = params.now ?? new Date();
  const updated = await params.tx.$queryRaw<
    Array<{
      id: string;
      code: string;
      discountType: PromoDiscountType;
      value: number;
      applicableCourseId: string | null;
      applicableGroupId: string | null;
    }>
  >`
    UPDATE "PromoCode"
    SET "usesCount" = "usesCount" + 1, "updatedAt" = NOW()
    WHERE "id" = ${params.promoId}
      AND "centerId" = ${params.centerId}
      AND "isActive" = true
      AND ("validFrom" IS NULL OR "validFrom" <= ${now})
      AND ("validUntil" IS NULL OR "validUntil" >= ${now})
      AND ("maxUses" IS NULL OR "usesCount" < "maxUses")
    RETURNING "id", "code", "discountType", "value", "applicableCourseId", "applicableGroupId"
  `;

  if (updated.length === 0) {
    throw new BillingError(
      409,
      "Промокод недействителен, истёк или исчерпан лимит использований",
      "PROMO_EXHAUSTED"
    );
  }

  const row = updated[0];
  if (row.applicableGroupId && row.applicableGroupId !== params.groupId) {
    throw new BillingError(400, "Промокод не действует для выбранной группы", "PROMO_WRONG_GROUP");
  }
  if (row.applicableCourseId && row.applicableCourseId !== params.courseId) {
    throw new BillingError(400, "Промокод не действует для выбранного курса", "PROMO_WRONG_COURSE");
  }

  const discountAmount = computePromoDiscountAmount(params.subtotal, row.discountType, row.value);
  return { promo: row, discountAmount };
}

// ============================================================
// 5. Charge Generation & Unified Payment Processing
// ============================================================

export async function createChargeForEnrollment(params: {
  centerId: string;
  enrollmentId: string;
  periodMonths: BillingPeriodMonths;
  dueDate?: Date;
  promoCode?: string | null;
  manualDiscountAmount?: number;
  discountReason?: string | null;
  actorUserId: string;
  actor: DiscountActorContext;
}) {
  const now = new Date();
  const created = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; studentMembershipId: string; groupId: string; status: string; paidUntil: Date | null }>
    >`
      SELECT "id", "studentMembershipId", "groupId", "status"::text, "paidUntil"
      FROM "Enrollment"
      WHERE "id" = ${params.enrollmentId} AND "centerId" = ${params.centerId}
      FOR UPDATE
    `;

    const enrollment = locked[0];
    if (!enrollment) {
      throw new BillingError(404, "Зачисление не найдено в этом центре", "ENROLLMENT_NOT_FOUND");
    }
    if (enrollment.status === "DROPPED" || enrollment.status === "COMPLETED") {
      throw new BillingError(400, "Нельзя выставить счёт для отчисленного/завершённого зачисления", "ENROLLMENT_INACTIVE");
    }

    const pricing = await resolveGroupPeriodPrice(
      tx,
      params.centerId,
      enrollment.groupId,
      params.periodMonths
    );

    const { periodStart, periodEnd } = computeNextPaidUntil(
      enrollment.paidUntil,
      now,
      params.periodMonths
    );

    let totalDiscount = 0;
    let promoId: string | null = null;
    let combinedReason: string | null = params.discountReason?.trim() || null;

    if (params.promoCode && params.promoCode.trim()) {
      const checked = await validatePromoCodeEligibility({
        txOrClient: tx,
        centerId: params.centerId,
        code: params.promoCode,
        courseId: pricing.courseId,
        groupId: enrollment.groupId,
        subtotal: pricing.price,
        now,
      });
      const consumed = await consumePromoCodeAtomic({
        tx,
        centerId: params.centerId,
        promoId: checked.promo.id,
        courseId: pricing.courseId,
        groupId: enrollment.groupId,
        subtotal: pricing.price,
        now,
      });
      promoId = consumed.promo.id;
      totalDiscount += consumed.discountAmount;
      if (!combinedReason) {
        combinedReason = `Промокод ${consumed.promo.code}`;
      }
    }

    if (params.manualDiscountAmount && params.manualDiscountAmount > 0) {
      if (!Number.isInteger(params.manualDiscountAmount)) {
        throw new BillingError(400, "Скидка должна быть целым числом в UZS", "INVALID_DISCOUNT");
      }
      await assertActorCanApplyDiscount(tx, params.centerId, params.actor);
      if (!params.discountReason || !params.discountReason.trim()) {
        throw new BillingError(400, "Укажите причину предоставления ручной скидки", "DISCOUNT_REASON_REQUIRED");
      }
      totalDiscount += params.manualDiscountAmount;
    }

    if (totalDiscount > pricing.price) {
      throw new BillingError(400, "Сумма скидки не может превышать стоимость периода", "DISCOUNT_EXCEEDS_TOTAL");
    }

    const finalAmount = pricing.price - totalDiscount;
    const invoiceNumber = await generateCenterInvoiceNumber(tx, params.centerId, now);

    let charge;
    try {
      charge = await tx.charge.create({
        data: {
          centerId: params.centerId,
          enrollmentId: enrollment.id,
          studentMembershipId: enrollment.studentMembershipId,
          groupId: enrollment.groupId,
          invoiceNumber,
          periodMonths: params.periodMonths,
          periodStart,
          periodEnd,
          originalAmount: pricing.price,
          discountAmount: totalDiscount,
          discountReason: combinedReason,
          amount: finalAmount,
          paidAmount: 0,
          status: finalAmount === 0 ? "PAID" : "PENDING",
          paidAt: finalAmount === 0 ? now : null,
          promoCodeId: promoId,
          dueDate: params.dueDate ?? periodStart,
          createdByUserId: params.actorUserId,
        },
      });
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new BillingError(
          409,
          "Счёт на данный расчётный период уже выставлен для этого зачисления",
          "DUPLICATE_CHARGE_PERIOD"
        );
      }
      throw err;
    }

    if (promoId) {
      await tx.promoCodeRedemption.create({
        data: {
          centerId: params.centerId,
          promoCodeId: promoId,
          studentMembershipId: enrollment.studentMembershipId,
          chargeId: charge.id,
          discountAmount: totalDiscount,
        },
      });
    }

    if (finalAmount === 0) {
      await tx.enrollment.update({
        where: { id: enrollment.id },
        data: { paidUntil: periodEnd },
      });
    }

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "BILLING_CHARGE_CREATED",
        resource: "Charge",
        resourceId: charge.id,
        detailsJson: JSON.stringify({
          invoiceNumber,
          periodMonths: params.periodMonths,
          originalAmount: pricing.price,
          discountAmount: totalDiscount,
          amount: finalAmount,
        }),
      },
    });

    return charge;
  });

  invalidateFinanceReportCache(params.centerId);
  return created;
}

export interface RecordBillingPaymentInput {
  centerId: string;
  studentMembershipId: string;
  groupId?: string | null;
  chargeId?: string | null;
  periodMonths?: BillingPeriodMonths | null;
  amount?: number | null; // optional when paying full group period or charge; required for standalone
  paymentMethod?: PaymentMethod;
  currency?: Currency;
  status?: CenterPaymentStatus;
  installmentIndex?: number | null;
  promoCode?: string | null;
  manualDiscountAmount?: number;
  discountReason?: string | null;
  note?: string | null;
  externalTxId?: string | null;
  paymentIntentId?: string | null;
  targetAccountId?: string | null;
  paymentDate?: Date;
  actorUserId: string;
  actor?: DiscountActorContext;
  tx?: Prisma.TransactionClient;
}

/**
 * Unified transactionally atomic payment processor.
 * Allocates payments to Charges (creating Charge on-the-fly for group period payments),
 * updates Enrollment.paidUntil according to center settings, consumes promos atomically,
 * assigns receiptNumber + receiptVerifyHash, and syncs FinanceTransaction.
 */
export async function recordBillingPayment(input: RecordBillingPaymentInput) {
  const runInTx = async (tx: Prisma.TransactionClient) => {
    const now = input.paymentDate ?? new Date();
    const method: PaymentMethod = input.paymentMethod ?? "CASH";
    const requestedStatus: CenterPaymentStatus = input.status ?? "PAID";

    const student = await tx.centerMembership.findFirst({
      where: {
        id: input.studentMembershipId,
        centerId: input.centerId,
        role: "STUDENT",
      },
      include: { user: { select: { fullName: true } } },
    });

    if (!student) {
      throw new BillingError(404, "Ученик не найден в этом учебном центре", "STUDENT_NOT_FOUND");
    }

    const centerConfig = await tx.learningCenter.findUnique({
      where: { id: input.centerId },
      select: { partialPaymentExtendsPeriod: true },
    });
    const partialExtends = centerConfig?.partialPaymentExtendsPeriod ?? false;

    const receiptNumber = await generateCenterReceiptNumber(tx, input.centerId, now);

    // Case A: Settling an existing Charge
    if (input.chargeId) {
      const lockedCharges = await tx.$queryRaw<
        Array<{
          id: string;
          enrollmentId: string;
          studentMembershipId: string;
          groupId: string;
          periodMonths: number;
          periodStart: Date;
          periodEnd: Date;
          originalAmount: number;
          discountAmount: number;
          amount: number;
          paidAmount: number;
          status: string;
          paidAt: Date | null;
        }>
      >`
        SELECT "id", "enrollmentId", "studentMembershipId", "groupId", "periodMonths",
               "periodStart", "periodEnd", "originalAmount", "discountAmount", "amount",
               "paidAmount", "status"::text, "paidAt"
        FROM "Charge"
        WHERE "id" = ${input.chargeId} AND "centerId" = ${input.centerId}
        FOR UPDATE
      `;
      const charge = lockedCharges[0];
      if (!charge) {
        throw new BillingError(404, "Счёт на оплату не найден", "CHARGE_NOT_FOUND");
      }
      if (charge.studentMembershipId !== student.id) {
        throw new BillingError(400, "Счёт принадлежит другому ученику", "CHARGE_STUDENT_MISMATCH");
      }
      if (charge.status === "CANCELLED" || charge.status === "REFUNDED") {
        throw new BillingError(400, "Нельзя оплатить отменённый счёт", "CHARGE_CANCELLED");
      }

      const remainingDue = Math.max(0, charge.amount - charge.paidAmount);
      if (remainingDue === 0) {
        throw new BillingError(409, "Счёт уже полностью оплачен", "CHARGE_ALREADY_PAID");
      }

      const payAmount =
        input.amount != null ? roundUzs(input.amount) : remainingDue;
      if (!Number.isInteger(payAmount) || payAmount <= 0) {
        throw new BillingError(400, "Сумма оплаты должна быть положительной", "INVALID_AMOUNT");
      }

      const allocated = Math.min(remainingDue, payAmount);
      const isSettledNow = requestedStatus === "PAID" || requestedStatus === "PARTIALLY_PAID";
      const finalPaymentStatus: CenterPaymentStatus =
        isSettledNow && allocated < remainingDue && payAmount < remainingDue
          ? "PARTIALLY_PAID"
          : requestedStatus;

      const paymentId = crypto.randomUUID();
      const verifyCode = computeReceiptVerifyCode(paymentId);
      const verifyHash = computeReceiptVerifyHash(verifyCode);

      const payment = await tx.centerPayment.create({
        data: {
          id: paymentId,
          centerId: input.centerId,
          studentMembershipId: student.id,
          groupId: charge.groupId,
          amount: payAmount,
          originalAmount: charge.originalAmount,
          discountAmount: charge.discountAmount,
          periodMonths: charge.periodMonths,
          periodStart: charge.periodStart,
          periodEnd: charge.periodEnd,
          receiptNumber,
          receiptVerifyHash: verifyHash,
          paymentIntentId: input.paymentIntentId ?? null,
          currency: input.currency ?? "UZS",
          status: finalPaymentStatus,
          paymentMethod: method,
          installmentIndex: input.installmentIndex ?? 1,
          externalTxId: input.externalTxId ?? null,
          note: input.note ?? null,
          paidAt: isSettledNow ? now : null,
        },
        include: {
          student: { include: { user: { select: { fullName: true } } } },
        },
      });

      if (isSettledNow) {
        const newPaidAmount = charge.paidAmount + allocated;
        const chargeFullyPaid = newPaidAmount >= charge.amount;
        await tx.chargePaymentAllocation.create({
          data: {
            centerId: input.centerId,
            chargeId: charge.id,
            paymentId: payment.id,
            amount: allocated,
          },
        });
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            paidAmount: newPaidAmount,
            status: chargeFullyPaid ? "PAID" : "PARTIAL",
            paidAt: chargeFullyPaid ? now : charge.paidAt,
          },
        });

        await applyPaidUntilUpdateForChargePayment({
          tx,
          centerId: input.centerId,
          enrollmentId: charge.enrollmentId,
          chargePeriodStart: charge.periodStart,
          chargePeriodEnd: charge.periodEnd,
          chargeAmount: charge.amount,
          allocatedNow: allocated,
          newPaidAmount,
          partialExtends,
        });

        await syncCenterPaymentToFinance({
          centerId: input.centerId,
          paymentId: payment.id,
          actorUserId: input.actorUserId,
          accountId: input.targetAccountId ?? undefined,
          tx,
        });
      }

      await writePaymentAudit(tx, input, payment.id, { receiptNumber, chargeId: charge.id });
      return payment;
    }

    // Case B: Period-based group payment (1, 2, or 3 months) - server enforces authoritative pricing
    if (input.groupId && input.periodMonths) {
      const periodMonths = input.periodMonths;
      if (![1, 2, 3].includes(periodMonths)) {
        throw new BillingError(400, "Период оплаты может быть только 1, 2 или 3 месяца", "INVALID_PERIOD");
      }

      const lockedEnrollments = await tx.$queryRaw<
        Array<{ id: string; groupId: string; status: string; paidUntil: Date | null }>
      >`
        SELECT "id", "groupId", "status"::text, "paidUntil"
        FROM "Enrollment"
        WHERE "studentMembershipId" = ${student.id}
          AND "groupId" = ${input.groupId}
          AND "centerId" = ${input.centerId}
        FOR UPDATE
      `;
      const enrollment = lockedEnrollments[0];
      if (!enrollment) {
        throw new BillingError(404, "Ученик не зачислен в указанную группу", "ENROLLMENT_NOT_FOUND");
      }
      if (enrollment.status === "DROPPED" || enrollment.status === "COMPLETED") {
        throw new BillingError(400, "Зачисление в группу не активно", "ENROLLMENT_INACTIVE");
      }

      const pricing = await resolveGroupPeriodPrice(tx, input.centerId, enrollment.groupId, periodMonths);
      const { periodStart, periodEnd } = computeNextPaidUntil(enrollment.paidUntil, now, periodMonths);

      let promoId: string | null = null;
      let promoDiscount = 0;
      let manualDiscount = 0;
      let discountReason = input.discountReason?.trim() || null;

      if (input.promoCode && input.promoCode.trim()) {
        const checked = await validatePromoCodeEligibility({
          txOrClient: tx,
          centerId: input.centerId,
          code: input.promoCode,
          courseId: pricing.courseId,
          groupId: enrollment.groupId,
          subtotal: pricing.price,
          now,
        });
        const consumed = await consumePromoCodeAtomic({
          tx,
          centerId: input.centerId,
          promoId: checked.promo.id,
          courseId: pricing.courseId,
          groupId: enrollment.groupId,
          subtotal: pricing.price,
          now,
        });
        promoId = consumed.promo.id;
        promoDiscount = consumed.discountAmount;
        if (!discountReason) {
          discountReason = `Промокод ${consumed.promo.code}`;
        }
      }

      if (input.manualDiscountAmount && input.manualDiscountAmount > 0) {
        if (!Number.isInteger(input.manualDiscountAmount)) {
          throw new BillingError(400, "Скидка должна быть целым числом в UZS", "INVALID_DISCOUNT");
        }
        if (!input.actor) {
          throw new BillingError(403, "Недостаточно прав для применения скидки", "DISCOUNT_FORBIDDEN");
        }
        await assertActorCanApplyDiscount(tx, input.centerId, input.actor);
        if (!input.discountReason || !input.discountReason.trim()) {
          throw new BillingError(400, "Для ручной скидки необходимо указать причину", "DISCOUNT_REASON_REQUIRED");
        }
        manualDiscount = input.manualDiscountAmount;
      }

      const totalDiscount = promoDiscount + manualDiscount;
      if (totalDiscount > pricing.price) {
        throw new BillingError(400, "Сумма скидки превышает стоимость периода", "DISCOUNT_EXCEEDS_TOTAL");
      }

      const expectedAmount = pricing.price - totalDiscount;
      const payAmount = input.amount != null ? roundUzs(input.amount) : expectedAmount;
      if (!Number.isInteger(payAmount) || payAmount < 0 || (expectedAmount > 0 && payAmount === 0)) {
        throw new BillingError(400, "Сумма оплаты должна быть положительной", "INVALID_AMOUNT");
      }

      const isSettledNow = requestedStatus === "PAID" || requestedStatus === "PARTIALLY_PAID";
      const isPartialPay = isSettledNow && payAmount < expectedAmount;
      const paymentStatus: CenterPaymentStatus = isPartialPay ? "PARTIALLY_PAID" : requestedStatus;

      const invoiceNumber = await generateCenterInvoiceNumber(tx, input.centerId, now);
      const allocatedAmount = Math.min(expectedAmount, payAmount);
      const chargeFullyPaid = isSettledNow && allocatedAmount >= expectedAmount;

      let charge;
      try {
        charge = await tx.charge.create({
          data: {
            centerId: input.centerId,
            enrollmentId: enrollment.id,
            studentMembershipId: student.id,
            groupId: enrollment.groupId,
            invoiceNumber,
            periodMonths,
            periodStart,
            periodEnd,
            originalAmount: pricing.price,
            discountAmount: totalDiscount,
            discountReason,
            amount: expectedAmount,
            paidAmount: isSettledNow ? allocatedAmount : 0,
            status: !isSettledNow ? "PENDING" : chargeFullyPaid ? "PAID" : "PARTIAL",
            paidAt: chargeFullyPaid ? now : null,
            promoCodeId: promoId,
            dueDate: periodStart,
            createdByUserId: input.actorUserId,
          },
        });
      } catch (err: unknown) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
          throw new BillingError(
            409,
            "Счёт на данный расчётный период уже выставлен для этого зачисления",
            "DUPLICATE_CHARGE_PERIOD"
          );
        }
        throw err;
      }

      const paymentId = crypto.randomUUID();
      const verifyCode = computeReceiptVerifyCode(paymentId);
      const verifyHash = computeReceiptVerifyHash(verifyCode);

      const payment = await tx.centerPayment.create({
        data: {
          id: paymentId,
          centerId: input.centerId,
          studentMembershipId: student.id,
          groupId: enrollment.groupId,
          amount: payAmount,
          originalAmount: pricing.price,
          discountAmount: totalDiscount,
          discountReason,
          promoCodeId: promoId,
          periodMonths,
          periodStart,
          periodEnd,
          receiptNumber,
          receiptVerifyHash: verifyHash,
          paymentIntentId: input.paymentIntentId ?? null,
          currency: input.currency ?? "UZS",
          status: paymentStatus,
          paymentMethod: method,
          installmentIndex: input.installmentIndex ?? 1,
          externalTxId: input.externalTxId ?? null,
          note: input.note ?? null,
          paidAt: isSettledNow ? now : null,
        },
        include: {
          student: { include: { user: { select: { fullName: true } } } },
        },
      });

      if (promoId) {
        await tx.promoCodeRedemption.create({
          data: {
            centerId: input.centerId,
            promoCodeId: promoId,
            studentMembershipId: student.id,
            chargeId: charge.id,
            paymentId: payment.id,
            discountAmount: promoDiscount,
          },
        });
      }

      if (isSettledNow) {
        if (allocatedAmount > 0) {
          await tx.chargePaymentAllocation.create({
            data: {
              centerId: input.centerId,
              chargeId: charge.id,
              paymentId: payment.id,
              amount: allocatedAmount,
            },
          });
        }

        await applyPaidUntilUpdateForChargePayment({
          tx,
          centerId: input.centerId,
          enrollmentId: enrollment.id,
          chargePeriodStart: periodStart,
          chargePeriodEnd: periodEnd,
          chargeAmount: expectedAmount,
          allocatedNow: allocatedAmount,
          newPaidAmount: allocatedAmount,
          partialExtends,
        });

        await syncCenterPaymentToFinance({
          centerId: input.centerId,
          paymentId: payment.id,
          actorUserId: input.actorUserId,
          accountId: input.targetAccountId ?? undefined,
          tx,
        });
      }

      await writePaymentAudit(tx, input, payment.id, {
        receiptNumber,
        invoiceNumber,
        chargeId: charge.id,
        periodMonths,
      });
      return payment;
    }

    // Case C: Standalone/legacy manual payment (no chargeId and no periodMonths)
    const intAmount = input.amount != null ? roundUzs(input.amount) : 0;
    if (!Number.isInteger(intAmount) || intAmount <= 0) {
      throw new BillingError(400, "Сумма оплаты должна быть положительным числом", "INVALID_AMOUNT");
    }

    let manualDiscount = 0;
    let discountReason = input.discountReason?.trim() || null;
    if (input.manualDiscountAmount && input.manualDiscountAmount > 0) {
      if (!Number.isInteger(input.manualDiscountAmount)) {
        throw new BillingError(400, "Скидка должна быть целым числом в UZS", "INVALID_DISCOUNT");
      }
      if (!input.actor) {
        throw new BillingError(403, "Недостаточно прав для применения скидки", "DISCOUNT_FORBIDDEN");
      }
      await assertActorCanApplyDiscount(tx, input.centerId, input.actor);
      if (!discountReason) {
        throw new BillingError(400, "Укажите причину предоставления скидки", "DISCOUNT_REASON_REQUIRED");
      }
      manualDiscount = input.manualDiscountAmount;
    }

    if (input.groupId) {
      const grp = await tx.group.findFirst({
        where: { id: input.groupId, centerId: input.centerId },
        select: { id: true },
      });
      if (!grp) {
        throw new BillingError(404, "Группа не найдена в этом центре", "GROUP_NOT_FOUND");
      }
    }

    const isSettledNow = requestedStatus === "PAID" || requestedStatus === "PARTIALLY_PAID";
    const paymentId = crypto.randomUUID();
    const verifyCode = computeReceiptVerifyCode(paymentId);
    const verifyHash = computeReceiptVerifyHash(verifyCode);

    const payment = await tx.centerPayment.create({
      data: {
        id: paymentId,
        centerId: input.centerId,
        studentMembershipId: student.id,
        groupId: input.groupId ?? null,
        amount: intAmount,
        originalAmount: intAmount + manualDiscount,
        discountAmount: manualDiscount,
        discountReason,
        receiptNumber,
        receiptVerifyHash: verifyHash,
        paymentIntentId: input.paymentIntentId ?? null,
        currency: input.currency ?? "UZS",
        status: requestedStatus,
        paymentMethod: method,
        installmentIndex: input.installmentIndex ?? 1,
        externalTxId: input.externalTxId ?? null,
        note: input.note ?? null,
        paidAt: isSettledNow ? now : null,
      },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
      },
    });

    if (isSettledNow) {
      await syncCenterPaymentToFinance({
        centerId: input.centerId,
        paymentId: payment.id,
        actorUserId: input.actorUserId,
        accountId: input.targetAccountId ?? undefined,
        tx,
      });
    }

    await writePaymentAudit(tx, input, payment.id, { receiptNumber });
    return payment;
  };

  const result = input.tx
    ? await runInTx(input.tx)
    : await db.$transaction(runInTx);

  invalidateFinanceReportCache(input.centerId);
  return result;
}

async function applyPaidUntilUpdateForChargePayment(params: {
  tx: Prisma.TransactionClient;
  centerId: string;
  enrollmentId: string;
  chargePeriodStart: Date;
  chargePeriodEnd: Date;
  chargeAmount: number;
  allocatedNow: number;
  newPaidAmount: number;
  partialExtends: boolean;
}) {
  const chargeFullyPaid = params.newPaidAmount >= params.chargeAmount;
  if (!chargeFullyPaid && !params.partialExtends) {
    return;
  }

  const enrollment = await params.tx.enrollment.findFirst({
    where: { id: params.enrollmentId, centerId: params.centerId },
    select: { id: true, paidUntil: true },
  });
  if (!enrollment) return;

  if (chargeFullyPaid) {
    const nextEnd =
      enrollment.paidUntil && enrollment.paidUntil > params.chargePeriodEnd
        ? enrollment.paidUntil
        : params.chargePeriodEnd;
    await params.tx.enrollment.update({
      where: { id: enrollment.id },
      data: { paidUntil: nextEnd },
    });
    return;
  }

  // Partial payment extension enabled by center setting -> extend proportionally
  if (params.chargeAmount <= 0 || params.allocatedNow <= 0) return;
  const totalDays = Math.max(
    1,
    diffTashkentCalendarDays(params.chargePeriodStart, params.chargePeriodEnd) + 1
  );
  const addDays = Math.max(0, Math.round((totalDays * params.allocatedNow) / params.chargeAmount));
  if (addDays <= 0) return;

  const base =
    enrollment.paidUntil && enrollment.paidUntil >= params.chargePeriodStart
      ? enrollment.paidUntil
      : addCalendarDays(startOfTashkentDay(params.chargePeriodStart), -1);
  const extended = endOfTashkentDay(addCalendarDays(base, addDays));
  const clamped = extended > params.chargePeriodEnd ? params.chargePeriodEnd : extended;

  await params.tx.enrollment.update({
    where: { id: enrollment.id },
    data: { paidUntil: clamped },
  });
}

async function writePaymentAudit(
  tx: Prisma.TransactionClient,
  input: RecordBillingPaymentInput,
  paymentId: string,
  extra: Record<string, unknown>
) {
  await tx.auditLog.create({
    data: {
      centerId: input.centerId,
      actorUserId: input.actorUserId,
      action: "STUDENT_PAYMENT_RECORDED",
      resource: "CenterPayment",
      resourceId: paymentId,
      detailsJson: JSON.stringify({
        studentId: input.studentMembershipId,
        paymentMethod: input.paymentMethod ?? "CASH",
        status: input.status ?? "PAID",
        ...extra,
      }),
    },
  });
}

// ============================================================
// 6. Partial / Full Refund + Enrollment.paidUntil Rollback
// ============================================================

export async function refundBillingPayment(params: {
  centerId: string;
  paymentId: string;
  refundAmount?: number | null; // omit/null => full remaining refund
  reason: string;
  actorUserId: string;
  tx?: Prisma.TransactionClient;
}) {
  const cleanReason = params.reason?.trim() ?? "";
  if (cleanReason.length < 3) {
    throw new BillingError(400, "Причина возврата обязательна (минимум 3 символа)", "REFUND_REASON_REQUIRED");
  }

  const runInTx = async (tx: Prisma.TransactionClient) => {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        studentMembershipId: string;
        groupId: string | null;
        amount: number;
        refundedAmount: number;
        status: string;
        paymentMethod: PaymentMethod;
        periodStart: Date | null;
        periodEnd: Date | null;
      }>
    >`
      SELECT "id", "studentMembershipId", "groupId", "amount", "refundedAmount",
             "status"::text, "paymentMethod", "periodStart", "periodEnd"
      FROM "CenterPayment"
      WHERE "id" = ${params.paymentId} AND "centerId" = ${params.centerId} AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    const payment = locked[0];
    if (!payment) {
      throw new BillingError(404, "Платёж не найден в этом центре", "PAYMENT_NOT_FOUND");
    }
    if (payment.status === "PENDING" || payment.status === "FAILED") {
      throw new BillingError(400, "Нельзя оформить возврат для неоплаченного платежа", "PAYMENT_NOT_PAID");
    }

    const totalInt = roundUzs(payment.amount);
    const remaining = Math.max(0, totalInt - roundUzs(payment.refundedAmount));
    if (remaining === 0 || payment.status === "REFUNDED") {
      throw new BillingError(409, "Платёж уже полностью возвращён", "ALREADY_REFUNDED");
    }

    const refundNow =
      params.refundAmount != null ? roundUzs(params.refundAmount) : remaining;
    if (!Number.isInteger(refundNow) || refundNow <= 0) {
      throw new BillingError(400, "Сумма возврата должна быть положительной", "INVALID_REFUND_AMOUNT");
    }
    if (refundNow > remaining) {
      throw new BillingError(
        400,
        `Сумма возврата (${refundNow} UZS) превышает доступный остаток (${remaining} UZS)`,
        "REFUND_EXCEEDS_PAID"
      );
    }

    const newRefundedTotal = roundUzs(payment.refundedAmount) + refundNow;
    const isNowFullyRefunded = newRefundedTotal >= totalInt;
    const now = new Date();
    const isOnlineMethod = payment.paymentMethod === "ONLINE";

    const updatedPayment = await tx.centerPayment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: newRefundedTotal,
        refundedAt: now,
        status: isNowFullyRefunded ? "REFUNDED" : (payment.status as CenterPaymentStatus),
        ...(isOnlineMethod
          ? {
              manualRefundStatus: "PENDING_MANUAL",
              manualRefundNote: cleanReason,
              manualRefundCompletedAt: null,
              manualRefundCompletedById: null,
            }
          : {}),
      },
    });

    // Sync to finance ledger (single-shot full refund uses reversal storno; partial uses EXPENSE refund tx)
    if (payment.refundedAmount === 0 && refundNow === totalInt) {
      await syncCenterPaymentRefundToFinance({
        centerId: params.centerId,
        paymentId: payment.id,
        actorUserId: params.actorUserId,
        reason: cleanReason,
        tx,
      });
    } else {
      const defaults = await ensureDefaultPaymentAccountAndCategory(
        params.centerId,
        payment.paymentMethod,
        tx
      );
      const originalTx = await tx.financeTransaction.findFirst({
        where: { centerId: params.centerId, centerPaymentId: payment.id, isReversal: false },
        select: { accountId: true, groupId: true, courseId: true, branchId: true, counterparty: true },
      });
      const refundCategoryId = await ensureDefaultRefundCategory(params.centerId, tx);

      await recordFinanceTransaction({
        centerId: params.centerId,
        type: "EXPENSE",
        amount: refundNow,
        accountId: originalTx?.accountId ?? defaults.accountId,
        categoryId: refundCategoryId,
        date: now,
        description: `Частичный возврат оплаты: ${cleanReason}`,
        counterparty: originalTx?.counterparty ?? null,
        studentMembershipId: payment.studentMembershipId,
        groupId: originalTx?.groupId ?? payment.groupId,
        courseId: originalTx?.courseId ?? null,
        branchId: originalTx?.branchId ?? null,
        refundPaymentId: payment.id,
        createdBy: params.actorUserId,
        tx,
      });
    }

    // Update Charge allocations & paidAmount proportionally
    const allocations = await tx.chargePaymentAllocation.findMany({
      where: { centerId: params.centerId, paymentId: payment.id },
      include: { charge: true },
    });
    let remainingToDebit = refundNow;
    for (const alloc of allocations) {
      if (remainingToDebit <= 0) break;
      const charge = alloc.charge;
      const debit = Math.min(remainingToDebit, charge.paidAmount, alloc.amount);
      if (debit > 0) {
        const nextChargePaid = Math.max(0, charge.paidAmount - debit);
        const nextStatus =
          nextChargePaid === 0
            ? isNowFullyRefunded
              ? "REFUNDED"
              : "PENDING"
            : "PARTIAL";
        await tx.charge.update({
          where: { id: charge.id },
          data: {
            paidAmount: nextChargePaid,
            status: nextStatus,
          },
        });
        remainingToDebit -= debit;
      }
    }

    // Proportionally roll back Enrollment.paidUntil when payment covered a specific period
    if (payment.groupId && payment.periodStart && payment.periodEnd) {
      const enrollment = await tx.enrollment.findFirst({
        where: {
          centerId: params.centerId,
          studentMembershipId: payment.studentMembershipId,
          groupId: payment.groupId,
        },
        select: { id: true, paidUntil: true },
      });
      if (enrollment?.paidUntil && totalInt > 0) {
        const coveredDays = Math.max(
          1,
          diffTashkentCalendarDays(payment.periodStart, payment.periodEnd) + 1
        );
        const rollbackDays = Math.round((coveredDays * refundNow) / totalInt);
        if (rollbackDays > 0) {
          const reduced = endOfTashkentDay(addCalendarDays(enrollment.paidUntil, -rollbackDays));
          const minBound = addCalendarDays(startOfTashkentDay(payment.periodStart), -1);
          const nextPaidUntil = reduced < minBound ? null : reduced;
          await tx.enrollment.update({
            where: { id: enrollment.id },
            data: { paidUntil: nextPaidUntil },
          });
        }
      }
    }

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "STUDENT_PAYMENT_REFUNDED",
        resource: "CenterPayment",
        resourceId: payment.id,
        detailsJson: JSON.stringify({
          refundAmount: refundNow,
          totalRefunded: newRefundedTotal,
          isFullyRefunded: isNowFullyRefunded,
          paymentMethod: payment.paymentMethod,
          manualRefundStatus: isOnlineMethod ? "PENDING_MANUAL" : "NONE",
          reason: cleanReason,
        }),
      },
    });

    return updatedPayment;
  };

  const updated = params.tx
    ? await runInTx(params.tx)
    : await db.$transaction(runInTx);

  invalidateFinanceReportCache(params.centerId);
  return updated;
}

/**
 * Confirms that an administrator/director has manually executed the refund in the Click merchant cabinet.
 */
export async function completeManualOnlineRefund(params: {
  centerId: string;
  paymentId: string;
  note: string;
  completedAt?: Date;
  actorUserId: string;
}) {
  const cleanNote = params.note?.trim() ?? "";
  if (cleanNote.length < 3) {
    throw new BillingError(
      400,
      "Укажите комментарий/причину подтверждения возврата в Click (минимум 3 символа)",
      "MANUAL_REFUND_NOTE_REQUIRED"
    );
  }
  const completedDate = params.completedAt ?? new Date();
  if (Number.isNaN(completedDate.getTime())) {
    throw new BillingError(400, "Некорректная дата выполнения возврата", "INVALID_COMPLETED_DATE");
  }

  const updated = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{
        id: string;
        paymentMethod: PaymentMethod;
        refundedAmount: number;
        manualRefundStatus: string;
      }>
    >`
      SELECT "id", "paymentMethod", "refundedAmount", "manualRefundStatus"::text
      FROM "CenterPayment"
      WHERE "id" = ${params.paymentId} AND "centerId" = ${params.centerId} AND "deletedAt" IS NULL
      FOR UPDATE
    `;

    const payment = locked[0];
    if (!payment) {
      throw new BillingError(404, "Платёж не найден в этом центре", "PAYMENT_NOT_FOUND");
    }
    if (payment.paymentMethod !== "ONLINE") {
      throw new BillingError(
        400,
        "Подтверждение в кабинете Click применимо только к онлайн-оплатам",
        "NOT_ONLINE_PAYMENT"
      );
    }
    if (payment.refundedAmount <= 0) {
      throw new BillingError(
        400,
        "По данному платежу ещё не оформлен возврат в системе",
        "NO_REFUND_RECORDED"
      );
    }
    if (payment.manualRefundStatus === "COMPLETED") {
      throw new BillingError(
        409,
        "Возврат в кабинете Click уже подтверждён",
        "MANUAL_REFUND_ALREADY_COMPLETED"
      );
    }

    const res = await tx.centerPayment.update({
      where: { id: payment.id },
      data: {
        manualRefundStatus: "COMPLETED",
        manualRefundNote: cleanNote,
        manualRefundCompletedAt: completedDate,
        manualRefundCompletedById: params.actorUserId,
      },
    });

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "ONLINE_MANUAL_REFUND_COMPLETED",
        resource: "CenterPayment",
        resourceId: payment.id,
        detailsJson: JSON.stringify({
          refundedAmount: payment.refundedAmount,
          note: cleanNote,
          completedAt: completedDate.toISOString(),
        }),
      },
    });

    return res;
  });

  invalidateFinanceReportCache(params.centerId);
  return updated;
}

// ============================================================
// 7. Enrollment Freeze / Early Unfreeze & DROPPED Proration
// ============================================================

export async function freezeEnrollment(params: {
  centerId: string;
  enrollmentId: string;
  startDate: Date;
  plannedEndDate: Date;
  reason: string;
  actorUserId: string;
}) {
  const cleanReason = params.reason?.trim() ?? "";
  if (cleanReason.length < 3) {
    throw new BillingError(400, "Причина заморозки обязательна", "FREEZE_REASON_REQUIRED");
  }

  const startDay = startOfTashkentDay(params.startDate);
  const endDay = startOfTashkentDay(params.plannedEndDate);
  if (endDay.getTime() <= startDay.getTime()) {
    throw new BillingError(400, "Дата окончания заморозки должна быть позже даты начала", "INVALID_FREEZE_DATES");
  }

  const plannedDays = Math.max(1, diffTashkentCalendarDays(startDay, endDay));

  const res = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; studentMembershipId: string; groupId: string; status: string; paidUntil: Date | null }>
    >`
      SELECT "id", "studentMembershipId", "groupId", "status"::text, "paidUntil"
      FROM "Enrollment"
      WHERE "id" = ${params.enrollmentId} AND "centerId" = ${params.centerId}
      FOR UPDATE
    `;
    const enrollment = locked[0];
    if (!enrollment) {
      throw new BillingError(404, "Зачисление не найдено в этом центре", "ENROLLMENT_NOT_FOUND");
    }
    if (enrollment.status === "FROZEN") {
      throw new BillingError(409, "Абонемент уже заморожен", "ALREADY_FROZEN");
    }
    if (enrollment.status !== "ACTIVE") {
      throw new BillingError(400, "Заморозить можно только активное зачисление", "ENROLLMENT_NOT_ACTIVE");
    }

    const plannedEndAt = endOfTashkentDay(endDay);
    const existingFreezes = await tx.enrollmentFreeze.findMany({
      where: {
        centerId: params.centerId,
        enrollmentId: enrollment.id,
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      select: {
        id: true,
        startDate: true,
        plannedEndDate: true,
        actualEndDate: true,
      },
    });

    const overlappingFreeze = existingFreezes.find((f) => {
      const fEnd = f.actualEndDate ?? f.plannedEndDate;
      return startDay.getTime() <= fEnd.getTime() && f.startDate.getTime() <= plannedEndAt.getTime();
    });
    if (overlappingFreeze) {
      throw new BillingError(
        409,
        "Период заморозки пересекается с уже оформленной заморозкой",
        "FREEZE_OVERLAP"
      );
    }

    let creditedDays = 0;
    let nextPaidUntil = enrollment.paidUntil;
    if (enrollment.paidUntil && endOfTashkentDay(enrollment.paidUntil) >= startDay) {
      creditedDays = plannedDays;
      nextPaidUntil = endOfTashkentDay(addCalendarDays(enrollment.paidUntil, creditedDays));
    }

    const freeze = await tx.enrollmentFreeze.create({
      data: {
        centerId: params.centerId,
        enrollmentId: enrollment.id,
        studentMembershipId: enrollment.studentMembershipId,
        groupId: enrollment.groupId,
        startDate: startDay,
        plannedEndDate: plannedEndAt,
        creditedDays,
        reason: cleanReason,
        status: "ACTIVE",
        createdByUserId: params.actorUserId,
      },
    });

    const updatedEnrollment = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "FROZEN",
        frozenAt: startDay,
        frozenUntil: endOfTashkentDay(endDay),
        paidUntil: nextPaidUntil,
      },
    });

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "ENROLLMENT_FROZEN",
        resource: "Enrollment",
        resourceId: enrollment.id,
        detailsJson: JSON.stringify({
          freezeId: freeze.id,
          creditedDays,
          reason: cleanReason,
        }),
      },
    });

    return { freeze, enrollment: updatedEnrollment };
  });

  invalidateFinanceReportCache(params.centerId);
  return res;
}

export async function unfreezeEnrollment(params: {
  centerId: string;
  enrollmentId: string;
  actualEndDate?: Date;
  actorUserId: string;
}) {
  const actualEnd = startOfTashkentDay(params.actualEndDate ?? new Date());

  const res = await db.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<
      Array<{ id: string; status: string; paidUntil: Date | null }>
    >`
      SELECT "id", "status"::text, "paidUntil"
      FROM "Enrollment"
      WHERE "id" = ${params.enrollmentId} AND "centerId" = ${params.centerId}
      FOR UPDATE
    `;
    const enrollment = locked[0];
    if (!enrollment) {
      throw new BillingError(404, "Зачисление не найдено в этом центре", "ENROLLMENT_NOT_FOUND");
    }
    if (enrollment.status !== "FROZEN") {
      throw new BillingError(400, "Зачисление не находится в заморозке", "NOT_FROZEN");
    }

    const activeFreeze = await tx.enrollmentFreeze.findFirst({
      where: { centerId: params.centerId, enrollmentId: enrollment.id, status: "ACTIVE" },
      orderBy: { createdAt: "desc" },
    });

    let nextPaidUntil = enrollment.paidUntil;
    let actualDays = 0;

    if (activeFreeze) {
      actualDays = Math.max(0, diffTashkentCalendarDays(activeFreeze.startDate, actualEnd));
      const deltaDays = activeFreeze.creditedDays > 0 ? actualDays - activeFreeze.creditedDays : 0;
      if (nextPaidUntil && deltaDays !== 0) {
        nextPaidUntil = endOfTashkentDay(addCalendarDays(nextPaidUntil, deltaDays));
      }

      await tx.enrollmentFreeze.update({
        where: { id: activeFreeze.id },
        data: {
          actualEndDate: endOfTashkentDay(actualEnd),
          creditedDays: activeFreeze.creditedDays > 0 ? actualDays : 0,
          status: "COMPLETED",
          unfrozenByUserId: params.actorUserId,
        },
      });
    }

    const updatedEnrollment = await tx.enrollment.update({
      where: { id: enrollment.id },
      data: {
        status: "ACTIVE",
        frozenAt: null,
        frozenUntil: null,
        paidUntil: nextPaidUntil,
      },
    });

    await tx.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "ENROLLMENT_UNFROZEN",
        resource: "Enrollment",
        resourceId: enrollment.id,
        detailsJson: JSON.stringify({
          freezeId: activeFreeze?.id ?? null,
          actualDays,
          newPaidUntil: nextPaidUntil?.toISOString() ?? null,
        }),
      },
    });

    return { enrollment: updatedEnrollment, actualDays };
  });

  invalidateFinanceReportCache(params.centerId);
  return res;
}

export async function calculateDroppedRemaining(
  centerId: string,
  enrollmentId: string,
  now = new Date()
) {
  const tenantDb = getTenantDb(centerId);
  const enrollment = await tenantDb.enrollment.findFirst({
    where: { id: enrollmentId, centerId },
    include: {
      group: {
        include: {
          course: { select: { id: true, title: true, priceMonthly: true } },
          pricingPlans: { where: { centerId, isActive: true } },
        },
      },
    },
  });

  if (!enrollment) {
    throw new BillingError(404, "Зачисление не найдено в этом центре", "ENROLLMENT_NOT_FOUND");
  }

  const todayStart = startOfTashkentDay(now);
  if (!enrollment.paidUntil || endOfTashkentDay(enrollment.paidUntil) <= todayStart) {
    return {
      enrollmentId: enrollment.id,
      hasPaidRemaining: false,
      remainingDays: 0,
      remainingAmount: 0,
      paidUntil: enrollment.paidUntil ? enrollment.paidUntil.toISOString() : null,
      latestPaymentId: null as string | null,
    };
  }

  const remainingDays = Math.max(0, diffTashkentCalendarDays(todayStart, enrollment.paidUntil));
  const latestPayment = await tenantDb.centerPayment.findFirst({
    where: {
      centerId,
      studentMembershipId: enrollment.studentMembershipId,
      groupId: enrollment.groupId,
      deletedAt: null,
      status: { in: ["PAID", "PARTIALLY_PAID"] },
    },
    orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
  });

  let dailyRate = 0;
  let maxRefundable = 0;
  if (latestPayment && latestPayment.periodStart && latestPayment.periodEnd) {
    const netPaid = Math.max(0, roundUzs(latestPayment.amount) - roundUzs(latestPayment.refundedAmount));
    const totalDays = Math.max(
      1,
      diffTashkentCalendarDays(latestPayment.periodStart, latestPayment.periodEnd) + 1
    );
    dailyRate = netPaid / totalDays;
    maxRefundable = netPaid;
  } else {
    const overview = buildGroupPricingOverview(
      enrollment.groupId,
      enrollment.group.courseId,
      enrollment.group.course?.priceMonthly || 0,
      enrollment.group.pricingPlans
    );
    const monthPrice = overview.periods[0]?.price ?? 0;
    dailyRate = monthPrice / 30;
    maxRefundable = monthPrice;
  }

  const remainingAmount = Math.min(maxRefundable, Math.max(0, roundUzs(remainingDays * dailyRate)));

  return {
    enrollmentId: enrollment.id,
    hasPaidRemaining: remainingDays > 0 && remainingAmount > 0,
    remainingDays,
    remainingAmount,
    paidUntil: enrollment.paidUntil.toISOString(),
    latestPaymentId: latestPayment?.id ?? null,
  };
}

// ============================================================
// 8. Unified Student Balances, Debtors & Center MRR
// ============================================================

export interface UnifiedReceiptDTO {
  id: string;
  receiptNumber: string;
  amount: number;
  refundedAmount: number;
  originalAmount: number;
  discountAmount: number;
  discountReason: string | null;
  currency: string;
  status: string;
  paymentMethod: string;
  groupName: string | null;
  periodMonths: number | null;
  periodStart: string | null;
  periodEnd: string | null;
  paidAt: string | null;
  createdAt: string;
  studentName: string;
  center: {
    name: string;
    legalName: string | null;
    inn: string | null;
    address: string | null;
    phone: string | null;
  };
}

export interface UnifiedEnrollmentBalanceDTO {
  enrollmentId: string;
  groupId: string;
  groupName: string;
  courseTitle: string;
  status: string;
  priceMonthly: number;
  pricing: GroupPeriodPriceDTO[];
  enrolledAt: string;
  paidUntil: string | null;
  frozenAt: string | null;
  frozenUntil: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  monthsEnrolled: number;
  accruedAmount: number;
  openChargesAmount: number;
}

export interface UnifiedChargeDTO {
  id: string;
  invoiceNumber: string;
  groupId: string;
  groupName: string;
  periodMonths: number;
  periodStart: string;
  periodEnd: string;
  originalAmount: number;
  discountAmount: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  dueDate: string;
}

export interface UnifiedStudentBalanceDTO {
  studentMembershipId: string;
  fullName: string;
  email: string;
  phone: string | null;
  monthlyTuition: number;
  totalAccrued: number;
  totalPaid: number;
  unallocatedCredit: number;
  balance: number;
  debtAmount: number;
  status: "DEBT" | "PAID" | "OVERPAID" | "FROZEN";
  earliestPaidUntil: string | null;
  enrollments: UnifiedEnrollmentBalanceDTO[];
  openCharges: UnifiedChargeDTO[];
  receipts: UnifiedReceiptDTO[];
}

export async function calculateCenterStudentBalances(params: {
  centerId: string;
  studentMembershipIds?: string[];
  now?: Date;
}): Promise<UnifiedStudentBalanceDTO[]> {
  const tenantDb = getTenantDb(params.centerId);
  const now = params.now ?? new Date();
  const todayStart = startOfTashkentDay(now);

  const center = await tenantDb.learningCenter.findUnique({
    where: { id: params.centerId },
    select: {
      name: true,
      legalName: true,
      inn: true,
      address: true,
      phone: true,
    },
  });

  const membershipWhere: Record<string, unknown> = {
    centerId: params.centerId,
    role: "STUDENT",
    status: { not: "ARCHIVED" },
  };
  if (params.studentMembershipIds && params.studentMembershipIds.length > 0) {
    membershipWhere.id = { in: params.studentMembershipIds };
  }

  const [students, standaloneTxs] = await Promise.all([
    tenantDb.centerMembership.findMany({
      where: membershipWhere,
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        enrollments: {
          where: { status: { in: ["ACTIVE", "FROZEN"] } },
          include: {
            group: {
              include: {
                course: { select: { id: true, title: true, priceMonthly: true } },
                pricingPlans: {
                  where: { centerId: params.centerId, isActive: true },
                  select: { periodMonths: true, price: true, isActive: true },
                },
              },
            },
          },
          orderBy: { enrolledAt: "asc" },
        },
        charges: {
          where: { status: { not: "CANCELLED" } },
          include: { group: { select: { name: true } } },
          orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        },
        payments: {
          where: { deletedAt: null },
          include: { group: { select: { name: true } } },
          orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        },
      },
      orderBy: { joinedAt: "asc" },
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        centerId: params.centerId,
        type: "INCOME",
        isReversal: false,
        centerPaymentId: null,
        refundPaymentId: null,
        reversedBy: { is: null },
        ...(params.studentMembershipIds && params.studentMembershipIds.length > 0
          ? { studentMembershipId: { in: params.studentMembershipIds } }
          : { studentMembershipId: { not: null } }),
      },
      select: { studentMembershipId: true, amount: true },
    }),
  ]);

  const standaloneMap = new Map<string, number>();
  for (const tx of standaloneTxs) {
    if (!tx.studentMembershipId) continue;
    standaloneMap.set(
      tx.studentMembershipId,
      (standaloneMap.get(tx.studentMembershipId) ?? 0) + roundUzs(tx.amount)
    );
  }

  const centerMeta = {
    name: center?.name || "Учебный центр",
    legalName: center?.legalName ?? null,
    inn: center?.inn ?? null,
    address: center?.address ?? null,
    phone: center?.phone ?? null,
  };

  return students.map((student) => {
    const chargesByEnrollment = new Map<string, typeof student.charges>();
    for (const ch of student.charges) {
      const list = chargesByEnrollment.get(ch.enrollmentId) ?? [];
      list.push(ch);
      chargesByEnrollment.set(ch.enrollmentId, list);
    }

    const totalPaymentPaid = student.payments
      .filter((p) => p.status === "PAID" || p.status === "PARTIALLY_PAID")
      .reduce((sum, p) => sum + Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount)), 0);
    const totalPaid = totalPaymentPaid + (standaloneMap.get(student.id) ?? 0);

    let monthlyTuition = 0;
    let totalChargeAmount = 0;
    let totalOpenChargesDue = 0;
    let totalUnbilledOverdue = 0;
    let earliestPaidUntil: Date | null = null;
    const openCharges: UnifiedChargeDTO[] = [];

    const enrollmentDTOs: UnifiedEnrollmentBalanceDTO[] = student.enrollments.map((en) => {
      const overview = buildGroupPricingOverview(
        en.groupId,
        en.group.courseId,
        en.group.course?.priceMonthly || 0,
        en.group.pricingPlans
      );
      const priceMonthly = overview.periods[0]?.price ?? 0;
      monthlyTuition += priceMonthly;

      const enCharges = chargesByEnrollment.get(en.id) ?? [];
      const enChargeTotal = enCharges.reduce((s, c) => s + c.amount, 0);
      totalChargeAmount += enChargeTotal;

      const enOpenCharges = enCharges.filter((c) => c.status === "PENDING" || c.status === "PARTIAL");
      let enOpenDue = 0;
      for (const ch of enOpenCharges) {
        const rem = Math.max(0, ch.amount - ch.paidAmount);
        enOpenDue += rem;
        openCharges.push({
          id: ch.id,
          invoiceNumber: ch.invoiceNumber,
          groupId: ch.groupId,
          groupName: ch.group.name,
          periodMonths: ch.periodMonths,
          periodStart: ch.periodStart.toISOString(),
          periodEnd: ch.periodEnd.toISOString(),
          originalAmount: ch.originalAmount,
          discountAmount: ch.discountAmount,
          amount: ch.amount,
          paidAmount: ch.paidAmount,
          remainingAmount: rem,
          status: ch.status,
          dueDate: ch.dueDate.toISOString(),
        });
      }
      totalOpenChargesDue += enOpenDue;

      if (en.paidUntil) {
        if (!earliestPaidUntil || en.paidUntil < earliestPaidUntil) {
          earliestPaidUntil = en.paidUntil;
        }
      }

      const daysRemaining = en.paidUntil
        ? diffTashkentCalendarDays(todayStart, en.paidUntil)
        : null;

      const hasOpenChargeCoveringNow = enOpenCharges.some(
        (c) => endOfTashkentDay(c.periodEnd) >= todayStart
      );

      let isOverdue = enOpenDue > 0;
      let unbilledDue = 0;

      if (en.status === "ACTIVE" && priceMonthly > 0) {
        if (en.paidUntil && endOfTashkentDay(en.paidUntil) < todayStart) {
          isOverdue = true;
          if (!hasOpenChargeCoveringNow) {
            unbilledDue = priceMonthly;
          }
        } else if (!en.paidUntil && enCharges.length === 0) {
          isOverdue = true;
          unbilledDue = priceMonthly;
        }
      }

      totalUnbilledOverdue += unbilledDue;

      return {
        enrollmentId: en.id,
        groupId: en.groupId,
        groupName: en.group.name,
        courseTitle: en.group.course?.title || "Курс",
        status: en.status,
        priceMonthly,
        pricing: overview.periods,
        enrolledAt: en.enrolledAt.toISOString(),
        paidUntil: en.paidUntil ? en.paidUntil.toISOString() : null,
        frozenAt: en.frozenAt ? en.frozenAt.toISOString() : null,
        frozenUntil: en.frozenUntil ? en.frozenUntil.toISOString() : null,
        daysRemaining,
        isOverdue,
        monthsEnrolled: Math.max(1, enCharges.reduce((s, c) => s + c.periodMonths, 0)),
        accruedAmount: enChargeTotal + unbilledDue,
        openChargesAmount: enOpenDue + unbilledDue,
      };
    });

    const allocatedFromCharges = student.charges.reduce((s, c) => s + c.paidAmount, 0);
    const unallocatedCredit = Math.max(0, totalPaid - allocatedFromCharges);
    const grossDebt = totalOpenChargesDue + totalUnbilledOverdue;
    const netBalance = unallocatedCredit - grossDebt;
    const totalAccrued = totalChargeAmount + totalUnbilledOverdue;
    const debtAmount = netBalance < 0 ? Math.abs(netBalance) : 0;

    const allFrozen =
      enrollmentDTOs.length > 0 && enrollmentDTOs.every((e) => e.status === "FROZEN");

    let status: "DEBT" | "PAID" | "OVERPAID" | "FROZEN" = "PAID";
    if (debtAmount > 0) status = "DEBT";
    else if (allFrozen && netBalance === 0) status = "FROZEN";
    else if (netBalance > 0) status = "OVERPAID";

    const receipts: UnifiedReceiptDTO[] = student.payments.map((p) => ({
      id: p.id,
      receiptNumber: p.receiptNumber || `RCP-${p.id.slice(0, 8).toUpperCase()}`,
      amount: roundUzs(p.amount),
      refundedAmount: roundUzs(p.refundedAmount),
      originalAmount: roundUzs(p.originalAmount ?? p.amount),
      discountAmount: roundUzs(p.discountAmount ?? 0),
      discountReason: p.discountReason ?? null,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      groupName: p.group?.name ?? null,
      periodMonths: p.periodMonths ?? null,
      periodStart: p.periodStart ? p.periodStart.toISOString() : null,
      periodEnd: p.periodEnd ? p.periodEnd.toISOString() : null,
      paidAt: p.paidAt ? p.paidAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      studentName: student.user.fullName,
      center: centerMeta,
    }));

    return {
      studentMembershipId: student.id,
      fullName: student.user.fullName,
      email: student.user.email,
      phone: student.user.phone,
      monthlyTuition,
      totalAccrued,
      totalPaid,
      unallocatedCredit,
      balance: netBalance,
      debtAmount,
      status,
      earliestPaidUntil: earliestPaidUntil ? (earliestPaidUntil as Date).toISOString() : null,
      enrollments: enrollmentDTOs,
      openCharges,
      receipts,
    };
  });
}

export async function calculateStudentDebtsSummary(centerId: string) {
  const balances = await calculateCenterStudentBalances({ centerId });

  const debts = balances.map((b) => ({
    studentId: b.studentMembershipId,
    fullName: b.fullName,
    phone: b.phone,
    email: b.email,
    monthlyTuition: b.monthlyTuition,
    totalDue: b.totalAccrued,
    totalPaid: b.totalPaid,
    balance: b.balance,
    debtAmount: b.debtAmount,
    status: (b.status === "FROZEN" ? "PAID" : b.status) as "DEBT" | "PAID" | "OVERPAID",
    billingStatus: b.status,
    paidUntil: b.earliestPaidUntil,
    enrollments: b.enrollments.map((e) => ({
      groupName: e.groupName,
      courseTitle: e.courseTitle,
      paidUntil: e.paidUntil,
      status: e.status,
    })),
  }));

  const debtItems = debts.filter((d) => d.status === "DEBT");
  const totalDebt = debtItems.reduce((sum, d) => sum + d.debtAmount, 0);

  return {
    debts,
    summary: {
      totalDebt,
      debtorsCount: debtItems.length,
      totalStudents: balances.length,
    },
  };
}

/**
 * Computes real Monthly Recurring Revenue (MRR) from active enrollments and their 1-month group pricing
 * (falling back to Course.priceMonthly when GroupPricingPlan is unset). Returns 0 if none.
 */
export async function calculateCenterExpectedMRR(centerId: string): Promise<number> {
  const tenantDb = getTenantDb(centerId);
  const activeEnrollments = await tenantDb.enrollment.findMany({
    where: {
      centerId,
      status: "ACTIVE",
      student: { status: { not: "ARCHIVED" } },
    },
    select: {
      groupId: true,
      group: {
        select: {
          courseId: true,
          course: { select: { priceMonthly: true } },
          pricingPlans: {
            where: { centerId, periodMonths: 1, isActive: true },
            select: { periodMonths: true, price: true, isActive: true },
          },
        },
      },
    },
  });

  let mrr = 0;
  for (const en of activeEnrollments) {
    const overview = buildGroupPricingOverview(
      en.groupId,
      en.group.courseId,
      en.group.course?.priceMonthly || 0,
      en.group.pricingPlans
    );
    mrr += overview.periods[0]?.price ?? 0;
  }
  return roundUzs(mrr);
}
