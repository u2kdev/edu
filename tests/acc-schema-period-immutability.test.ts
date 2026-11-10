import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import {
  calculateAccountBalance,
  recordFinanceTransaction,
  reverseFinanceTransaction,
  closeFinancePeriod,
} from "../src/lib/finance";

describe("ACC-1 Item 1: Finance Schema, Account Balances, Period Lock & Storno Immutability", () => {
  let centerId: string;
  let directorUserId: string;
  let directorMemberId: string;
  let teacherUserId: string;
  let teacherMemberId: string;
  let studentUserId: string;
  let studentMemberId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let incomeCategoryId: string;
  let expenseCategoryId: string;
  let taxCategoryId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const directorUser = await db.platformUser.create({
      data: {
        email: `acc_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Accounting",
        emailVerified: new Date(),
      },
    });
    directorUserId = directorUser.id;

    const teacherUser = await db.platformUser.create({
      data: {
        email: `acc_tch_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Teacher Accounting",
        emailVerified: new Date(),
      },
    });
    teacherUserId = teacherUser.id;

    const studentUser = await db.platformUser.create({
      data: {
        email: `acc_std_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Student Accounting",
        emailVerified: new Date(),
      },
    });
    studentUserId = studentUser.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Accounting Test Center",
        slug: `acc-center-${ts}`,
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
    directorMemberId = dirMember.id;

    const tchMember = await db.centerMembership.create({
      data: {
        centerId,
        userId: teacherUserId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMemberId = tchMember.id;

    const stdMember = await db.centerMembership.create({
      data: {
        centerId,
        userId: studentUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMemberId = stdMember.id;

    const tenantDb = getTenantDb(centerId);

    const cashAcc = await tenantDb.account.create({
      data: {
        centerId,
        name: "Основная касса (Наличные)",
        type: "CASH",
        currency: "UZS",
      },
    });
    cashAccountId = cashAcc.id;

    const bankAcc = await tenantDb.account.create({
      data: {
        centerId,
        name: "Расчётный счёт в банке",
        type: "BANK",
        currency: "UZS",
      },
    });
    bankAccountId = bankAcc.id;

    const incCat = await tenantDb.financeCategory.create({
      data: {
        centerId,
        name: "Оплата за обучение",
        type: "INCOME",
        code: "TUITION",
      },
    });
    incomeCategoryId = incCat.id;

    const expCat = await tenantDb.financeCategory.create({
      data: {
        centerId,
        name: "Аренда помещения",
        type: "EXPENSE",
        code: "RENT",
      },
    });
    expenseCategoryId = expCat.id;

    // Configurable tax category (no hardcoded tax rates)
    const taxCat = await tenantDb.financeCategory.create({
      data: {
        centerId,
        name: "Налог с оборота (настраиваемая категория)",
        type: "EXPENSE",
        code: "TAX_CUSTOM",
      },
    });
    taxCategoryId = taxCat.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.financePeriod.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    const userIds = [directorUserId, teacherUserId, studentUserId].filter(Boolean);
    if (userIds.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("1. computes account balance dynamically from INCOME, EXPENSE, and TRANSFER transactions in integer UZS", async () => {
    // Initial balance is 0
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(0);
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(0);

    // Record INCOME of 1,500,000 UZS to Cash
    const incomeTx = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 1500000,
      accountId: cashAccountId,
      categoryId: incomeCategoryId,
      date: new Date("2026-09-10T10:00:00+05:00"),
      description: "Оплата за сентябрь",
      counterparty: "Student Accounting",
      studentMembershipId: studentMemberId,
      createdBy: directorUserId,
    });
    expect(incomeTx.amount).toBe(1500000);
    expect(incomeTx.currency).toBe("UZS");

    // Record EXPENSE of 400,000 UZS from Cash
    await recordFinanceTransaction({
      centerId,
      type: "EXPENSE",
      amount: 400000,
      accountId: cashAccountId,
      categoryId: expenseCategoryId,
      date: new Date("2026-09-12T12:00:00+05:00"),
      description: "Хоз. расходы",
      counterparty: "ООО Снаб",
      createdBy: directorUserId,
    });

    // Record custom tax EXPENSE of 60,000 UZS from Cash
    await recordFinanceTransaction({
      centerId,
      type: "EXPENSE",
      amount: 60000,
      accountId: cashAccountId,
      categoryId: taxCategoryId,
      date: new Date("2026-09-13T12:00:00+05:00"),
      description: "Оплата налога по категории центра",
      counterparty: "ГНК",
      createdBy: directorUserId,
    });

    // Record TRANSFER of 500,000 UZS from Cash to Bank
    await recordFinanceTransaction({
      centerId,
      type: "TRANSFER",
      amount: 500000,
      accountId: cashAccountId,
      targetAccountId: bankAccountId,
      date: new Date("2026-09-15T15:00:00+05:00"),
      description: "Инкассация на р/с",
      createdBy: directorUserId,
    });

    // Cash balance = 1,500,000 - 400,000 - 60,000 - 500,000 = 540,000 UZS
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(540000);
    // Bank balance = +500,000 UZS
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(500000);
  });

  it("2. rejects non-positive or fractional amounts (requires integer UZS > 0)", async () => {
    await expect(
      recordFinanceTransaction({
        centerId,
        type: "INCOME",
        amount: 0,
        accountId: cashAccountId,
        categoryId: incomeCategoryId,
        createdBy: directorUserId,
      })
    ).rejects.toThrow(/positive integer/i);

    await expect(
      recordFinanceTransaction({
        centerId,
        type: "EXPENSE",
        amount: -50000,
        accountId: cashAccountId,
        categoryId: expenseCategoryId,
        createdBy: directorUserId,
      })
    ).rejects.toThrow(/positive integer/i);

    await expect(
      recordFinanceTransaction({
        centerId,
        type: "INCOME",
        amount: 100.5,
        accountId: cashAccountId,
        categoryId: incomeCategoryId,
        createdBy: directorUserId,
      })
    ).rejects.toThrow(/positive integer/i);
  });

  it("3. forbids direct editing or deletion of FinanceTransaction; allows correction only via storno with reason and AuditLog", async () => {
    const tenantDb = getTenantDb(centerId);
    const tx = await recordFinanceTransaction({
      centerId,
      type: "EXPENSE",
      amount: 100000,
      accountId: cashAccountId,
      categoryId: expenseCategoryId,
      date: new Date("2026-09-18T11:00:00+05:00"),
      description: "Ошибочный расход",
      createdBy: directorUserId,
    });

    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(440000);

    // Direct delete and update must be forbidden
    await expect(
      tenantDb.financeTransaction.delete({ where: { id: tx.id } })
    ).rejects.toThrow(/immutable|storno|reversal/i);

    await expect(
      tenantDb.financeTransaction.update({
        where: { id: tx.id },
        data: { amount: 50000 },
      })
    ).rejects.toThrow(/immutable|storno|reversal/i);

    // Reversal (storno) without reason must fail
    await expect(
      reverseFinanceTransaction({
        centerId,
        transactionId: tx.id,
        reason: "   ",
        actorUserId: directorUserId,
      })
    ).rejects.toThrow(/reason/i);

    // Valid storno with reason restores balance and writes AuditLog
    const reversal = await reverseFinanceTransaction({
      centerId,
      transactionId: tx.id,
      reason: "Ошибочно введена сумма расхода",
      actorUserId: directorUserId,
      date: new Date("2026-09-19T11:00:00+05:00"),
    });

    expect(reversal.isReversal).toBe(true);
    expect(reversal.reversalOfId).toBe(tx.id);
    expect(reversal.reversalReason).toBe("Ошибочно введена сумма расхода");

    // Balance restored back to 540,000 UZS
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(540000);

    // Second storno on the same transaction must be rejected
    await expect(
      reverseFinanceTransaction({
        centerId,
        transactionId: tx.id,
        reason: "Повторное сторно",
        actorUserId: directorUserId,
      })
    ).rejects.toThrow(/already reversed/i);

    // AuditLog entry must exist
    const audit = await db.auditLog.findFirst({
      where: {
        centerId,
        action: "FINANCE_TRANSACTION_REVERSED",
        resourceId: reversal.id,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.detailsJson).toContain(tx.id);
    expect(audit?.detailsJson).toContain("Ошибочно введена сумма расхода");
  });

  it("4. only DIRECTOR can close a FinancePeriod, and writing into a CLOSED period is strictly forbidden", async () => {
    // Non-director cannot close period
    await expect(
      closeFinancePeriod({
        centerId,
        year: 2026,
        month: 9,
        actorUserId: teacherUserId,
        actorMembershipId: teacherMemberId,
        actorRole: "TEACHER",
      })
    ).rejects.toThrow(/Only Director/i);

    // Director closes September 2026
    const period = await closeFinancePeriod({
      centerId,
      year: 2026,
      month: 9,
      actorUserId: directorUserId,
      actorMembershipId: directorMemberId,
      actorRole: "DIRECTOR",
      notes: "Закрытие сентября 2026",
    });
    expect(period.status).toBe("CLOSED");

    // Recording new transaction in September 2026 (closed period) must fail
    await expect(
      recordFinanceTransaction({
        centerId,
        type: "INCOME",
        amount: 200000,
        accountId: cashAccountId,
        categoryId: incomeCategoryId,
        date: new Date("2026-09-25T14:00:00+05:00"),
        description: "Попытка записи в закрытый период",
        createdBy: directorUserId,
      })
    ).rejects.toThrow(/closed/i);

    // Direct tenantDb.financeTransaction.create in closed period must also fail
    const tenantDb = getTenantDb(centerId);
    await expect(
      tenantDb.financeTransaction.create({
        data: {
          centerId,
          type: "INCOME",
          amount: 200000,
          accountId: cashAccountId,
          categoryId: incomeCategoryId,
          date: new Date("2026-09-20T10:00:00+05:00"),
          createdBy: directorUserId,
        },
      })
    ).rejects.toThrow(/closed/i);

    // Recording in October 2026 (open period) succeeds
    const octTx = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 300000,
      accountId: cashAccountId,
      categoryId: incomeCategoryId,
      date: new Date("2026-10-02T10:00:00+05:00"),
      description: "Оплата в открытом периоде октября",
      createdBy: directorUserId,
    });
    expect(octTx.id).toBeDefined();
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(840000);
  });

  it("5. enforces storno uniqueness under Promise.all concurrency, forbids reversing a transaction from a CLOSED period, and forbids mismatched reversal amounts", async () => {
    const tenantDb = getTenantDb(centerId);

    // 5a. Cannot reverse a transaction that belongs to CLOSED September 2026, even if reversal date is in October 2026
    const sepTx = await tenantDb.financeTransaction.findFirstOrThrow({
      where: {
        date: {
          gte: new Date("2026-09-01T00:00:00+05:00"),
          lte: new Date("2026-09-30T23:59:59+05:00"),
        },
        isReversal: false,
        reversedBy: null,
      },
    });

    await expect(
      reverseFinanceTransaction({
        centerId,
        transactionId: sepTx.id,
        reason: "Попытка сторнировать проводку из закрытого сентября",
        actorUserId: directorUserId,
        date: new Date("2026-10-05T10:00:00+05:00"),
      })
    ).rejects.toThrow(/closed finance period/i);

    // 5b. Create a new transaction in open October 2026 and test Promise.all concurrent storno
    const octTx2 = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 450000,
      accountId: cashAccountId,
      categoryId: incomeCategoryId,
      date: new Date("2026-10-06T10:00:00+05:00"),
      description: "Проводка для конкурентного сторно",
      createdBy: directorUserId,
    });

    // Direct tenantDb attempt to create a storno with mismatched amount (!== 450000) must fail
    await expect(
      tenantDb.financeTransaction.create({
        data: {
          centerId,
          type: "INCOME",
          amount: 100000, // Mismatched! Original is 450000
          accountId: cashAccountId,
          categoryId: incomeCategoryId,
          date: new Date("2026-10-06T12:00:00+05:00"),
          isReversal: true,
          reversalOfId: octTx2.id,
          reversalReason: "Попытка частичного сторно",
          createdBy: directorUserId,
        },
      })
    ).rejects.toThrow(/Reversal amount must exactly equal original transaction amount/i);

    // Concurrent Promise.all storno calls: exactly 1 succeeds, others reject with "already reversed"
    const concurrentOutcomes = await Promise.allSettled([
      reverseFinanceTransaction({
        centerId,
        transactionId: octTx2.id,
        reason: "Конкурентное сторно #1",
        actorUserId: directorUserId,
        date: new Date("2026-10-06T15:00:00+05:00"),
      }),
      reverseFinanceTransaction({
        centerId,
        transactionId: octTx2.id,
        reason: "Конкурентное сторно #2",
        actorUserId: directorUserId,
        date: new Date("2026-10-06T15:00:00+05:00"),
      }),
      reverseFinanceTransaction({
        centerId,
        transactionId: octTx2.id,
        reason: "Конкурентное сторно #3",
        actorUserId: directorUserId,
        date: new Date("2026-10-06T15:00:00+05:00"),
      }),
    ]);

    const fulfilled = concurrentOutcomes.filter((o) => o.status === "fulfilled");
    const rejected = concurrentOutcomes.filter((o) => o.status === "rejected");
    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(2);

    const reversalsInDb = await tenantDb.financeTransaction.findMany({
      where: { reversalOfId: octTx2.id },
    });
    expect(reversalsInDb.length).toBe(1);
    expect(reversalsInDb[0].amount).toBe(octTx2.amount);
  });
});
