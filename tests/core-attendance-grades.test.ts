import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { GET as getAttendance, POST as markAttendance } from "../src/app/api/attendance/route";

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

const mockRequest = (
  url: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("CORE-3 Attendance & Grades System", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAMembershipId: string;
  let teacherA1MembershipId: string;
  let teacherA2MembershipId: string;

  let studentA1MembershipId: string;
  let studentA2MembershipId: string;
  let parentA1MembershipId: string;

  let groupA1Id: string;
  let groupA2Id: string;
  let lessonA1Id: string;
  let lessonB1Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();
    const plan = await db.subscriptionPlan.findFirst();
    const planId = plan ? plan.id : "plan-id";

    // Center A
    const dirA = await db.platformUser.create({
      data: {
        email: `att-dir-a-${Date.now()}@test.com`,
        fullName: "Attendance Director A",
        passwordHash,
        emailVerified: now,
      },
    });

    const centerA = await db.learningCenter.create({
      data: {
        name: "Attendance Center A",
        slug: `att-center-a-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirA.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerAId = centerA.id;

    const dirMemA = await db.centerMembership.create({
      data: {
        userId: dirA.id,
        centerId: centerAId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorAMembershipId = dirMemA.id;

    // Teachers in Center A
    const tUser1 = await db.platformUser.create({
      data: {
        email: `att-teach-1-${Date.now()}@test.com`,
        fullName: "Attendance Teacher 1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    teacherA1MembershipId = tUser1.memberships[0].id;

    const tUser2 = await db.platformUser.create({
      data: {
        email: `att-teach-2-${Date.now()}@test.com`,
        fullName: "Attendance Teacher 2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    teacherA2MembershipId = tUser2.memberships[0].id;

    // Students in Center A
    const sUser1 = await db.platformUser.create({
      data: {
        email: `att-stud-1-${Date.now()}@test.com`,
        fullName: "Attendance Student 1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    studentA1MembershipId = sUser1.memberships[0].id;

    const sUser2 = await db.platformUser.create({
      data: {
        email: `att-stud-2-${Date.now()}@test.com`,
        fullName: "Attendance Student 2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    studentA2MembershipId = sUser2.memberships[0].id;

    // Parent in Center A
    const pUser1 = await db.platformUser.create({
      data: {
        email: `att-parent-1-${Date.now()}@test.com`,
        fullName: "Attendance Parent 1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "PARENT", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    parentA1MembershipId = pUser1.memberships[0].id;

    await db.parentLink.create({
      data: {
        parentMembershipId: parentA1MembershipId,
        studentMembershipId: studentA1MembershipId,
        status: "CONFIRMED",
      },
    });

    // Courses & Groups in Center A
    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Course Att A",
        createdByMembershipId: directorAMembershipId,
      },
    });

    const moduleA = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        title: "Module Att A1",
      },
    });

    const groupA1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group Att A1",
        teacherMembershipId: teacherA1MembershipId,
      },
    });
    groupA1Id = groupA1.id;

    const groupA2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group Att A2",
        teacherMembershipId: teacherA2MembershipId,
      },
    });
    groupA2Id = groupA2.id;

    // Enroll students
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        status: "ACTIVE",
      },
    });

    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA2MembershipId,
        groupId: groupA2Id,
        status: "ACTIVE",
      },
    });

    // Lessons in Center A
    const lessonA1 = await db.lesson.create({
      data: {
        centerId: centerAId,
        moduleId: moduleA.id,
        title: "Lesson Att A1",
        scheduledAt: new Date(),
      },
    });
    lessonA1Id = lessonA1.id;

    // Center B
    const dirB = await db.platformUser.create({
      data: {
        email: `att-dir-b-${Date.now()}@test.com`,
        fullName: "Attendance Director B",
        passwordHash,
        emailVerified: now,
      },
    });

    const centerB = await db.learningCenter.create({
      data: {
        name: "Attendance Center B",
        slug: `att-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirB.id,
        subscriptions: {
          create: {
            planId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerBId = centerB.id;

    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Course Att B",
        createdByMembershipId: (await db.centerMembership.create({
          data: { userId: dirB.id, centerId: centerBId, role: "DIRECTOR", status: "ACTIVE" },
        })).id,
      },
    });

    const moduleB = await db.courseModule.create({
      data: {
        centerId: centerBId,
        courseId: courseB.id,
        title: "Module Att B1",
      },
    });

    const lessonB1 = await db.lesson.create({
      data: {
        centerId: centerBId,
        moduleId: moduleB.id,
        title: "Lesson Att B1",
      },
    });
    lessonB1Id = lessonB1.id;
  });

  it("1. Tenant isolation: Center A cannot view or mark attendance for Center B lesson", async () => {
    const dirA = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dirA!.userId,
      email: dirA!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    // Attempt to view Center B lesson attendance
    const resGet = await getAttendance(mockRequest(`/api/attendance?lessonId=${lessonB1Id}`, "GET"));
    expect(resGet.status).toBe(404);

    // Attempt to mark attendance for Center B lesson
    const resPost = await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonB1Id,
        records: [{ studentMembershipId: studentA1MembershipId, status: "PRESENT" }],
      })
    );
    expect(resPost.status).toBe(404);
  });

  it("2. Attendance status validation: Rejects invalid attendance statuses with 400", async () => {
    const dirA = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dirA!.userId,
      email: dirA!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const resInvalid = await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        records: [{ studentMembershipId: studentA1MembershipId, status: "INVALID_STATUS" }],
      })
    );
    expect(resInvalid.status).toBe(400);
    const data = await resInvalid.json();
    expect(data.error).toContain("Invalid attendance status");
  });

  it("3. Quick bulk mark with notes: Saves status and optional comment/note in database", async () => {
    const dirA = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dirA!.userId,
      email: dirA!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const resMark = await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        records: [
          {
            studentMembershipId: studentA1MembershipId,
            status: "LATE",
            note: "Arrived 15 minutes late due to traffic",
          },
        ],
      })
    );
    expect(resMark.status).toBe(200);

    // Verify record in database
    const attRecord = await db.attendance.findUnique({
      where: {
        lessonId_studentMembershipId: {
          lessonId: lessonA1Id,
          studentMembershipId: studentA1MembershipId,
        },
      },
    });
    expect(attRecord?.status).toBe("LATE");
    expect(attRecord?.note).toBe("Arrived 15 minutes late due to traffic");
  });

  it("4. Role scoping: Teacher cannot mark attendance for student in another teacher's group", async () => {
    const t1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: t1!.userId,
      email: t1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    // Student A2 belongs to Group A2 (taught by Teacher A2)
    const resForbidden = await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        records: [{ studentMembershipId: studentA2MembershipId, status: "PRESENT" }],
      })
    );
    expect(resForbidden.status).toBe(403);
  });
});
