import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";

// Import all API routes to test
import { POST as createCenter } from "../src/app/api/platform/centers/route";
import { POST as createStaff } from "../src/app/api/tenant/staff/route";
import { POST as createCourse } from "../src/app/api/courses/route";
import { POST as createGroup } from "../src/app/api/groups/route";
import { POST as generateInvite } from "../src/app/api/invites/generate/route";
import { POST as redeemInvite } from "../src/app/api/invites/redeem/route";
import { POST as createHomework } from "../src/app/api/homework/route";
import { POST as createGrade } from "../src/app/api/grades/route";
import { POST as createLesson } from "../src/app/api/lessons/route";
import { POST as createModule } from "../src/app/api/modules/route";

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

const mockRequest = (url: string, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Phase 12: Real-World E2E Validation Journey", () => {
  let platformOwnerId: string;
  let centerId: string;
  let planId: string;
  let directorId: string;
  let teacherId: string;
  let teacherMembershipId: string;
  let studentId: string;
  let studentMembershipId: string;
  let courseId: string;
  let moduleId: string;
  let groupId: string;
  let studentInviteCode: string;
  let lessonId: string;
  let homeworkId: string;

  beforeAll(async () => {
    // 1. Create a Platform Owner
    const po = await db.platformUser.create({
      data: { email: `po-${Date.now()}@e2e.com`, passwordHash: "x", fullName: "PO", platformRole: "PLATFORM_ADMIN" },
    });
    platformOwnerId = po.id;

    // 2. Create a restricted Subscription Plan for limits testing
    const plan = await db.subscriptionPlan.create({
      data: { name: "E2E Strict Plan", priceMonthly: 10, maxStudents: 2, maxTeachers: 1, maxCourses: 1, maxBranches: 1 },
    });
    planId = plan.id;
  });

  afterAll(async () => {
    if (centerId) {
      await db.subscription.deleteMany({ where: { centerId } });
      await db.learningCenter.delete({ where: { id: centerId } });
    }
    await db.subscriptionPlan.delete({ where: { id: planId } });
    await db.platformUser.delete({ where: { id: platformOwnerId } });
  });

  const setAuth = (userId: string, platformRole: string, activeCenterId?: string, activeCenterRole?: string) => {
    mockToken = signJWT({ userId, email: "test@e2e.com", platformRole, activeCenterId, activeCenterRole });
  };

  it("1. Platform Owner creates an Educational Center (Tenant)", async () => {
    setAuth(platformOwnerId, "PLATFORM_ADMIN");
    const req = mockRequest("/api/platform/centers", {
      name: "E2E Test Center",
      slug: `e2e-${Date.now()}`,
      centerType: "HYBRID",
      planId: planId,
      directorEmail: `director-${Date.now()}@e2e.com`,
      directorFullName: "E2E Director",
    });

    const res = await createCenter(req);
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.center.id).toBeDefined();
    
    centerId = data.center.id;
    directorId = data.director.id;
  });

  it("2. Center Owner logs in and creates a Teacher", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const req = mockRequest("/api/tenant/staff", {
      email: `teacher-${Date.now()}@e2e.com`,
      fullName: "E2E Teacher",
      staffRole: "TEACHER",
    });

    const res = await createStaff(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.membership.userId).toBeDefined();

    teacherId = data.membership.userId;
    teacherMembershipId = data.membership.id;
  });

  it("3. Subscription Limit: Center Owner fails to create a 2nd Teacher", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const req = mockRequest("/api/tenant/staff", {
      email: `teacher2-${Date.now()}@e2e.com`,
      fullName: "E2E Teacher 2",
      staffRole: "TEACHER",
    });

    const res = await createStaff(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("PLAN_LIMIT_REACHED");
  });

  it("4. Center Owner creates a Course", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const req = mockRequest("/api/courses", {
      title: "E2E Next.js Mastery",
      description: "Learn Next.js 14",
    });

    const res = await createCourse(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    courseId = data.course.id;
  });

  it("5. Subscription Limit: Center Owner fails to create a 2nd Course", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    const req = mockRequest("/api/courses", {
      title: "E2E React Mastery",
    });

    const res = await createCourse(req);
    const data = await res.json();

    expect(res.status).toBe(403);
    expect(data.error).toContain("PLAN_LIMIT_REACHED");
  });

  it("6. Center Owner creates a Group & generates Student Invite", async () => {
    setAuth(directorId, "NONE", centerId, "DIRECTOR");
    
    // Create Group
    const grpReq = mockRequest("/api/groups", {
      name: "E2E Batch 1",
      courseId: courseId,
      maxStudents: 10,
      teacherMembershipId: teacherMembershipId,
    });
    const createGrpRes = await createGroup(grpReq);
    const grpData = (await createGrpRes.json()) as { group: { id: string } };
    expect(createGrpRes.status).toBe(200);
    groupId = grpData.group.id;

    // Generate Invite
    const invReq = mockRequest("/api/invites/generate", {
      targetRole: "STUDENT",
      courseId: courseId,
      groupId: groupId,
      maxUses: 1,
    });
    const invRes = await generateInvite(invReq);
    const invData = (await invRes.json()) as { invite: { code: string } };
    expect(invRes.status).toBe(200);
    studentInviteCode = invData.invite.code;

  });

  it("7. Student redeems invite code to join Group", async () => {
    const studentEmail = `student-${Date.now()}@e2e.com`;
    // Unauthenticated request
    mockToken = "";
    const req = mockRequest("/api/invites/redeem", {
      code: studentInviteCode,
      email: studentEmail,
      fullName: "E2E Student",
      password: "Password123!",
    });

    const res = await redeemInvite(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);

    // Get the student's IDs directly from DB
    const studentUser = await db.platformUser.findUnique({ where: { email: studentEmail } });
    expect(studentUser).toBeDefined();
    studentId = studentUser!.id;

    const mem = await db.centerMembership.findFirst({
      where: { userId: studentId, centerId: centerId }
    });
    expect(mem).toBeDefined();
    studentMembershipId = mem!.id;
  });

  it("8. Teacher creates Lesson & Homework", async () => {
    setAuth(teacherId, "NONE", centerId, "TEACHER");
    
    // Create Module First
    const modReq = mockRequest("/api/modules", {
      courseId: courseId,
      title: "E2E Module 1",
    });
    const modRes = await createModule(modReq);
    const modData = (await modRes.json()) as { module: { id: string } };
    expect(modRes.status).toBe(200);
    moduleId = modData.module.id;

    // Create Lesson
    const lessonReq = mockRequest("/api/lessons", {
      moduleId: moduleId,
      title: "E2E Lesson 1",
      scheduledAt: new Date().toISOString(),
      lessonType: "REGULAR",
    });
    const lessonRes = await createLesson(lessonReq);
    const lessonData = (await lessonRes.json()) as { lesson?: { id: string }; error?: unknown };
    if (lessonRes.status !== 200) console.log("Lesson Error:", lessonData.error);
    expect(lessonRes.status).toBe(200);
    lessonId = lessonData.lesson!.id;

    // Create Homework
    const hwReq = mockRequest("/api/homework", {
      lessonId: lessonId,
      title: "E2E Build an App",
      description: "Use App Router",
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    });

    const hwRes = await createHomework(hwReq);
    const hwData = (await hwRes.json()) as { homework?: { id: string }; error?: unknown };
    if (hwRes.status !== 200) console.log("Homework Error:", hwData.error);
    expect(hwRes.status).toBe(200);
    homeworkId = hwData.homework!.id;
  });

  it("9. Teacher assigns Grade", async () => {
    setAuth(teacherId, "NONE", centerId, "TEACHER");
    const req = mockRequest("/api/grades", {
      studentMembershipId: studentMembershipId,
      groupId: groupId,
      lessonId: lessonId,
      gradeType: "HOMEWORK",
      value: 100,
      comment: "Excellent",
    });

    const res = await createGrade(req);
    const data = await res.json();
    if(res.status !== 200) console.log("Grade Error:", data.error);
    expect(res.status).toBe(200);
    expect(data.grade.id).toBeDefined();
  });
});
