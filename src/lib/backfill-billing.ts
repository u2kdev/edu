import type { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  addCalendarMonths,
  calculateCenterStudentBalances,
  endOfTashkentDay,
  generateCenterInvoiceNumber,
  generateCenterReceiptNumber,
  startOfTashkentDay,
  type UnifiedStudentBalanceDTO,
} from "./billing";
import { roundUzs } from "./money";
import { computeReceiptVerifyCode, computeReceiptVerifyHash } from "./receipt-verify";

export interface BackfillCenterReport {
  centerId: string;
  centerName: string;
  debtBeforeUzs: number;
  debtAfterUzs: number;
  debtDeltaUzs: number;
  pricingPlansToCreate: number;
  enrollmentsToUpdatePaidUntil: number;
  chargesToCreate: number;
  allocationsToCreate: number;
  paymentsToBackfillReceipt: number;
  actionsPreview: string[];
}

export interface BackfillBillingResult {
  dryRun: boolean;
  centersProcessed: number;
  totals: {
    pricingPlansCreated: number;
    enrollmentsUpdated: number;
    chargesCreated: number;
    allocationsCreated: number;
    receiptsBackfilled: number;
    totalDebtBeforeUzs: number;
    totalDebtAfterUzs: number;
  };
  centers: BackfillCenterReport[];
}

interface CenterBillingPlanWork {
  centerId: string;
  centerName: string;
  missingPricingPlans: Array<{ groupId: string; groupName: string; periodMonths: number; price: number }>;
  enrollmentUpdates: Array<{
    enrollmentId: string;
    studentMembershipId: string;
    groupId: string;
    paidUntil: Date | null;
    chargeToCreate?: {
      periodMonths: number;
      periodStart: Date;
      periodEnd: Date;
      amount: number;
      paidAmount: number;
      paymentIdsToLink: Array<{ paymentId: string; amount: number }>;
    };
  }>;
  paymentsMissingReceipt: Array<{ paymentId: string; createdAt: Date; needsNumber: boolean; needsHash: boolean }>;
}

async function analyzeCenter(
  center: { id: string; name: string },
  client: Prisma.TransactionClient | typeof db = db
): Promise<CenterBillingPlanWork> {
  const [groups, existingPlans, enrollments, settledPayments] = await Promise.all([
    client.group.findMany({
      where: { centerId: center.id },
      select: {
        id: true,
        name: true,
        course: { select: { priceMonthly: true } },
      },
    }),
    client.groupPricingPlan.findMany({
      where: { centerId: center.id },
      select: { groupId: true, periodMonths: true, price: true },
    }),
    client.enrollment.findMany({
      where: { centerId: center.id, status: { in: ["ACTIVE", "FROZEN"] } },
      select: {
        id: true,
        studentMembershipId: true,
        groupId: true,
        enrolledAt: true,
        paidUntil: true,
        group: { select: { course: { select: { priceMonthly: true } } } },
      },
    }),
    client.centerPayment.findMany({
      where: {
        centerId: center.id,
        deletedAt: null,
        status: { in: ["PAID", "PARTIALLY_PAID"] },
      },
      include: {
        chargeAllocations: { select: { id: true, amount: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const planSet = new Set(existingPlans.map((p) => `${p.groupId}:${p.periodMonths}`));
  const planPriceMap = new Map<string, number>();
  for (const p of existingPlans) {
    if (p.periodMonths === 1) planPriceMap.set(p.groupId, roundUzs(p.price));
  }

  const missingPricingPlans: CenterBillingPlanWork["missingPricingPlans"] = [];
  for (const grp of groups) {
    const baseMonthly = roundUzs(grp.course?.priceMonthly ?? 0);
    if (baseMonthly <= 0) continue;
    if (!planPriceMap.has(grp.id)) {
      planPriceMap.set(grp.id, baseMonthly);
    }
    for (const pm of [1, 2, 3]) {
      if (!planSet.has(`${grp.id}:${pm}`)) {
        missingPricingPlans.push({
          groupId: grp.id,
          groupName: grp.name,
          periodMonths: pm,
          price: roundUzs(baseMonthly * pm),
        });
      }
    }
  }

  // Group enrollments per student to resolve standalone payments unambiguously
  const studentEnrollmentCount = new Map<string, number>();
  for (const en of enrollments) {
    studentEnrollmentCount.set(
      en.studentMembershipId,
      (studentEnrollmentCount.get(en.studentMembershipId) ?? 0) + 1
    );
  }

  const enrollmentUpdates: CenterBillingPlanWork["enrollmentUpdates"] = [];
  for (const en of enrollments) {
    if (en.paidUntil !== null) {
      continue;
    }

    const relevantPayments = settledPayments.filter((p) => {
      if (p.studentMembershipId !== en.studentMembershipId) return false;
      if (p.groupId === en.groupId) return true;
      return (
        p.groupId === null &&
        (studentEnrollmentCount.get(en.studentMembershipId) ?? 0) === 1
      );
    });

    const netPayments = relevantPayments
      .map((p) => ({
        ...p,
        netPaid: Math.max(0, roundUzs(p.amount) - roundUzs(p.refundedAmount)),
      }))
      .filter((p) => p.netPaid > 0);

    if (netPayments.length === 0) {
      // No payments yet: mark enrollment paidUntil as day before enrolledAt so first charge starts from enrolledAt
      const startDay = startOfTashkentDay(en.enrolledAt);
      const initialPaidUntil = new Date(startDay.getTime() - 1000);
      enrollmentUpdates.push({
        enrollmentId: en.id,
        studentMembershipId: en.studentMembershipId,
        groupId: en.groupId,
        paidUntil: initialPaidUntil,
      });
      continue;
    }

    // Check if payments already carry periodEnd
    const maxExplicitEnd = netPayments
      .map((p) => p.periodEnd)
      .filter((d): d is Date => Boolean(d))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (maxExplicitEnd) {
      enrollmentUpdates.push({
        enrollmentId: en.id,
        studentMembershipId: en.studentMembershipId,
        groupId: en.groupId,
        paidUntil: maxExplicitEnd,
      });
      continue;
    }

    const monthlyPrice =
      planPriceMap.get(en.groupId) ?? roundUzs(en.group.course?.priceMonthly ?? 0);
    const startDay = startOfTashkentDay(en.enrolledAt);
    const totalPaid = netPayments.reduce((sum, p) => sum + p.netPaid, 0);

    let coveredMonths = 1;
    if (monthlyPrice > 0) {
      coveredMonths = Math.max(1, Math.floor(totalPaid / monthlyPrice));
    }
    const periodEnd = addCalendarMonths(startDay, coveredMonths);

    const unallocated = netPayments.filter((p) => p.chargeAllocations.length === 0);
    const unallocatedTotal = unallocated.reduce((sum, p) => sum + p.netPaid, 0);
    const chargeMonths = Math.min(3, Math.max(1, coveredMonths));

    enrollmentUpdates.push({
      enrollmentId: en.id,
      studentMembershipId: en.studentMembershipId,
      groupId: en.groupId,
      paidUntil: periodEnd,
      chargeToCreate:
        unallocated.length > 0 && unallocatedTotal > 0
          ? {
              periodMonths: chargeMonths,
              periodStart: startDay,
              periodEnd,
              amount: unallocatedTotal,
              paidAmount: unallocatedTotal,
              paymentIdsToLink: unallocated.map((p) => ({
                paymentId: p.id,
                amount: p.netPaid,
              })),
            }
          : undefined,
    });
  }

  // Payments missing receiptNumber / receiptVerifyHash
  const allPayments = await client.centerPayment.findMany({
    where: {
      centerId: center.id,
      deletedAt: null,
      OR: [{ receiptNumber: null }, { receiptVerifyHash: null }],
    },
    select: {
      id: true,
      createdAt: true,
      receiptNumber: true,
      receiptVerifyHash: true,
    },
  });

  const paymentsMissingReceipt = allPayments.map((p) => ({
    paymentId: p.id,
    createdAt: p.createdAt,
    needsNumber: !p.receiptNumber,
    needsHash: !p.receiptVerifyHash,
  }));

  return {
    centerId: center.id,
    centerName: center.name,
    missingPricingPlans,
    enrollmentUpdates,
    paymentsMissingReceipt,
  };
}

function projectDebtAfterBackfill(
  balancesBefore: UnifiedStudentBalanceDTO[],
  enrollmentUpdates: CenterBillingPlanWork["enrollmentUpdates"],
  todayStart: Date
): number {
  const updateByEnrollment = new Map(enrollmentUpdates.map((u) => [u.enrollmentId, u]));
  let projectedTotalDebt = 0;

  for (const student of balancesBefore) {
    let addedAllocated = 0;
    let openAndUnbilledDebt = 0;

    for (const en of student.enrollments) {
      const upd = updateByEnrollment.get(en.enrollmentId);
      if (upd?.chargeToCreate) {
        addedAllocated += upd.chargeToCreate.paidAmount;
      }

      const matchingOpenCharges = student.openCharges.filter((c) => c.groupId === en.groupId);
      const openDueForGroup = matchingOpenCharges.reduce((s, c) => s + c.remainingAmount, 0);
      openAndUnbilledDebt += openDueForGroup;

      if (en.status === "ACTIVE" && en.priceMonthly > 0) {
        const nextPaidUntil = upd ? upd.paidUntil : en.paidUntil ? new Date(en.paidUntil) : null;
        const hasOpenChargeCoveringNow = matchingOpenCharges.some(
          (c) => endOfTashkentDay(new Date(c.periodEnd)) >= todayStart
        );
        const hasAnyChargeNow = en.accruedAmount > en.openChargesAmount || matchingOpenCharges.length > 0 || Boolean(upd?.chargeToCreate);

        if (nextPaidUntil && endOfTashkentDay(nextPaidUntil) < todayStart) {
          if (!hasOpenChargeCoveringNow) {
            openAndUnbilledDebt += en.priceMonthly;
          }
        } else if (!nextPaidUntil && !hasAnyChargeNow) {
          openAndUnbilledDebt += en.priceMonthly;
        }
      }
    }

    const projUnallocated = Math.max(0, student.unallocatedCredit - addedAllocated);
    const netBalance = projUnallocated - openAndUnbilledDebt;
    if (netBalance < 0) {
      projectedTotalDebt += Math.abs(netBalance);
    }
  }

  return projectedTotalDebt;
}

/**
 * Idempotent billing backfill supporting `--dry-run`.
 * Safe to run concurrently and repeatedly without creating duplicate charges, allocations, or pricing plans.
 */
export async function backfillBillingData(params: {
  dryRun: boolean;
  centerId?: string;
}): Promise<BackfillBillingResult> {
  const centers = await db.learningCenter.findMany({
    where: params.centerId ? { id: params.centerId } : undefined,
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  const todayStart = startOfTashkentDay(new Date());
  const reports: BackfillCenterReport[] = [];
  const totals = {
    pricingPlansCreated: 0,
    enrollmentsUpdated: 0,
    chargesCreated: 0,
    allocationsCreated: 0,
    receiptsBackfilled: 0,
    totalDebtBeforeUzs: 0,
    totalDebtAfterUzs: 0,
  };

  for (const center of centers) {
    const balancesBefore = await calculateCenterStudentBalances({ centerId: center.id });
    const debtBeforeUzs = balancesBefore.reduce((s, b) => s + b.debtAmount, 0);

    let plan: CenterBillingPlanWork;

    if (params.dryRun) {
      plan = await analyzeCenter(center, db);
      const debtAfterUzs = projectDebtAfterBackfill(
        balancesBefore,
        plan.enrollmentUpdates,
        todayStart
      );

      const preview: string[] = [];
      for (const mp of plan.missingPricingPlans.slice(0, 5)) {
        preview.push(
          `[Pricing] Group "${mp.groupName}" ${mp.periodMonths}m = ${mp.price.toLocaleString("ru-RU")} UZS`
        );
      }
      for (const eu of plan.enrollmentUpdates.slice(0, 5)) {
        preview.push(
          `[Enrollment ${eu.enrollmentId.slice(0, 8)}] paidUntil -> ${eu.paidUntil?.toISOString().slice(0, 10) ?? "null"}${eu.chargeToCreate ? ` (+Charge ${eu.chargeToCreate.amount} UZS)` : ""}`
        );
      }
      if (plan.paymentsMissingReceipt.length > 0) {
        preview.push(
          `[Receipts] ${plan.paymentsMissingReceipt.length} payments missing receiptNumber/verifyHash`
        );
      }

      const chargesToCreateCount = plan.enrollmentUpdates.filter((u) => Boolean(u.chargeToCreate)).length;
      const allocationsToCreateCount = plan.enrollmentUpdates.reduce(
        (sum, u) => sum + (u.chargeToCreate?.paymentIdsToLink.length ?? 0),
        0
      );

      totals.totalDebtBeforeUzs += debtBeforeUzs;
      totals.totalDebtAfterUzs += debtAfterUzs;

      reports.push({
        centerId: center.id,
        centerName: center.name,
        debtBeforeUzs,
        debtAfterUzs,
        debtDeltaUzs: debtAfterUzs - debtBeforeUzs,
        pricingPlansToCreate: plan.missingPricingPlans.length,
        enrollmentsToUpdatePaidUntil: plan.enrollmentUpdates.length,
        chargesToCreate: chargesToCreateCount,
        allocationsToCreate: allocationsToCreateCount,
        paymentsToBackfillReceipt: plan.paymentsMissingReceipt.length,
        actionsPreview: preview,
      });
      continue;
    }

    plan = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Serialize concurrent backfills per center so analysis and writes stay strictly idempotent.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`backfill-billing:${center.id}`}))`;

      const lockedPlan = await analyzeCenter(center, tx);

      if (lockedPlan.missingPricingPlans.length > 0) {
        const res = await tx.groupPricingPlan.createMany({
          data: lockedPlan.missingPricingPlans.map((mp) => ({
            centerId: center.id,
            groupId: mp.groupId,
            periodMonths: mp.periodMonths,
            price: mp.price,
            isActive: true,
          })),
          skipDuplicates: true,
        });
        totals.pricingPlansCreated += res.count;
      }

      for (const eu of lockedPlan.enrollmentUpdates) {
        const updatedEnr = await tx.enrollment.updateMany({
          where: { id: eu.enrollmentId, centerId: center.id, paidUntil: null },
          data: { paidUntil: eu.paidUntil },
        });
        if (updatedEnr.count > 0) {
          totals.enrollmentsUpdated += updatedEnr.count;
        }

        if (eu.chargeToCreate) {
          const existingBackfill = await tx.charge.findFirst({
            where: {
              centerId: center.id,
              enrollmentId: eu.enrollmentId,
              periodStart: eu.chargeToCreate.periodStart,
              status: { not: "CANCELLED" },
            },
            select: { id: true },
          });

          if (!existingBackfill) {
            const invoiceNumber = await generateCenterInvoiceNumber(
              tx,
              center.id,
              eu.chargeToCreate.periodStart
            );
            const charge = await tx.charge.create({
              data: {
                centerId: center.id,
                enrollmentId: eu.enrollmentId,
                studentMembershipId: eu.studentMembershipId,
                groupId: eu.groupId,
                invoiceNumber,
                periodMonths: eu.chargeToCreate.periodMonths,
                periodStart: eu.chargeToCreate.periodStart,
                periodEnd: eu.chargeToCreate.periodEnd,
                originalAmount: eu.chargeToCreate.amount,
                discountAmount: 0,
                amount: eu.chargeToCreate.amount,
                paidAmount: eu.chargeToCreate.paidAmount,
                status: "PAID",
                paidAt: eu.chargeToCreate.periodStart,
                dueDate: eu.chargeToCreate.periodStart,
              },
            });
            totals.chargesCreated += 1;

            if (eu.chargeToCreate.paymentIdsToLink.length > 0) {
              const allocRes = await tx.chargePaymentAllocation.createMany({
                data: eu.chargeToCreate.paymentIdsToLink.map((link) => ({
                  centerId: center.id,
                  chargeId: charge.id,
                  paymentId: link.paymentId,
                  amount: link.amount,
                })),
                skipDuplicates: true,
              });
              totals.allocationsCreated += allocRes.count;
            }
          }
        }
      }

      for (const p of lockedPlan.paymentsMissingReceipt) {
        const updateData: Prisma.CenterPaymentUpdateManyMutationInput = {};
        if (p.needsNumber) {
          updateData.receiptNumber = await generateCenterReceiptNumber(tx, center.id, p.createdAt);
        }
        if (p.needsHash) {
          const code = computeReceiptVerifyCode(p.paymentId);
          updateData.receiptVerifyHash = computeReceiptVerifyHash(code);
        }
        const res = await tx.centerPayment.updateMany({
          where: { id: p.paymentId, centerId: center.id },
          data: updateData,
        });
        totals.receiptsBackfilled += res.count;
      }

      return lockedPlan;
    });

    const balancesAfter = await calculateCenterStudentBalances({ centerId: center.id });
    const debtAfterUzs = balancesAfter.reduce((s, b) => s + b.debtAmount, 0);

    const preview: string[] = [];
    for (const mp of plan.missingPricingPlans.slice(0, 5)) {
      preview.push(
        `[Pricing] Group "${mp.groupName}" ${mp.periodMonths}m = ${mp.price.toLocaleString("ru-RU")} UZS`
      );
    }
    for (const eu of plan.enrollmentUpdates.slice(0, 5)) {
      preview.push(
        `[Enrollment ${eu.enrollmentId.slice(0, 8)}] paidUntil -> ${eu.paidUntil?.toISOString().slice(0, 10) ?? "null"}${eu.chargeToCreate ? ` (+Charge ${eu.chargeToCreate.amount} UZS)` : ""}`
      );
    }
    if (plan.paymentsMissingReceipt.length > 0) {
      preview.push(
        `[Receipts] ${plan.paymentsMissingReceipt.length} payments missing receiptNumber/verifyHash`
      );
    }

    const chargesToCreateCount = plan.enrollmentUpdates.filter((u) => Boolean(u.chargeToCreate)).length;
    const allocationsToCreateCount = plan.enrollmentUpdates.reduce(
      (sum, u) => sum + (u.chargeToCreate?.paymentIdsToLink.length ?? 0),
      0
    );

    totals.totalDebtBeforeUzs += debtBeforeUzs;
    totals.totalDebtAfterUzs += debtAfterUzs;

    reports.push({
      centerId: center.id,
      centerName: center.name,
      debtBeforeUzs,
      debtAfterUzs,
      debtDeltaUzs: debtAfterUzs - debtBeforeUzs,
      pricingPlansToCreate: plan.missingPricingPlans.length,
      enrollmentsToUpdatePaidUntil: plan.enrollmentUpdates.length,
      chargesToCreate: chargesToCreateCount,
      allocationsToCreate: allocationsToCreateCount,
      paymentsToBackfillReceipt: plan.paymentsMissingReceipt.length,
      actionsPreview: preview,
    });
  }

  return {
    dryRun: params.dryRun,
    centersProcessed: centers.length,
    totals,
    centers: reports,
  };
}
