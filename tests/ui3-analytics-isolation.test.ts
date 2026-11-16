import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { hashPassword, signJWT } from "../src/lib/auth";
import { buildPlatformAnalyticsExtension } from "../src/lib/platform-dashboard-analytics";
import { getCenterFinanceAnalytics } from "../src/lib/finance-analytics";
import {
  DashboardAccessError,
  getDirectorDashboardData,
  getStudentPerformanceData,
  getTeacherDashboardData,
} from "../src/lib/dashboard-analytics";
import { GET as getFinanceAnalyticsRoute } from "../src/app/api/finance/analytics/route";
import { GET as getStudentPerformanceRoute } from "../src/app/api/students/[id]/performance/route";

let mockToken = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

describe("Stage UI3 Analytics & Multi-Tenant RBAC/IDOR Isolation (real DB)", () => {
  const ts = Date.now();
  const createdUserIds: string[] = [];
  const createdCenterIds: string[] = [];
  const createdPlanIds: string[] = [];

  let centerAId = "";
  let centerBId = "";

  let dirAUserId = "";
  let dirAEmail = "";
  let accAUserId = "";
  let accAEmail = "";
  let teachA1UserId = "";
  let teachA1Email = "";
  let teachA2UserId = "";
  let teachA2Email = "";
  let stuA1UserId = "";
  let stuA1Email = "";
  let parOkUserId = "";
  let parOkEmail = "";
  let parWaitUserId = "";
  let parWaitEmail = "";
  let dirBUserId = "";
  let dirBEmail = "";

  let teachA1MemberId = "";
  let teachA2MemberId = "";
  let stuA1MemberId = "";
  let stuA2MemberId = "";
  let stuA3MemberId = "";
  let parOkMemberId = "";
  let parWaitMemberId = "";
  let stuB1MemberId = "";

  let groupA1Id = "";
  let lessonA1Id = "";
  let courseAId = "";
  let moduleAId = "";

  function setAuth(
    userId: string,
    email: string,
    centerId: string,
    role: string
  ) {
    mockToken = signJWT({
      userId,
      email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: role,
    });
  }

  function req(url: string, ip = "198.51.100.71") {
    return new Request(`http://localhost${url}`, {
      method: "GET",
      headers: { "x-forwarded-for": ip },
    });
  }

  beforeAll(async () => {
    const passHash = await hashPassword("Ui3Isolation!2026");

    const mkUser = async (prefix: string, fullName: string) => {
      const email = `${prefix}_${ts}@ui3.test`;
      const u = await db.platformUser.create({
        data: {
          email,
          fullName,
          passwordHash: passHash,
          emailVerified: new Date(),
          platformRole: "NONE",
        },
      });
      createdUserIds.push(u.id);
      return u;
    };

    const dirA = await mkUser("dirA", "Director A");
    const accA = await mkUser("accA", "Accountant A");
    const teachA1 = await mkUser("teachA1", "Teacher A1");
    const teachA2 = await mkUser("teachA2", "Teacher A2 Idle");
    const stuA1 = await mkUser("stuA1", "Student A1");
    const stuA2 = await mkUser("stuA2", "Student A2");
    const stuA3 = await mkUser("stuA3", "Student A3");
    const parOk = await mkUser("parOk", "Parent Confirmed");
    const parWait = await mkUser("parWait", "Parent Pending");
    const dirB = await mkUser("dirB", "Director B");
    const stuB1 = await mkUser("stuB1", "Student B1");

    dirAUserId = dirA.id;
    dirAEmail = dirA.email;
    accAUserId = accA.id;
    accAEmail = accA.email;
    teachA1UserId = teachA1.id;
    teachA1Email = teachA1.email;
    teachA2UserId = teachA2.id;
    teachA2Email = teachA2.email;
    stuA1UserId = stuA1.id;
    stuA1Email = stuA1.email;
    parOkUserId = parOk.id;
    parOkEmail = parOk.email;
    parWaitUserId = parWait.id;
    parWaitEmail = parWait.email;
    dirBUserId = dirB.id;
    dirBEmail = dirB.email;

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `UI3-Plan-${ts}`,
        maxStudents: 100,
        maxTeachers: 20,
        maxCourses: 10,
        priceMonthly: 1_500_000,
      },
    });
    createdPlanIds.push(plan.id);

    const cA = await db.learningCenter.create({
      data: {
        name: "UI3 Center A",
        slug: `ui3-a-${ts}`,
        ownerId: dirA.id,
        status: "ACTIVE",
      },
    });
    const cB = await db.learningCenter.create({
      data: {
        name: "UI3 Center B",
        slug: `ui3-b-${ts}`,
        ownerId: dirB.id,
        status: "ACTIVE",
      },
    });
    createdCenterIds.push(cA.id, cB.id);
    centerAId = cA.id;
    centerBId = cB.id;

    const now = new Date();
    const subA = await db.subscription.create({
      data: {
        centerId: centerAId,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(now.getTime() - 10 * 24 * 3600 * 1000),
        currentPeriodEndsAt: new Date(now.getTime() + 20 * 24 * 3600 * 1000),
      },
    });

    await db.platformPayment.create({
      data: {
        centerId: centerAId,
        subscriptionId: subA.id,
        planId: plan.id,
        amount: 1_500_000,
        currency: "UZS",
        status: "PAID",
        paymentType: "SUBSCRIPTION",
        paidAt: now,
      },
    });

    const mkMember = async (
      centerId: string,
      userId: string,
      role: "DIRECTOR" | "ACCOUNTANT" | "TEACHER" | "STUDENT" | "PARENT"
    ) => {
      return db.centerMembership.create({
        data: { centerId, userId, role, status: "ACTIVE" },
      });
    };

    const dirAMem = await mkMember(centerAId, dirA.id, "DIRECTOR");
    await mkMember(centerAId, accA.id, "ACCOUNTANT");
    const tA1Mem = await mkMember(centerAId, teachA1.id, "TEACHER");
    const tA2Mem = await mkMember(centerAId, teachA2.id, "TEACHER");
    const sA1Mem = await mkMember(centerAId, stuA1.id, "STUDENT");
    const sA2Mem = await mkMember(centerAId, stuA2.id, "STUDENT");
    const sA3Mem = await mkMember(centerAId, stuA3.id, "STUDENT");
    const pOkMem = await mkMember(centerAId, parOk.id, "PARENT");
    const pWaitMem = await mkMember(centerAId, parWait.id, "PARENT");

    const dirBMem = await mkMember(centerBId, dirB.id, "DIRECTOR");
    const sB1Mem = await mkMember(centerBId, stuB1.id, "STUDENT");

    teachA1MemberId = tA1Mem.id;
    teachA2MemberId = tA2Mem.id;
    stuA1MemberId = sA1Mem.id;
    stuA2MemberId = sA2Mem.id;
    stuA3MemberId = sA3Mem.id;
    parOkMemberId = pOkMem.id;
    parWaitMemberId = pWaitMem.id;
    stuB1MemberId = sB1Mem.id;

    await db.parentLink.create({
      data: {
        parentMembershipId: parOkMemberId,
        studentMembershipId: stuA1MemberId,
        status: "CONFIRMED",
      },
    });
    await db.parentLink.create({
      data: {
        parentMembershipId: parWaitMemberId,
        studentMembershipId: stuA1MemberId,
        status: "PENDING",
      },
    });

    const cashAccA = await db.account.create({
      data: { centerId: centerAId, name: "Касса А", type: "CASH", isDefault: true },
    });
    const bankAccA = await db.account.create({
      data: { centerId: centerAId, name: "Банк А", type: "BANK", isDefault: false },
    });
    const expCatA = await db.financeCategory.create({
      data: { centerId: centerAId, name: "Аренда", type: "EXPENSE" },
    });

    const cashAccB = await db.account.create({
      data: { centerId: centerBId, name: "Касса B", type: "CASH", isDefault: true },
    });

    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Course A UI3",
        priceMonthly: 600_000,
        createdByMembershipId: dirAMem.id,
      },
    });
    courseAId = courseA.id;
    const modA = await db.courseModule.create({
      data: { centerId: centerAId, courseId: courseA.id, title: "Module 1" },
    });
    moduleAId = modA.id;

    const groupA = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group A1",
        teacherMembershipId: teachA1MemberId,
        maxStudents: 10,
      },
    });
    groupA1Id = groupA.id;

    const lessonA1 = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: modA.id,
        title: "Lesson 1",
        scheduledAt: new Date(now.getTime() - 2 * 24 * 3600 * 1000),
        durationMinutes: 90,
      },
    });
    lessonA1Id = lessonA1.id;

    await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: modA.id,
        title: "Lesson 2 Upcoming",
        scheduledAt: new Date(now.getTime() + 3 * 24 * 3600 * 1000),
        durationMinutes: 90,
      },
    });

    await db.scheduleSlot.create({
      data: {
        centerId: centerAId,
        groupId: groupA1Id,
        teacherMembershipId: teachA1MemberId,
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:30",
        roomName: "101",
      },
    });

    const enrA1 = await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        paidUntil: new Date(now.getTime() + 10 * 24 * 3600 * 1000),
      },
    });
    await db.enrollment.create({
      data: { centerId: centerAId, studentMembershipId: stuA2MemberId, groupId: groupA1Id },
    });
    await db.enrollment.create({
      data: { centerId: centerAId, studentMembershipId: stuA3MemberId, groupId: groupA1Id },
    });

    await db.attendance.create({
      data: {
        lessonId: lessonA1Id,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        status: "PRESENT",
        markedByMembershipId: teachA1MemberId,
        markedAt: now,
      },
    });

    const hw = await db.homework.create({
      data: {
        centerId: centerAId,
        lessonId: lessonA1Id,
        title: "HW 1",
        dueDate: new Date(now.getTime() - 24 * 3600 * 1000),
      },
    });
    await db.homeworkSubmission.create({
      data: {
        centerId: centerAId,
        homeworkId: hw.id,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        status: "UNDER_REVIEW",
        submittedAt: now,
      },
    });

    // Initially ONLY 2 distinct students graded in Group A (< 3 threshold!)
    await db.grade.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        lessonId: lessonA1Id,
        teacherMembershipId: teachA1MemberId,
        value: 90,
        maxValue: 100,
      },
    });
    await db.grade.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA2MemberId,
        groupId: groupA1Id,
        lessonId: lessonA1Id,
        teacherMembershipId: teachA1MemberId,
        value: 70,
        maxValue: 100,
      },
    });

    // Payments + FinanceTransactions in Center A (CLICK + CASH + BANK + DISCOUNT + PENDING_MANUAL refund + EXPENSE)
    const payClick = await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        amount: 500_000,
        originalAmount: 600_000,
        discountAmount: 100_000,
        status: "PAID",
        paymentMethod: "ONLINE",
        externalTxId: `clk-ui3-${ts}`,
        paidAt: now,
      },
    });
    await db.financeTransaction.create({
      data: {
        centerId: centerAId,
        type: "INCOME",
        amount: 500_000,
        accountId: bankAccA.id,
        centerPaymentId: payClick.id,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        courseId: courseAId,
        date: now,
        createdBy: dirAUserId,
      },
    });

    const payCash = await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA2MemberId,
        groupId: groupA1Id,
        amount: 300_000,
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: now,
      },
    });
    await db.financeTransaction.create({
      data: {
        centerId: centerAId,
        type: "INCOME",
        amount: 300_000,
        accountId: cashAccA.id,
        centerPaymentId: payCash.id,
        studentMembershipId: stuA2MemberId,
        groupId: groupA1Id,
        courseId: courseAId,
        date: now,
        createdBy: dirAUserId,
      },
    });

    await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA3MemberId,
        groupId: groupA1Id,
        amount: 200_000,
        refundedAmount: 200_000,
        manualRefundStatus: "PENDING_MANUAL",
        status: "REFUNDED",
        paymentMethod: "ONLINE",
        paidAt: now,
        refundedAt: now,
      },
    });

    await db.financeTransaction.create({
      data: {
        centerId: centerAId,
        type: "EXPENSE",
        amount: 150_000,
        accountId: cashAccA.id,
        categoryId: expCatA.id,
        date: now,
        description: "Office rent",
        createdBy: dirAUserId,
      },
    });

    // Overdue Charge 65 days old for debt aging bucket 61+
    const oldStart = new Date(now.getTime() - 95 * 24 * 3600 * 1000);
    const oldDue = new Date(now.getTime() - 65 * 24 * 3600 * 1000);
    await db.charge.create({
      data: {
        centerId: centerAId,
        enrollmentId: enrA1.id,
        studentMembershipId: stuA1MemberId,
        groupId: groupA1Id,
        invoiceNumber: `INV-UI3-${ts}`,
        periodMonths: 1,
        periodStart: oldStart,
        periodEnd: oldDue,
        originalAmount: 600_000,
        discountAmount: 0,
        amount: 600_000,
        paidAmount: 200_000,
        status: "PARTIAL",
        dueDate: oldDue,
      },
    });

    // Center B completely separate income (9,999,000) to verify zero cross-tenant leakage
    const payB = await db.centerPayment.create({
      data: {
        centerId: centerBId,
        studentMembershipId: stuB1MemberId,
        amount: 9_999_000,
        status: "PAID",
        paymentMethod: "CASH",
        paidAt: now,
      },
    });
    await db.financeTransaction.create({
      data: {
        centerId: centerBId,
        type: "INCOME",
        amount: 9_999_000,
        accountId: cashAccB.id,
        centerPaymentId: payB.id,
        studentMembershipId: stuB1MemberId,
        date: now,
        createdBy: dirBUserId,
      },
    });
    // Ensure courseA & moduleA variables stay clearly scoped
    void dirBMem;
    void moduleAId;
  });

  afterAll(async () => {
    for (const cId of createdCenterIds) {
      await db.financeTransaction.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.attendance.deleteMany({ where: { lesson: { centerId: cId } } }).catch(() => {});
      await db.grade.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.homeworkSubmission.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.charge.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.centerPayment.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.platformPayment.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.enrollment.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.scheduleSlot.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.group.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.course.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.account.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.financeCategory.deleteMany({ where: { centerId: cId } }).catch(() => {});
      await db.learningCenter.deleteMany({ where: { id: cId } }).catch(() => {});
    }
    for (const pId of createdPlanIds) {
      await db.subscriptionPlan.deleteMany({ where: { id: pId } }).catch(() => {});
    }
    if (createdUserIds.length > 0) {
      await db.platformUser.deleteMany({ where: { id: { in: createdUserIds } } }).catch(() => {});
    }
  });

  it("builds 12m platform analytics and KPI deltas cleanly", async () => {
    const ext = await buildPlatformAnalyticsExtension("30d");
    expect(ext.revenueMrr12Months).toHaveLength(12);
    expect(ext.centersByPlan.some((p) => p.planName.includes(`UI3-Plan-${ts}`))).toBe(true);
    expect(ext.centersByStatus.some((s) => s.status === "ACTIVE" && s.count >= 2)).toBe(true);
    expect(ext.deltas.currentPeriodRevenue).toBeGreaterThanOrEqual(1_500_000);
  });

  it("aggregates Center A finance & director analytics cleanly without Center B leakage", async () => {
    const fin = await getCenterFinanceAnalytics({ centerId: centerAId, period: "30d" });
    expect(fin.kpis.revenue).toBe(800_000);
    expect(fin.kpis.expenses).toBe(150_000);
    expect(fin.kpis.netProfit).toBe(650_000);
    expect(fin.kpis.totalDiscounts).toBe(100_000);
    expect(fin.kpis.revenue).not.toBeGreaterThanOrEqual(9_999_000);

    const clickMethod = fin.paymentMethods.find((m) => m.method === "CLICK");
    const cashMethod = fin.paymentMethods.find((m) => m.method === "CASH");
    expect(clickMethod?.amount).toBe(500_000);
    expect(cashMethod?.amount).toBe(300_000);
    expect(fin.expenseCategories[0]?.categoryName).toBe("Аренда");
    expect(fin.debtAging.find((b) => b.bucket === "61+")?.amount).toBe(400_000);

    const dirData = await getDirectorDashboardData({ centerId: centerAId, period: "30d" });
    expect(dirData.kpis.revenue).toBe(800_000);
    expect(dirData.kpis.pendingManualRefundsCount).toBe(1);
    expect(dirData.debtAgingTotals.aging61plus).toBe(400_000);
    expect(dirData.groupOccupancy[0]?.groupName).toBe("Group A1");
    expect(dirData.attentionCounts.inactiveTeachersCount).toBe(2);
  });

  it("enforces RBAC & Zod validation on /api/finance/analytics", async () => {
    // ACCOUNTANT -> 200 + no-store
    setAuth(accAUserId, accAEmail, centerAId, "ACCOUNTANT");
    const okRes = await getFinanceAnalyticsRoute(req("/api/finance/analytics?period=30d"));
    expect(okRes.status).toBe(200);
    expect(okRes.headers.get("Cache-Control")).toBe("no-store");
    const okJson = await okRes.json();
    expect(okJson.analytics.kpis.revenue).toBe(800_000);

    // DIRECTOR invalid period -> 400
    setAuth(dirAUserId, dirAEmail, centerAId, "DIRECTOR");
    const badRes = await getFinanceAnalyticsRoute(req("/api/finance/analytics?period=999d"));
    expect(badRes.status).toBe(400);

    // TEACHER -> 403
    setAuth(teachA1UserId, teachA1Email, centerAId, "TEACHER");
    const tchRes = await getFinanceAnalyticsRoute(req("/api/finance/analytics?period=30d"));
    expect(tchRes.status).toBe(403);

    // STUDENT -> 403
    setAuth(stuA1UserId, stuA1Email, centerAId, "STUDENT");
    const stuRes = await getFinanceAnalyticsRoute(req("/api/finance/analytics?period=30d"));
    expect(stuRes.status).toBe(403);
  });

  it("isolates teacher dashboard strictly to teacher's own groups", async () => {
    const t1 = await getTeacherDashboardData({
      centerId: centerAId,
      membershipId: teachA1MemberId,
      role: "TEACHER",
      period: "30d",
    });
    expect(t1.kpis.groupsCount).toBe(1);
    expect(t1.pendingReviews.length).toBe(1);
    expect(t1.attendanceByGroup[0]?.groupName).toBe("Group A1");

    const t2 = await getTeacherDashboardData({
      centerId: centerAId,
      membershipId: teachA2MemberId,
      role: "TEACHER",
      period: "30d",
    });
    expect(t2.kpis.groupsCount).toBe(0);
    expect(t2.pendingReviews.length).toBe(0);
  });

  it("enforces strict RBAC/IDOR, teacher payment redaction and groupAverage k-anonymity on StudentPerformance", async () => {
    // 1. STUDENT accessing own record with <3 graded students in group -> no groupAverage leaked
    const stuOwnSmall = await getStudentPerformanceData({
      centerId: centerAId,
      studentMembershipId: stuA1MemberId,
      viewerRole: "STUDENT",
      viewerMembershipId: stuA1MemberId,
      period: "30d",
    });
    expect(stuOwnSmall.canViewPayments).toBe(true);
    expect(stuOwnSmall.payment).not.toBeNull();
    expect(stuOwnSmall.canViewGroupAverage).toBe(false);
    expect(stuOwnSmall.gradesTrajectory[0]?.groupAverage).toBeUndefined();

    // 2. Add 3rd distinct student grade in Group A -> groupAverage becomes enabled as anonymous numeric mean
    await db.grade.create({
      data: {
        centerId: centerAId,
        studentMembershipId: stuA3MemberId,
        groupId: groupA1Id,
        lessonId: lessonA1Id,
        teacherMembershipId: teachA1MemberId,
        value: 80,
        maxValue: 100,
      },
    });
    const stuOwnAnon = await getStudentPerformanceData({
      centerId: centerAId,
      studentMembershipId: stuA1MemberId,
      viewerRole: "STUDENT",
      viewerMembershipId: stuA1MemberId,
      period: "30d",
    });
    expect(stuOwnAnon.canViewGroupAverage).toBe(true);
    expect(stuOwnAnon.gradesTrajectory[0]?.groupAverage).toBe(80); // (90+70+80)/3

    // 3. STUDENT accessing peer stuA2 -> 403
    await expect(
      getStudentPerformanceData({
        centerId: centerAId,
        studentMembershipId: stuA2MemberId,
        viewerRole: "STUDENT",
        viewerMembershipId: stuA1MemberId,
      })
    ).rejects.toBeInstanceOf(DashboardAccessError);

    // 4. PARENT confirmed allowed; pending blocked (403)
    const parRes = await getStudentPerformanceData({
      centerId: centerAId,
      studentMembershipId: stuA1MemberId,
      viewerRole: "PARENT",
      viewerMembershipId: parOkMemberId,
    });
    expect(parRes.canViewPayments).toBe(true);

    await expect(
      getStudentPerformanceData({
        centerId: centerAId,
        studentMembershipId: stuA1MemberId,
        viewerRole: "PARENT",
        viewerMembershipId: parWaitMemberId,
      })
    ).rejects.toBeInstanceOf(DashboardAccessError);

    // 5. TEACHER assigned to stuA1's group: allowed, MUST NOT receive payments
    setAuth(teachA1UserId, teachA1Email, centerAId, "TEACHER");
    const tchApiRes = await getStudentPerformanceRoute(
      req(`/api/students/${stuA1MemberId}/performance?detailed=1&period=30d`),
      { params: { id: stuA1MemberId } }
    );
    expect(tchApiRes.status).toBe(200);
    expect(tchApiRes.headers.get("Cache-Control")).toBe("no-store");
    const tchJson = await tchApiRes.json();
    expect(tchJson.detailedPerformance.canViewPayments).toBe(false);
    expect(tchJson.detailedPerformance.payment).toBeNull();

    // 6. Unassigned teacher -> 403
    setAuth(teachA2UserId, teachA2Email, centerAId, "TEACHER");
    const tch2ApiRes = await getStudentPerformanceRoute(
      req(`/api/students/${stuA1MemberId}/performance?detailed=1`),
      { params: { id: stuA1MemberId } }
    );
    expect(tch2ApiRes.status).toBe(403);

    // 7. Pending parent via API -> 403; Foreign center student -> 404
    setAuth(parWaitUserId, parWaitEmail, centerAId, "PARENT");
    const parWaitApi = await getStudentPerformanceRoute(
      req(`/api/students/${stuA1MemberId}/performance?detailed=1`),
      { params: { id: stuA1MemberId } }
    );
    expect(parWaitApi.status).toBe(403);

    setAuth(dirAUserId, dirAEmail, centerAId, "DIRECTOR");
    const crossCenterApi = await getStudentPerformanceRoute(
      req(`/api/students/${stuB1MemberId}/performance?detailed=1`),
      { params: { id: stuB1MemberId } }
    );
    expect(crossCenterApi.status).toBe(404);
    void courseAId;
    void stuA1Email;
    void parOkEmail;
    void dirBEmail;
    void parOkUserId;
  });
});
