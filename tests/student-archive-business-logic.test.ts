import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { checkSubscriptionLimit } from "../src/lib/limits";
import type {
  LearningCenter,
  PlatformUser,
  Course,
  CourseModule,
  Lesson,
  Group,
  CenterMembership,
  SubscriptionPlan,
  Subscription,
} from "@prisma/client";
import { GET as getGroups } from "../src/app/api/groups/route";
import { POST as bulkAttendance } from "../src/app/api/attendance/bulk/route";
import { POST as createAttendance } from "../src/app/api/attendance/route";
import { POST as switchTenant } from "../src/app/api/auth/switch-tenant/route";
import { GET as getGrades } from "../src/app/api/grades/route";
import { DELETE as deleteStaffMember } from "../src/app/api/tenant/staff/route";

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

describe("TRUST-3d Item 4: Student archiving, exclusion from enrollments/schedule/attendance/limits, inactive login block, and 409 deletion", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let teacherUser: PlatformUser;
  let studentUser1: PlatformUser;
  let studentUser2: PlatformUser;

  let ownerMember: CenterMembership;
  let teacherMember: CenterMembership;
  let studentMember1: CenterMembership;
  let studentMember2: CenterMembership;

  let plan: SubscriptionPlan;
  let subscription: Subscription;
  let course: Course;
  let courseModule: CourseModule;
  let lesson: Lesson;
  let group: Group;

  let ownerToken: string;
  let student1Token: string;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_arc_${ts}@test.com`, passwordHash: "x", fullName: "Owner Archive", emailVerified: new Date() },
    });
    teacherUser = await db.platformUser.create({
      data: { email: `teacher_arc_${ts}@test.com`, passwordHash: "x", fullName: "Teacher Archive", emailVerified: new Date() },
    });
    studentUser1 = await db.platformUser.create({
      data: { email: `student1_arc_${ts}@test.com`, passwordHash: "x", fullName: "Student One Active", emailVerified: new Date() },
    });
    studentUser2 = await db.platformUser.create({
      data: { email: `student2_arc_${ts}@test.com`, passwordHash: "x", fullName: "Student Two Archived", emailVerified: new Date() },
    });

    center = await db.learningCenter.create({
      data: { name: "Archive Test Center", slug: `arc-center-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    // Plan with maxStudents = 1 to test subscription limit exclusion
    plan = await db.subscriptionPlan.create({
      data: {
        name: `Archive Limit Plan ${ts}`,
        priceMonthly: 10,
        maxStudents: 1,
        maxTeachers: 5,
        maxCourses: 5,
        maxBranches: 2,
      },
    });

    subscription = await db.subscription.create({
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
    teacherMember = await db.centerMembership.create({
      data: { userId: teacherUser.id, centerId: center.id, role: "TEACHER", status: "ACTIVE" },
    });
    studentMember1 = await db.centerMembership.create({
      data: { userId: studentUser1.id, centerId: center.id, role: "STUDENT", status: "ACTIVE" },
    });
    // studentMember2 starts as ARCHIVED
    studentMember2 = await db.centerMembership.create({
      data: { userId: studentUser2.id, centerId: center.id, role: "STUDENT", status: "ARCHIVED" },
    });

    course = await db.course.create({
      data: { centerId: center.id, title: "Course Archive", createdByMembershipId: ownerMember.id },
    });
    courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module Archive" },
    });
    lesson = await db.lesson.create({
      data: { centerId: center.id, moduleId: courseModule.id, title: "Lesson Archive" },
    });

    group = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Group Archive",
        teacherMembershipId: teacherMember.id,
      },
    });

    // Enroll both students in group
    await db.enrollment.create({
      data: {
        centerId: center.id,
        groupId: group.id,
        studentMembershipId: studentMember1.id,
        status: "ACTIVE",
      },
    });
    await db.enrollment.create({
      data: {
        centerId: center.id,
        groupId: group.id,
        studentMembershipId: studentMember2.id,
        status: "ACTIVE",
      },
    });

    // Create payment and attendance for studentMember2 to make it non-deletable (P2003 Restrict)
    await db.centerPayment.create({
      data: {
        centerId: center.id,
        studentMembershipId: studentMember2.id,
        amount: 100,
        status: "PAID",
      },
    });
    await db.attendance.create({
      data: {
        lessonId: lesson.id,
        studentMembershipId: studentMember2.id,
        markedByMembershipId: teacherMember.id,
        status: "PRESENT",
      },
    });

    ownerToken = signJWT({
      userId: owner.id,
      email: owner.email,
      platformRole: "NONE",
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });

    student1Token = signJWT({
      userId: studentUser1.id,
      email: studentUser1.email,
      platformRole: "NONE",
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
    });
  });

  afterAll(async () => {
    await db.attendance.deleteMany({ where: { lessonId: lesson.id } });
    await db.grade.deleteMany({ where: { centerId: center.id } });
    await db.centerPayment.deleteMany({ where: { centerId: center.id } });
    await db.enrollment.deleteMany({ where: { centerId: center.id } });
    await db.group.deleteMany({ where: { centerId: center.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { id: plan.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({
      where: { id: { in: [owner.id, teacherUser.id, studentUser1.id, studentUser2.id] } },
    });
  });

  it("1. checkSubscriptionLimit ignores ARCHIVED students in count", async () => {
    // Current setup: plan.maxStudents = 1.
    // 1 ACTIVE student (studentMember1) and 1 ARCHIVED student (studentMember2).
    // Total students = 2, but ACTIVE students = 1.
    // If incrementAmount = 0: currentCount (1 active) <= plan.maxStudents (1) -> true.
    const canKeepCurrent = await checkSubscriptionLimit(center.id, "students", 0);
    expect(canKeepCurrent).toBe(true);

    // If we try to add +1 new student: 1 + 1 = 2 > 1 -> false.
    const canAddOneMore = await checkSubscriptionLimit(center.id, "students", 1);
    expect(canAddOneMore).toBe(false);

    // If studentMember1 is also ARCHIVED: activeCount = 0 <= 1 -> can add +1
    await db.centerMembership.update({
      where: { id: studentMember1.id },
      data: { status: "ARCHIVED" },
    });
    const canAddAfterArchivingBoth = await checkSubscriptionLimit(center.id, "students", 1);
    expect(canAddAfterArchivingBoth).toBe(true);

    // Restore studentMember1 to ACTIVE
    await db.centerMembership.update({
      where: { id: studentMember1.id },
      data: { status: "ACTIVE" },
    });
  });

  it("2. GET /api/groups excludes ARCHIVED students from group enrollments list", async () => {
    mockToken = ownerToken;
    const req = new Request(`http://localhost/api/groups?centerId=${center.id}`, {
      method: "GET",
    });
    const res = await getGroups(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { groups: Array<{ id: string; enrollments: Array<{ student: { id: string } }> }> };
    const targetGroup = body.groups.find((g) => g.id === group.id);
    expect(targetGroup).toBeDefined();

    // Group should only contain active student1, NOT archived student2
    const enrolledStudentIds = targetGroup!.enrollments.map((e) => e.student.id);
    expect(enrolledStudentIds).toContain(studentMember1.id);
    expect(enrolledStudentIds).not.toContain(studentMember2.id);
  });

  it("3. POST /api/attendance/bulk only marks attendance for ACTIVE students and skips ARCHIVED", async () => {
    mockToken = ownerToken;
    const req = new Request(`http://localhost/api/attendance/bulk?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: lesson.id,
        groupId: group.id,
        defaultStatus: "LATE",
      }),
    });
    const res = await bulkAttendance(req);
    expect(res.status).toBe(200);

    // Check attendance records created for this lesson
    const student1Attendance = await db.attendance.findFirst({
      where: { lessonId: lesson.id, studentMembershipId: studentMember1.id },
    });
    expect(student1Attendance).not.toBeNull();
    expect(student1Attendance?.status).toBe("LATE");

    // student2 was already marked PRESENT in beforeAll, verify bulk did NOT overwrite it
    // because bulkAttendance must only select ACTIVE students
    const student2Attendance = await db.attendance.findFirst({
      where: { lessonId: lesson.id, studentMembershipId: studentMember2.id },
    });
    expect(student2Attendance?.status).toBe("PRESENT");
  });

  it("4. POST /api/attendance rejects marking attendance directly for ARCHIVED student with 400", async () => {
    mockToken = ownerToken;
    const req = new Request(`http://localhost/api/attendance?centerId=${center.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: lesson.id,
        records: [
          { studentMembershipId: studentMember2.id, status: "ABSENT" },
        ],
      }),
    });
    const res = await createAttendance(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: string };
    expect(body.error?.toLowerCase()).toContain("archived");
  });

  it("5. requireTenantAccess and switch-tenant reject ARCHIVED student with MEMBERSHIP_INACTIVE (403)", async () => {
    // Generate token for archived student2
    const archivedToken = signJWT({
      userId: studentUser2.id,
      email: studentUser2.email,
      platformRole: "NONE",
      activeCenterId: center.id,
      activeCenterRole: "STUDENT",
    });

    // Direct tenant access to /api/grades
    mockToken = archivedToken;
    const reqGrades = new Request(`http://localhost/api/grades?centerId=${center.id}`, {
      method: "GET",
    });
    const resGrades = await getGrades(reqGrades);
    expect(resGrades.status).toBe(403);
    const gradesBody = (await resGrades.json()) as { error?: string; code?: string };
    expect(gradesBody.code).toBe("MEMBERSHIP_INACTIVE");

    // Switch tenant attempt
    const reqSwitch = new Request(`http://localhost/api/auth/switch-tenant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId: center.id }),
    });
    const resSwitch = await switchTenant(reqSwitch);
    expect(resSwitch.status).toBe(403);
    const switchBody = (await resSwitch.json()) as { error?: string; code?: string };
    expect(switchBody.code).toBe("MEMBERSHIP_INACTIVE");
  });

  it("6. DELETE /api/tenant/staff returns clean 409 with hint 'архивировать' when student has records", async () => {
    mockToken = ownerToken;
    const req = new Request(`http://localhost/api/tenant/staff?centerId=${center.id}&membershipId=${studentMember2.id}`, {
      method: "DELETE",
    });
    const res = await deleteStaffMember(req);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error?: string; hint?: string };
    expect(body.hint).toBe("архивировать");
    expect(body.error).toContain("Невозможно удалить студента с существующими записями");
  });

  it("7. DELETE /api/tenant/staff successfully deletes student when they have NO business records", async () => {
    // Create temporary clean student
    const cleanUser = await db.platformUser.create({
      data: { email: `clean_student_${Date.now()}@test.com`, passwordHash: "x", fullName: "Clean Student" },
    });
    const cleanMember = await db.centerMembership.create({
      data: { userId: cleanUser.id, centerId: center.id, role: "STUDENT", status: "ACTIVE" },
    });

    mockToken = ownerToken;
    const req = new Request(`http://localhost/api/tenant/staff?centerId=${center.id}&membershipId=${cleanMember.id}`, {
      method: "DELETE",
    });
    const res = await deleteStaffMember(req);
    expect(res.status).toBe(200);

    const deleted = await db.centerMembership.findUnique({ where: { id: cleanMember.id } });
    expect(deleted).toBeNull();

    await db.platformUser.delete({ where: { id: cleanUser.id } });
  });
});
