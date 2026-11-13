import { getTenantDb } from "./db-tenant";

export interface StudentReceiptDTO {
  id: string;
  receiptNumber: string;
  studentMembershipId: string;
  studentName: string;
  groupName: string | null;
  courseTitle: string | null;
  amount: number;
  originalAmount: number | null;
  discountPercent: number | null;
  promoCodeUsed: string | null;
  currency: string;
  status: string;
  paymentMethod: string | null;
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
  status: "DEBT" | "PAID" | "OVERPAID" | "NO_CHARGES";
  nextPayment: {
    amount: number;
    dueDate: string;
    isOverdue: boolean;
    description: string;
    paymentId?: string;
  } | null;
  enrollments: Array<{
    enrollmentId: string;
    groupId: string;
    groupName: string;
    courseTitle: string;
    priceMonthly: number;
    enrolledAt: string;
    monthsEnrolled: number;
    accruedAmount: number;
  }>;
  payments: StudentReceiptDTO[];
}

export async function calculateStudentBalances(params: {
  centerId: string;
  studentMembershipIds: string[];
}): Promise<StudentBalanceSummaryDTO[]> {
  const { centerId, studentMembershipIds } = params;
  if (studentMembershipIds.length === 0) {
    return [];
  }

  const tenantDb = getTenantDb(centerId);
  const now = new Date();

  const [centerInfo, students, financeTransactions] = await Promise.all([
    tenantDb.learningCenter.findFirst({
      where: { id: centerId },
      select: {
        name: true,
        legalName: true,
        inn: true,
        address: true,
        phone: true,
      },
    }),
    tenantDb.centerMembership.findMany({
      where: {
        centerId,
        id: { in: studentMembershipIds },
        role: "STUDENT",
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            group: {
              include: {
                course: {
                  select: {
                    id: true,
                    title: true,
                    priceMonthly: true,
                  },
                },
              },
            },
          },
        },
        payments: {
          include: {
            group: {
              include: {
                course: {
                  select: {
                    title: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        centerId,
        studentMembershipId: { in: studentMembershipIds },
        type: "INCOME",
        centerPaymentId: null,
      },
      include: {
        group: { select: { name: true } },
        course: { select: { title: true } },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const centerMeta = {
    name: centerInfo?.name || "Учебный центр",
    legalName: centerInfo?.legalName || null,
    inn: centerInfo?.inn || null,
    address: centerInfo?.address || null,
    phone: centerInfo?.phone || null,
  };

  return students.map((student) => {
    let monthlyTuition = 0;
    let courseAccrued = 0;

    const enrollmentItems = student.enrollments.map((en) => {
      const priceMonthly = en.group?.course?.priceMonthly || 0;
      monthlyTuition += priceMonthly;

      const enrolledDate = new Date(en.enrolledAt);
      const monthsDiff =
        (now.getFullYear() - enrolledDate.getFullYear()) * 12 +
        (now.getMonth() - enrolledDate.getMonth()) +
        1;
      const monthsEnrolled = Math.max(1, monthsDiff);
      const accruedAmount = priceMonthly * monthsEnrolled;
      courseAccrued += accruedAmount;

      return {
        enrollmentId: en.id,
        groupId: en.groupId,
        groupName: en.group?.name || "—",
        courseTitle: en.group?.course?.title || "—",
        priceMonthly,
        enrolledAt: en.enrolledAt.toISOString(),
        monthsEnrolled,
        accruedAmount,
      };
    });

    const paidCenterPayments = student.payments
      .filter((p) => p.status === "PAID" || p.status === "PARTIALLY_PAID")
      .reduce((sum, p) => sum + p.amount, 0);

    const pendingCenterPayments = student.payments.filter(
      (p) => p.status === "PENDING"
    );
    const pendingInvoicesAmount = pendingCenterPayments.reduce(
      (sum, p) => sum + p.amount,
      0
    );

    const studentStandaloneTxs = financeTransactions.filter(
      (tx) => tx.studentMembershipId === student.id
    );
    const standalonePaid = studentStandaloneTxs.reduce(
      (sum, tx) => sum + (tx.isReversal ? -tx.amount : tx.amount),
      0
    );

    const totalPaid = Math.max(0, paidCenterPayments + standalonePaid);
    const totalAccrued = Math.max(
      courseAccrued,
      totalPaid + pendingInvoicesAmount
    );

    const rawDiff = totalAccrued - totalPaid;
    const debtAmount = rawDiff > 0 ? rawDiff : 0;
    const overpaidAmount = rawDiff < 0 ? Math.abs(rawDiff) : 0;

    let status: "DEBT" | "PAID" | "OVERPAID" | "NO_CHARGES" = "PAID";
    if (totalAccrued === 0 && totalPaid === 0) {
      status = "NO_CHARGES";
    } else if (debtAmount > 0) {
      status = "DEBT";
    } else if (overpaidAmount > 0) {
      status = "OVERPAID";
    }

    // Determine nextPayment
    let nextPayment: StudentBalanceSummaryDTO["nextPayment"] = null;
    if (pendingCenterPayments.length > 0) {
      const earliestPending =
        pendingCenterPayments[pendingCenterPayments.length - 1];
      nextPayment = {
        amount: earliestPending.amount,
        dueDate: earliestPending.createdAt.toISOString(),
        isOverdue: debtAmount > 0,
        description: earliestPending.group?.name
          ? `Оплата за группу ${earliestPending.group.name}`
          : "Ожидающий счёт на оплату",
        paymentId: earliestPending.id,
      };
    } else if (debtAmount > 0) {
      nextPayment = {
        amount: debtAmount,
        dueDate: now.toISOString(),
        isOverdue: true,
        description: "Текущая задолженность за обучение",
      };
    } else if (monthlyTuition > 0) {
      const nextMonthFirst = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)
      );
      nextPayment = {
        amount: monthlyTuition,
        dueDate: nextMonthFirst.toISOString(),
        isOverdue: false,
        description: "Плановый ежемесячный платёж",
      };
    }

    const paymentReceipts: StudentReceiptDTO[] = [
      ...student.payments.map((p) => ({
        id: p.id,
        receiptNumber: `INV-${p.id.slice(0, 8).toUpperCase()}`,
        studentMembershipId: student.id,
        studentName: student.user.fullName,
        groupName: p.group?.name || enrollmentItems[0]?.groupName || null,
        courseTitle:
          p.group?.course?.title || enrollmentItems[0]?.courseTitle || null,
        amount: p.amount,
        originalAmount: p.originalAmount,
        discountPercent: p.discountAmount || null,
        promoCodeUsed: p.note || null,
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt ? p.paidAt.toISOString() : null,
        createdAt: p.createdAt.toISOString(),
        center: centerMeta,
      })),
      ...studentStandaloneTxs
        .filter((tx) => !tx.isReversal)
        .map((tx) => ({
          id: tx.id,
          receiptNumber: `TX-${tx.id.slice(0, 8).toUpperCase()}`,
          studentMembershipId: student.id,
          studentName: student.user.fullName,
          groupName: tx.group?.name || enrollmentItems[0]?.groupName || null,
          courseTitle:
            tx.course?.title || enrollmentItems[0]?.courseTitle || null,
          amount: tx.amount,
          originalAmount: tx.amount,
          discountPercent: null,
          promoCodeUsed: null,
          currency: tx.currency,
          status: "PAID",
          paymentMethod: "CASH",
          paidAt: tx.date.toISOString(),
          createdAt: tx.createdAt.toISOString(),
          center: centerMeta,
        })),
    ];

    return {
      studentMembershipId: student.id,
      fullName: student.user.fullName,
      email: student.user.email,
      phone: student.user.phone,
      monthlyTuition,
      totalAccrued,
      totalPaid,
      pendingInvoicesAmount,
      debtAmount,
      overpaidAmount,
      status,
      nextPayment,
      enrollments: enrollmentItems,
      payments: paymentReceipts,
    };
  });
}
