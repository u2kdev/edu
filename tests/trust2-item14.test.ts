import { describe, it, expect, vi, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { GET as getGradesHandler } from "../src/app/api/grades/route";
import { GET as getPaymentsHandler } from "../src/app/api/center-payments/route";
import { GET as getGroupsHandler } from "../src/app/api/groups/route";
import { GET as getAttendanceHandler } from "../src/app/api/attendance/route";
import type { LearningCenter, PlatformUser, CenterMembership, Group, Lesson, Grade, CenterPayment, Attendance } from "@prisma/client";

interface MockTenantContext {
  center: LearningCenter;
  role: string;
  membership: CenterMembership;
  session: { user: PlatformUser };
}

let mockContext: MockTenantContext | null = null;

vi.mock("@/lib/tenant", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    requireTenantAccess: vi.fn(async () => {
      if (!mockContext) throw new Error("Unauthorized");
      return mockContext;
    }),
  };
});

describe("TRUST-2 Item 14: Center intra-permissions on real test.db", () => {
  let center: LearningCenter;
  let ownerUser: PlatformUser;
  let studentUserA: PlatformUser;
  let studentUserB: PlatformUser;
  let teacherUser1: PlatformUser;
  let teacherUser2: PlatformUser;
  let parentUser: PlatformUser;

  let memberStudentA: CenterMembership;
  let memberStudentB: CenterMembership;
  let memberTeacher1: CenterMembership;
  let memberTeacher2: CenterMembership;
  let memberParent: CenterMembership;

  let group1: Group;
  let group2: Group;
  let lesson1: Lesson;
  let gradeA: Grade;
  let gradeB: Grade;
  let paymentA: CenterPayment;
  let paymentB: CenterPayment;
  let attendanceA: Attendance;
  let attendanceB: Attendance;

  beforeAll(async () => {
    const ts = Date.now();
    ownerUser = await db.platformUser.create({
      data: { email: `owner14_${ts}@test.com`, passwordHash: "x", fullName: "Owner 14" },
    });

    center = await db.learningCenter.create({
      data: {
        name: "Intra Perms Center",
        slug: `intra-center-${ts}`,
        status: "ACTIVE",
        ownerId: ownerUser.id,
      },
    });

    studentUserA = await db.platformUser.create({
      data: { email: `studentA_${ts}@test.com`, passwordHash: "x", fullName: "Student A" },
    });
    studentUserB = await db.platformUser.create({
      data: { email: `studentB_${ts}@test.com`, passwordHash: "x", fullName: "Student B" },
    });
    teacherUser1 = await db.platformUser.create({
      data: { email: `teacher1_${ts}@test.com`, passwordHash: "x", fullName: "Teacher 1" },
    });
    teacherUser2 = await db.platformUser.create({
      data: { email: `teacher2_${ts}@test.com`, passwordHash: "x", fullName: "Teacher 2" },
    });
    parentUser = await db.platformUser.create({
      data: { email: `parent_${ts}@test.com`, passwordHash: "x", fullName: "Parent of A" },
    });

    memberStudentA = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUserA.id, role: "STUDENT" },
    });
    memberStudentB = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUserB.id, role: "STUDENT" },
    });
    memberTeacher1 = await db.centerMembership.create({
      data: { centerId: center.id, userId: teacherUser1.id, role: "TEACHER" },
    });
    memberTeacher2 = await db.centerMembership.create({
      data: { centerId: center.id, userId: teacherUser2.id, role: "TEACHER" },
    });
    memberParent = await db.centerMembership.create({
      data: { centerId: center.id, userId: parentUser.id, role: "PARENT" },
    });

    // Parent linked to Student A only
    await db.parentLink.create({
      data: {
        parentMembershipId: memberParent.id,
        studentMembershipId: memberStudentA.id,
        status: "CONFIRMED",
      },
    });

    const course = await db.course.create({
      data: { centerId: center.id, title: "Intra Course", createdByMembershipId: memberTeacher1.id },
    });
    const courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module 1" },
    });
    lesson1 = await db.lesson.create({
      data: {
        center: { connect: { id: center.id } },
        title: "Lesson 1",
        module: { connect: { id: courseModule.id } },
      },
    });

    group1 = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Group 1 (Teacher 1)",
        teacherMembershipId: memberTeacher1.id,
      },
    });

    group2 = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Group 2 (Teacher 2)",
        teacherMembershipId: memberTeacher2.id,
      },
    });

    // Grades
    gradeA = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: memberStudentA.id,
        teacherMembershipId: memberTeacher1.id,
        groupId: group1.id,
        value: 95,
        maxValue: 100,
        gradeType: "HOMEWORK",
      },
    });

    gradeB = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: memberStudentB.id,
        teacherMembershipId: memberTeacher2.id,
        groupId: group2.id,
        value: 80,
        maxValue: 100,
        gradeType: "HOMEWORK",
      },
    });

    // Payments
    paymentA = await db.centerPayment.create({
      data: {
        centerId: center.id,
        studentMembershipId: memberStudentA.id,
        groupId: group1.id,
        amount: 500,
      },
    });

    paymentB = await db.centerPayment.create({
      data: {
        centerId: center.id,
        studentMembershipId: memberStudentB.id,
        groupId: group2.id,
        amount: 700,
      },
    });

    // Attendance
    attendanceA = await db.attendance.create({
      data: {
        lessonId: lesson1.id,
        studentMembershipId: memberStudentA.id,
        markedByMembershipId: memberTeacher1.id,
        status: "PRESENT",
      },
    });

    attendanceB = await db.attendance.create({
      data: {
        lessonId: lesson1.id,
        studentMembershipId: memberStudentB.id,
        markedByMembershipId: memberTeacher2.id,
        status: "ABSENT",
      },
    });
  });

  it("Student A cannot see Student B's grades", async () => {
    mockContext = {
      center,
      role: "STUDENT",
      membership: memberStudentA,
      session: { user: studentUserA },
    };

    const res = await getGradesHandler(new Request("http://localhost:3000/api/grades"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { grades: Array<{ id: string }> };
    const ids = data.grades.map((g) => g.id);
    expect(ids).toContain(gradeA.id);
    expect(ids).not.toContain(gradeB.id);
  });

  it("Student A cannot see Student B's payments", async () => {
    mockContext = {
      center,
      role: "STUDENT",
      membership: memberStudentA,
      session: { user: studentUserA },
    };

    const res = await getPaymentsHandler(new Request("http://localhost:3000/api/center-payments"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { payments: Array<{ id: string }> };
    const ids = data.payments.map((p) => p.id);
    expect(ids).toContain(paymentA.id);
    expect(ids).not.toContain(paymentB.id);
  });

  it("Student A cannot see Student B's attendance", async () => {
    mockContext = {
      center,
      role: "STUDENT",
      membership: memberStudentA,
      session: { user: studentUserA },
    };

    const res = await getAttendanceHandler(
      new Request(`http://localhost:3000/api/attendance?lessonId=${lesson1.id}`)
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { attendances: Array<{ studentMembershipId: string }> };
    const studentIds = data.attendances.map((a) => a.studentMembershipId);
    expect(studentIds).toContain(memberStudentA.id);
    expect(studentIds).not.toContain(memberStudentB.id);
  });

  it("Teacher 1 sees only Teacher 1's groups, not Teacher 2's group", async () => {
    mockContext = {
      center,
      role: "TEACHER",
      membership: memberTeacher1,
      session: { user: teacherUser1 },
    };

    const res = await getGroupsHandler(new Request("http://localhost:3000/api/groups"));
    expect(res.status).toBe(200);
    const data = (await res.json()) as { groups: Array<{ id: string }> };
    const groupIds = data.groups.map((g) => g.id);
    expect(groupIds).toContain(group1.id);
    expect(groupIds).not.toContain(group2.id);
  });

  it("Parent of A sees only Student A's grades and payments, not Student B's", async () => {
    mockContext = {
      center,
      role: "PARENT",
      membership: memberParent,
      session: { user: parentUser },
    };

    const resGrades = await getGradesHandler(new Request("http://localhost:3000/api/grades"));
    expect(resGrades.status).toBe(200);
    const gradesData = (await resGrades.json()) as { grades: Array<{ id: string }> };
    const gradeIds = gradesData.grades.map((g) => g.id);
    expect(gradeIds).toContain(gradeA.id);
    expect(gradeIds).not.toContain(gradeB.id);

    const resPayments = await getPaymentsHandler(new Request("http://localhost:3000/api/center-payments"));
    expect(resPayments.status).toBe(200);
    const paymentsData = (await resPayments.json()) as { payments: Array<{ id: string }> };
    const paymentIds = paymentsData.payments.map((p) => p.id);
    expect(paymentIds).toContain(paymentA.id);
    expect(paymentIds).not.toContain(paymentB.id);

    const resAttendance = await getAttendanceHandler(
      new Request(`http://localhost:3000/api/attendance?lessonId=${lesson1.id}`)
    );
    expect(resAttendance.status).toBe(200);
    const attendanceData = (await resAttendance.json()) as { attendances: Array<{ studentMembershipId: string }> };
    const attendanceStudentIds = attendanceData.attendances.map((a) => a.studentMembershipId);
    expect(attendanceStudentIds).toContain(memberStudentA.id);
    expect(attendanceStudentIds).not.toContain(memberStudentB.id);
  });
});
