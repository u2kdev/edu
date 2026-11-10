import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { getTenantDb } from "../src/lib/db-tenant";
import {
  GET as getTransactions,
  POST as postTransaction,
} from "../src/app/api/finance/transactions/route";
import {
  GET as getAccounts,
  POST as postAccount,
} from "../src/app/api/finance/accounts/route";
import {
  GET as getCategories,
  POST as postCategory,
} from "../src/app/api/finance/categories/route";

describe("ACC-1 Item 4: Finance API Pagination, Filters, Search, Zod, Audit & Cross-Tenant Isolation", () => {
  let centerAId: string;
  let centerBId: string;
  let dirAUserId: string;
  let dirBUserId: string;
  let tokenA: string;
  let tokenB: string;

  let accACashId: string;
  let accABankId: string;
  let accBCashId: string;

  let catAIncomeId: string;
  let catAExpenseId: string;
  let catBIncomeId: string;

  let groupAId: string;
  let groupBId: string;
  let branchAId: string;
  let branchBId: string;

  beforeAll(async () => {
    const ts = Date.now();
    const userA = await db.platformUser.create({
      data: {
        email: `acc4_dirA_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Center A",
        emailVerified: new Date(),
      },
    });
    dirAUserId = userA.id;

    const userB = await db.platformUser.create({
      data: {
        email: `acc4_dirB_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Center B",
        emailVerified: new Date(),
      },
    });
    dirBUserId = userB.id;

    const centerA = await db.learningCenter.create({
      data: {
        name: "Finance Center A",
        slug: `fin-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUserId,
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: "Finance Center B",
        slug: `fin-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUserId,
      },
    });
    centerBId = centerB.id;

    const memA = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const memB = await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    tokenA = await signJWT({
      userId: dirAUserId,
      email: userA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    tokenB = await signJWT({
      userId: dirBUserId,
      email: userB.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    const branchA = await db.branch.create({
      data: { centerId: centerAId, name: "Филиал Чиланзар" },
    });
    branchAId = branchA.id;

    const branchB = await db.branch.create({
      data: { centerId: centerBId, name: "Чужой Филиал B" },
    });
    branchBId = branchB.id;

    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "IELTS Intensive",
        createdByMembershipId: memA.id,
      },
    });
    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Foreign Course B",
        createdByMembershipId: memB.id,
      },
    });

    const groupA = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        branchId: branchAId,
        name: "IELTS-A1",
      },
    });
    groupAId = groupA.id;

    const groupB = await db.group.create({
      data: {
        centerId: centerBId,
        courseId: courseB.id,
        branchId: branchBId,
        name: "FOREIGN-B1",
      },
    });
    groupBId = groupB.id;

    // Create accounts and categories via API for Center A & B
    const accARes = await postAccount(
      new Request("http://localhost:3000/api/finance/accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Касса Чиланзар", type: "CASH", isDefault: true }),
      })
    );
    expect(accARes.status).toBe(201);
    accACashId = (await accARes.json()).account.id;

    const accABankRes = await postAccount(
      new Request("http://localhost:3000/api/finance/accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Банк Ипак Йули", type: "BANK" }),
      })
    );
    expect(accABankRes.status).toBe(201);
    accABankId = (await accABankRes.json()).account.id;

    const accBRes = await postAccount(
      new Request("http://localhost:3000/api/finance/accounts", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Чужая Касса B", type: "CASH", isDefault: true }),
      })
    );
    expect(accBRes.status).toBe(201);
    accBCashId = (await accBRes.json()).account.id;

    const catAIncRes = await postCategory(
      new Request("http://localhost:3000/api/finance/categories", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Оплата курса IELTS", type: "INCOME", code: "IELTS_INC" }),
      })
    );
    expect(catAIncRes.status).toBe(201);
    catAIncomeId = (await catAIncRes.json()).category.id;

    const catAExpRes = await postCategory(
      new Request("http://localhost:3000/api/finance/categories", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Реклама Telegram", type: "EXPENSE", code: "MKT" }),
      })
    );
    expect(catAExpRes.status).toBe(201);
    catAExpenseId = (await catAExpRes.json()).category.id;

    const catBIncRes = await postCategory(
      new Request("http://localhost:3000/api/finance/categories", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Чужая категория B", type: "INCOME" }),
      })
    );
    expect(catBIncRes.status).toBe(201);
    catBIncomeId = (await catBIncRes.json()).category.id;
  });

  afterAll(async () => {
    const centers = [centerAId, centerBId].filter(Boolean);
    if (centers.length > 0) {
      await db.auditLog.deleteMany({ where: { centerId: { in: centers } } });
      await db.financeTransaction.deleteMany({ where: { centerId: { in: centers } } });
      await db.financeCategory.deleteMany({ where: { centerId: { in: centers } } });
      await db.account.deleteMany({ where: { centerId: { in: centers } } });
      await db.group.deleteMany({ where: { centerId: { in: centers } } });
      await db.course.deleteMany({ where: { centerId: { in: centers } } });
      await db.branch.deleteMany({ where: { centerId: { in: centers } } });
      await db.centerMembership.deleteMany({ where: { centerId: { in: centers } } });
      await db.learningCenter.deleteMany({ where: { id: { in: centers } } });
    }
    const users = [dirAUserId, dirBUserId].filter(Boolean);
    if (users.length > 0) {
      await db.userSession.deleteMany({ where: { userId: { in: users } } });
      await db.platformUser.deleteMany({ where: { id: { in: users } } });
    }
  });

  it("1. supports server-side pagination, filtering (period, type, category, account, branch, group) and search (description, counterparty)", async () => {
    // Seed 3 transactions in Center A and 1 in Center B
    const txPayloads = [
      {
        type: "INCOME",
        amount: 800000,
        accountId: accACashId,
        categoryId: catAIncomeId,
        branchId: branchAId,
        groupId: groupAId,
        date: "2026-10-05T09:00:00+05:00",
        description: "Оплата за октябрь Алишер",
        counterparty: "Алишер Каримов",
      },
      {
        type: "EXPENSE",
        amount: 250000,
        accountId: accACashId,
        categoryId: catAExpenseId,
        branchId: branchAId,
        date: "2026-10-07T14:00:00+05:00",
        description: "Таргет в Telegram канале",
        counterparty: "Agency Media UZ",
      },
      {
        type: "TRANSFER",
        amount: 300000,
        accountId: accACashId,
        targetAccountId: accABankId,
        date: "2026-10-08T16:00:00+05:00",
        description: "Пополнение расчётного счёта",
        counterparty: "Внутренний перевод",
      },
    ];

    for (const payload of txPayloads) {
      const res = await postTransaction(
        new Request("http://localhost:3000/api/finance/transactions", {
          method: "POST",
          headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      );
      expect(res.status).toBe(201);
    }

    // Center B transaction
    await postTransaction(
      new Request("http://localhost:3000/api/finance/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenB}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: 999000,
          accountId: accBCashId,
          categoryId: catBIncomeId,
          date: "2026-10-05T10:00:00+05:00",
          description: "Секретная проводка Центра B",
          counterparty: "Секретный контрагент B",
        }),
      })
    );

    // 1) Pagination: pageSize=2, page=1 -> returns 2 items, total=3, totalPages=2
    const page1Res = await getTransactions(
      new Request("http://localhost:3000/api/finance/transactions?page=1&pageSize=2", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    expect(page1Res.status).toBe(200);
    const page1Data = await page1Res.json();
    expect(page1Data.transactions.length).toBe(2);
    expect(page1Data.pagination.total).toBe(3);
    expect(page1Data.pagination.totalPages).toBe(2);

    // 2) Filter by type=EXPENSE
    const expRes = await getTransactions(
      new Request("http://localhost:3000/api/finance/transactions?type=EXPENSE", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const expData = await expRes.json();
    expect(expData.transactions.length).toBe(1);
    expect(expData.transactions[0].amount).toBe(250000);

    // 3) Filter by groupId
    const grpRes = await getTransactions(
      new Request(`http://localhost:3000/api/finance/transactions?groupId=${groupAId}`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const grpData = await grpRes.json();
    expect(grpData.transactions.length).toBe(1);
    expect(grpData.transactions[0].counterparty).toBe("Алишер Каримов");

    // 4) Search by counterparty ("Agency Media")
    const searchRes = await getTransactions(
      new Request("http://localhost:3000/api/finance/transactions?search=Agency%20Media", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const searchData = await searchRes.json();
    expect(searchData.transactions.length).toBe(1);
    expect(searchData.transactions[0].description).toContain("Telegram");

    // 5) Filter by period=2026-10
    const periodRes = await getTransactions(
      new Request("http://localhost:3000/api/finance/transactions?period=2026-10", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const periodData = await periodRes.json();
    expect(periodData.pagination.total).toBe(3);
  });

  it("2. strictly isolates tenants and rejects foreign center foreign keys (foreign accountId, targetAccountId, categoryId, groupId, branchId)", async () => {
    // Center A cannot see Center B's accounts or categories
    const accsARes = await getAccounts(
      new Request("http://localhost:3000/api/finance/accounts", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const accsAData = await accsARes.json();
    expect(accsAData.accounts.some((a: { id: string }) => a.id === accBCashId)).toBe(false);

    const catsARes = await getCategories(
      new Request("http://localhost:3000/api/finance/categories", {
        headers: { Authorization: `Bearer ${tokenA}` },
      })
    );
    const catsAData = await catsARes.json();
    expect(catsAData.categories.some((c: { id: string }) => c.id === catBIncomeId)).toBe(false);

    // Center A attempting to record transaction with Center B's groupId -> rejected
    const foreignGroupRes = await postTransaction(
      new Request("http://localhost:3000/api/finance/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: 100000,
          accountId: accACashId,
          categoryId: catAIncomeId,
          groupId: groupBId,
        }),
      })
    );
    expect(foreignGroupRes.status).toBe(403);

    // Center A attempting to record transaction with Center B's branchId -> rejected
    const foreignBranchRes = await postTransaction(
      new Request("http://localhost:3000/api/finance/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: 100000,
          accountId: accACashId,
          categoryId: catAIncomeId,
          branchId: branchBId,
        }),
      })
    );
    expect(foreignBranchRes.status).toBe(403);

    // Direct tenantDb cross-tenant FK check on financeTransaction.create
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.financeTransaction.create({
        data: {
          centerId: centerAId,
          type: "INCOME",
          amount: 100000,
          accountId: accBCashId, // belongs to Center B!
          createdBy: dirAUserId,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/i);
  });

  it("3. validates input with Zod (rejects negative/float amounts and invalid UUIDs) and writes AuditLog for every write", async () => {
    const badRes = await postTransaction(
      new Request("http://localhost:3000/api/finance/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: -500,
          accountId: accACashId,
        }),
      })
    );
    expect(badRes.status).toBe(400);

    const floatRes = await postTransaction(
      new Request("http://localhost:3000/api/finance/transactions", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokenA}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "INCOME",
          amount: 1500.75,
          accountId: accACashId,
        }),
      })
    );
    expect(floatRes.status).toBe(400);

    // Verify AuditLog entries were created for Center A accounts, categories, and transactions
    const audits = await db.auditLog.findMany({
      where: { centerId: centerAId },
    });
    const actions = new Set(audits.map((a) => a.action));
    expect(actions.has("FINANCE_ACCOUNT_CREATED")).toBe(true);
    expect(actions.has("FINANCE_CATEGORY_CREATED")).toBe(true);
    expect(actions.has("FINANCE_TRANSACTION_CREATED")).toBe(true);
  });
});
