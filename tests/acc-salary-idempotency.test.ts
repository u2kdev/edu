import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import {
  calculateAccountBalance,
  getTashkentMonthBounds,
  disburseTeacherSalaries,
} from "../src/lib/finance";
import { calculateTeacherSalariesReport } from "../src/lib/finance-reports";

describe("ACC-1b Item 4: Teacher Salary Disbursement — Each Conducted Lesson Paid Once & Parallel Idempotency", () => {
  let centerId: string;
  let directorUserId: string;
  let teacherMemId: string;
  let cashAccountId: string;
  let salaryCategoryId: string;
  let courseId: string;
  let groupId: string;
  let lesson1Id: string;
  let lesson2Id: string;

  beforeAll(async () => {
    const ts = Date.now();
    const dirUser = await db.platformUser.create({
      data: {
        email: `acc1b_sal_dir_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Director Salary Idempotency",
        emailVerified: new Date(),
      },
    });
    directorUserId = dirUser.id;

    const tchUser = await db.platformUser.create({
      data: {
        email: `acc1b_sal_tch_${ts}@test.uz`,
        passwordHash: "hash",
        fullName: "Teacher Salary Idempotency",
        emailVerified: new Date(),
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "Salary Idempotency Center",
        slug: `sal-idem-${ts}`,
        status: "ACTIVE",
        ownerId: directorUserId,
      },
    });
    centerId = center.id;

    const dirMem = await db.centerMembership.create({
      data: { centerId, userId: directorUserId, role: "DIRECTOR", status: "ACTIVE" },
    });

    const tchMem = await db.centerMembership.create({
      data: { centerId, userId: tchUser.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherMemId = tchMem.id;

    const cashAcc = await db.account.create({
      data: { centerId, name: "Касса ЗП", type: "CASH", currency: "UZS", isDefault: true },
    });
    cashAccountId = cashAcc.id;

    const salCat = await db.financeCategory.create({
      data: { centerId, name: "Зарплата преподавателей", type: "EXPENSE", code: "SALARY" },
    });
    salaryCategoryId = salCat.id;

    // Seed 2,000,000 UZS into Cash so we can observe exact deductions
    const incCat = await db.financeCategory.create({
      data: { centerId, name: "Выручка", type: "INCOME" },
    });
    await db.financeTransaction.create({
      data: {
        centerId,
        type: "INCOME",
        amount: 2000000,
        accountId: cashAccountId,
        categoryId: incCat.id,
        date: new Date("2026-10-01T10:00:00+05:00"),
        createdBy: directorUserId,
      },
    });

    const course = await db.course.create({
      data: {
        centerId,
        title: "Physics Intensive",
        priceMonthly: 600000,
        createdByMembershipId: dirMem.id,
      },
    });
    courseId = course.id;

    const group = await db.group.create({
      data: {
        centerId,
        courseId,
        teacherMembershipId: teacherMemId,
        name: "PHYS-01",
      },
    });
    groupId = group.id;

    // HOURLY rate = 100,000 UZS / hour (60 min)
    await db.teacherSalaryRate.create({
      data: {
        centerId,
        teacherMembershipId: teacherMemId,
        groupId,
        rateType: "HOURLY",
        amount: 100000,
      },
    });

    const mod = await db.courseModule.create({
      data: { centerId, courseId, title: "Module 1" },
    });
    const slot = await db.scheduleSlot.create({
      data: {
        centerId,
        groupId,
        teacherMembershipId: teacherMemId,
        dayOfWeek: 2,
        startTime: "14:00",
        endTime: "15:30",
      },
    });

    // Two conducted 90-minute lessons (each = 1.5h = 150,000 UZS, total = 300,000 UZS)
    const l1 = await db.lesson.create({
      data: {
        centerId,
        moduleId: mod.id,
        scheduleSlotId: slot.id,
        title: "Lesson 1 (90m)",
        status: "ACTIVE",
        durationMinutes: 90,
        scheduledAt: new Date("2026-10-06T14:00:00+05:00"),
      },
    });
    lesson1Id = l1.id;

    const l2 = await db.lesson.create({
      data: {
        centerId,
        moduleId: mod.id,
        scheduleSlotId: slot.id,
        title: "Lesson 2 (90m)",
        status: "ACTIVE",
        durationMinutes: 90,
        scheduledAt: new Date("2026-10-13T14:00:00+05:00"),
      },
    });
    lesson2Id = l2.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.auditLog.deleteMany({ where: { centerId } });
      await db.financeTransaction.deleteMany({ where: { centerId } });
      await db.teacherSalaryRate.deleteMany({ where: { centerId } });
      await db.lesson.deleteMany({ where: { centerId } });
      await db.scheduleSlot.deleteMany({ where: { centerId } });
      await db.courseModule.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.financeCategory.deleteMany({ where: { centerId } });
      await db.account.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    await db.platformUser.deleteMany({
      where: { email: { contains: "acc1b_sal_" } },
    });
  });

  it("1. parallel Promise.all salary disbursements pay each conducted lesson at most ONCE without duplicate EXPENSE transactions", async () => {
    const { startDate, endDate } = getTashkentMonthBounds(2026, 10);

    // Fire 4 concurrent salary disbursements for the same period & teacher
    const parallelRuns = await Promise.all([
      disburseTeacherSalaries({
        centerId,
        startDate,
        endDate,
        accountId: cashAccountId,
        categoryId: salaryCategoryId,
        actorUserId: directorUserId,
      }),
      disburseTeacherSalaries({
        centerId,
        startDate,
        endDate,
        accountId: cashAccountId,
        categoryId: salaryCategoryId,
        actorUserId: directorUserId,
      }),
      disburseTeacherSalaries({
        centerId,
        startDate,
        endDate,
        accountId: cashAccountId,
        categoryId: salaryCategoryId,
        actorUserId: directorUserId,
      }),
      disburseTeacherSalaries({
        centerId,
        startDate,
        endDate,
        accountId: cashAccountId,
        categoryId: salaryCategoryId,
        actorUserId: directorUserId,
      }),
    ]);

    expect(parallelRuns.length).toBe(4);

    // Verify in DB: exactly 1 EXPENSE transaction for lesson1 and 1 for lesson2
    const salaryTxs = await db.financeTransaction.findMany({
      where: {
        centerId,
        lessonId: { in: [lesson1Id, lesson2Id] },
        isReversal: false,
      },
    });
    expect(salaryTxs.length).toBe(2);
    expect(salaryTxs.every((t) => t.amount === 150000)).toBe(true);

    // Cash balance = 2,000,000 - 300,000 = 1,700,000 UZS
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(1700000);
  });

  it("2. repeated salary calculation and subsequent disbursement do not re-pay already paid lessons", async () => {
    const { startDate, endDate } = getTashkentMonthBounds(2026, 10);

    // Check report: shows 2 conducted lessons (300,000 total), 2 paid (300,000), and 0 unpaid remaining!
    const report = await calculateTeacherSalariesReport({
      centerId,
      startDate,
      endDate,
    });
    const row = report.teachers.find((t) => t.teacherMembershipId === teacherMemId);
    expect(row?.conductedLessonsCount).toBe(2);
    expect(row?.paidLessonsCount).toBe(2);
    expect(row?.unpaidLessonsCount).toBe(0);
    expect(row?.calculatedSalary).toBe(300000);
    expect(row?.paidSalaryAmount).toBe(300000);
    expect(row?.unpaidSalaryAmount).toBe(0);

    // Re-running disburseTeacherSalaries creates 0 new transactions
    const secondRun = await disburseTeacherSalaries({
      centerId,
      startDate,
      endDate,
      accountId: cashAccountId,
      categoryId: salaryCategoryId,
      actorUserId: directorUserId,
    });
    expect(secondRun.createdTransactionsCount).toBe(0);
    expect(secondRun.totalDisbursedAmount).toBe(0);

    // Balance remains 1,700,000 UZS
    expect(await calculateAccountBalance(centerId, cashAccountId)).toBe(1700000);
  });
});
