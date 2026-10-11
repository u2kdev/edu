import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";

import { POST as createCourse, GET as getCourses } from "../src/app/api/courses/route";
import { POST as createGroup } from "../src/app/api/groups/route";
import { POST as createModule } from "../src/app/api/modules/route";
import { POST as createLesson } from "../src/app/api/lessons/route";
import { POST as createScheduleSlot, GET as getSchedule } from "../src/app/api/tenant/schedule/route";
import { POST as generateInvite } from "../src/app/api/invites/generate/route";
import { POST as redeemInvite } from "../src/app/api/invites/redeem/route";
import { POST as markAttendance } from "../src/app/api/attendance/route";
import { POST as createGrade, GET as getGrades } from "../src/app/api/grades/route";
import { POST as handleParentLink } from "../src/app/api/invites/parent-link/route";
import { POST as suspendCenter } from "../src/app/api/platform/centers/[id]/suspend/route";

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

const mockRequest = (url: string, method: "GET" | "POST", body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("End-to-End Demo Journey (Director, Teacher, Student, Parent, Platform Owner)", () => {
  let platformOwnerId: string;
  let centerId: string;
  let directorId: string;
  let directorMembershipId: string;
  let teacherId: string;
  let teacherMembershipId: string;
  let studentId: string;
  let studentMembershipId: string;
  let parentId: string;
  let parentMembershipId: string;
  let courseId: string;
  let moduleId: string;
  let lessonId: string;
  let groupId: string;
  let studentInviteCode: string;

  beforeAll(async () => {
    const defaultPassword = "Password123!";
    const passwordHash = await hashPassword(defaultPassword);
    const now = new Date();

    // 1. Platform Superadmin
    const po = await db.platformUser.create({
      data: {
        email: `po-${Date.now()}@e2e-demo.com`,
        passwordHash,
        fullName: "Platform Owner",
        platformRole: "SUPERADMIN",
        emailVerified: now,
      },
    });
    platformOwnerId = po.id;

    // 2. Subscription Plan
    const plan = await db.subscriptionPlan.upsert({
      where: { id: "plan-pro" },
      update: {},
      create: {
        id: "plan-pro",
        name: "Профессиональный",
        priceMonthly: 7900,
        maxStudents: 50,
        maxTeachers: 10,
        maxCourses: 20,
      },
    });

    // 3. Director
    const directorUser = await db.platformUser.create({
      data: {
        email: `director-${Date.now()}@e2e-demo.com`,
        passwordHash,
        fullName: "Alisher Director",
        emailVerified: now,
      },
    });
    directorId = directorUser.id;

    // 4. Center
    const center = await db.learningCenter.create({
      data: {
        name: "E2E Demo Center",
        slug: `e2e-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: directorId,
      },
    });
    centerId = center.id;

    // Subscription for center
    await db.subscription.create({
      data: {
        centerId: center.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: now,
        currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      },
    });

    // Director Membership
    const dMem = await db.centerMembership.create({
      data: {
        userId: directorId,
        centerId: center.id,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorMembershipId = dMem.id;

    // 5. Teacher
    const teacherUser = await db.platformUser.create({
      data: {
        email: `teacher-${Date.now()}@e2e-demo.com`,
        passwordHash,
        fullName: "Anvar Teacher",
        emailVerified: now,
      },
    });
    teacherId = teacherUser.id;

    const tMem = await db.centerMembership.create({
      data: {
        userId: teacherId,
        centerId: center.id,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMembershipId = tMem.id;

    // 6. Parent
    const parentUser = await db.platformUser.create({
      data: {
        email: `parent-${Date.now()}@e2e-demo.com`,
        passwordHash,
        fullName: "Parent User",
        emailVerified: now,
      },
    });
    parentId = parentUser.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.grade.deleteMany({ where: { centerId } });
      await db.attendance.deleteMany({ where: { lesson: { centerId } } });
      await db.lesson.deleteMany({ where: { centerId } });
      await db.courseModule.deleteMany({ where: { centerId } });
      await db.scheduleSlot.deleteMany({ where: { centerId } });
      await db.enrollment.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.inviteCode.deleteMany({ where: { centerId } });
      await db.parentLink.deleteMany({ where: { parent: { centerId } } });
      await db.course.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.subscription.deleteMany({ where: { centerId } });
      await db.learningCenter.delete({ where: { id: centerId } });
    }
    if (platformOwnerId) await db.platformUser.delete({ where: { id: platformOwnerId } });
    if (directorId) await db.platformUser.delete({ where: { id: directorId } });
    if (teacherId) await db.platformUser.delete({ where: { id: teacherId } });
    if (studentId) await db.platformUser.delete({ where: { id: studentId } });
    if (parentId) await db.platformUser.delete({ where: { id: parentId } });
  });

  const setAuth = (userId: string, platformRole: string, activeCenterId?: string, activeCenterRole?: string) => {
    mockToken = signJWT({ userId, email: "user@demo.com", platformRole, activeCenterId, activeCenterRole });
  };

  it("1. Director creates a course", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const req = mockRequest("/api/courses", "POST", {
      title: "Fullstack Web Development",
      description: "Learn Next.js and Prisma from scratch",
      priceMonthly: 600000,
    });

    const res = await createCourse(req);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.course.id).toBeDefined();
    expect(data.course.title).toBe("Fullstack Web Development");
    courseId = data.course.id;
  });

  it("2. Director creates a group and schedule slot for the course", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");

    // Group
    const grpReq = mockRequest("/api/groups", "POST", {
      name: "Group FS-2026",
      courseId,
      maxStudents: 15,
      teacherMembershipId,
    });
    const grpRes = await createGroup(grpReq);
    const grpData = await grpRes.json();
    expect(grpRes.status).toBe(200);
    expect(grpData.group.id).toBeDefined();
    groupId = grpData.group.id;

    // Schedule slot
    const slotReq = mockRequest("/api/tenant/schedule", "POST", {
      groupId,
      teacherMembershipId,
      dayOfWeek: 1, // Monday
      startTime: "10:00",
      endTime: "11:30",
    });
    const slotRes = await createScheduleSlot(slotReq);
    const slotData = await slotRes.json();
    expect(slotRes.status).toBe(200);
    expect(slotData.slot.id).toBeDefined();
  });

  it("3. Director generates invite code and adds a student", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");

    const invReq = mockRequest("/api/invites/generate", "POST", {
      targetRole: "STUDENT",
      courseId,
      groupId,
      maxUses: 1,
    });
    const invRes = await generateInvite(invReq);
    const invData = await invRes.json();
    expect(invRes.status).toBe(200);
    studentInviteCode = invData.invite.code;

    // Student redeems invite
    const studentEmail = `student-${Date.now()}@e2e-demo.com`;
    mockToken = "";
    const redeemReq = mockRequest("/api/invites/redeem", "POST", {
      code: studentInviteCode,
      email: studentEmail,
      fullName: "Jasurbek Student",
      password: "Password123!",
    });
    const redeemRes = await redeemInvite(redeemReq);
    const redeemData = await redeemRes.json();
    expect(redeemRes.status).toBe(200);
    expect(redeemData.success).toBe(true);

    const sUser = await db.platformUser.findUnique({ where: { email: studentEmail } });
    expect(sUser).toBeDefined();
    studentId = sUser!.id;

    // Mark student as verified
    await db.platformUser.update({ where: { id: studentId }, data: { emailVerified: new Date() } });

    const sMem = await db.centerMembership.findFirst({
      where: { userId: studentId, centerId, role: "STUDENT" },
    });
    expect(sMem).toBeDefined();
    studentMembershipId = sMem!.id;

    // Verify student is enrolled in group
    const enrollment = await db.enrollment.findFirst({
      where: { studentMembershipId, groupId },
    });
    expect(enrollment).toBeDefined();
  });

  it("4. Teacher marks attendance and assigns a grade to the student", async () => {
    setAuth(teacherId, "NONE", centerId, "TEACHER");

    // Create module and lesson first
    const modReq = mockRequest("/api/modules", "POST", {
      courseId,
      title: "Module 1: React Fundamentals",
    });
    const modRes = await createModule(modReq);
    const modData = await modRes.json();
    expect(modRes.status).toBe(200);
    moduleId = modData.module.id;

    const lessonReq = mockRequest("/api/lessons", "POST", {
      moduleId,
      title: "Lesson 1: Components and State",
      lessonType: "OFFLINE",
      durationMinutes: 90,
      scheduledAt: new Date().toISOString(),
    });
    const lessonRes = await createLesson(lessonReq);
    const lessonData = await lessonRes.json();
    expect(lessonRes.status).toBe(200);
    lessonId = lessonData.lesson.id;

    // Mark attendance
    const attReq = mockRequest("/api/attendance", "POST", {
      lessonId,
      records: [
        {
          studentMembershipId,
          status: "PRESENT",
          note: "Active participation",
        },
      ],
    });
    const attRes = await markAttendance(attReq);
    const attData = await attRes.json();
    expect(attRes.status).toBe(200);
    expect(attData.success).toBe(true);

    // Assign grade
    const gradeReq = mockRequest("/api/grades", "POST", {
      studentMembershipId,
      groupId,
      lessonId,
      gradeType: "HOMEWORK",
      value: 95,
      comment: "A'lo darajada topshirildi",
    });
    const gradeRes = await createGrade(gradeReq);
    const gradeData = await gradeRes.json();
    expect(gradeRes.status).toBe(200);
    expect(gradeData.grade.value).toBe(95);
  });

  it("5. Student views schedule and assigned grades", async () => {
    setAuth(studentId, "NONE", centerId, "STUDENT");

    // Schedule
    const schedReq = mockRequest("/api/tenant/schedule", "GET");
    const schedRes = await getSchedule(schedReq);
    const schedData = await schedRes.json();
    expect(schedRes.status).toBe(200);
    expect(Array.isArray(schedData.slots)).toBe(true);
    expect(schedData.slots.some((s: { groupId: string }) => s.groupId === groupId)).toBe(true);

    // Grades
    const gradeReq = mockRequest("/api/grades", "GET");
    const gradeRes = await getGrades(gradeReq);
    const gradeData = await gradeRes.json();
    expect(gradeRes.status).toBe(200);
    expect(Array.isArray(gradeData.grades)).toBe(true);
    expect(gradeData.grades.some((g: { value: number; studentMembershipId: string }) => g.value === 95 && g.studentMembershipId === studentMembershipId)).toBe(true);
  });

  it("6. Parent links to student and views child's progress and schedule", async () => {
    // 6a. Director initiates parent invite
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const pInvReq = mockRequest("/api/invites/parent-link", "POST", {
      action: "INITIATE_BY_ADMIN",
      studentId: studentMembershipId,
    });
    const pInvRes = await handleParentLink(pInvReq);
    const pInvData = await pInvRes.json();
    expect(pInvRes.status).toBe(200);
    expect(pInvData.parentInviteCode).toBeDefined();

    // 6b. Parent claims link
    setAuth(parentId, "NONE");
    const claimReq = mockRequest("/api/invites/parent-link", "POST", {
      action: "CLAIM_PARENT_LINK",
      inviteCode: pInvData.parentInviteCode,
      studentId: studentMembershipId,
    });
    const claimRes = await handleParentLink(claimReq);
    const claimData = await claimRes.json();
    expect(claimRes.status).toBe(200);
    expect(claimData.parentMembershipId).toBeDefined();
    parentMembershipId = claimData.parentMembershipId;

    // 6c. Parent views student's grades
    setAuth(parentId, "NONE", centerId, "PARENT");
    const pGradesReq = mockRequest("/api/grades", "GET");
    const pGradesRes = await getGrades(pGradesReq);
    const pGradesData = await pGradesRes.json();
    expect(pGradesRes.status).toBe(200);
    expect(pGradesData.grades.some((g: { studentMembershipId: string; value: number }) => g.studentMembershipId === studentMembershipId && g.value === 95)).toBe(true);

    // 6d. Parent views student's schedule
    const pSchedReq = mockRequest("/api/tenant/schedule", "GET");
    const pSchedRes = await getSchedule(pSchedReq);
    const pSchedData = await pSchedRes.json();
    expect(pSchedRes.status).toBe(200);
    expect(pSchedData.slots.some((s: { groupId: string }) => s.groupId === groupId)).toBe(true);
  });

  it("7. Platform owner blocks the center, and Director gets 403 CENTER_SUSPENDED", async () => {
    // Platform owner blocks center
    setAuth(platformOwnerId, "SUPERADMIN");
    const suspendReq = mockRequest(`/api/platform/centers/${centerId}/suspend`, "POST", {
      action: "block",
      reason: "To'lov muddati o'tib ketganligi sababli bloklandi",
    });
    const suspendRes = await suspendCenter(suspendReq, { params: { id: centerId } });
    const suspendData = await suspendRes.json();
    expect(suspendRes.status).toBe(200);
    expect(suspendData.status).toBe("BLOCKED");

    // Director attempts to access center API
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const dirReq = mockRequest("/api/courses", "POST", {
      title: "Blocked Course Creation",
    });
    const dirRes = await createCourse(dirReq);
    const dirData = await dirRes.json();
    expect(dirRes.status).toBe(403);
    expect(dirData.code).toBe("CENTER_SUSPENDED");
  });
});
