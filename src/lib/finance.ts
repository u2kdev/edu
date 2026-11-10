import crypto from "crypto";
import {
  AccountType,
  Currency,
  FinanceTransactionType,
  MembershipRole,
  PaymentMethod,
} from "@prisma/client";
import { db } from "./db";
import { getTenantDb } from "./db-tenant";

export const TASHKENT_OFFSET_MS = 5 * 3600 * 1000;

/**
 * Extracts year and month (1..12) in Asia/Tashkent timezone (UTC+5).
 */
export function getTashkentYearMonth(date: Date): { year: number; month: number } {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
  };
}

/**
 * Computes exact UTC start and end bounds for a calendar month in Asia/Tashkent (UTC+5).
 */
export function getTashkentMonthBounds(year: number, month: number): {
  startDate: Date;
  endDate: Date;
} {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Invalid year for finance period");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Invalid month for finance period (must be 1..12)");
  }
  const startUtcMs = Date.UTC(year, month - 1, 1, 0, 0, 0, 0) - TASHKENT_OFFSET_MS;
  const endUtcMs = Date.UTC(year, month, 1, 0, 0, 0, 0) - TASHKENT_OFFSET_MS - 1;
  return {
    startDate: new Date(startUtcMs),
    endDate: new Date(endUtcMs),
  };
}

/**
 * Checks whether the given date falls into a CLOSED FinancePeriod for the center.
 */
export async function isDateInClosedPeriod(centerId: string, date: Date): Promise<boolean> {
  const tenantDb = getTenantDb(centerId);
  const { year, month } = getTashkentYearMonth(date);
  const closed = await tenantDb.financePeriod.findFirst({
    where: {
      centerId,
      status: "CLOSED",
      OR: [
        { year, month },
        {
          startDate: { lte: date },
          endDate: { gte: date },
        },
      ],
    },
    select: { id: true },
  });
  return Boolean(closed);
}

/**
 * Dynamically calculates an Account's balance in integer UZS from all transactions
 * (no mutable balance column stored on Account).
 *
 * Rules:
 * - INCOME on accountId: +amount (or -amount if isReversal=true)
 * - EXPENSE on accountId: -amount (or +amount if isReversal=true)
 * - TRANSFER from accountId: -amount (or +amount if isReversal=true)
 * - TRANSFER to targetAccountId: +amount (or -amount if isReversal=true)
 */
export async function calculateAccountBalance(
  centerId: string,
  accountId: string,
  upToDate?: Date
): Promise<number> {
  const tenantDb = getTenantDb(centerId);
  const account = await tenantDb.account.findFirst({
    where: { id: accountId },
    select: { id: true },
  });
  if (!account) {
    throw new Error("Account not found in this center");
  }

  const dateFilter = upToDate ? { date: { lte: upToDate } } : {};

  const [
    incomeNormal,
    incomeReversed,
    expenseNormal,
    expenseReversed,
    transferOutLegNormal,
    transferOutLegReversed,
    transferInLegNormal,
    transferInLegReversed,
    transferLegacyOutNormal,
    transferLegacyOutReversed,
    transferLegacyInNormal,
    transferLegacyInReversed,
  ] = await Promise.all([
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "INCOME", isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "INCOME", isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "EXPENSE", isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "EXPENSE", isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: "OUT", isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: "OUT", isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: "IN", isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: "IN", isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: null, isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { accountId, type: "TRANSFER", transferDirection: null, isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { targetAccountId: accountId, type: "TRANSFER", transferDirection: null, isReversal: false, ...dateFilter },
      _sum: { amount: true },
    }),
    tenantDb.financeTransaction.aggregate({
      where: { targetAccountId: accountId, type: "TRANSFER", transferDirection: null, isReversal: true, ...dateFilter },
      _sum: { amount: true },
    }),
  ]);

  const inc = (incomeNormal._sum.amount ?? 0) - (incomeReversed._sum.amount ?? 0);
  const exp = (expenseNormal._sum.amount ?? 0) - (expenseReversed._sum.amount ?? 0);
  const trOut =
    (transferOutLegNormal._sum.amount ?? 0) -
    (transferOutLegReversed._sum.amount ?? 0) +
    ((transferLegacyOutNormal._sum.amount ?? 0) - (transferLegacyOutReversed._sum.amount ?? 0));
  const trIn =
    (transferInLegNormal._sum.amount ?? 0) -
    (transferInLegReversed._sum.amount ?? 0) +
    ((transferLegacyInNormal._sum.amount ?? 0) - (transferLegacyInReversed._sum.amount ?? 0));

  return inc - exp - trOut + trIn;
}

export interface RecordFinanceTransferInput {
  centerId: string;
  amount: number;
  sourceAccountId: string;
  targetAccountId: string;
  date?: Date;
  description?: string | null;
  counterparty?: string | null;
  branchId?: string | null;
  createdBy: string;
  simulateSecondLegError?: boolean;
}

/**
 * Records an account-to-account transfer as TWO FinanceTransaction rows (OUT on sourceAccountId
 * and IN on targetAccountId) inside a single atomic DB transaction (db.$transaction).
 * If the second leg fails, the entire DB transaction rolls back so the first leg is never persisted alone.
 */
export async function recordFinanceTransfer(input: RecordFinanceTransferInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Transaction amount must be a positive integer in UZS");
  }
  if (!input.sourceAccountId || !input.targetAccountId) {
    throw new Error("Both sourceAccountId and targetAccountId are required for TRANSFER");
  }
  if (input.sourceAccountId === input.targetAccountId) {
    throw new Error("Cannot transfer to the same account");
  }

  const txDate = input.date ?? new Date();
  if (await isDateInClosedPeriod(input.centerId, txDate)) {
    throw new Error("Cannot record transaction in a closed finance period");
  }

  const tenantDb = getTenantDb(input.centerId);
  const [sourceAccount, targetAccount] = await Promise.all([
    tenantDb.account.findFirst({ where: { id: input.sourceAccountId, isActive: true } }),
    tenantDb.account.findFirst({ where: { id: input.targetAccountId, isActive: true } }),
  ]);

  if (!sourceAccount) {
    throw new Error("Cross-tenant relation violation: sourceAccountId not found or inactive in this center");
  }
  if (!targetAccount) {
    throw new Error("Cross-tenant relation violation: targetAccountId not found or inactive in this center");
  }

  if (input.branchId) {
    const branch = await tenantDb.branch.findFirst({ where: { id: input.branchId } });
    if (!branch) {
      throw new Error("Cross-tenant relation violation: branchId does not belong to this center");
    }
  }

  const transferGroupId = crypto.randomUUID();

  return db.$transaction(async (tx) => {
    const outTransaction = await tx.financeTransaction.create({
      data: {
        centerId: input.centerId,
        type: "TRANSFER",
        amount: input.amount,
        currency: Currency.UZS,
        accountId: input.sourceAccountId,
        targetAccountId: input.targetAccountId,
        transferGroupId,
        transferDirection: "OUT",
        date: txDate,
        description: input.description ?? `Перевод на счёт ${targetAccount.name}`,
        counterparty: input.counterparty ?? null,
        branchId: input.branchId ?? null,
        isReversal: false,
        createdBy: input.createdBy,
      },
    });

    if (input.simulateSecondLegError) {
      throw new Error("Second leg of transfer failed: atomic rollback triggered");
    }

    const inTransaction = await tx.financeTransaction.create({
      data: {
        centerId: input.centerId,
        type: "TRANSFER",
        amount: input.amount,
        currency: Currency.UZS,
        accountId: input.targetAccountId,
        targetAccountId: input.sourceAccountId,
        transferGroupId,
        transferDirection: "IN",
        date: txDate,
        description: input.description ?? `Перевод со счёта ${sourceAccount.name}`,
        counterparty: input.counterparty ?? null,
        branchId: input.branchId ?? null,
        isReversal: false,
        createdBy: input.createdBy,
      },
    });

    await tx.auditLog.create({
      data: {
        centerId: input.centerId,
        actorUserId: input.createdBy,
        action: "FINANCE_TRANSFER_CREATED",
        resource: "FinanceTransaction",
        resourceId: outTransaction.id,
        detailsJson: JSON.stringify({
          transferGroupId,
          outTransactionId: outTransaction.id,
          inTransactionId: inTransaction.id,
          amount: input.amount,
          sourceAccountId: input.sourceAccountId,
          targetAccountId: input.targetAccountId,
        }),
      },
    });

    return {
      transferGroupId,
      outTransaction,
      inTransaction,
    };
  });
}

export interface RecordFinanceTransactionInput {
  centerId: string;
  type: FinanceTransactionType;
  amount: number;
  accountId: string;
  targetAccountId?: string | null;
  categoryId?: string | null;
  date?: Date;
  description?: string | null;
  counterparty?: string | null;
  studentMembershipId?: string | null;
  groupId?: string | null;
  courseId?: string | null;
  branchId?: string | null;
  centerPaymentId?: string | null;
  lessonId?: string | null;
  createdBy: string;
}

/**
 * Records a new finance transaction (INCOME, EXPENSE, or TRANSFER) in integer UZS,
 * verifying closed periods, account/category consistency, and writing an AuditLog entry.
 */
export async function recordFinanceTransaction(input: RecordFinanceTransactionInput) {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new Error("Transaction amount must be a positive integer in UZS");
  }

  const txDate = input.date ?? new Date();
  if (await isDateInClosedPeriod(input.centerId, txDate)) {
    throw new Error("Cannot record transaction in a closed finance period");
  }

  const tenantDb = getTenantDb(input.centerId);

  const sourceAccount = await tenantDb.account.findFirst({
    where: { id: input.accountId, isActive: true },
  });
  if (!sourceAccount) {
    throw new Error("Source account not found or inactive in this center");
  }

  if (input.type === "TRANSFER") {
    if (!input.targetAccountId) {
      throw new Error("targetAccountId is required for TRANSFER transactions");
    }
    const transferResult = await recordFinanceTransfer({
      centerId: input.centerId,
      amount: input.amount,
      sourceAccountId: input.accountId,
      targetAccountId: input.targetAccountId,
      date: txDate,
      description: input.description,
      counterparty: input.counterparty,
      branchId: input.branchId,
      createdBy: input.createdBy,
    });
    return transferResult.outTransaction;
  } else if (input.categoryId) {
    const category = await tenantDb.financeCategory.findFirst({
      where: { id: input.categoryId, isActive: true },
    });
    if (!category) {
      throw new Error("Finance category not found or inactive in this center");
    }
    if (category.type !== input.type) {
      throw new Error(`Category type (${category.type}) does not match transaction type (${input.type})`);
    }
  }

  const created = await tenantDb.financeTransaction.create({
    data: {
      centerId: input.centerId,
      type: input.type,
      amount: input.amount,
      currency: Currency.UZS,
      accountId: input.accountId,
      targetAccountId: input.type === "TRANSFER" ? (input.targetAccountId ?? null) : null,
      categoryId: input.type === "TRANSFER" ? null : (input.categoryId ?? null),
      date: txDate,
      description: input.description ?? null,
      counterparty: input.counterparty ?? null,
      studentMembershipId: input.studentMembershipId ?? null,
      groupId: input.groupId ?? null,
      courseId: input.courseId ?? null,
      branchId: input.branchId ?? null,
      centerPaymentId: input.centerPaymentId ?? null,
      lessonId: input.lessonId ?? null,
      isReversal: false,
      createdBy: input.createdBy,
    },
  });

  await tenantDb.auditLog.create({
    data: {
      centerId: input.centerId,
      actorUserId: input.createdBy,
      action: "FINANCE_TRANSACTION_CREATED",
      resource: "FinanceTransaction",
      resourceId: created.id,
      detailsJson: JSON.stringify({
        type: created.type,
        amount: created.amount,
        currency: created.currency,
        accountId: created.accountId,
        targetAccountId: created.targetAccountId,
        categoryId: created.categoryId,
        centerPaymentId: created.centerPaymentId,
      }),
    },
  });

  return created;
}

export interface ReverseFinanceTransactionInput {
  centerId: string;
  transactionId: string;
  reason: string;
  actorUserId: string;
  date?: Date;
}

/**
 * Reverses (storno) an existing FinanceTransaction by creating a compensating entry
 * with isReversal=true, reversalOfId=original.id, and recording an AuditLog entry.
 */
export async function reverseFinanceTransaction(input: ReverseFinanceTransactionInput) {
  const trimmedReason = input.reason?.trim() ?? "";
  if (trimmedReason.length < 3) {
    throw new Error("Reversal reason is required (minimum 3 characters)");
  }

  const tenantDb = getTenantDb(input.centerId);
  const original = await tenantDb.financeTransaction.findFirst({
    where: { id: input.transactionId },
  });

  if (!original) {
    throw new Error("Original transaction not found in this center");
  }
  if (original.isReversal) {
    throw new Error("Cannot reverse a transaction that is already a reversal (storno)");
  }

  const existingReversal = await tenantDb.financeTransaction.findFirst({
    where: { reversalOfId: original.id },
  });
  if (existingReversal) {
    throw new Error("Transaction has already been reversed (already reversed)");
  }

  const reversalDate = input.date ?? new Date();
  if (await isDateInClosedPeriod(input.centerId, original.date)) {
    throw new Error("Cannot reverse transaction belonging to a closed finance period");
  }
  if (await isDateInClosedPeriod(input.centerId, reversalDate)) {
    throw new Error("Cannot record reversal in a closed finance period");
  }

  let reversal;
  try {
    if (original.type === "TRANSFER" && original.transferGroupId) {
      const sibling = await tenantDb.financeTransaction.findFirst({
        where: {
          transferGroupId: original.transferGroupId,
          id: { not: original.id },
          isReversal: false,
        },
      });
      const reversalGroupId = crypto.randomUUID();

      reversal = await db.$transaction(async (tx) => {
        const revPrimary = await tx.financeTransaction.create({
          data: {
            centerId: input.centerId,
            type: original.type,
            amount: original.amount,
            currency: original.currency,
            accountId: original.accountId,
            targetAccountId: original.targetAccountId,
            transferGroupId: reversalGroupId,
            transferDirection: original.transferDirection,
            date: reversalDate,
            description: `СТОРНО: ${original.description ?? original.id} (${trimmedReason})`,
            counterparty: original.counterparty,
            branchId: original.branchId,
            isReversal: true,
            reversalOfId: original.id,
            reversalReason: trimmedReason,
            createdBy: input.actorUserId,
          },
        });

        if (sibling) {
          await tx.financeTransaction.create({
            data: {
              centerId: input.centerId,
              type: sibling.type,
              amount: sibling.amount,
              currency: sibling.currency,
              accountId: sibling.accountId,
              targetAccountId: sibling.targetAccountId,
              transferGroupId: reversalGroupId,
              transferDirection: sibling.transferDirection,
              date: reversalDate,
              description: `СТОРНО: ${sibling.description ?? sibling.id} (${trimmedReason})`,
              counterparty: sibling.counterparty,
              branchId: sibling.branchId,
              isReversal: true,
              reversalOfId: sibling.id,
              reversalReason: trimmedReason,
              createdBy: input.actorUserId,
            },
          });
        }

        return revPrimary;
      });
    } else {
      reversal = await tenantDb.financeTransaction.create({
        data: {
          centerId: input.centerId,
          type: original.type,
          amount: original.amount,
          currency: original.currency,
          accountId: original.accountId,
          targetAccountId: original.targetAccountId,
          categoryId: original.categoryId,
          date: reversalDate,
          description: `СТОРНО: ${original.description ?? original.id} (${trimmedReason})`,
          counterparty: original.counterparty,
          studentMembershipId: original.studentMembershipId,
          groupId: original.groupId,
          courseId: original.courseId,
          branchId: original.branchId,
          centerPaymentId: original.centerPaymentId,
          lessonId: original.lessonId,
          isReversal: true,
          reversalOfId: original.id,
          reversalReason: trimmedReason,
          createdBy: input.actorUserId,
        },
      });
    }
  } catch (err: unknown) {
    const errStr = String(err);
    if (errStr.includes("Unique constraint") || errStr.includes("P2002")) {
      throw new Error("Transaction has already been reversed (already reversed)");
    }
    throw err;
  }

  await tenantDb.auditLog.create({
    data: {
      centerId: input.centerId,
      actorUserId: input.actorUserId,
      action: "FINANCE_TRANSACTION_REVERSED",
      resource: "FinanceTransaction",
      resourceId: reversal.id,
      detailsJson: JSON.stringify({
        reversalOfId: original.id,
        reason: trimmedReason,
        amount: original.amount,
        type: original.type,
      }),
    },
  });

  return reversal;
}

export interface CloseFinancePeriodInput {
  centerId: string;
  year: number;
  month: number;
  actorUserId: string;
  actorMembershipId?: string | null;
  actorRole: MembershipRole | string;
  notes?: string | null;
}

/**
 * Closes a FinancePeriod (year, month) so no further transactions can be written into it.
 * Only DIRECTOR (or platform SUPERADMIN/DEVELOPER) can close a finance period.
 */
export async function closeFinancePeriod(input: CloseFinancePeriodInput) {
  const allowedRoles = ["DIRECTOR", "SUPERADMIN", "DEVELOPER", "FULL_ACCESS"];
  if (!allowedRoles.includes(input.actorRole)) {
    throw new Error("Only Director can close a finance period");
  }

  const { startDate, endDate } = getTashkentMonthBounds(input.year, input.month);
  const tenantDb = getTenantDb(input.centerId);

  const existing = await tenantDb.financePeriod.findFirst({
    where: { year: input.year, month: input.month },
  });

  const now = new Date();
  const period = existing
    ? await tenantDb.financePeriod.update({
        where: { id: existing.id },
        data: {
          status: "CLOSED",
          closedAt: now,
          closedByMembershipId: input.actorMembershipId ?? null,
          notes: input.notes ?? existing.notes,
        },
      })
    : await tenantDb.financePeriod.create({
        data: {
          centerId: input.centerId,
          year: input.year,
          month: input.month,
          startDate,
          endDate,
          status: "CLOSED",
          closedAt: now,
          closedByMembershipId: input.actorMembershipId ?? null,
          notes: input.notes ?? null,
        },
      });

  await tenantDb.auditLog.create({
    data: {
      centerId: input.centerId,
      actorUserId: input.actorUserId,
      action: "FINANCE_PERIOD_CLOSED",
      resource: "FinancePeriod",
      resourceId: period.id,
      detailsJson: JSON.stringify({
        year: input.year,
        month: input.month,
        closedByMembershipId: input.actorMembershipId ?? null,
        notes: input.notes ?? null,
      }),
    },
  });

  return period;
}

/**
 * Ensures the center has a default Account matching the payment method and a default
 * tuition INCOME FinanceCategory. Used when syncing CenterPayment to FinanceTransaction.
 */
export async function ensureDefaultPaymentAccountAndCategory(
  centerId: string,
  method?: PaymentMethod | null
): Promise<{ accountId: string; categoryId: string }> {
  const tenantDb = getTenantDb(centerId);

  const targetAccountType: AccountType =
    method === "BANK_TRANSFER" ? "BANK" : method === "ONLINE" ? "CARD" : "CASH";

  const defaultAccountName =
    targetAccountType === "BANK"
      ? "Расчётный счёт (Банк)"
      : targetAccountType === "CARD"
        ? "Терминал / Онлайн (Карта)"
        : "Основная касса (Наличные)";

  let account = await tenantDb.account.findFirst({
    where: { type: targetAccountType, isActive: true },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });

  if (!account) {
    try {
      account = await tenantDb.account.create({
        data: {
          centerId,
          name: defaultAccountName,
          type: targetAccountType,
          currency: Currency.UZS,
          isDefault: true,
        },
      });
    } catch {
      account = await tenantDb.account.findFirst({
        where: { name: defaultAccountName },
      });
    }
  }

  let category = await tenantDb.financeCategory.findFirst({
    where: { type: "INCOME", isActive: true, code: "TUITION" },
  });

  if (!category) {
    category = await tenantDb.financeCategory.findFirst({
      where: { type: "INCOME", name: "Оплата за обучение" },
    });
  }

  if (!category) {
    try {
      category = await tenantDb.financeCategory.create({
        data: {
          centerId,
          name: "Оплата за обучение",
          type: "INCOME",
          code: "TUITION",
        },
      });
    } catch {
      category = await tenantDb.financeCategory.findFirst({
        where: { type: "INCOME", name: "Оплата за обучение" },
      });
    }
  }

  if (!account || !category) {
    throw new Error("Failed to resolve default finance account and category for center");
  }

  return { accountId: account.id, categoryId: category.id };
}

export interface SyncCenterPaymentInput {
  centerId: string;
  paymentId: string;
  actorUserId: string;
  accountId?: string;
  categoryId?: string;
}

/**
 * Idempotently creates an INCOME FinanceTransaction for a PAID / PARTIALLY_PAID CenterPayment.
 * Protected against race conditions (Promise.all) by the unique constraint @@unique([centerPaymentId, isReversal]).
 */
export async function syncCenterPaymentToFinance(input: SyncCenterPaymentInput) {
  const tenantDb = getTenantDb(input.centerId);

  const existing = await tenantDb.financeTransaction.findFirst({
    where: { centerPaymentId: input.paymentId, isReversal: false },
  });
  if (existing) {
    return existing;
  }

  const payment = await tenantDb.centerPayment.findFirst({
    where: { id: input.paymentId },
    include: {
      student: {
        include: { user: { select: { fullName: true } } },
      },
      group: {
        select: { id: true, name: true, courseId: true, branchId: true },
      },
    },
  });

  if (!payment) {
    throw new Error("CenterPayment not found in this center");
  }

  if (payment.status !== "PAID" && payment.status !== "PARTIALLY_PAID") {
    return null;
  }

  const intAmount = Math.round(payment.amount);
  if (intAmount <= 0) {
    return null;
  }

  const defaults = await ensureDefaultPaymentAccountAndCategory(input.centerId, payment.paymentMethod);
  const accountId = input.accountId ?? defaults.accountId;
  const categoryId = input.categoryId ?? defaults.categoryId;

  try {
    return await recordFinanceTransaction({
      centerId: input.centerId,
      type: "INCOME",
      amount: intAmount,
      accountId,
      categoryId,
      date: payment.paidAt ?? payment.createdAt,
      description: `Оплата студента${payment.group ? ` (${payment.group.name})` : ""}`,
      counterparty: payment.student?.user?.fullName ?? null,
      studentMembershipId: payment.studentMembershipId,
      groupId: payment.groupId,
      courseId: payment.group?.courseId ?? null,
      branchId: payment.group?.branchId ?? null,
      centerPaymentId: payment.id,
      createdBy: input.actorUserId,
    });
  } catch (err: unknown) {
    const raced = await tenantDb.financeTransaction.findFirst({
      where: { centerPaymentId: input.paymentId, isReversal: false },
    });
    if (raced) {
      return raced;
    }
    throw err;
  }
}

export interface SyncCenterPaymentRefundInput {
  centerId: string;
  paymentId: string;
  actorUserId: string;
  reason?: string;
}

/**
 * Idempotently creates a reversal (storno) FinanceTransaction when a CenterPayment is REFUNDED.
 */
export async function syncCenterPaymentRefundToFinance(input: SyncCenterPaymentRefundInput) {
  const tenantDb = getTenantDb(input.centerId);

  const existingReversal = await tenantDb.financeTransaction.findFirst({
    where: { centerPaymentId: input.paymentId, isReversal: true },
  });
  if (existingReversal) {
    return existingReversal;
  }

  const originalIncome = await tenantDb.financeTransaction.findFirst({
    where: { centerPaymentId: input.paymentId, isReversal: false },
  });
  if (!originalIncome) {
    return null;
  }

  try {
    return await reverseFinanceTransaction({
      centerId: input.centerId,
      transactionId: originalIncome.id,
      reason: input.reason?.trim() || "Возврат оплаты студенту",
      actorUserId: input.actorUserId,
    });
  } catch (err: unknown) {
    const raced = await tenantDb.financeTransaction.findFirst({
      where: { centerPaymentId: input.paymentId, isReversal: true },
    });
    if (raced) {
      return raced;
    }
    throw err;
  }
}

export interface DisburseTeacherSalariesInput {
  centerId: string;
  startDate: Date;
  endDate: Date;
  accountId: string;
  categoryId: string;
  actorUserId: string;
  teacherMembershipId?: string;
}

/**
 * Pays conducted (ACTIVE) lessons in [startDate, endDate] for teachers with active salary rates.
 * Each conducted lesson is paid at most ONCE (enforced by @@unique([lessonId, isReversal])).
 * Safe against repeated invocations and parallel Promise.all executions.
 */
export async function disburseTeacherSalaries(input: DisburseTeacherSalariesInput) {
  const tenantDb = getTenantDb(input.centerId);

  const [rates, lessons, existingSalaryTxs] = await Promise.all([
    tenantDb.teacherSalaryRate.findMany({
      where: {
        isActive: true,
        ...(input.teacherMembershipId ? { teacherMembershipId: input.teacherMembershipId } : {}),
      },
      include: {
        teacher: {
          include: { user: { select: { fullName: true } } },
        },
        group: {
          select: { id: true, name: true, courseId: true, branchId: true },
        },
      },
    }),
    tenantDb.lesson.findMany({
      where: {
        status: "ACTIVE",
        scheduledAt: {
          gte: input.startDate,
          lte: input.endDate,
        },
      },
      include: {
        scheduleSlot: {
          select: {
            groupId: true,
            teacherMembershipId: true,
            branchId: true,
          },
        },
        module: {
          select: { courseId: true },
        },
      },
      orderBy: { scheduledAt: "asc" },
    }),
    tenantDb.financeTransaction.findMany({
      where: {
        lessonId: { not: null },
        isReversal: false,
      },
      select: {
        id: true,
        lessonId: true,
        amount: true,
        reversedBy: { select: { id: true } },
      },
    }),
  ]);

  const paidLessonIds = new Set(
    existingSalaryTxs.filter((tx) => !tx.reversedBy).map((tx) => tx.lessonId!)
  );

  let createdTransactionsCount = 0;
  let totalDisbursedAmount = 0;
  const createdTransactions = [];

  for (const rate of rates) {
    if (rate.rateType !== "HOURLY") continue;

    const matchingLessons = lessons.filter((l) => {
      const effectiveTeacherId =
        l.substituteTeacherMembershipId ?? l.scheduleSlot?.teacherMembershipId;
      if (effectiveTeacherId !== rate.teacherMembershipId) return false;
      if (rate.groupId && l.scheduleSlot?.groupId !== rate.groupId) return false;
      return true;
    });

    for (const lesson of matchingLessons) {
      if (paidLessonIds.has(lesson.id)) continue;

      const durationMin = lesson.durationMinutes || 60;
      const lessonAmount = Math.round((durationMin * rate.amount) / 60);
      if (lessonAmount <= 0) continue;

      try {
        const tx = await recordFinanceTransaction({
          centerId: input.centerId,
          type: "EXPENSE",
          amount: lessonAmount,
          accountId: input.accountId,
          categoryId: input.categoryId,
          date: lesson.scheduledAt ?? new Date(),
          description: `Выплата ЗП за урок "${lesson.title}" (${durationMin} мин)`,
          counterparty: rate.teacher?.user?.fullName ?? "Преподаватель",
          groupId: lesson.scheduleSlot?.groupId ?? rate.groupId ?? null,
          courseId: lesson.module?.courseId ?? rate.group?.courseId ?? null,
          branchId: lesson.scheduleSlot?.branchId ?? rate.group?.branchId ?? null,
          lessonId: lesson.id,
          createdBy: input.actorUserId,
        });
        paidLessonIds.add(lesson.id);
        createdTransactionsCount += 1;
        totalDisbursedAmount += lessonAmount;
        createdTransactions.push(tx);
      } catch (err: unknown) {
        const errStr = String(err);
        if (errStr.includes("Unique constraint") || errStr.includes("P2002")) {
          // Concurrent runner already paid this lesson; skip without duplicate
          paidLessonIds.add(lesson.id);
          continue;
        }
        throw err;
      }
    }
  }

  return {
    createdTransactionsCount,
    totalDisbursedAmount,
    transactions: createdTransactions,
  };
}
