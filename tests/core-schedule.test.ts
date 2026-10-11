import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { GET as getSchedule, POST as createSchedule, PATCH as updateSchedule, DELETE as deleteSchedule } from "../src/app/api/tenant/schedule/route";
import { POST as createLesson, PATCH as updateLesson } from "../src/app/api/lessons/route";

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

describe("CORE-2 Schedule & Timetable Management", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAMembershipId: string;
  let teacherA1MembershipId: string;
  let teacherA2MembershipId: string;

  let studentA1MembershipId: string;
  let parentA1MembershipId: string;

  let groupA1Id: string;
  let groupA2Id: string;
  let groupB1Id: string;
  let moduleA1Id: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();
    const plan = await db.subscriptionPlan.findFirst();
    const planId = plan ? plan.id : "plan-id";

    // Center A
    const dirA = await db.platformUser.create({
      data: {
        email: `sched-dir-a-${Date.now()}@test.com`,
        fullName: "Schedule Director A",
        passwordHash,
        emailVerified: now,
      },
    });

    const centerA = await db.learningCenter.create({
      data: {
        name: "Schedule Center A",
        slug: `sched-center-a-${Date.now()}`,
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

    // Center B
    const dirB = await db.platformUser.create({
      data: {
        email: `sched-dir-b-${Date.now()}@test.com`,
        fullName: "Schedule Director B",
        passwordHash,
        emailVerified: now,
      },
    });

    const centerB = await db.learningCenter.create({
      data: {
        name: "Schedule Center B",
        slug: `sched-center-b-${Date.now()}`,
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

    const dirMemB = await db.centerMembership.create({
      data: {
        userId: dirB.id,
        centerId: centerBId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // Teachers in Center A
    const tUser1 = await db.platformUser.create({
      data: {
        email: `sched-teach-1-${Date.now()}@test.com`,
        fullName: "Schedule Teacher 1",
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
        email: `sched-teach-2-${Date.now()}@test.com`,
        fullName: "Schedule Teacher 2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "TEACHER", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    teacherA2MembershipId = tUser2.memberships[0].id;

    // Student A1 and Parent A1 in Center A
    const sUser1 = await db.platformUser.create({
      data: {
        email: `sched-student-1-${Date.now()}@test.com`,
        fullName: "Schedule Student 1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: { centerId: centerAId, role: "STUDENT", status: "ACTIVE" },
        },
      },
      include: { memberships: true },
    });
    studentA1MembershipId = sUser1.memberships[0].id;

    const pUser1 = await db.platformUser.create({
      data: {
        email: `sched-parent-1-${Date.now()}@test.com`,
        fullName: "Schedule Parent 1",
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
        title: "Course Sched A",
        createdByMembershipId: directorAMembershipId,
      },
    });

    const modA1 = await db.courseModule.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        title: "Module Sched A1",
      },
    });
    moduleA1Id = modA1.id;

    const groupA1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group Sched A1",
        teacherMembershipId: teacherA1MembershipId,
      },
    });
    groupA1Id = groupA1.id;

    const groupA2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group Sched A2",
        teacherMembershipId: teacherA2MembershipId,
      },
    });
    groupA2Id = groupA2.id;

    // Enroll Student A1 in Group A1
    await db.enrollment.create({
      data: {
        centerId: centerAId,
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        status: "ACTIVE",
      },
    });

    // Course & Group in Center B
    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Course Sched B",
        createdByMembershipId: (await db.centerMembership.findFirst({ where: { centerId: centerBId } }))!.id,
      },
    });

    const groupB1 = await db.group.create({
      data: {
        centerId: centerBId,
        courseId: courseB.id,
        name: "Group Sched B1",
      },
    });
    groupB1Id = groupB1.id;
  });

  it("1. Tenant isolation: Center A cannot view or manipulate Center B schedule", async () => {
    // Create slot in Center B
    const teacherB = await db.centerMembership.findFirst({ where: { centerId: centerBId } });
    const slotB = await db.scheduleSlot.create({
      data: {
        centerId: centerBId,
        groupId: groupB1Id,
        teacherMembershipId: teacherB!.id,
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:30",
        roomName: "Room B",
      },
    });

    // Query from Center A as Director A
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

    const res = await getSchedule(mockRequest("/api/tenant/schedule", "GET"));
    expect(res.status).toBe(200);
    const data = await res.json();
    const slotIds = data.slots.map((s: { id: string }) => s.id);
    expect(slotIds).not.toContain(slotB.id);

    // Try to delete Center B slot from Center A -> 404
    const resDel = await deleteSchedule(mockRequest("/api/tenant/schedule", "DELETE", { id: slotB.id }));
    expect(resDel.status).toBe(404);
  });

  it("2. Teacher conflict: Overlapping time slot for same teacher is rejected with 409", async () => {
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

    // Create slot for Teacher 1: Monday 10:00 - 11:30 in Group A1
    const res1 = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA1Id,
        teacherMembershipId: teacherA1MembershipId,
        dayOfWeek: 1,
        startTime: "10:00",
        endTime: "11:30",
        roomName: "Room 101",
      })
    );
    expect(res1.status).toBe(200);

    // Try overlapping slot for Teacher 1: Monday 11:00 - 12:30 in Group A2 -> 409 conflict
    const resConflict = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA2Id,
        teacherMembershipId: teacherA1MembershipId,
        dayOfWeek: 1,
        startTime: "11:00",
        endTime: "12:30",
        roomName: "Room 102",
      })
    );
    expect(resConflict.status).toBe(409);
    const data = await resConflict.json();
    expect(data.error).toContain("Schedule conflicts detected");
    expect(data.conflicts[0]).toContain("Teacher already has a class");
  });

  it("3. Group conflict: Overlapping time slot for same group is rejected with 409", async () => {
    // Try scheduling Group A1 on Monday 10:30 - 12:00 with Teacher 2 (overlaps with Monday 10:00-11:30)
    const resConflict = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA1Id,
        teacherMembershipId: teacherA2MembershipId,
        dayOfWeek: 1,
        startTime: "10:30",
        endTime: "12:00",
        roomName: "Room 103",
      })
    );
    expect(resConflict.status).toBe(409);
    const data = await resConflict.json();
    expect(data.conflicts.some((c: string) => c.includes("Group already has a class"))).toBe(true);
  });

  it("4. Room conflict: Overlapping time slot in same room (without branchId) is rejected with 409", async () => {
    // Teacher 2 in Group A2 on Monday 10:30 - 11:30 in "Room 101" (Room 101 is already booked 10:00 - 11:30)
    const resConflict = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA2Id,
        teacherMembershipId: teacherA2MembershipId,
        dayOfWeek: 1,
        startTime: "10:30",
        endTime: "11:30",
        roomName: "Room 101",
      })
    );
    expect(resConflict.status).toBe(409);
    const data = await resConflict.json();
    expect(data.conflicts.some((c: string) => c.includes("Room \"Room 101\" is already occupied"))).toBe(true);
  });

  it("5. Role-based scoping: Teacher sees own, Student sees enrolled group, Parent sees children's groups", async () => {
    // Teacher 1 query
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

    const resT1 = await getSchedule(mockRequest("/api/tenant/schedule", "GET"));
    expect(resT1.status).toBe(200);
    const dataT1 = await resT1.json();
    expect(dataT1.slots.every((s: { teacherMembershipId: string }) => s.teacherMembershipId === teacherA1MembershipId)).toBe(true);

    // Student 1 query (enrolled in Group A1)
    const s1 = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: s1!.userId,
      email: s1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });

    const resS1 = await getSchedule(mockRequest("/api/tenant/schedule", "GET"));
    expect(resS1.status).toBe(200);
    const dataS1 = await resS1.json();
    expect(dataS1.slots.every((s: { groupId: string }) => s.groupId === groupA1Id)).toBe(true);

    // Parent 1 query (linked to Student 1)
    const p1 = await db.centerMembership.findUnique({
      where: { id: parentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: p1!.userId,
      email: p1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "PARENT",
    });

    const resP1 = await getSchedule(mockRequest("/api/tenant/schedule", "GET"));
    expect(resP1.status).toBe(200);
    const dataP1 = await resP1.json();
    expect(dataP1.slots.every((s: { groupId: string }) => s.groupId === groupA1Id)).toBe(true);
  });

  it("6. Concurrent double-booking race condition: Promise.all allows exactly one and rejects duplicate", async () => {
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

    // 4 concurrent bookings for Wednesday 14:00 - 15:30 in Room 202
    const responses = await Promise.all([
      createSchedule(
        mockRequest("/api/tenant/schedule", "POST", {
          groupId: groupA1Id,
          teacherMembershipId: teacherA1MembershipId,
          dayOfWeek: 3,
          startTime: "14:00",
          endTime: "15:30",
          roomName: "Room 202",
        })
      ),
      createSchedule(
        mockRequest("/api/tenant/schedule", "POST", {
          groupId: groupA2Id,
          teacherMembershipId: teacherA2MembershipId,
          dayOfWeek: 3,
          startTime: "14:00",
          endTime: "15:30",
          roomName: "Room 202",
        })
      ),
    ]);

    const statuses = responses.map((r) => r.status);
    const successCount = statuses.filter((s) => s === 200).length;
    const conflictCount = statuses.filter((s) => s === 409).length;

    expect(successCount).toBe(1);
    expect(conflictCount).toBe(1);

    // Verify DB only has 1 slot for that room/day/time
    const actualSlots = await db.scheduleSlot.count({
      where: {
        centerId: centerAId,
        dayOfWeek: 3,
        startTime: "14:00",
        roomName: "Room 202",
      },
    });
    expect(actualSlots).toBe(1);
  });

  it("7. Invalid duration: Inverted or identical start/end times are rejected with 400", async () => {
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

    const resInverted = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA1Id,
        teacherMembershipId: teacherA1MembershipId,
        dayOfWeek: 4,
        startTime: "16:00",
        endTime: "15:00",
      })
    );
    expect(resInverted.status).toBe(400);
    const dataInverted = await resInverted.json();
    expect(dataInverted.error).toContain("startTime must be earlier than endTime");

    const resEqual = await createSchedule(
      mockRequest("/api/tenant/schedule", "POST", {
        groupId: groupA1Id,
        teacherMembershipId: teacherA1MembershipId,
        dayOfWeek: 4,
        startTime: "16:00",
        endTime: "16:00",
      })
    );
    expect(resEqual.status).toBe(400);
  });

  it("8. Lesson cancellation: Status changed to CANCELLED with cancelledReason, writes audit log", async () => {
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

    // Create a lesson
    const resCreate = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleA1Id,
        title: "Lesson to cancel",
      })
    );
    expect(resCreate.status).toBe(200);
    const { lesson } = await resCreate.json();

    // Cancel the lesson
    const resCancel = await updateLesson(
      mockRequest("/api/lessons", "PATCH", {
        lessonId: lesson.id,
        status: "CANCELLED",
        cancelledReason: "Teacher emergency leave",
      })
    );
    expect(resCancel.status).toBe(200);
    const dataCancel = await resCancel.json();
    expect(dataCancel.lesson.status).toBe("CANCELLED");
    expect(dataCancel.lesson.cancelledReason).toBe("Teacher emergency leave");

    // Verify audit log
    const auditLog = await db.auditLog.findFirst({
      where: {
        centerId: centerAId,
        action: "LESSON_UPDATED",
        resourceId: lesson.id,
      },
    });
    expect(auditLog).toBeDefined();
    expect(auditLog?.detailsJson).toContain("CANCELLED");
  });

  it("9. Lesson substitution: Rejects non-teacher or foreign membership with 400, succeeds with active teacher", async () => {
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

    const resCreate = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleA1Id,
        title: "Lesson for substitution",
      })
    );
    const { lesson } = await resCreate.json();

    // Attempt substitution with student membership (invalid role) -> 400
    const resBadRole = await updateLesson(
      mockRequest("/api/lessons", "PATCH", {
        lessonId: lesson.id,
        substituteTeacherMembershipId: studentA1MembershipId,
      })
    );
    expect(resBadRole.status).toBe(400);

    // Attempt substitution with teacher from Center B -> 400
    const teacherB = await db.centerMembership.findFirst({ where: { centerId: centerBId } });
    const resForeign = await updateLesson(
      mockRequest("/api/lessons", "PATCH", {
        lessonId: lesson.id,
        substituteTeacherMembershipId: teacherB!.id,
      })
    );
    expect(resForeign.status).toBe(400);

    // Valid substitution with Teacher A2 -> 200
    const resValid = await updateLesson(
      mockRequest("/api/lessons", "PATCH", {
        lessonId: lesson.id,
        substituteTeacherMembershipId: teacherA2MembershipId,
      })
    );
    expect(resValid.status).toBe(200);
    const dataValid = await resValid.json();
    expect(dataValid.lesson.substituteTeacherMembershipId).toBe(teacherA2MembershipId);
  });

  it("10. Lesson role scoping: Unassigned teacher cannot modify or cancel another teacher's lesson", async () => {
    // Lesson created for Teacher A1
    const resCreate = await createLesson(
      mockRequest("/api/lessons", "POST", {
        moduleId: moduleA1Id,
        title: "Teacher 1 private lesson",
      })
    );
    const { lesson } = await resCreate.json();

    // Teacher 2 (not assigned to this lesson/group/course) attempts to cancel
    const t2 = await db.centerMembership.findUnique({
      where: { id: teacherA2MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: t2!.userId,
      email: t2!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const resForbidden = await updateLesson(
      mockRequest("/api/lessons", "PATCH", {
        lessonId: lesson.id,
        status: "CANCELLED",
        cancelledReason: "Malicious cancellation",
      })
    );
    expect(resForbidden.status).toBe(403);
  });
});
