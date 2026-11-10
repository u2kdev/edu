import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { hasPermission } from "../src/lib/permissions";
import { GET as getGrades } from "../src/app/api/grades/route";
import { GET as getCenterPayments } from "../src/app/api/center-payments/route";
import {
  GET as getAccounts,
  POST as postAccount,
} from "../src/app/api/finance/accounts/route";
import {
  GET as getTransactions,
  POST as postTransaction,
} from "../src/app/api/finance/transactions/route";
import { POST as reverseTransactionRoute } from "../src/app/api/finance/transactions/[id]/reverse/route";
import { POST as closePeriodRoute } from "../src/app/api/finance/periods/route";

describe("ACC-1 Item 3: ACCOUNTANT Role & Role × Endpoint Permission Matrix", () => {
  let centerId: string;
  let accountId: string;
  let categoryId: string;
  let groupId: string;
  const tokens: Record<string, string> = {};
  const userIds: string[] = [];
  const memberIds: Record<string, string> = {};

  beforeAll(async () => {
    const ts = Date.now();
    const roles = [
      "DIRECTOR",
      "ACCOUNTANT",
      "CENTER_ADMIN",
      "TEACHER",
      "STUDENT",
      "PARENT",
    ] as const;

    const dirUser = await db.platformUser.create({
      data: {
        email: `acc3_director_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Role Matrix Director",
        emailVerified: new Date(),
      },
    });
    userIds.push(dirUser.id);

    const center = await db.learningCenter.create({
      data: {
        name: "RBAC Matrix Center",
        slug: `rbac-acc-${ts}`,
        status: "ACTIVE",
        ownerId: dirUser.id,
      },
    });
    centerId = center.id;

    for (const role of roles) {
      let u = dirUser;
      if (role !== "DIRECTOR") {
        u = await db.platformUser.create({
          data: {
            email: `acc3_${role.toLowerCase()}_${ts}@test.uz`,
            passwordHash: "hash",
            fullName: `Role Matrix ${role}`,
            emailVerified: new Date(),
          },
        });
        userIds.push(u.id);
      }

      const mem = await db.centerMembership.create({
        data: {
          centerId,
          userId: u.id,
          role,
          status: "ACTIVE",
        },
      });
      memberIds[role] = mem.id;

      tokens[role] = await signJWT({
        userId: u.id,
        email: u.email,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: role,
      });
    }

    // Link PARENT to STUDENT
    await db.parentLink.create({
      data: {
        parentMembershipId: memberIds.PARENT,
        studentMembershipId: memberIds.STUDENT,
        status: "CONFIRMED",
        initiatedBy: "ADMIN",
      },
    });

    const course = await db.course.create({
      data: {
        centerId,
        title: "Math Course",
        priceMonthly: 500000,
        createdByMembershipId: memberIds.DIRECTOR,
      },
    });

    const group = await db.group.create({
      data: {
        centerId,
        courseId: course.id,
        name: "MATH-01",
        teacherMembershipId: memberIds.TEACHER,
      },
    });
    groupId = group.id;

    // Create sample payments: 1 for STUDENT, 1 for another student
    const otherStudentUser = await db.platformUser.create({
      data: {
        email: `acc3_other_std_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Other Student",
        emailVerified: new Date(),
      },
    });
    userIds.push(otherStudentUser.id);
    const otherStudentMem = await db.centerMembership.create({
      data: {
        centerId,
        userId: otherStudentUser.id,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    memberIds.OTHER_STUDENT = otherStudentMem.id;

    // Payment in TEACHER's group for STUDENT
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: memberIds.STUDENT,
        groupId,
        amount: 500000,
        originalAmount: 500000,
        status: "PAID",
      },
    });

    // Payment not in TEACHER's group for OTHER_STUDENT
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: otherStudentMem.id,
        amount: 700000,
        originalAmount: 700000,
        status: "PAID",
      },
    });

    const acc = await db.account.create({
      data: {
        centerId,
        name: "Касса RBAC",
        type: "CASH",
        currency: "UZS",
      },
    });
    accountId = acc.id;

    const cat = await db.financeCategory.create({
      data: {
        centerId,
        name: "Оплата RBAC",
        type: "INCOME",
      },
    });
    categoryId = cat.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.financePeriod.deleteMany({ where: { centerId } });
      await db.centerPayment.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.parentLink.deleteMany({
        where: { parentMembershipId: memberIds.PARENT },
      });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (userIds.length > 0) {
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  function makeReq(url: string, role: string, method = "GET", body?: unknown): Request {
    return new Request(url, {
      method,
      headers: {
        Authorization: `Bearer ${tokens[role]}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("1. verifies unit permissions in hasPermission() for DIRECTOR, ACCOUNTANT, CENTER_ADMIN, TEACHER, STUDENT, PARENT", () => {
    // DIRECTOR has all finance permissions
    expect(hasPermission("finance.read", "NONE", "DIRECTOR")).toBe(true);
    expect(hasPermission("finance.write", "NONE", "DIRECTOR")).toBe(true);
    expect(hasPermission("finance.storno", "NONE", "DIRECTOR")).toBe(true);
    expect(hasPermission("finance.period.close", "NONE", "DIRECTOR")).toBe(true);
    expect(hasPermission("finance.export", "NONE", "DIRECTOR")).toBe(true);

    // ACCOUNTANT has read, write, export, but NOT storno, NOT period.close and NOT grades.read
    expect(hasPermission("finance.read", "NONE", "ACCOUNTANT")).toBe(true);
    expect(hasPermission("finance.write", "NONE", "ACCOUNTANT")).toBe(true);
    expect(hasPermission("finance.storno", "NONE", "ACCOUNTANT")).toBe(false);
    expect(hasPermission("finance.export", "NONE", "ACCOUNTANT")).toBe(true);
    expect(hasPermission("finance.period.close", "NONE", "ACCOUNTANT")).toBe(false);
    expect(hasPermission("grades.read", "NONE", "ACCOUNTANT")).toBe(false);

    // CENTER_ADMIN has read and write, but NOT storno and NOT period.close
    expect(hasPermission("finance.read", "NONE", "CENTER_ADMIN")).toBe(true);
    expect(hasPermission("finance.write", "NONE", "CENTER_ADMIN")).toBe(true);
    expect(hasPermission("finance.storno", "NONE", "CENTER_ADMIN")).toBe(false);
    expect(hasPermission("finance.period.close", "NONE", "CENTER_ADMIN")).toBe(false);

    // TEACHER, STUDENT, PARENT have NO center finance permissions
    for (const r of ["TEACHER", "STUDENT", "PARENT"]) {
      expect(hasPermission("finance.read", "NONE", r)).toBe(false);
      expect(hasPermission("finance.write", "NONE", r)).toBe(false);
      expect(hasPermission("finance.storno", "NONE", r)).toBe(false);
      expect(hasPermission("finance.period.close", "NONE", r)).toBe(false);
    }
  });

  it("2. ACCOUNTANT cannot access grades (/api/grades returns 403)", async () => {
    const res = await getGrades(makeReq("http://localhost:3000/api/grades", "ACCOUNTANT"));
    expect(res.status).toBe(403);
  });

  it("3. enforces Role × Endpoint matrix for finance read & manual entry (/api/finance/accounts & /api/finance/transactions)", async () => {
    // Allowed to read & write: DIRECTOR, ACCOUNTANT, CENTER_ADMIN
    for (const role of ["DIRECTOR", "ACCOUNTANT", "CENTER_ADMIN"]) {
      const getAccRes = await getAccounts(makeReq("http://localhost:3000/api/finance/accounts", role));
      expect(getAccRes.status).toBe(200);

      const postTxRes = await postTransaction(
        makeReq("http://localhost:3000/api/finance/transactions", role, "POST", {
          type: "INCOME",
          amount: 100000,
          accountId,
          categoryId,
          date: "2026-10-10T10:00:00+05:00",
          description: `Tx by ${role}`,
        })
      );
      expect(postTxRes.status).toBe(201);
    }

    // Forbidden (403) for TEACHER, STUDENT, PARENT
    for (const role of ["TEACHER", "STUDENT", "PARENT"]) {
      const getAccRes = await getAccounts(makeReq("http://localhost:3000/api/finance/accounts", role));
      expect(getAccRes.status).toBe(403);

      const getTxRes = await getTransactions(makeReq("http://localhost:3000/api/finance/transactions", role));
      expect(getTxRes.status).toBe(403);

      const postAccRes = await postAccount(
        makeReq("http://localhost:3000/api/finance/accounts", role, "POST", {
          name: `Illegal Account ${role}`,
          type: "CASH",
        })
      );
      expect(postAccRes.status).toBe(403);

      const postTxRes = await postTransaction(
        makeReq("http://localhost:3000/api/finance/transactions", role, "POST", {
          type: "INCOME",
          amount: 50000,
          accountId,
          categoryId,
        })
      );
      expect(postTxRes.status).toBe(403);
    }
  });

  it("4. enforces Role × Endpoint matrix for Storno (/api/finance/transactions/[id]/reverse): ONLY DIRECTOR allowed, ACCOUNTANT, CENTER_ADMIN & others 403", async () => {
    // Create two transactions to reverse
    const tx1 = await db.financeTransaction.create({
      data: {
        centerId,
        type: "INCOME",
        amount: 75000,
        accountId,
        categoryId,
        date: new Date("2026-10-11T10:00:00+05:00"),
        createdBy: userIds[0],
      },
    });
    const tx2 = await db.financeTransaction.create({
      data: {
        centerId,
        type: "INCOME",
        amount: 85000,
        accountId,
        categoryId,
        date: new Date("2026-10-11T11:00:00+05:00"),
        createdBy: userIds[0],
      },
    });

    // ACCOUNTANT, CENTER_ADMIN, TEACHER, STUDENT, PARENT -> 403 on storno
    for (const role of ["ACCOUNTANT", "CENTER_ADMIN", "TEACHER", "STUDENT", "PARENT"]) {
      const res = await reverseTransactionRoute(
        makeReq(`http://localhost:3000/api/finance/transactions/${tx1.id}/reverse`, role, "POST", {
          reason: "Попытка сторно без прав",
        }),
        { params: Promise.resolve({ id: tx1.id }) }
      );
      expect(res.status).toBe(403);
    }

    // DIRECTOR -> 200 on storno
    const dirRes = await reverseTransactionRoute(
      makeReq(`http://localhost:3000/api/finance/transactions/${tx2.id}/reverse`, "DIRECTOR", "POST", {
        reason: "Сторно директором",
      }),
      { params: Promise.resolve({ id: tx2.id }) }
    );
    expect(dirRes.status).toBe(200);
  });

  it("5. enforces Role × Endpoint matrix for Period Closing (/api/finance/periods POST): ONLY DIRECTOR allowed; ACCOUNTANT, CENTER_ADMIN & others 403", async () => {
    for (const role of ["ACCOUNTANT", "CENTER_ADMIN", "TEACHER", "STUDENT", "PARENT"]) {
      const res = await closePeriodRoute(
        makeReq("http://localhost:3000/api/finance/periods", role, "POST", {
          year: 2026,
          month: 8,
          notes: "Попытка закрытия не-директором",
        })
      );
      expect(res.status).toBe(403);
    }

    const dirRes = await closePeriodRoute(
      makeReq("http://localhost:3000/api/finance/periods", "DIRECTOR", "POST", {
        year: 2026,
        month: 8,
        notes: "Закрыто директором",
      })
    );
    expect(dirRes.status).toBe(200);
  });

  it("6. TEACHER, STUDENT, and PARENT see only their own/group/child payments on /api/center-payments", async () => {
    // STUDENT sees only 1 payment (their own)
    const stdRes = await getCenterPayments(makeReq("http://localhost:3000/api/center-payments", "STUDENT"));
    expect(stdRes.status).toBe(200);
    const stdData = await stdRes.json();
    expect(stdData.payments.length).toBe(1);
    expect(stdData.payments[0].studentMembershipId).toBe(memberIds.STUDENT);

    // PARENT sees only 1 payment (their linked child)
    const parRes = await getCenterPayments(makeReq("http://localhost:3000/api/center-payments", "PARENT"));
    expect(parRes.status).toBe(200);
    const parData = await parRes.json();
    expect(parData.payments.length).toBe(1);
    expect(parData.payments[0].studentMembershipId).toBe(memberIds.STUDENT);

    // TEACHER sees only 1 payment (their group)
    const tchRes = await getCenterPayments(makeReq("http://localhost:3000/api/center-payments", "TEACHER"));
    expect(tchRes.status).toBe(200);
    const tchData = await tchRes.json();
    expect(tchData.payments.length).toBe(1);
    expect(tchData.payments[0].groupId).toBe(groupId);

    // ACCOUNTANT sees all 2 center payments
    const accRes = await getCenterPayments(makeReq("http://localhost:3000/api/center-payments", "ACCOUNTANT"));
    expect(accRes.status).toBe(200);
    const accData = await accRes.json();
    expect(accData.payments.length).toBe(2);
  });
});
