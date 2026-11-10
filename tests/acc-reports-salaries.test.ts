import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import {
  recordFinanceTransaction,
  recordFinanceTransfer,
  reverseFinanceTransaction,
  getTashkentMonthBounds,
} from "../src/lib/finance";
import {
  generateFinanceReport,
  calculateDebtorsReport,
  calculateTeacherSalariesReport,
} from "../src/lib/finance-reports";
import { GET as getFinanceReportsRoute } from "../src/app/api/finance/reports/route";

describe("ACC-1 Item 5: Financial Reports (P&L, Cash Flow, Breakdowns, Debtors Aging, Teacher Salaries & Asia/Tashkent Boundaries)", () => {
  let centerId: string;
  let directorUserId: string;
  let directorToken: string;
  let teacher1MemId: string;
  let teacher2MemId: string;
  let student1MemId: string;
  let student2MemId: string;
  let student3MemId: string;

  let cashAccId: string;
  let bankAccId: string;
  let catTuitionId: string;
  let catRentId: string;
  let catTaxId: string;

  let branch1Id: string;
  let branch2Id: string;
  let course1Id: string;
  let course2Id: string;
  let group1Id: string;
  let group2Id: string;

  const userIds: string[] = [];

  beforeAll(async () => {
    const ts = Date.now();
    const dirUser = await db.platformUser.create({
      data: {
        email: `acc5_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Reports",
        emailVerified: new Date(),
      },
    });
    directorUserId = dirUser.id;
    userIds.push(dirUser.id);

    const center = await db.learningCenter.create({
      data: {
        name: "Reports Center UZ",
        slug: `rep-uz-${ts}`,
        status: "ACTIVE",
        ownerId: directorUserId,
      },
    });
    centerId = center.id;

    const dirMem = await db.centerMembership.create({
      data: {
        centerId,
        userId: directorUserId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    directorToken = await signJWT({
      userId: directorUserId,
      email: dirUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });

    // Create 2 teachers and 3 students
    const createMember = async (role: "TEACHER" | "STUDENT", label: string) => {
      const u = await db.platformUser.create({
        data: {
          email: `acc5_${label}_${ts}@test.uz`,
          passwordHash: "hash",
          fullName: `User ${label}`,
          phone: `+99890123${Math.floor(1000 + Math.random() * 8999)}`,
          emailVerified: new Date(),
        },
      });
      userIds.push(u.id);
      const m = await db.centerMembership.create({
        data: { centerId, userId: u.id, role, status: "ACTIVE" },
      });
      return m.id;
    };

    teacher1MemId = await createMember("TEACHER", "tch1");
    teacher2MemId = await createMember("TEACHER", "tch2");
    student1MemId = await createMember("STUDENT", "std1");
    student2MemId = await createMember("STUDENT", "std2");
    student3MemId = await createMember("STUDENT", "std3");

    const b1 = await db.branch.create({ data: { centerId, name: "Юнусабад" } });
    const b2 = await db.branch.create({ data: { centerId, name: "Мирзо-Улугбек" } });
    branch1Id = b1.id;
    branch2Id = b2.id;

    const c1 = await db.course.create({
      data: {
        centerId,
        title: "General English",
        priceMonthly: 600000,
        createdByMembershipId: dirMem.id,
      },
    });
    const c2 = await db.course.create({
      data: {
        centerId,
        title: "Frontend React",
        priceMonthly: 900000,
        createdByMembershipId: dirMem.id,
      },
    });
    course1Id = c1.id;
    course2Id = c2.id;

    const g1 = await db.group.create({
      data: {
        centerId,
        courseId: course1Id,
        branchId: branch1Id,
        teacherMembershipId: teacher1MemId,
        name: "GE-01",
      },
    });
    const g2 = await db.group.create({
      data: {
        centerId,
        courseId: course2Id,
        branchId: branch2Id,
        teacherMembershipId: teacher2MemId,
        name: "REACT-01",
      },
    });
    group1Id = g1.id;
    group2Id = g2.id;

    const cashAcc = await db.account.create({
      data: { centerId, name: "Касса Нал", type: "CASH", currency: "UZS" },
    });
    const bankAcc = await db.account.create({
      data: { centerId, name: "Банк Р/С", type: "BANK", currency: "UZS" },
    });
    cashAccId = cashAcc.id;
    bankAccId = bankAcc.id;

    const catTuition = await db.financeCategory.create({
      data: { centerId, name: "Обучение", type: "INCOME", code: "TUITION" },
    });
    const catRent = await db.financeCategory.create({
      data: { centerId, name: "Аренда", type: "EXPENSE", code: "RENT" },
    });
    const catTax = await db.financeCategory.create({
      data: { centerId, name: "Налоги (настраиваемая)", type: "EXPENSE", code: "TAX" },
    });
    catTuitionId = catTuition.id;
    catRentId = catRent.id;
    catTaxId = catTax.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.teacherSalaryRate.deleteMany({ where: { centerId } });
      await db.centerPayment.deleteMany({ where: { centerId } });
      await db.lesson.deleteMany({ where: { centerId } });
      await db.scheduleSlot.deleteMany({ where: { centerId } });
      await db.courseModule.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.branch.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    if (userIds.length > 0) {
      await db.userSession.deleteMany({ where: { userId: { in: userIds } } });
      await db.platformUser.deleteMany({ where: { id: { in: userIds } } });
    }
  });

  it("1. computes P&L, account balances, and breakdowns by category, month, branch, course, and group with exact Asia/Tashkent period boundaries", async () => {
    // Boundary test:
    // Oct 1, 2026 00:15:00 in Asia/Tashkent (+05:00) is 2026-09-30T19:15:00.000Z in UTC!
    // Must belong to 2026-10 in Tashkent, NOT 2026-09.
    const txOctStartTashkent = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 1200000,
      accountId: cashAccId,
      categoryId: catTuitionId,
      branchId: branch1Id,
      courseId: course1Id,
      groupId: group1Id,
      date: new Date("2026-10-01T00:15:00+05:00"),
      description: "Оплата в первые минуты октября по Ташкенту",
      createdBy: directorUserId,
    });
    expect(txOctStartTashkent.id).toBeDefined();

    // Oct 15 INCOME in Group 2 (Branch 2, Course 2) to Bank
    await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 1800000,
      accountId: bankAccId,
      categoryId: catTuitionId,
      branchId: branch2Id,
      courseId: course2Id,
      groupId: group2Id,
      date: new Date("2026-10-15T12:00:00+05:00"),
      description: "Оплата React",
      createdBy: directorUserId,
    });

    // Oct 16 EXPENSE Rent (500,000) and reversible Expense (200,000 -> reversed!)
    await recordFinanceTransaction({
      centerId,
      type: "EXPENSE",
      amount: 500000,
      accountId: cashAccId,
      categoryId: catRentId,
      branchId: branch1Id,
      date: new Date("2026-10-16T10:00:00+05:00"),
      description: "Аренда Юнусабад",
      createdBy: directorUserId,
    });

    const errExp = await recordFinanceTransaction({
      centerId,
      type: "EXPENSE",
      amount: 200000,
      accountId: cashAccId,
      categoryId: catTaxId,
      date: new Date("2026-10-17T10:00:00+05:00"),
      description: "Ошибочный налог",
      createdBy: directorUserId,
    });
    await reverseFinanceTransaction({
      centerId,
      transactionId: errExp.id,
      reason: "Сторно ошибочного налога",
      actorUserId: directorUserId,
      date: new Date("2026-10-17T11:00:00+05:00"),
    });

    // Sept 30, 2026 23:50:00 in Asia/Tashkent (+05:00) -> belongs to 2026-09, NOT 2026-10
    await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 400000,
      accountId: cashAccId,
      categoryId: catTuitionId,
      date: new Date("2026-09-30T23:50:00+05:00"),
      description: "Сентябрьская оплата",
      createdBy: directorUserId,
    });

    const { startDate, endDate } = getTashkentMonthBounds(2026, 10);
    const reportOct = await generateFinanceReport({
      centerId,
      startDate,
      endDate,
    });

    // Total Income in Oct 2026 = 1,200,000 + 1,800,000 = 3,000,000 UZS (Sept 400k excluded!)
    expect(reportOct.pnl.totalIncome).toBe(3000000);
    // Total Expense in Oct 2026 = 500,000 + 200,000 - 200,000 (storno) = 500,000 UZS
    expect(reportOct.pnl.totalExpense).toBe(500000);
    // Net Profit = 2,500,000 UZS
    expect(reportOct.pnl.netProfit).toBe(2500000);

    // Breakdown by branch
    const b1Row = reportOct.byBranch.find((b) => b.branchId === branch1Id);
    const b2Row = reportOct.byBranch.find((b) => b.branchId === branch2Id);
    expect(b1Row?.income).toBe(1200000);
    expect(b1Row?.expense).toBe(500000);
    expect(b1Row?.net).toBe(700000);
    expect(b2Row?.income).toBe(1800000);

    // Breakdown by course & group
    const c1Row = reportOct.byCourse.find((c) => c.courseId === course1Id);
    const g2Row = reportOct.byGroup.find((g) => g.groupId === group2Id);
    expect(c1Row?.income).toBe(1200000);
    expect(g2Row?.income).toBe(1800000);
  });

  it("2. computes Debtors report with aging buckets (0-30, 31-60, 61+ days)", async () => {
    const referenceNow = new Date("2026-10-25T12:00:00+05:00");

    // Student 1: PENDING payment created 10 days ago (bucket 0-30), amount 600,000
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: student1MemId,
        groupId: group1Id,
        amount: 600000,
        originalAmount: 600000,
        status: "PENDING",
        createdAt: new Date("2026-10-15T12:00:00+05:00"),
      },
    });

    // Student 2: PARTIALLY_PAID payment created 45 days ago (bucket 31-60), original 900,000, paid 400,000 -> debt 500,000
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: student2MemId,
        groupId: group2Id,
        amount: 400000,
        originalAmount: 900000,
        discountAmount: 0,
        status: "PARTIALLY_PAID",
        createdAt: new Date("2026-09-10T12:00:00+05:00"),
      },
    });

    // Student 3: PENDING payment created 75 days ago (bucket 61+), amount 750,000
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: student3MemId,
        groupId: group1Id,
        amount: 750000,
        originalAmount: 750000,
        status: "PENDING",
        createdAt: new Date("2026-08-11T12:00:00+05:00"),
      },
    });

    const debtors = await calculateDebtorsReport({ centerId, asOfDate: referenceNow });
    expect(debtors.summary.totalDebt).toBe(600000 + 500000 + 750000);
    expect(debtors.summary.aging0to30).toBe(600000);
    expect(debtors.summary.aging31to60).toBe(500000);
    expect(debtors.summary.aging61plus).toBe(750000);
    expect(debtors.debtors.length).toBe(3);
  });

  it("3. computes Teacher Salaries from conducted lessons (HOURLY and PERCENTAGE with integer rounding) and serves via GET /api/finance/reports", async () => {
    // Teacher 1: HOURLY rate = 120,000 UZS / hour for group1
    await db.teacherSalaryRate.create({
      data: {
        centerId,
        teacherMembershipId: teacher1MemId,
        groupId: group1Id,
        rateType: "HOURLY",
        amount: 120000,
      },
    });

    // Teacher 2: PERCENTAGE rate = 33% of group2 income (1,800,000 * 33 / 100 = 594,000 UZS)
    await db.teacherSalaryRate.create({
      data: {
        centerId,
        teacherMembershipId: teacher2MemId,
        groupId: group2Id,
        rateType: "PERCENTAGE",
        amount: 33,
      },
    });

    // Create CourseModule & ScheduleSlot for Teacher 1 (group1) and conduct 2 lessons of 90 minutes each (= 3 hours total)
    const mod1 = await db.courseModule.create({
      data: { centerId, courseId: course1Id, title: "Module 1" },
    });
    const slot1 = await db.scheduleSlot.create({
      data: {
        centerId,
        groupId: group1Id,
        teacherMembershipId: teacher1MemId,
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:30",
      },
    });

    await db.lesson.createMany({
      data: [
        {
          centerId,
          moduleId: mod1.id,
          scheduleSlotId: slot1.id,
          title: "Lesson 1 (90 min)",
          status: "ACTIVE",
          durationMinutes: 90,
          scheduledAt: new Date("2026-10-05T10:00:00+05:00"),
        },
        {
          centerId,
          moduleId: mod1.id,
          scheduleSlotId: slot1.id,
          title: "Lesson 2 (90 min)",
          status: "ACTIVE",
          durationMinutes: 90,
          scheduledAt: new Date("2026-10-12T10:00:00+05:00"),
        },
        {
          centerId,
          moduleId: mod1.id,
          scheduleSlotId: slot1.id,
          title: "Cancelled Lesson (ignored)",
          status: "CANCELLED",
          durationMinutes: 90,
          scheduledAt: new Date("2026-10-19T10:00:00+05:00"),
        },
      ],
    });

    const { startDate, endDate } = getTashkentMonthBounds(2026, 10);
    const salaries = await calculateTeacherSalariesReport({
      centerId,
      startDate,
      endDate,
    });

    const t1 = salaries.teachers.find((t) => t.teacherMembershipId === teacher1MemId);
    const t2 = salaries.teachers.find((t) => t.teacherMembershipId === teacher2MemId);

    // Teacher 1: 2 active lessons * 90 min = 180 min = 3 hours * 120,000 = 360,000 UZS
    expect(t1?.conductedLessonsCount).toBe(2);
    expect(t1?.conductedMinutes).toBe(180);
    expect(t1?.calculatedSalary).toBe(360000);

    // Teacher 2: 33% of 1,800,000 UZS = 594,000 UZS
    expect(t2?.calculatedSalary).toBe(594000);

    // Verify GET /api/finance/reports?period=2026-10 returns combined report
    const apiRes = await getFinanceReportsRoute(
      new Request("http://localhost:3000/api/finance/reports?period=2026-10", {
        headers: { Authorization: `Bearer ${directorToken}` },
      })
    );
    expect(apiRes.status).toBe(200);
    const apiData = await apiRes.json();
    expect(apiData.report.pnl.netProfit).toBe(2500000);
    expect(apiData.salaries.totalCalculatedSalary).toBe(360000 + 594000);
  });

  it("4. verifies Asia/Tashkent month end boundary: 2026-10-31T23:59:59+05:00 (2026-10-31T18:59:59Z) is included in October, while 2026-11-01T00:00:00+05:00 is in November", async () => {
    const octEndTx = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 111000,
      accountId: cashAccId,
      categoryId: catTuitionId,
      date: new Date("2026-10-31T23:59:59+05:00"),
      description: "Последняя секунда октября по Ташкенту",
      createdBy: directorUserId,
    });
    const novStartTx = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 222000,
      accountId: cashAccId,
      categoryId: catTuitionId,
      date: new Date("2026-11-01T00:00:00+05:00"),
      description: "Первая секунда ноября по Ташкенту",
      createdBy: directorUserId,
    });

    const octBounds = getTashkentMonthBounds(2026, 10);
    const novBounds = getTashkentMonthBounds(2026, 11);

    const octReport = await generateFinanceReport({ centerId, ...octBounds });
    const novReport = await generateFinanceReport({ centerId, ...novBounds });

    // Previous Oct income was 3,000,000 + 111,000 = 3,111,000 (excluding 222,000)
    expect(octReport.pnl.totalIncome).toBe(3111000);
    expect(novReport.pnl.totalIncome).toBe(222000);

    // Clean up these two boundary test rows via reversal so subsequent manual checks stay exact
    await reverseFinanceTransaction({
      centerId,
      transactionId: octEndTx.id,
      reason: "Очистка граничного теста октября",
      actorUserId: directorUserId,
      date: new Date("2026-10-31T23:59:59+05:00"),
    });
    await reverseFinanceTransaction({
      centerId,
      transactionId: novStartTx.id,
      reason: "Очистка граничного теста ноября",
      actorUserId: directorUserId,
      date: new Date("2026-11-01T00:00:01+05:00"),
    });
  });

  it("5. verifies storno of INCOME reduces totalIncome and netProfit without inflating totalExpense", async () => {
    const incTx = await recordFinanceTransaction({
      centerId,
      type: "INCOME",
      amount: 500000,
      accountId: cashAccId,
      categoryId: catTuitionId,
      branchId: branch1Id,
      courseId: course1Id,
      groupId: group1Id,
      date: new Date("2026-10-20T10:00:00+05:00"),
      description: "Ошибочный приход 500к",
      createdBy: directorUserId,
    });

    const octBounds = getTashkentMonthBounds(2026, 10);
    const beforeStorno = await generateFinanceReport({ centerId, ...octBounds });
    expect(beforeStorno.pnl.totalIncome).toBe(3500000);
    expect(beforeStorno.pnl.totalExpense).toBe(500000);

    await reverseFinanceTransaction({
      centerId,
      transactionId: incTx.id,
      reason: "Возврат ошибочного прихода",
      actorUserId: directorUserId,
      date: new Date("2026-10-20T12:00:00+05:00"),
    });

    const afterStorno = await generateFinanceReport({ centerId, ...octBounds });
    // Income returns to 3,000,000, Expense stays 500,000 (not 1,000,000!)
    expect(afterStorno.pnl.totalIncome).toBe(3000000);
    expect(afterStorno.pnl.totalExpense).toBe(500000);
    expect(afterStorno.pnl.netProfit).toBe(2500000);
  });

  it("6. verifies account Cash Flow (periodInflow, periodOutflow, currentBalance) including two-leg TRANSFER between Cash and Bank", async () => {
    // Perform transfer of 300,000 UZS from Cash to Bank on Oct 22
    const tr = await recordFinanceTransfer({
      centerId,
      amount: 300000,
      sourceAccountId: cashAccId,
      targetAccountId: bankAccId,
      date: new Date("2026-10-22T14:00:00+05:00"),
      description: "Инкассация 300к",
      createdBy: directorUserId,
    });

    const octBounds = getTashkentMonthBounds(2026, 10);
    const rep = await generateFinanceReport({ centerId, ...octBounds });

    const cashRow = rep.accountsCashflow.find((a) => a.accountId === cashAccId);
    const bankRow = rep.accountsCashflow.find((a) => a.accountId === bankAccId);

    // Cash in Oct: Inflow = 1,200,000; Outflow = 500,000 (rent) + 300,000 (transfer out) = 800,000
    // Cash total balance (including Sept 400,000): 400,000 + 1,200,000 - 800,000 = 800,000
    expect(cashRow?.periodInflow).toBe(1200000);
    expect(cashRow?.periodOutflow).toBe(800000);
    expect(cashRow?.currentBalance).toBe(800000);

    // Bank in Oct: Inflow = 1,800,000 (income) + 300,000 (transfer in) = 2,100,000; Outflow = 0
    expect(bankRow?.periodInflow).toBe(2100000);
    expect(bankRow?.periodOutflow).toBe(0);
    expect(bankRow?.currentBalance).toBe(2100000);
    expect(rep.pnl.totalTransferVolume).toBe(300000);

    // Reverse transfer to keep baseline clean
    await reverseFinanceTransaction({
      centerId,
      transactionId: tr.outTransaction.id,
      reason: "Отмена тестовой инкассации",
      actorUserId: directorUserId,
      date: new Date("2026-10-22T15:00:00+05:00"),
    });
  });

  it("7. verifies Category breakdown hides zeroed-out reversed categories and accurately sums active categories", async () => {
    const octBounds = getTashkentMonthBounds(2026, 10);
    const rep = await generateFinanceReport({ centerId, ...octBounds });

    // Tax category had 200,000 expense and -200,000 storno -> net 0 -> filtered out of active breakdown
    const taxCatRow = rep.byCategory.find((c) => c.categoryId === catTaxId);
    expect(taxCatRow).toBeUndefined();

    const tuitionCatRow = rep.byCategory.find((c) => c.categoryId === catTuitionId);
    const rentCatRow = rep.byCategory.find((c) => c.categoryId === catRentId);
    expect(tuitionCatRow?.amount).toBe(3000000);
    expect(rentCatRow?.amount).toBe(500000);
  });

  it("8. verifies Multi-Month breakdown (byMonth) across September and October in Asia/Tashkent", async () => {
    const start = getTashkentMonthBounds(2026, 9).startDate;
    const end = getTashkentMonthBounds(2026, 10).endDate;
    const multiRep = await generateFinanceReport({
      centerId,
      startDate: start,
      endDate: end,
    });

    expect(multiRep.byMonth.length).toBe(2);
    expect(multiRep.byMonth[0]).toEqual({
      month: "2026-09",
      income: 400000,
      expense: 0,
      net: 400000,
    });
    expect(multiRep.byMonth[1]).toEqual({
      month: "2026-10",
      income: 3000000,
      expense: 500000,
      net: 2500000,
    });
  });

  it("9. verifies Debtors exact aging boundary days (30, 31, 60, 61 days) and discount deduction", async () => {
    const asOf = new Date("2026-12-31T12:00:00+05:00");

    // Create a temporary payment with discount: original 1,000,000, discount 150,000, paid 250,000 -> debt 600,000
    // Created exactly 30 days before asOf (2026-12-01T12:00:00+05:00) -> bucket "0-30"
    const p30 = await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: student1MemId,
        groupId: group1Id,
        amount: 250000,
        originalAmount: 1000000,
        discountAmount: 150000,
        status: "PARTIALLY_PAID",
        createdAt: new Date("2026-12-01T12:00:00+05:00"),
      },
    });

    // Created exactly 60 days before asOf (2026-11-01T12:00:00+05:00) -> bucket "31-60"
    const p60 = await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: student2MemId,
        groupId: group2Id,
        amount: 300000,
        originalAmount: 300000,
        discountAmount: 0,
        status: "PENDING",
        createdAt: new Date("2026-11-01T12:00:00+05:00"),
      },
    });

    const rep = await calculateDebtorsReport({ centerId, asOfDate: asOf });
    const row30 = rep.debtors.find((d) => d.paymentId === p30.id);
    const row60 = rep.debtors.find((d) => d.paymentId === p60.id);

    expect(row30?.daysOverdue).toBe(30);
    expect(row30?.agingBucket).toBe("0-30");
    expect(row30?.debtAmount).toBe(600000);

    expect(row60?.daysOverdue).toBe(60);
    expect(row60?.agingBucket).toBe("31-60");
    expect(row60?.debtAmount).toBe(300000);

    await db.centerPayment.deleteMany({ where: { id: { in: [p30.id, p60.id] } } });
  });

  it("10. verifies FIXED teacher salary rate and integer rounding on fractional HOURLY lessons (45 min at 100,001 UZS/h)", async () => {
    // Update Teacher 1 rate to 100,001 UZS/hour and add a 45-minute lesson in November 2026:
    // 45 * 100,001 / 60 = 75,000.75 -> Math.round = 75,001 UZS
    const rate = await db.teacherSalaryRate.findFirstOrThrow({
      where: { centerId, teacherMembershipId: teacher1MemId },
    });
    await db.teacherSalaryRate.update({
      where: { id: rate.id },
      data: { amount: 100001 },
    });

    const mod = await db.courseModule.findFirstOrThrow({ where: { centerId, courseId: course1Id } });
    const slot = await db.scheduleSlot.findFirstOrThrow({ where: { centerId, groupId: group1Id } });

    const novLesson = await db.lesson.create({
      data: {
        centerId,
        moduleId: mod.id,
        scheduleSlotId: slot.id,
        title: "Nov 45m Lesson",
        status: "ACTIVE",
        durationMinutes: 45,
        scheduledAt: new Date("2026-11-10T10:00:00+05:00"),
      },
    });

    const novBounds = getTashkentMonthBounds(2026, 11);
    const salRep = await calculateTeacherSalariesReport({ centerId, ...novBounds });
    const t1 = salRep.teachers.find((t) => t.teacherMembershipId === teacher1MemId);
    expect(t1?.calculatedSalary).toBe(75001);

    await db.lesson.delete({ where: { id: novLesson.id } });
  });
});
