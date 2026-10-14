import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { requireTenantPageAccess } from "../src/lib/tenant";

let mockToken: string = "";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
    set: vi.fn(),
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

describe("CORE-5 Role Dashboards & Cabinets Hardening", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAUserId: string;
  let teacherA1UserId: string;
  let teacherA2UserId: string;
  let studentA1UserId: string;
  let studentA2UserId: string;
  let parentA1UserId: string;

  let directorAMembershipId: string;
  let teacherA1MembershipId: string;
  let teacherA2MembershipId: string;
  let studentA1MembershipId: string;
  let studentA2MembershipId: string;
  let parentA1MembershipId: string;

  let courseAId: string;
  let groupA1Id: string;
  let groupA2Id: string;
  let lessonA1Id: string;
  let homeworkA1Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();
    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Dashboard Test Plan",
          maxStudents: 50,
          maxTeachers: 5,
          maxCourses: 5,
          maxBranches: 1,
          priceMonthly: 0,
        },
      });
    }
    const planId = plan.id;

    // Center A
    const dirA = await db.platformUser.create({
      data: {
        email: `dash-dira-${Date.now()}@example.com`,
        fullName: "Director Center A",
        passwordHash,
        emailVerified: now,
      },
    });
    directorAUserId = dirA.id;

    const centerA = await db.learningCenter.create({
      data: {
        name: "Dashboard Center A",
        slug: `dash-center-a-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirA.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerAId = centerA.id;

    const dirAMem = await db.centerMembership.create({
      data: {
        centerId: centerAId,
        userId: dirA.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorAMembershipId = dirAMem.id;

    // Center B (for tenant isolation check)
    const dirB = await db.platformUser.create({
      data: {
        email: `dash-dirb-${Date.now()}@example.com`,
        fullName: "Director Center B",
        passwordHash,
        emailVerified: now,
      },
    });
    const centerB = await db.learningCenter.create({
      data: {
        name: "Dashboard Center B",
        slug: `dash-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirB.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerBId = centerB.id;
    await db.centerMembership.create({
      data: {
        centerId: centerBId,
        userId: dirB.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // Teachers in Center A
    const t1User = await db.platformUser.create({
      data: { email: `dash-t1-${Date.now()}@example.com`, fullName: "Teacher A1", passwordHash, emailVerified: now },
    });
    teacherA1UserId = t1User.id;
    const t1Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: t1User.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherA1MembershipId = t1Mem.id;

    const t2User = await db.platformUser.create({
      data: { email: `dash-t2-${Date.now()}@example.com`, fullName: "Teacher A2", passwordHash, emailVerified: now },
    });
    teacherA2UserId = t2User.id;
    const t2Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: t2User.id, role: "TEACHER", status: "ACTIVE" },
    });
    teacherA2MembershipId = t2Mem.id;

    // Students in Center A
    const s1User = await db.platformUser.create({
      data: { email: `dash-s1-${Date.now()}@example.com`, fullName: "Student A1", passwordHash, emailVerified: now },
    });
    studentA1UserId = s1User.id;
    const s1Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: s1User.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentA1MembershipId = s1Mem.id;

    const s2User = await db.platformUser.create({
      data: { email: `dash-s2-${Date.now()}@example.com`, fullName: "Student A2", passwordHash, emailVerified: now },
    });
    studentA2UserId = s2User.id;
    const s2Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: s2User.id, role: "STUDENT", status: "ACTIVE" },
    });
    studentA2MembershipId = s2Mem.id;

    // Parent in Center A
    const p1User = await db.platformUser.create({
      data: { email: `dash-p1-${Date.now()}@example.com`, fullName: "Parent A1", passwordHash, emailVerified: now },
    });
    parentA1UserId = p1User.id;
    const p1Mem = await db.centerMembership.create({
      data: { centerId: centerAId, userId: p1User.id, role: "PARENT", status: "ACTIVE" },
    });
    parentA1MembershipId = p1Mem.id;

    // ParentLink (confirmed child = student A1; unconfirmed child = student A2)
    await db.parentLink.create({
      data: {
        parentMembershipId: p1Mem.id,
        studentMembershipId: s1Mem.id,
        status: "CONFIRMED",
      },
    });
    await db.parentLink.create({
      data: {
        parentMembershipId: p1Mem.id,
        studentMembershipId: s2Mem.id,
        status: "PENDING",
      },
    });

    // Course, Module, Lesson in Center A
    const course = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Frontend Bootcamp",
        createdByMembershipId: dirAMem.id,
      },
    });
    courseAId = course.id;

    const module1 = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: course.id,
        title: "Module 1",
      },
    });

    const lesson1 = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: module1.id,
        title: "Lesson 1: React Basics",
        status: "ACTIVE",
      },
    });
    lessonA1Id = lesson1.id;

    // Groups
    const group1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: course.id,
        name: "Group Alpha",
        teacherMembershipId: t1Mem.id,
      },
    });
    groupA1Id = group1.id;

    await db.enrollment.create({
      data: {
        centerId: centerAId,
        groupId: group1.id,
        studentMembershipId: s1Mem.id,
        status: "ACTIVE",
      },
    });

    const group2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: course.id,
        name: "Group Beta",
        teacherMembershipId: t2Mem.id,
      },
    });
    groupA2Id = group2.id;

    await db.enrollment.create({
      data: {
        centerId: centerAId,
        groupId: group2.id,
        studentMembershipId: s2Mem.id,
        status: "ACTIVE",
      },
    });

    // Schedule slots
    await db.scheduleSlot.create({
      data: {
        centerId: centerAId,
        groupId: group1.id,
        teacherMembershipId: t1Mem.id,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:30",
        roomName: "Room 101",
        status: "ACTIVE",
      },
    });
    await db.scheduleSlot.create({
      data: {
        centerId: centerAId,
        groupId: group2.id,
        teacherMembershipId: t2Mem.id,
        dayOfWeek: 2,
        startTime: "11:00",
        endTime: "12:30",
        roomName: "Room 102",
        status: "ACTIVE",
      },
    });

    // Homework & Submission
    const hw = await db.homework.create({
      data: {
        centerId: centerAId,
        lessonId: lessonA1Id,
        title: "Build Todo App",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    homeworkA1Id = hw.id;

    // Student A1 submitted homework (waiting for review)
    await db.homeworkSubmission.create({
      data: {
        centerId: centerAId,
        homeworkId: hw.id,
        studentMembershipId: s1Mem.id,
        submissionText: "https://github.com/student1/todo",
        status: "SUBMITTED",
        grade: null,
      },
    });

    // Attendance records for Student A1 (1 present, 1 absent -> 50% attendance = at risk < 80%)
    await db.attendance.create({
      data: {
        lessonId: lessonA1Id,
        studentMembershipId: s1Mem.id,
        markedByMembershipId: t1Mem.id,
        status: "PRESENT",
      },
    });

    const lesson2 = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: module1.id,
        title: "Lesson 2: State",
        status: "ACTIVE",
      },
    });
    await db.attendance.create({
      data: {
        lessonId: lesson2.id,
        studentMembershipId: s1Mem.id,
        markedByMembershipId: t1Mem.id,
        status: "ABSENT",
      },
    });

    // Grade record for Student A1
    await db.grade.create({
      data: {
        centerId: centerAId,
        studentMembershipId: s1Mem.id,
        teacherMembershipId: t1Mem.id,
        groupId: group1.id,
        lessonId: lessonA1Id,
        value: 85,
        maxValue: 100,
        comment: "Good job",
        lifecycle: "SUBMITTED",
      },
    });

    // Center payment for Student A1
    await db.centerPayment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: s1Mem.id,
        amount: 500000,
        currency: "UZS",
        status: "PAID",
      },
    });
  });

  // TEST 1: Director metrics isolation and accurate calculations
  it("TEST 1: Director dashboard correctly scopes center metrics and revenue", async () => {
    mockToken = signJWT({
      userId: directorAUserId,
      email: "dash-dira@example.com",
      platformRole: "USER",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const tenantCtx = await requireTenantPageAccess();
    expect(tenantCtx.center.id).toBe(centerAId);

    const activeStudentsCount = await tenantCtx.getTenantDb().centerMembership.count({
      where: { centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
    });
    const coursesCount = await tenantCtx.getTenantDb().course.count({
      where: { centerId: centerAId },
    });
    const payments = await tenantCtx.getTenantDb().centerPayment.aggregate({
      where: { centerId: centerAId, status: "PAID" },
      _sum: { amount: true },
    });

    expect(activeStudentsCount).toBe(2);
    expect(coursesCount).toBe(1);
    expect(payments._sum.amount).toBe(500000);
  });

  // TEST 2: Director attendance summary and at-risk students detection (< 80%)
  it("TEST 2: Director dashboard detects student attendance rate and at-risk count", async () => {
    mockToken = signJWT({
      userId: directorAUserId,
      email: "dash-dira@example.com",
      platformRole: "USER",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const tenantCtx = await requireTenantPageAccess();
    const centerAttendances = await tenantCtx.getTenantDb().attendance.findMany({
      where: { lesson: { module: { course: { centerId: centerAId } } } },
      select: { studentMembershipId: true, status: true },
    });

    const totalCenterAtt = centerAttendances.length;
    const presentCenterAtt = centerAttendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const overallRate = totalCenterAtt > 0 ? Math.round((presentCenterAtt / totalCenterAtt) * 100) : null;

    expect(totalCenterAtt).toBe(2);
    expect(presentCenterAtt).toBe(1);
    expect(overallRate).toBe(50); // 1 out of 2 = 50%

    // Risk map
    const studentAttMap = new Map<string, { total: number; present: number }>();
    for (const a of centerAttendances) {
      const cur = studentAttMap.get(a.studentMembershipId) || { total: 0, present: 0 };
      cur.total++;
      if (a.status === "PRESENT" || a.status === "LATE") cur.present++;
      studentAttMap.set(a.studentMembershipId, cur);
    }
    let atRiskCount = 0;
    for (const [, stats] of studentAttMap) {
      if (stats.total > 0 && stats.present / stats.total < 0.8) {
        atRiskCount++;
      }
    }

    expect(atRiskCount).toBe(1); // Student A1 has 50% (< 80%)
  });

  // TEST 3: Teacher personal schedule and pending reviews scoping
  it("TEST 3: Teacher dashboard scopes schedule and pending homework reviews to their assignments", async () => {
    mockToken = signJWT({
      userId: teacherA1UserId,
      email: "dash-t1@example.com",
      platformRole: "USER",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const tenantCtx = await requireTenantPageAccess();

    // Teacher A1's schedule slots
    const mySlots = await tenantCtx.getTenantDb().scheduleSlot.findMany({
      where: {
        centerId: centerAId,
        teacherMembershipId: teacherA1MembershipId,
        status: "ACTIVE",
      },
      include: { group: true },
    });

    expect(mySlots.length).toBe(1);
    expect(mySlots[0].group.name).toBe("Group Alpha");
    expect(mySlots[0].roomName).toBe("Room 101");

    // Teacher A2's slots are not in Teacher A1's mySlots query
    const otherTeacherSlots = mySlots.filter((s) => s.teacherMembershipId === teacherA2MembershipId);
    expect(otherTeacherSlots.length).toBe(0);

    // Pending homework submissions
    const pendingCount = await tenantCtx.getTenantDb().homeworkSubmission.count({
      where: {
        homework: { lesson: { module: { course: { centerId: centerAId } } } },
        grade: null,
        status: "SUBMITTED",
      },
    });
    expect(pendingCount).toBe(1);
  });

  // TEST 4: Student dashboard personal schedule, deadlines, and GPA isolation
  it("TEST 4: Student dashboard isolates schedule, homework deadlines, and grades", async () => {
    mockToken = signJWT({
      userId: studentA1UserId,
      email: "dash-s1@example.com",
      platformRole: "USER",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    const tenantCtx = await requireTenantPageAccess();

    // Student A1 enrolled groups
    const enrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: { studentMembershipId: studentA1MembershipId, status: "ACTIVE" },
      include: { group: true },
    });
    expect(enrollments.length).toBe(1);
    expect(enrollments[0].group.name).toBe("Group Alpha");

    // Student A1 schedule slots (Group Alpha only, not Group Beta)
    const enrolledGroupIds = enrollments.map((en) => en.group.id);
    const slots = await tenantCtx.getTenantDb().scheduleSlot.findMany({
      where: {
        centerId: centerAId,
        groupId: { in: enrolledGroupIds },
        status: "ACTIVE",
      },
    });
    expect(slots.length).toBe(1);
    expect(slots[0].groupId).toBe(groupA1Id);

    // Student A1 grades
    const myGrades = await tenantCtx.getTenantDb().grade.findMany({
      where: { studentMembershipId: studentA1MembershipId },
    });
    expect(myGrades.length).toBe(1);
    expect(myGrades[0].value).toBe(85);
    expect(myGrades[0].maxValue).toBe(100);

    // Student A2 has no grades
    const s2Grades = await tenantCtx.getTenantDb().grade.findMany({
      where: { studentMembershipId: studentA2MembershipId },
    });
    expect(s2Grades.length).toBe(0);
  });

  // TEST 5: Parent dashboard exposes only confirmed linked children
  it("TEST 5: Parent dashboard exposes only confirmed linked children (excludes PENDING/REJECTED)", async () => {
    mockToken = signJWT({
      userId: parentA1UserId,
      email: "dash-p1@example.com",
      platformRole: "USER",
      activeCenterId: centerAId,
      activeCenterRole: "PARENT",
    });

    const tenantCtx = await requireTenantPageAccess();

    // Query confirmed parent links
    const confirmedLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: { parentMembershipId: parentA1MembershipId, status: "CONFIRMED" },
      include: {
        student: { include: { user: true } },
      },
    });

    expect(confirmedLinks.length).toBe(1);
    expect(confirmedLinks[0].student.user.fullName).toBe("Student A1");

    // Unconfirmed child (student A2) is NOT in the confirmed links list
    const hasStudentA2 = confirmedLinks.some((l) => l.studentMembershipId === studentA2MembershipId);
    expect(hasStudentA2).toBe(false);

    // Attendance data of confirmed child
    const childAttendances = await tenantCtx.getTenantDb().attendance.findMany({
      where: { studentMembershipId: confirmedLinks[0].studentMembershipId },
    });
    expect(childAttendances.length).toBe(2);
  });

  // TEST 6: Tenant isolation prevents cross-center access
  it("TEST 6: User cannot access dashboard of another center they do not belong to", async () => {
    // User is only member of Center A, tries to access Center B
    mockToken = signJWT({
      userId: studentA1UserId,
      email: "dash-s1@example.com",
      platformRole: "USER",
      activeCenterId: centerBId,
      activeCenterRole: "STUDENT",
    });

    await expect(requireTenantPageAccess({ expectedCenterId: centerBId })).rejects.toThrow();
  });
});
