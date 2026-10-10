import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import type { LearningCenter, PlatformUser, Course, CourseModule, Lesson, CenterMembership, CenterPayment, Grade, Attendance } from "@prisma/client";
import { PATCH as updateStaff } from "../src/app/api/tenant/staff/route";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-3c Item 5: Student deletion Restrict constraint and ARCHIVED status", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let studentUser: PlatformUser;
  let teacherUser: PlatformUser;

  let ownerMember: CenterMembership;
  let studentMember: CenterMembership;
  let teacherMember: CenterMembership;

  let course: Course;
  let courseModule: CourseModule;
  let lesson: Lesson;
  let payment: CenterPayment;
  let grade: Grade;
  let attendance: Attendance;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_sar_${ts}@test.com`, passwordHash: "x", fullName: "Owner SAR", emailVerified: new Date() },
    });
    studentUser = await db.platformUser.create({
      data: { email: `student_sar_${ts}@test.com`, passwordHash: "x", fullName: "Student SAR", emailVerified: new Date() },
    });
    teacherUser = await db.platformUser.create({
      data: { email: `teacher_sar_${ts}@test.com`, passwordHash: "x", fullName: "Teacher SAR", emailVerified: new Date() },
    });

    center = await db.learningCenter.create({
      data: { name: "Archive Restrict Center", slug: `sar-center-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `SAR Plan ${ts}`,
        priceMonthly: 10,
        maxStudents: 100,
        maxTeachers: 50,
        maxCourses: 50,
        maxBranches: 10,
      },
    });

    await db.subscription.create({
      data: {
        centerId: center.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    ownerMember = await db.centerMembership.create({
      data: { userId: owner.id, centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    studentMember = await db.centerMembership.create({
      data: { userId: studentUser.id, centerId: center.id, role: "STUDENT", status: "ACTIVE" },
    });
    teacherMember = await db.centerMembership.create({
      data: { userId: teacherUser.id, centerId: center.id, role: "TEACHER", status: "ACTIVE" },
    });

    course = await db.course.create({
      data: { centerId: center.id, title: "Course SAR", createdByMembershipId: ownerMember.id },
    });
    courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module SAR" },
    });
    lesson = await db.lesson.create({
      data: { centerId: center.id, moduleId: courseModule.id, title: "Lesson SAR" },
    });

    payment = await db.centerPayment.create({
      data: {
        centerId: center.id,
        studentMembershipId: studentMember.id,
        amount: 250,
        status: "PAID",
      },
    });

    grade = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: studentMember.id,
        teacherMembershipId: teacherMember.id,
        value: 90,
      },
    });

    attendance = await db.attendance.create({
      data: {
        lessonId: lesson.id,
        studentMembershipId: studentMember.id,
        markedByMembershipId: teacherMember.id,
        status: "PRESENT",
      },
    });

    mockToken = signJWT({
      userId: owner.id,
      email: owner.email,
      platformRole: "NONE",
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });
  });

  afterAll(async () => {
    await db.attendance.deleteMany({ where: { lessonId: lesson.id } });
    await db.grade.deleteMany({ where: { centerId: center.id } });
    await db.centerPayment.deleteMany({ where: { centerId: center.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { contains: "SAR Plan" } } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({
      where: { id: { in: [owner.id, studentUser.id, teacherUser.id] } },
    });
  });

  it("deleting student with existing payments, grades, or attendance is rejected with Restrict constraint (P2003)", async () => {
    let caughtError: unknown = null;
    try {
      await db.centerMembership.delete({
        where: { id: studentMember.id },
      });
    } catch (e: unknown) {
      caughtError = e;
    }

    // Must be rejected by foreign key Restrict constraint
    expect(caughtError).not.toBeNull();
    const errorStr = String(caughtError);
    expect(errorStr.includes("P2003") || errorStr.includes("23001") || errorStr.includes("RESTRICT")).toBe(true);

    // Verify all history records are preserved intact
    const checkPayment = await db.centerPayment.findUnique({ where: { id: payment.id } });
    expect(checkPayment).not.toBeNull();

    const checkGrade = await db.grade.findUnique({ where: { id: grade.id } });
    expect(checkGrade).not.toBeNull();

    const checkAttendance = await db.attendance.findUnique({ where: { id: attendance.id } });
    expect(checkAttendance).not.toBeNull();
  });

  it("archiving student sets status to ARCHIVED and preserves all educational and financial history", async () => {
    const req = new Request(`http://localhost/api/tenant/staff?centerId=${center.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        membershipId: studentMember.id,
        status: "ARCHIVED",
      }),
    });

    const res = await updateStaff(req);
    expect(res.status).toBe(200);

    const updated = await db.centerMembership.findUnique({ where: { id: studentMember.id } });
    expect(updated?.status).toBe("ARCHIVED");

    // History is completely intact
    const checkPayment = await db.centerPayment.findUnique({ where: { id: payment.id } });
    expect(checkPayment?.amount).toBe(250);

    const checkGrade = await db.grade.findUnique({ where: { id: grade.id } });
    expect(checkGrade?.value).toBe(90);

    const checkAttendance = await db.attendance.findUnique({ where: { id: attendance.id } });
    expect(checkAttendance?.status).toBe("PRESENT");
  });
});
