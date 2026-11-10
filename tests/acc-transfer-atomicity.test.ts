import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import {
  calculateAccountBalance,
  recordFinanceTransfer,
  reverseFinanceTransaction,
} from "../src/lib/finance";

describe("ACC-1b Item 3: Account-to-Account Transfer — Two Transactions in One DB Transaction & Atomic Rollback", () => {
  let centerId: string;
  let directorUserId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let incomeCategoryId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const user = await db.platformUser.create({
      data: {
        email: `acc1b_tr_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Transfer Test",
        emailVerified: new Date(),
      },
    });
    directorUserId = user.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Transfer Atomicity Center",
        slug: `tr-atom-${ts}`,
        status: "ACTIVE",
        ownerId: directorUserId,
      },
    });
    centerId = center.id;

    await db.centerMembership.create({
      data: {
        centerId,
        userId: directorUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const cashAcc = await db.account.create({
      data: {
        centerId,
        name: "Касса Переводов",
        type: "CASH",
        currency: "UZS",
      },
    });
    cashAccountId = cashAcc.id;

    const bankAcc = await db.account.create({
      data: {
        centerId,
        name: "Банк Переводов",
        type: "BANK",
        currency: "UZS",
      },
    });
    bankAccountId = bankAcc.id;

    const cat = await db.financeCategory.create({
      data: {
        centerId,
        name: "Пополнение",
        type: "INCOME",
      },
    });
    incomeCategoryId = cat.id;

    // Seed initial 1,000,000 UZS in Cash
    await db.financeTransaction.create({
      data: {
        centerId,
        type: "INCOME",
        amount: 1000000,
        accountId: cashAccountId,
        categoryId: incomeCategoryId,
        date: new Date("2026-10-01T10:00:00+05:00"),
        createdBy: directorUserId,
      },
    });
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (directorUserId) {
      await db.platformUser.deleteMany({ where: { id: directorUserId } });
    }
  });

  it("1. creates exactly two linked FinanceTransaction rows (OUT and IN) in one DB transaction for a TRANSFER", async () => {
    const result = await recordFinanceTransfer({
      centerId,
      amount: 400000,
      sourceAccountId: cashAccountId,
      targetAccountId: bankAccountId,
      date: new Date("2026-10-05T12:00:00+05:00"),
      description: "Перевод из кассы в банк",
      createdBy: directorUserId,
    });

    expect(result.outTransaction.id).toBeDefined();
    expect(result.inTransaction.id).toBeDefined();
    expect(result.outTransaction.transferGroupId).toBe(result.transferGroupId);
    expect(result.inTransaction.transferGroupId).toBe(result.transferGroupId);
    expect(result.outTransaction.transferDirection).toBe("OUT");
    expect(result.inTransaction.transferDirection).toBe("IN");
    expect(result.outTransaction.accountId).toBe(cashAccountId);
    expect(result.inTransaction.accountId).toBe(bankAccountId);

    // Verify 2 rows in DB with this transferGroupId
    const rows = await db.financeTransaction.findMany({
      where: { centerId, transferGroupId: result.transferGroupId },
    });
    expect(rows.length).toBe(2);

    // Verify balances: Cash = 1,000,000 - 400,000 = 600,000; Bank = 400,000
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(600000);
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(400000);
  });

  it("2. atomically rolls back the first leg (OUT) if the second leg (IN) fails inside the DB transaction", async () => {
    const countBefore = await db.financeTransaction.count({ where: { centerId } });
    const cashBefore = await calculateAccountBalance(centerId, cashAccountId);
    const bankBefore = await calculateAccountBalance(centerId, bankAccountId);

    // Trigger failure on the second leg (e.g., non-existent targetAccountId FK violation or simulated second-leg error)
    await expect(
      recordFinanceTransfer({
        centerId,
        amount: 250000,
        sourceAccountId: cashAccountId,
        targetAccountId: bankAccountId,
        date: new Date("2026-10-06T12:00:00+05:00"),
        description: "Перевод с ошибкой на второй проводке",
        createdBy: directorUserId,
        simulateSecondLegError: true,
      })
    ).rejects.toThrow(/Second leg of transfer failed/i);

    // Neither OUT nor IN transaction may exist in DB!
    const countAfter = await db.financeTransaction.count({ where: { centerId } });
    expect(countAfter).toBe(countBefore);

    // Account balances remain completely unchanged
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(cashBefore);
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(bankBefore);
  });

  it("3. reversing (storno) one leg of a transfer atomically reverses both legs and restores both account balances", async () => {
    const tr = await recordFinanceTransfer({
      centerId,
      amount: 150000,
      sourceAccountId: cashAccountId,
      targetAccountId: bankAccountId,
      date: new Date("2026-10-07T12:00:00+05:00"),
      description: "Перевод для последующего сторно",
      createdBy: directorUserId,
    });

    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(450000);
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(550000);

    await reverseFinanceTransaction({
      centerId,
      transactionId: tr.outTransaction.id,
      reason: "Ошибочный перевод между счетами",
      actorUserId: directorUserId,
      date: new Date("2026-10-08T10:00:00+05:00"),
    });

    // Both Cash and Bank balances restored to 600,000 and 400,000
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(600000);
    expect(await calculateAccountBalance(centerId, bankAccountId)).toBe(400000);
  });
});
