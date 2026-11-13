import { describe, it, expect, beforeAll } from "vitest";
// Reason: Exception: Test setup and verification requires raw db access for multi-tenant fixtures.
// eslint-disable-next-line no-restricted-imports
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { calculateAccountBalance } from "../src/lib/finance";

// Route handlers under test
import { POST as postAccount, GET as getAccounts } from "../src/app/api/finance/accounts/route";
import { POST as postTransaction, GET as getTransactions } from "../src/app/api/finance/transactions/route";
import { POST as reverseTransaction } from "../src/app/api/finance/transactions/[id]/reverse/route";
import { POST as postSalaryRate } from "../src/app/api/finance/salary-rates/route";
import { POST as disburseSalaries } from "../src/app/api/finance/salary-rates/disburse/route";
import { GET as getStudentDebts, POST as postStudentDebtPayment } from "../src/app/api/finance/student-debts/route";
import { POST as closePeriod } from "../src/app/api/finance/periods/route";

describe("Stage D3: Director & Accountant Finances, Ledger, Debts & Salaries", () => {
  let centerAId: string;
  let centerBId: string;
  let dirAUserId: string;
  let dirAMembershipId: string;
  let teacherAUserId: string;
  let teacherAMembershipId: string;
  let studentAUserId: string;
  let studentAMembershipId: string;
  let dirBUserId: string;

  let tokenDirA: string;
  let tokenDirB: string;

  let cashAccountId: string;
  let bankAccountId: string;
  let expenseCategoryId: string;
  let courseAId: string;
  let groupAId: string;
  let lessonAId: string;

  beforeAll(async () => {
    const ts = Date.now();

    // 1. Users
    const userDirA = await db.platformUser.create({
      data: {
        email: `dir_d3_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director D3 A",
        emailVerified: new Date(),
      },
    });
    dirAUserId = userDirA.id;

    const userTeacherA = await db.platformUser.create({
      data: {
        email: `teacher_d3_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Teacher D3 A",
        emailVerified: new Date(),
      },
    });
    teacherAUserId = userTeacherA.id;

    const userStudentA = await db.platformUser.create({
      data: {
        email: `student_d3_a_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Student D3 A",
        emailVerified: new Date(),
      },
    });
    studentAUserId = userStudentA.id;

    const userDirB = await db.platformUser.create({
      data: {
        email: `dir_d3_b_${ts}@test.uz`,
        passwordHash: await hashPassword("ValidPass123!"),
        fullName: "Director D3 B",
        emailVerified: new Date(),
      },
    });
    dirBUserId = userDirB.id;

    // 2. Plan & Centers
    const plan = (await db.subscriptionPlan.findFirst()) || (await db.subscriptionPlan.create({
      data: {
        name: "Standard Plan D3",
        priceMonthly: 500000,
        maxStudents: 500,
        maxTeachers: 20,
        maxCourses: 50,
        maxStorage: 2048,
      },
    }));

    const centerA = await db.learningCenter.create({
      data: {
        name: `Center A D3 ${ts}`,
        slug: `d3-a-${ts}`,
        status: "ACTIVE",
        ownerId: dirAUserId,
      },
    });
    centerAId = centerA.id;

    const centerB = await db.learningCenter.create({
      data: {
        name: `Center B D3 ${ts}`,
        slug: `d3-b-${ts}`,
        status: "ACTIVE",
        ownerId: dirBUserId,
      },
    });
    centerBId = centerB.id;

    // Subscriptions
    await db.subscription.create({
      data: {
        centerId: centerAId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });
    await db.subscription.create({
      data: {
        centerId: centerBId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodEndsAt: new Date(Date.now() + 30 * 86400000),
      },
    });

    // Memberships
    const dirAMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirAUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    dirAMembershipId = dirAMem.id;

    const teacherAMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: teacherAUserId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherAMembershipId = teacherAMem.id;

    const studentAMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: studentAUserId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentAMembershipId = studentAMem.id;

    await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirBUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // Tokens
    tokenDirA = await signJWT({
      userId: dirAUserId,
      email: userDirA.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    tokenDirB = await signJWT({
      userId: dirBUserId,
      email: userDirB.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    // Course, Module, Group, Lesson
    const course = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Python Pro",
        priceMonthly: 600000,
        createdByMembershipId: dirAMembershipId,
      },
    });
    courseAId = course.id;

    const courseModule = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        title: "Basics",
        orderIndex: 0,
      },
    });

    const group = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseAId,
        name: "PY-01",
        teacherMembershipId: teacherAMembershipId,
      },
    });
    groupAId = group.id;

    const lesson = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: courseModule.id,
        title: "Variables & Loops",
        status: "ACTIVE",
        durationMinutes: 90,
        scheduledAt: new Date(),
        substituteTeacherMembershipId: teacherAMembershipId,
      },
    });
    lessonAId = lesson.id;

    // Enroll student in group
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        groupId: groupAId,
        studentMembershipId: studentAMembershipId,
        status: "ACTIVE",
      },
    });
  });

  describe("1. Accounts & Dynamic Real-Time Balances", () => {
    it("creates Cash and Bank accounts", async () => {
      const reqCash = new Request("http://localhost/api/finance/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Основная касса", type: "CASH", isDefault: true }),
      });
      const resCash = await postAccount(reqCash);
      const dataCash = await resCash.json();
      expect(resCash.status).toBe(201);
      cashAccountId = dataCash.account.id;

      const reqBank = new Request("http://localhost/api/finance/accounts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: "Расчетный счет", type: "BANK" }),
      });
      const resBank = await postAccount(reqBank);
      const dataBank = await resBank.json();
      expect(resBank.status).toBe(201);
      bankAccountId = dataBank.account.id;
    });

    it("calculates real-time balances after income and expense transactions", async () => {
      // 1. Create expense category
      const cat = await db.financeCategory.create({
        data: {
          centerId: centerAId,
          name: "Канцелярия",
          type: "EXPENSE",
        },
      });
      expenseCategoryId = cat.id;

      // 2. Record Income (+500,000 UZS into Cash)
      const reqInc = new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "INCOME",
          amount: 500000,
          accountId: cashAccountId,
          description: "Оплата за учебники",
        }),
      });
      const resInc = await postTransaction(reqInc);
      expect(resInc.status).toBe(201);

      // Check balance
      let balCash = await calculateAccountBalance(centerAId, cashAccountId);
      expect(balCash).toBe(500000);

      // 3. Record Expense (-150,000 UZS from Cash)
      const reqExp = new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "EXPENSE",
          amount: 150000,
          accountId: cashAccountId,
          categoryId: expenseCategoryId,
          description: "Бумага А4 и маркеры",
        }),
      });
      const resExp = await postTransaction(reqExp);
      expect(resExp.status).toBe(201);

      balCash = await calculateAccountBalance(centerAId, cashAccountId);
      expect(balCash).toBe(350000);
    });
  });

  describe("2. Atomic Inter-Account Transfers", () => {
    it("transfers 100,000 UZS from Cash to Bank with 2 atomic legs", async () => {
      const reqTransfer = new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "TRANSFER",
          amount: 100000,
          accountId: cashAccountId,
          targetAccountId: bankAccountId,
          description: "Инкассация в банк",
        }),
      });

      const resTransfer = await postTransaction(reqTransfer);
      expect(resTransfer.status).toBe(201);

      const balCash = await calculateAccountBalance(centerAId, cashAccountId);
      const balBank = await calculateAccountBalance(centerAId, bankAccountId);

      expect(balCash).toBe(250000);
      expect(balBank).toBe(100000);
    });
  });

  describe("3. Storno / Transaction Reversal", () => {
    it("reverses a transaction and restores balance, rejecting short reasons", async () => {
      // Find the expense transaction of 150,000
      const expTx = await db.financeTransaction.findFirst({
        where: { centerId: centerAId, amount: 150000, type: "EXPENSE" },
      });
      expect(expTx).not.toBeNull();

      // Attempt reversal with short reason (< 3 chars)
      const reqShort = new Request(
        `http://localhost/api/finance/transactions/${expTx!.id}/reverse`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenDirA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "no" }),
        }
      );
      const resShort = await reverseTransaction(reqShort, {
        params: Promise.resolve({ id: expTx!.id }),
      });
      expect(resShort.status).toBe(400);

      // Reversal with valid reason
      const reqValid = new Request(
        `http://localhost/api/finance/transactions/${expTx!.id}/reverse`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${tokenDirA}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reason: "Ошибочная проводка по чеку" }),
        }
      );
      const resValid = await reverseTransaction(reqValid, {
        params: Promise.resolve({ id: expTx!.id }),
      });
      const dataValid = await resValid.json();
      expect(resValid.status).toBe(200);
      expect(dataValid.reversal.isReversal).toBe(true);

      // Balance restored (+150,000 back to Cash: 250,000 + 150,000 = 400,000)
      const balCash = await calculateAccountBalance(centerAId, cashAccountId);
      expect(balCash).toBe(400000);
    });
  });

  describe("4. Student Debts & Debt Payment Integration", () => {
    it("computes student debt based on enrolled course price", async () => {
      const req = new Request("http://localhost/api/finance/student-debts", {
        headers: { Authorization: `Bearer ${tokenDirA}` },
      });

      const res = await getStudentDebts(req);
      const data = await res.json();
      expect(res.status).toBe(200);

      const studentItem = data.students.find(
        (s: { studentId: string }) => s.studentId === studentAMembershipId
      );
      expect(studentItem).toBeDefined();
      expect(studentItem.monthlyTuition).toBe(600000);
      expect(studentItem.status).toBe("DEBT");
      expect(studentItem.debtAmount).toBeGreaterThanOrEqual(600000);
    });

    it("records debt payment, creating CenterPayment and FinanceTransaction", async () => {
      const req = new Request("http://localhost/api/finance/student-debts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentMembershipId: studentAMembershipId,
          amount: 600000,
          paymentMethod: "CASH",
        }),
      });

      const res = await postStudentDebtPayment(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.success).toBe(true);

      // Verify CenterPayment was created
      const payment = await db.centerPayment.findFirst({
        where: { studentMembershipId: studentAMembershipId },
      });
      expect(payment).not.toBeNull();
      expect(payment?.amount).toBe(600000);

      // Verify FinanceTransaction was synced
      const finTx = await db.financeTransaction.findFirst({
        where: { centerPaymentId: payment?.id },
      });
      expect(finTx).not.toBeNull();
      expect(finTx?.amount).toBe(600000);
      expect(finTx?.type).toBe("INCOME");
    });
  });

  describe("5. Teacher Salary Rates & Disbursement", () => {
    it("sets teacher hourly rate", async () => {
      const req = new Request("http://localhost/api/finance/salary-rates", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherMembershipId: teacherAMembershipId,
          rateType: "HOURLY",
          amount: 100000, // 100k UZS per hour
        }),
      });

      const res = await postSalaryRate(req);
      const data = await res.json();
      expect(res.status).toBe(201);
      expect(data.rate.amount).toBe(100000);
    });

    it("disburses salary for 90-min conducted lesson (150,000 UZS) and prevents duplicate payouts", async () => {
      const startDate = new Date(Date.now() - 86400000).toISOString();
      const endDate = new Date(Date.now() + 86400000).toISOString();

      const reqDisburse = new Request("http://localhost/api/finance/salary-rates/disburse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          accountId: cashAccountId,
          teacherMembershipId: teacherAMembershipId,
        }),
      });

      const resDisburse = await disburseSalaries(reqDisburse);
      const dataDisburse = await resDisburse.json();
      expect(resDisburse.status).toBe(200);
      expect(dataDisburse.createdCount).toBe(1);
      expect(dataDisburse.totalDisbursedAmount).toBe(150000); // 90 min @ 100k/hr = 150k

      // Repeated call should NOT double-pay (0 paid)
      const reqRepeat = new Request("http://localhost/api/finance/salary-rates/disburse", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate,
          endDate,
          accountId: cashAccountId,
          teacherMembershipId: teacherAMembershipId,
        }),
      });

      const resRepeat = await disburseSalaries(reqRepeat);
      const dataRepeat = await resRepeat.json();
      expect(resRepeat.status).toBe(200);
      expect(dataRepeat.createdCount).toBe(0);
      expect(dataRepeat.totalDisbursedAmount).toBe(0);
    });
  });

  describe("6. Accounting Period Closure Guard", () => {
    it("closes accounting period and blocks new transactions in closed period", async () => {
      const curYear = new Date().getFullYear();
      const curMonth = new Date().getMonth() + 1;

      // Director closes period
      const reqClose = new Request("http://localhost/api/finance/periods", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          year: curYear,
          month: curMonth,
          notes: "Отчетный период закрыт директором",
        }),
      });

      const resClose = await closePeriod(reqClose);
      const dataClose = await resClose.json();
      expect(resClose.status).toBe(200);
      expect(dataClose.period.status).toBe("CLOSED");

      // Attempt to record new transaction in the closed period
      const reqTxBlocked = new Request("http://localhost/api/finance/transactions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenDirA}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "INCOME",
          amount: 50000,
          accountId: cashAccountId,
          description: "Попытка записи в закрытый месяц",
          date: new Date().toISOString(),
        }),
      });

      const resTxBlocked = await postTransaction(reqTxBlocked);
      expect(resTxBlocked.status).toBe(403);
      const dataBlocked = await resTxBlocked.json();
      expect(dataBlocked.error).toContain("closed finance period");
    });
  });

  describe("7. Cross-Tenant Finance Isolation", () => {
    it("Director B cannot view or access Director A's accounts or transactions", async () => {
      const reqAcc = new Request("http://localhost/api/finance/accounts", {
        headers: { Authorization: `Bearer ${tokenDirB}` },
      });
      const resAcc = await getAccounts(reqAcc);
      const dataAcc = await resAcc.json();
      expect(resAcc.status).toBe(200);
      const hasA = (dataAcc.accounts || []).some((a: { id: string }) => a.id === cashAccountId);
      expect(hasA).toBe(false);

      const reqTx = new Request("http://localhost/api/finance/transactions", {
        headers: { Authorization: `Bearer ${tokenDirB}` },
      });
      const resTx = await getTransactions(reqTx);
      const dataTx = await resTx.json();
      expect(resTx.status).toBe(200);
      const hasTxA = (dataTx.transactions || []).some(
        (t: { accountId: string }) => t.accountId === cashAccountId
      );
      expect(hasTxA).toBe(false);
    });
  });
});
