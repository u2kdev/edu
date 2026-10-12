import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import type { LearningCenter, PlatformUser, CenterMembership, Course, CourseModule, Lesson, Group, Grade, Attendance, InviteCode, Announcement } from "@prisma/client";

describe("TRUST-3 Item 3: onDelete Restrict for creator/teacher associations", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let teacherUser: PlatformUser;
  let studentUser: PlatformUser;

  let ownerMember: CenterMembership;
  let teacherMember: CenterMembership;
  let studentMember: CenterMembership;

  let course: Course;
  let courseModule: CourseModule;
  let lesson: Lesson;
  let group: Group;
  let grade: Grade;
  let attendance: Attendance;
  let inviteCode: InviteCode;
  let announcement: Announcement;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_del_${ts}@test.com`, passwordHash: "x", fullName: "Owner Del" },
    });
    teacherUser = await db.platformUser.create({
      data: { email: `teacher_del_${ts}@test.com`, passwordHash: "x", fullName: "Teacher Del" },
    });
    studentUser = await db.platformUser.create({
      data: { email: `student_del_${ts}@test.com`, passwordHash: "x", fullName: "Student Del" },
    });

    center = await db.learningCenter.create({
      data: {
        name: "Delete Restrict Center",
        slug: `del-center-${ts}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });

    ownerMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: owner.id, role: "DIRECTOR" },
    });
    teacherMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: teacherUser.id, role: "TEACHER" },
    });
    studentMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUser.id, role: "STUDENT" },
    });

    // Course created by teacher
    course = await db.course.create({
      data: {
        centerId: center.id,
        title: "Teacher Course",
        createdByMembershipId: teacherMember.id,
      },
    });

    courseModule = await db.courseModule.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        title: "Module 1",
      },
    });

    lesson = await db.lesson.create({
      data: {
        centerId: center.id,
        moduleId: courseModule.id,
        title: "Lesson 1",
      },
    });

    group = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Teacher Group",
        teacherMembershipId: teacherMember.id,
      },
    });

    grade = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: studentMember.id,
        teacherMembershipId: teacherMember.id,
        value: 95,
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

    inviteCode = await db.inviteCode.create({
      data: {
        centerId: center.id,
        code: `INV-${ts}`,
        createdByMembershipId: teacherMember.id,
      },
    });

    announcement = await db.announcement.create({
      data: {
        centerId: center.id,
        authorId: teacherMember.id,
        title: "Announcement 1",
        body: "Body",
      },
    });
  });

  afterAll(async () => {
    // Teardown in strict dependency order:
    await db.announcement.deleteMany({ where: { centerId: center.id } });
    await db.inviteCode.deleteMany({ where: { centerId: center.id } });
    await db.attendance.deleteMany({ where: { lessonId: lesson.id } });
    await db.grade.deleteMany({ where: { centerId: center.id } });
    await db.group.deleteMany({ where: { centerId: center.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({
      where: { id: { in: [owner.id, teacherUser.id, studentUser.id] } },
    });
  });

  it("deleting teacher membership fails with Restrict (P2003) when courses/grades/attendance exist", async () => {
    let caughtError: unknown = null;
    try {
      await db.centerMembership.delete({
        where: { id: teacherMember.id },
      });
    } catch (e: unknown) {
      caughtError = e;
    }
    expect(caughtError).not.toBeNull();

    // Verify entities are still intact and not cascade-deleted
    const checkGrade = await db.grade.findUnique({ where: { id: grade.id } });
    expect(checkGrade).not.toBeNull();

    const checkAttendance = await db.attendance.findUnique({ where: { id: attendance.id } });
    expect(checkAttendance).not.toBeNull();

    const checkCourse = await db.course.findUnique({ where: { id: course.id } });
    expect(checkCourse).not.toBeNull();
  });
});
