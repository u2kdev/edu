import {
  calculateCenterStudentBalances,
  type GroupPeriodPriceDTO,
  type UnifiedChargeDTO,
} from "./billing";

export interface StudentReceiptDTO {
  id: string;
  receiptNumber: string;
  studentMembershipId: string;
  studentName: string;
  groupName: string | null;
  courseTitle: string | null;
  amount: number;
  refundedAmount: number;
  originalAmount: number | null;
  discountPercent: number | null;
  discountReason?: string | null;
  promoCodeUsed: string | null;
  currency: string;
  status: string;
  paymentMethod: string | null;
  periodMonths?: number | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  paidAt: string | null;
  createdAt: string;
  center: {
    name: string;
    legalName: string | null;
    inn: string | null;
    address: string | null;
    phone: string | null;
  };
}

export interface StudentBalanceSummaryDTO {
  studentMembershipId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  monthlyTuition: number;
  totalAccrued: number;
  totalPaid: number;
  pendingInvoicesAmount: number;
  debtAmount: number;
  overpaidAmount: number;
  status: "DEBT" | "PAID" | "OVERPAID" | "NO_CHARGES" | "FROZEN";
  earliestPaidUntil: string | null;
  nextPayment: {
    amount: number;
    dueDate: string;
    isOverdue: boolean;
    description: string;
    paymentId?: string;
    chargeId?: string;
  } | null;
  enrollments: Array<{
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
  }>;
  openCharges: UnifiedChargeDTO[];
  payments: StudentReceiptDTO[];
}

/**
 * Unified student balance computation delegating to src/lib/billing.ts.
 */
export async function calculateStudentBalances(params: {
  centerId: string;
  studentMembershipIds?: string[];
}): Promise<StudentBalanceSummaryDTO[]> {
  const { centerId, studentMembershipIds } = params;
  if (studentMembershipIds && studentMembershipIds.length === 0) {
    return [];
  }

  const balances = await calculateCenterStudentBalances({
    centerId,
    studentMembershipIds,
  });

  return balances.map((b) => {
    const pendingInvoicesAmount = b.openCharges.reduce(
      (sum, c) => sum + c.remainingAmount,
      0
    );
    const overpaidAmount = b.balance > 0 ? b.balance : 0;

    let mappedStatus: StudentBalanceSummaryDTO["status"] = b.status;
    if (b.totalAccrued === 0 && b.totalPaid === 0 && b.openCharges.length === 0 && b.status !== "FROZEN") {
      mappedStatus = "NO_CHARGES";
    }

    let nextPayment: StudentBalanceSummaryDTO["nextPayment"] = null;
    if (b.openCharges.length > 0) {
      const firstCharge = b.openCharges[0];
      nextPayment = {
        amount: firstCharge.remainingAmount,
        dueDate: firstCharge.dueDate,
        isOverdue: new Date(firstCharge.dueDate).getTime() < Date.now(),
        description: `Счёт №${firstCharge.invoiceNumber} — ${firstCharge.groupName}`,
        chargeId: firstCharge.id,
      };
    } else if (b.debtAmount > 0 && b.enrollments.length > 0) {
      const targetEn = b.enrollments.find((e) => e.isOverdue) ?? b.enrollments[0];
      nextPayment = {
        amount: b.debtAmount,
        dueDate: targetEn.paidUntil ?? new Date().toISOString(),
        isOverdue: true,
        description: `Продление обучения — ${targetEn.groupName}`,
      };
    } else if (b.enrollments.length > 0 && b.earliestPaidUntil) {
      const targetEn = b.enrollments[0];
      const oneMonthPrice =
        targetEn.pricing.find((p) => p.periodMonths === 1)?.price ?? targetEn.priceMonthly;
      if (oneMonthPrice > 0) {
        nextPayment = {
          amount: oneMonthPrice,
          dueDate: b.earliestPaidUntil,
          isOverdue: false,
          description: `Следующий период — ${targetEn.groupName}`,
        };
      }
    }

    const receipts: StudentReceiptDTO[] = b.receipts.map((r) => ({
      id: r.id,
      receiptNumber: r.receiptNumber,
      studentMembershipId: b.studentMembershipId,
      studentName: r.studentName,
      groupName: r.groupName,
      courseTitle: null,
      amount: r.amount,
      refundedAmount: r.refundedAmount,
      originalAmount: r.originalAmount,
      discountPercent: r.discountAmount || null,
      discountReason: r.discountReason,
      promoCodeUsed: null,
      currency: r.currency,
      status: r.status,
      paymentMethod: r.paymentMethod,
      periodMonths: r.periodMonths,
      periodStart: r.periodStart,
      periodEnd: r.periodEnd,
      paidAt: r.paidAt,
      createdAt: r.createdAt,
      center: r.center,
    }));

    return {
      studentMembershipId: b.studentMembershipId,
      fullName: b.fullName,
      email: b.email,
      phone: b.phone,
      monthlyTuition: b.monthlyTuition,
      totalAccrued: b.totalAccrued,
      totalPaid: b.totalPaid,
      pendingInvoicesAmount,
      debtAmount: b.debtAmount,
      overpaidAmount,
      status: mappedStatus,
      earliestPaidUntil: b.earliestPaidUntil,
      nextPayment,
      enrollments: b.enrollments,
      openCharges: b.openCharges,
      payments: receipts,
    };
  });
}
