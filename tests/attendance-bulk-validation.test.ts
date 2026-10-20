import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { POST as bulkAttendance } from "../src/app/api/attendance/bulk/route";

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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("POST /api/attendance/bulk validation and scoping", () => {
  let centerId: string;
  let otherCenterId: string;
  let directorUser: { id: string; email: string };

  let course1Id: string;
  let course2Id: string;
  let group1Id: string;
  let group2Id: string;

  let module1Id: string;
  let module2Id: string;
  let lesson1Id: string;
  let lesson2Id: string;

  let activeStudentMemberId: string;
  let archivedStudentMemberId: string;
  let otherGroupStudentMemberId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();

    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Attendance Bulk Plan",
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
        email: `dir-attbulk-${Date.now()}@test.com`,
        fullName: "Director AttBulk",
        passwordHash,
        emailVerified: now,
      },
    });
    directorUser = { id: dirUser.id, email: dirUser.email };

    const center = await db.learningCenter.create({
      data: {
        name: "AttBulk Center",
        slug: `attbulk-center-${Date.now()}`,
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

    // Other Center
    const otherCenter = await db.learningCenter.create({
      data: {
        name: "Other AttBulk Center",
        slug: `other-attbulk-${Date.now()}`,
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
    otherCenterId = otherCenter.id;

    // Course 1 & Group 1
    const course1 = await db.course.create({
      data: {
        centerId,
        title: "Course 1",
        createdByMembershipId: dirMem.id,
      },
    });
    course1Id = course1.id;

    const mod1 = await db.courseModule.create({
      data: {
        centerId,
        courseId: course1Id,
        title: "Module 1",
      },
    });
    module1Id = mod1.id;

    const lesson1 = await db.lesson.create({
      data: {
        centerId,
        moduleId: module1Id,
        title: "Lesson 1 in Course 1",
      },
    });
    lesson1Id = lesson1.id;

    const group1 = await db.group.create({
      data: {
        centerId,
        courseId: course1Id,
        name: "Group 1",
      },
    });
    group1Id = group1.id;

    // Course 2 & Group 2 (different course)
    const course2 = await db.course.create({
      data: {
        centerId,
        title: "Course 2",
        createdByMembershipId: dirMem.id,
      },
    });
    course2Id = course2.id;

    const mod2 = await db.courseModule.create({
      data: {
        centerId,
        courseId: course2Id,
        title: "Module 2",
      },
    });
    module2Id = mod2.id;

    const lesson2 = await db.lesson.create({
      data: {
        centerId,
        moduleId: module2Id,
        title: "Lesson 2 in Course 2",
      },
    });
    lesson2Id = lesson2.id;

    const group2 = await db.group.create({
      data: {
        centerId,
        courseId: course2Id,
        name: "Group 2",
      },
    });
    group2Id = group2.id;

    // Students
    // 1. Active student in Group 1
    const u1 = await db.platformUser.create({
      data: {
        email: `stu-act-${Date.now()}@test.com`,
        fullName: "Active Student",
        passwordHash,
        emailVerified: now,
      },
    });
    const m1 = await db.centerMembership.create({
      data: {
        userId: u1.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    activeStudentMemberId = m1.id;
    await db.enrollment.create({
      data: {
        centerId,
        groupId: group1Id,
        studentMembershipId: activeStudentMemberId,
        status: "ACTIVE",
      },
    });

    // 2. Archived student in Group 1
    const u2 = await db.platformUser.create({
      data: {
        email: `stu-arch-${Date.now()}@test.com`,
        fullName: "Archived Student",
        passwordHash,
        emailVerified: now,
      },
    });
    const m2 = await db.centerMembership.create({
      data: {
        userId: u2.id,
        centerId,
        role: "STUDENT",
        status: "ARCHIVED",
      },
    });
    archivedStudentMemberId = m2.id;
    await db.enrollment.create({
      data: {
        centerId,
        groupId: group1Id,
        studentMembershipId: archivedStudentMemberId,
        status: "ACTIVE",
      },
    });

    // 3. Student only in Group 2
    const u3 = await db.platformUser.create({
      data: {
        email: `stu-g2-${Date.now()}@test.com`,
        fullName: "Group 2 Student",
        passwordHash,
        emailVerified: now,
      },
    });
    const m3 = await db.centerMembership.create({
      data: {
        userId: u3.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    otherGroupStudentMemberId = m3.id;
    await db.enrollment.create({
      data: {
        centerId,
        groupId: group2Id,
        studentMembershipId: otherGroupStudentMemberId,
        status: "ACTIVE",
      },
    });
  });

  const setDirAuth = () => {
    mockToken = signJWT({
      userId: directorUser.id,
      email: directorUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });
  };

  it("1. rejects invalid status in defaultStatus or studentStatusMap with 400 (Zod)", async () => {
    setDirAuth();
    const resInvalidDefault = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson1Id,
        groupId: group1Id,
        defaultStatus: "UNKNOWN_STATUS",
      })
    );
    expect(resInvalidDefault.status).toBe(400);

    const resInvalidMap = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson1Id,
        groupId: group1Id,
        studentStatusMap: {
          [activeStudentMemberId]: "INVALID",
        },
      })
    );
    expect(resInvalidMap.status).toBe(400);
  });

  it("2. rejects when lessonId does not belong to groupId course or center with 400 or 404", async () => {
    setDirAuth();
    // Lesson 2 is in Course 2, but group1Id is in Course 1
    const resMismatchedGroup = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson2Id,
        groupId: group1Id,
        defaultStatus: "PRESENT",
      })
    );
    expect(resMismatchedGroup.status).toBe(400);
  });

  it("3. rejects studentStatusMap with students not in this group with 400", async () => {
    setDirAuth();
    const resForeignStudent = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson1Id,
        groupId: group1Id,
        studentStatusMap: {
          [otherGroupStudentMemberId]: "PRESENT",
        },
      })
    );
    expect(resForeignStudent.status).toBe(400);
  });

  it("4. rejects studentStatusMap with archived student with 400", async () => {
    setDirAuth();
    const resArchivedStudent = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson1Id,
        groupId: group1Id,
        studentStatusMap: {
          [archivedStudentMemberId]: "PRESENT",
        },
      })
    );
    expect(resArchivedStudent.status).toBe(400);
  });

  it("5. succeeds for valid lesson, group, and active students with 200", async () => {
    setDirAuth();
    const res = await bulkAttendance(
      mockRequest(`/api/attendance/bulk?centerId=${centerId}`, {
        lessonId: lesson1Id,
        groupId: group1Id,
        studentStatusMap: {
          [activeStudentMemberId]: "PRESENT",
        },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    const record = await db.attendance.findFirst({
      where: { lessonId: lesson1Id, studentMembershipId: activeStudentMemberId },
    });
    expect(record).toBeDefined();
    expect(record?.status).toBe("PRESENT");
  });
});
