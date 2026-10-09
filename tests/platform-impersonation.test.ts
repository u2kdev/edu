import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import { GET as getCourses, POST as postCourse } from "../src/app/api/courses/route";
import { GET as getGrades, POST as postGrade } from "../src/app/api/grades/route";
import { GET as getAttendance, POST as postAttendance } from "../src/app/api/attendance/route";
import type { LearningCenter, PlatformUser, CenterMembership, Lesson, CourseModule, Course } from "@prisma/client";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-3 Item 7: Platform roles tenant access matrix (impersonation gate)", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let superAdmin: PlatformUser;
  let developer: PlatformUser;
  let platformSupport: PlatformUser;
  let platformAdmin: PlatformUser;
  let student: PlatformUser;

  let ownerMember: CenterMembership;
  let studentMember: CenterMembership;

  let course: Course;
  let courseModule: CourseModule;
  let lesson: Lesson;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Owner P" },
    });
    superAdmin = await db.platformUser.create({
      data: { email: `sa_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Super Admin", platformRole: "SUPERADMIN" },
    });
    developer = await db.platformUser.create({
      data: { email: `dev_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Developer", platformRole: "DEVELOPER" },
    });
    platformSupport = await db.platformUser.create({
      data: { email: `ps_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Platform Support", platformRole: "PLATFORM_SUPPORT" },
    });
    platformAdmin = await db.platformUser.create({
      data: { email: `pa_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Platform Admin", platformRole: "PLATFORM_ADMIN" },
    });
    student = await db.platformUser.create({
      data: { email: `stud_p_${ts}@matrix.com`, passwordHash: "x", fullName: "Student", platformRole: "NONE" },
    });

    center = await db.learningCenter.create({
      data: { name: "Matrix Center", slug: `mc-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Plan ${ts}`,
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
        currentPeriodEndsAt: new Date(Date.now() + 86400000),
      },
    });

    ownerMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: owner.id, role: "DIRECTOR" },
    });
    studentMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: student.id, role: "STUDENT" },
    });

    course = await db.course.create({
      data: { centerId: center.id, title: "Matrix Course", createdByMembershipId: ownerMember.id },
    });
    courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module M" },
    });
    lesson = await db.lesson.create({
      data: { centerId: center.id, moduleId: courseModule.id, title: "Lesson M" },
    });
  });

  afterAll(async () => {
    await db.attendance.deleteMany({ where: { lessonId: lesson.id } });
    await db.grade.deleteMany({ where: { centerId: center.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { startsWith: "Plan " } } });
    await db.userSession.deleteMany({
      where: { userId: { in: [owner.id, superAdmin.id, developer.id, platformSupport.id, platformAdmin.id, student.id] } },
    });
    await db.platformUser.deleteMany({
      where: { id: { in: [owner.id, superAdmin.id, developer.id, platformSupport.id, platformAdmin.id, student.id] } },
    });
  });

  const setAuth = async (user: PlatformUser) => {
    const jti = `jti_${Date.now()}_${Math.random()}`;
    const crypto = await import("crypto");
    const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    mockToken = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: center.id,
      activeCenterRole: user.platformRole === "NONE" ? "STUDENT" : undefined,
    }, "1h", jti);
  };

  // PLATFORM_ADMIN must NOT have impersonation access to tenant data
  it("PLATFORM_ADMIN is rejected (403) on tenant routes GET /api/courses", async () => {
    await setAuth(platformAdmin);
    const res = await getCourses(new Request(`http://localhost/api/courses?centerId=${center.id}`));
    expect(res.status).toBe(403);
  });

  it("PLATFORM_ADMIN is rejected (403) on tenant routes POST /api/courses", async () => {
    await setAuth(platformAdmin);
    const res = await postCourse(new Request(`http://localhost/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId: center.id, title: "Blocked Course" }),
    }));
    expect(res.status).toBe(403);
  });

  it("PLATFORM_ADMIN is rejected (403) on tenant routes GET /api/grades", async () => {
    await setAuth(platformAdmin);
    const res = await getGrades(new Request(`http://localhost/api/grades?centerId=${center.id}`));
    expect(res.status).toBe(403);
  });

  // SUPERADMIN has impersonation: GET succeeds, POST succeeds
  it("SUPERADMIN has impersonation: GET and POST /api/courses succeed", async () => {
    await setAuth(superAdmin);
    const resGet = await getCourses(new Request(`http://localhost/api/courses?centerId=${center.id}`));
    expect(resGet.status).toBe(200);

    const resPost = await postCourse(new Request(`http://localhost/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ centerId: center.id, title: "SuperAdmin Course" }),
    }));
    expect(resPost.status).toBe(200);
  });

  // DEVELOPER has impersonation: GET succeeds, POST succeeds
  it("DEVELOPER has impersonation: GET and POST /api/grades succeed", async () => {
    await setAuth(developer);
    const resGet = await getGrades(new Request(`http://localhost/api/grades?centerId=${center.id}`));
    expect(resGet.status).toBe(200);

    const resPost = await postGrade(new Request(`http://localhost/api/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: center.id,
        studentMembershipId: studentMember.id,
        value: 100,
        gradeType: "TEST",
      }),
    }));
    expect(resPost.status).toBe(200);
  });

  // PLATFORM_SUPPORT: GET succeeds (200), POST rejected with read-only 403
  it("PLATFORM_SUPPORT: GET /api/attendance succeeds (200), POST rejected (403)", async () => {
    await setAuth(platformSupport);
    const resGet = await getAttendance(new Request(`http://localhost/api/attendance?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(resGet.status).toBe(200);

    const resPost = await postAttendance(new Request(`http://localhost/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lessonId: lesson.id,
        records: [{ studentMembershipId: studentMember.id, status: "PRESENT" }],
      }),
    }));
    expect(resPost.status).toBe(403);
  });
});
