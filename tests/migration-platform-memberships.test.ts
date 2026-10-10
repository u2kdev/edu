import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import type { LearningCenter, PlatformUser, CenterMembership, Group } from "@prisma/client";
import fs from "fs";
import path from "path";

describe("TRUST-3c Item 2: Migration deletes platform CenterMemberships and transfers references to SetNull", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let impersonatedAdmin: PlatformUser;
  let platformTeacher: PlatformUser;
  let studentUser: PlatformUser;
  let normalTeacher: PlatformUser;

  let ownerMember: CenterMembership;
  let impersonatedAdminMember: CenterMembership;
  let platformTeacherMember: CenterMembership;
  let studentMember: CenterMembership;
  let normalTeacherMember: CenterMembership;

  let groupWithPlatformTeacher: Group;
  let groupWithNormalTeacher: Group;
  let gradeWithPlatformTeacher: { id: string };
  let attendanceWithPlatformTeacher: { id: string };

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_mig_${ts}@test.com`, passwordHash: "x", fullName: "Owner Mig" },
    });
    impersonatedAdmin = await db.platformUser.create({
      data: { email: `imp_mig_${ts}@test.com`, passwordHash: "x", fullName: "Impersonated Admin Mig", platformRole: "SUPERADMIN" },
    });
    platformTeacher = await db.platformUser.create({
      data: { email: `plat_teacher_${ts}@test.com`, passwordHash: "x", fullName: "Platform Teacher Mig", platformRole: "DEVELOPER" },
    });
    studentUser = await db.platformUser.create({
      data: { email: `student_mig_${ts}@test.com`, passwordHash: "x", fullName: "Student Mig", platformRole: "NONE" },
    });
    normalTeacher = await db.platformUser.create({
      data: { email: `teacher_mig_${ts}@test.com`, passwordHash: "x", fullName: "Normal Teacher Mig", platformRole: "NONE" },
    });

    center = await db.learningCenter.create({
      data: { name: "Migration Test Center", slug: `mig-center-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    ownerMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: owner.id, role: "DIRECTOR" },
    });
    impersonatedAdminMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: impersonatedAdmin.id, role: "DIRECTOR" },
    });
    platformTeacherMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: platformTeacher.id, role: "TEACHER" },
    });
    studentMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUser.id, role: "STUDENT" },
    });
    normalTeacherMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: normalTeacher.id, role: "TEACHER" },
    });

    const course = await db.course.create({
      data: { centerId: center.id, title: "Course Mig", createdByMembershipId: ownerMember.id },
    });

    // Group assigned to platformTeacher
    groupWithPlatformTeacher = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Platform Teacher Group",
        teacherMembershipId: platformTeacherMember.id,
      },
    });

    // Group assigned to normal teacher
    groupWithNormalTeacher = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Normal Group",
        teacherMembershipId: normalTeacherMember.id,
      },
    });

    const courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module 1" },
    });

    // Lesson
    const lesson = await db.lesson.create({
      data: {
        centerId: center.id,
        moduleId: courseModule.id,
        title: "Lesson 1",
      },
    });

    // Attendance marked by platformTeacher
    attendanceWithPlatformTeacher = await db.attendance.create({
      data: {
        lessonId: lesson.id,
        studentMembershipId: studentMember.id,
        groupId: groupWithPlatformTeacher.id,
        markedByMembershipId: platformTeacherMember.id,
        status: "PRESENT",
      },
    });

    // Grade given by platformTeacher
    gradeWithPlatformTeacher = await db.grade.create({
      data: {
        centerId: center.id,
        studentMembershipId: studentMember.id,
        groupId: groupWithPlatformTeacher.id,
        teacherMembershipId: platformTeacherMember.id,
        value: 95,
        gradeType: "HOMEWORK",
      },
    });
  });

  afterAll(async () => {
    await db.grade.deleteMany({ where: { centerId: center.id } });
    await db.attendance.deleteMany({ where: { groupId: groupWithPlatformTeacher.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.group.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({
      where: {
        id: {
          in: [owner.id, impersonatedAdmin.id, platformTeacher.id, studentUser.id, normalTeacher.id],
        },
      },
    });
  });

  it("data before migration: impersonated admin has membership, platform teacher has real grades and attendance", async () => {
    const impMember = await db.centerMembership.findUnique({ where: { id: impersonatedAdminMember.id } });
    expect(impMember).not.toBeNull();

    const ptMember = await db.centerMembership.findUnique({ where: { id: platformTeacherMember.id } });
    expect(ptMember).not.toBeNull();

    const group = await db.group.findUnique({ where: { id: groupWithPlatformTeacher.id } });
    expect(group?.teacherMembershipId).toBe(platformTeacherMember.id);
  });

  it("executing migration SQL: removes empty impersonation memberships, preserves platform teacher with real data and references", async () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "prisma/migrations/20261009192930_remove_platform_memberships/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Execute migration statements
    const cleanSql = sql.replace(/--.*$/gm, "").trim();
    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
    }

    // 1. impersonatedAdmin membership (no data) is DELETED
    const impMemberAfter = await db.centerMembership.findUnique({ where: { id: impersonatedAdminMember.id } });
    expect(impMemberAfter).toBeNull();

    // 2. platformTeacher membership (has real data) is PRESERVED
    const ptMemberAfter = await db.centerMembership.findUnique({ where: { id: platformTeacherMember.id } });
    expect(ptMemberAfter).not.toBeNull();
    expect(ptMemberAfter?.role).toBe("TEACHER");

    // 3. groupWithPlatformTeacher retains platformTeacher (NOT set to null)
    const ptGroupAfter = await db.group.findUnique({ where: { id: groupWithPlatformTeacher.id } });
    expect(ptGroupAfter?.teacherMembershipId).toBe(platformTeacherMember.id);

    // 4. grade and attendance retain platformTeacher
    const gradeAfter = await db.grade.findUnique({ where: { id: gradeWithPlatformTeacher.id } });
    expect(gradeAfter?.teacherMembershipId).toBe(platformTeacherMember.id);

    const attAfter = await db.attendance.findUnique({ where: { id: attendanceWithPlatformTeacher.id } });
    expect(attAfter?.markedByMembershipId).toBe(platformTeacherMember.id);

    // 5. normal teacher data is UNTOUCHED
    const normalMemberAfter = await db.centerMembership.findUnique({ where: { id: normalTeacherMember.id } });
    expect(normalMemberAfter).not.toBeNull();

    const normalGroupAfter = await db.group.findUnique({ where: { id: groupWithNormalTeacher.id } });
    expect(normalGroupAfter?.teacherMembershipId).toBe(normalTeacherMember.id);
  });
});
