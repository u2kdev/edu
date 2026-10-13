import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { POST as createLesson } from "../src/app/api/lessons/route";

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

const mockRequest = (url: string, method: "POST", body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("POST /api/lessons teacher course scoping", () => {
  let centerId: string;
  let teacherUser: { id: string; email: string };
  let teacherMembershipId: string;
  let directorUser: { id: string; email: string };
  let adminUser: { id: string; email: string };

  let courseOwnId: string;
  let moduleOwnId: string;
  let courseForeignId: string;
  let moduleForeignId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();

    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Lesson Scope Plan",
          maxStudents: 50,
          maxTeachers: 5,
          maxCourses: 10,
          maxBranches: 1,
          priceMonthly: 0,
        },
      });
    }

    const dirUser = await db.platformUser.create({
      data: {
        email: `dir-lesson-${Date.now()}@test.com`,
        fullName: "Director Lesson",
        passwordHash,
        emailVerified: now,
      },
    });
    directorUser = { id: dirUser.id, email: dirUser.email };

    const center = await db.learningCenter.create({
      data: {
        name: "Lesson Center",
        slug: `lesson-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirUser.id,
        subscriptions: {
          create: {
            planId: plan.id,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerId = center.id;

    const dirMem = await db.centerMembership.create({
      data: {
        userId: dirUser.id,
        centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    const admUser = await db.platformUser.create({
      data: {
        email: `adm-lesson-${Date.now()}@test.com`,
        fullName: "Admin Lesson",
        passwordHash,
        emailVerified: now,
      },
    });
    adminUser = { id: admUser.id, email: admUser.email };

    await db.centerMembership.create({
      data: {
        userId: admUser.id,
        centerId,
        role: "CENTER_ADMIN",
        status: "ACTIVE",
      },
    });

    const tUser = await db.platformUser.create({
      data: {
        email: `teacher-lesson-${Date.now()}@test.com`,
        fullName: "Teacher Lesson",
        passwordHash,
        emailVerified: now,
      },
    });
    teacherUser = { id: tUser.id, email: tUser.email };

    const tMem = await db.centerMembership.create({
      data: {
        userId: tUser.id,
        centerId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMembershipId = tMem.id;

    // Course 1 (Teacher has a group here)
    const courseOwn = await db.course.create({
      data: {
        centerId,
        title: "Teacher Own Course",
        createdByMembershipId: dirMem.id,
      },
    });
    courseOwnId = courseOwn.id;

    const modOwn = await db.courseModule.create({
      data: {
        centerId,
        courseId: courseOwnId,
        title: "Module Own",
      },
    });
    moduleOwnId = modOwn.id;

    // Group assigned to teacher
    await db.group.create({
      data: {
        centerId,
        courseId: courseOwnId,
        name: "Group 1",
        teacherMembershipId,
      },
    });

    // Course 2 (Teacher has NO groups here)
    const courseForeign = await db.course.create({
      data: {
        centerId,
        title: "Foreign Course",
        createdByMembershipId: dirMem.id,
      },
    });
    courseForeignId = courseForeign.id;

    const modForeign = await db.courseModule.create({
      data: {
        centerId,
        courseId: courseForeignId,
        title: "Module Foreign",
      },
    });
    moduleForeignId = modForeign.id;
  });

  it("teacher cannot create lesson in course where they have no groups (403)", async () => {
    mockToken = signJWT({
      userId: teacherUser.id,
      email: teacherUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "TEACHER",
    });

    const res = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleForeignId,
        title: "Illegal Lesson",
      })
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/Forbidden/i);
  });

  it("teacher can create lesson in course where they have a group (200)", async () => {
    mockToken = signJWT({
      userId: teacherUser.id,
      email: teacherUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "TEACHER",
    });

    const res = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleOwnId,
        title: "Legal Teacher Lesson",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.lesson.title).toBe("Legal Teacher Lesson");
  });

  it("director can create lesson in any course (200)", async () => {
    mockToken = signJWT({
      userId: directorUser.id,
      email: directorUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });

    const res = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleForeignId,
        title: "Director Lesson in Foreign Course",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("center admin can create lesson in any course (200)", async () => {
    mockToken = signJWT({
      userId: adminUser.id,
      email: adminUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "CENTER_ADMIN",
    });

    const res = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleForeignId,
        title: "Admin Lesson in Foreign Course",
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
