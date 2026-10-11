import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";

import { GET as getStudents, POST as createStudent } from "../src/app/api/students/route";
import { GET as getStudentCard } from "../src/app/api/students/[id]/route";
import { POST as enrollStudent, DELETE as dropStudent } from "../src/app/api/groups/[id]/enrollments/route";
import { POST as transferStudent } from "../src/app/api/groups/[id]/transfer/route";

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
  method: "GET" | "POST" | "DELETE" | "PUT",
  body?: unknown
) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Core Students and Groups Management", () => {
  let centerAId: string;
  let centerBId: string;

  let directorAMembershipId: string;
  let teacherA1MembershipId: string;
  let teacherA2MembershipId: string;

  let studentA1MembershipId: string;
  let studentA2MembershipId: string;
  let studentBMembershipId: string;

  let parentA1MembershipId: string;
  let parentA2MembershipId: string;

  let groupA1Id: string;
  let groupA2Id: string;

  let defaultPlanId: string;

  beforeAll(async () => {
    const defaultPassword = "Password123!";
    const passwordHash = await hashPassword(defaultPassword);
    const now = new Date();

    const plan = await db.subscriptionPlan.findFirst();
    defaultPlanId = plan ? plan.id : "plan-id";

    // Director Center A
    const dirUserA = await db.platformUser.create({
      data: {
        email: `dir-core-a-${Date.now()}@test.com`,
        fullName: "Director Core A",
        passwordHash,
        emailVerified: now,
      },
    });

    // Center A
    const centerA = await db.learningCenter.create({
      data: {
        name: "Core Center A",
        slug: `core-center-a-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirUserA.id,
        subscriptions: {
          create: {
            planId: defaultPlanId,
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
        userId: dirUserA.id,
        centerId: centerAId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorAMembershipId = dirMemA.id;

    // Director Center B
    const dirUserB = await db.platformUser.create({
      data: {
        email: `dir-core-b-${Date.now()}@test.com`,
        fullName: "Director Core B",
        passwordHash,
        emailVerified: now,
      },
    });

    // Center B
    const centerB = await db.learningCenter.create({
      data: {
        name: "Core Center B",
        slug: `core-center-b-${Date.now()}`,
        status: "ACTIVE",
        ownerId: dirUserB.id,
        subscriptions: {
          create: {
            planId: defaultPlanId,
            status: "ACTIVE",
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          },
        },
      },
    });
    centerBId = centerB.id;

    // Teacher A1
    const tUserA1 = await db.platformUser.create({
      data: {
        email: `teach-a1-${Date.now()}@test.com`,
        fullName: "Teacher A1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "TEACHER",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    teacherA1MembershipId = tUserA1.memberships[0].id;

    // Teacher A2
    const tUserA2 = await db.platformUser.create({
      data: {
        email: `teach-a2-${Date.now()}@test.com`,
        fullName: "Teacher A2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "TEACHER",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    teacherA2MembershipId = tUserA2.memberships[0].id;

    // Student A1
    const sUserA1 = await db.platformUser.create({
      data: {
        email: `student-a1-${Date.now()}@test.com`,
        fullName: "Student A1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "STUDENT",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    studentA1MembershipId = sUserA1.memberships[0].id;

    // Student A2
    const sUserA2 = await db.platformUser.create({
      data: {
        email: `student-a2-${Date.now()}@test.com`,
        fullName: "Student A2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "STUDENT",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    studentA2MembershipId = sUserA2.memberships[0].id;

    // Student B
    const sUserB = await db.platformUser.create({
      data: {
        email: `student-b-${Date.now()}@test.com`,
        fullName: "Student B",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerBId,
            role: "STUDENT",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    studentBMembershipId = sUserB.memberships[0].id;

    // Parent A1 (linked to Student A1)
    const pUserA1 = await db.platformUser.create({
      data: {
        email: `parent-a1-${Date.now()}@test.com`,
        fullName: "Parent A1",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "PARENT",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    parentA1MembershipId = pUserA1.memberships[0].id;

    await db.parentLink.create({
      data: {
        parentMembershipId: parentA1MembershipId,
        studentMembershipId: studentA1MembershipId,
        status: "CONFIRMED",
      },
    });

    // Parent A2 (not linked to Student A1)
    const pUserA2 = await db.platformUser.create({
      data: {
        email: `parent-a2-${Date.now()}@test.com`,
        fullName: "Parent A2",
        passwordHash,
        emailVerified: now,
        memberships: {
          create: {
            centerId: centerAId,
            role: "PARENT",
            status: "ACTIVE",
          },
        },
      },
      include: { memberships: true },
    });
    parentA2MembershipId = pUserA2.memberships[0].id;

    // Course in Center A
    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Course A",
        createdByMembershipId: directorAMembershipId,
      },
    });

    // Group A1 (taught by Teacher A1, maxStudents: 1)
    const groupA1 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group A1",
        teacherMembershipId: teacherA1MembershipId,
        maxStudents: 1,
      },
    });
    groupA1Id = groupA1.id;

    // Group A2 (taught by Teacher A2, maxStudents: 5)
    const groupA2 = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: courseA.id,
        name: "Group A2",
        teacherMembershipId: teacherA2MembershipId,
        maxStudents: 5,
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
  });

  afterAll(async () => {
    await db.learningCenter.deleteMany({
      where: { id: { in: [centerAId, centerBId] } },
    });
  });

  it("1. Tenant isolation: Center A does not see students from Center B", async () => {
    const dir = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dir!.userId,
      email: dir!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const res = await getStudents(mockRequest("/api/students", "GET"));
    expect(res.status).toBe(200);
    const data = await res.json();

    const ids = data.students.map((s: { id: string }) => s.id);
    expect(ids).toContain(studentA1MembershipId);
    expect(ids).toContain(studentA2MembershipId);
    expect(ids).not.toContain(studentBMembershipId);
  });

  it("2. Role permissions: Teacher A1 sees student in their group, Teacher A2 gets 403 on other student card", async () => {
    // Teacher A1 accessing Student A1 (enrolled in Group A1 taught by Teacher A1) -> 200
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

    const res1 = await getStudentCard(
      mockRequest(`/api/students/${studentA1MembershipId}`, "GET"),
      { params: { id: studentA1MembershipId } }
    );
    expect(res1.status).toBe(200);

    // Teacher A2 accessing Student A1 (not in Teacher A2's groups) -> 403
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

    const res2 = await getStudentCard(
      mockRequest(`/api/students/${studentA1MembershipId}`, "GET"),
      { params: { id: studentA1MembershipId } }
    );
    expect(res2.status).toBe(403);
  });

  it("3. Role permissions: Student sees self, other student gets 403; Parent sees linked child, other parent gets 403", async () => {
    // Student A1 sees self
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
    const resS1 = await getStudentCard(
      mockRequest(`/api/students/${studentA1MembershipId}`, "GET"),
      { params: { id: studentA1MembershipId } }
    );
    expect(resS1.status).toBe(200);

    // Student A1 tries to access Student A2 -> 403
    const resS2 = await getStudentCard(
      mockRequest(`/api/students/${studentA2MembershipId}`, "GET"),
      { params: { id: studentA2MembershipId } }
    );
    expect(resS2.status).toBe(403);

    // Parent A1 accessing linked child (Student A1) -> 200
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
    const resP1 = await getStudentCard(
      mockRequest(`/api/students/${studentA1MembershipId}`, "GET"),
      { params: { id: studentA1MembershipId } }
    );
    expect(resP1.status).toBe(200);

    // Parent A2 accessing non-linked Student A1 -> 403
    const p2 = await db.centerMembership.findUnique({
      where: { id: parentA2MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: p2!.userId,
      email: p2!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "PARENT",
    });
    const resP2 = await getStudentCard(
      mockRequest(`/api/students/${studentA1MembershipId}`, "GET"),
      { params: { id: studentA1MembershipId } }
    );
    expect(resP2.status).toBe(403);
  });

  it("4. Group capacity: Adding student beyond maxStudents is rejected", async () => {
    // Group A1 has maxStudents: 1 and Student A1 is already enrolled
    const dir = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dir!.userId,
      email: dir!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const res = await enrollStudent(
      mockRequest(`/api/groups/${groupA1Id}/enrollments`, "POST", {
        studentMembershipId: studentA2MembershipId,
      }),
      { params: { id: groupA1Id } }
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Вместимость группы исчерпана");
  });

  it("4b. Group capacity race condition: Promise.all concurrent enrollments for the last remaining seat allows exactly one", async () => {
    // Create students C1..C5 in Center A
    const defaultPassword = "Password123!";
    const passwordHash = await hashPassword(defaultPassword);
    const now = new Date();

    // Create a group with capacity = 1 and 0 students
    const groupRace = await db.group.create({
      data: {
        centerId: centerAId,
        courseId: (await db.course.findFirst({ where: { centerId: centerAId } }))!.id,
        name: `Race Group ${Date.now()}`,
        maxStudents: 1,
      },
    });

    const candidateIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const u = await db.platformUser.create({
        data: {
          email: `race-candidate-${i}-${Date.now()}@test.com`,
          fullName: `Race Candidate ${i}`,
          passwordHash,
          emailVerified: now,
          memberships: {
            create: {
              centerId: centerAId,
              role: "STUDENT",
              status: "ACTIVE",
            },
          },
        },
        include: { memberships: true },
      });
      candidateIds.push(u.memberships[0].id);
    }

    const dir = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dir!.userId,
      email: dir!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    // Run 5 concurrent enrollments for the single remaining seat
    const responses = await Promise.all(
      candidateIds.map((cId) =>
        enrollStudent(
          mockRequest(`/api/groups/${groupRace.id}/enrollments`, "POST", {
            studentMembershipId: cId,
          }),
          { params: { id: groupRace.id } }
        )
      )
    );

    const statuses = responses.map((r) => r.status);
    const successCount = statuses.filter((s) => s === 200).length;
    const rejectedCount = statuses.filter((s) => s === 400).length;

    expect(successCount).toBe(1);
    expect(rejectedCount).toBe(4);

    // Confirm DB has exactly 1 active enrollment
    const actualEnrollments = await db.enrollment.count({
      where: { groupId: groupRace.id, status: "ACTIVE" },
    });
    expect(actualEnrollments).toBe(1);
  });

  it("5. Transfer between groups: moves student and preserves history via audit log", async () => {
    const dir = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dir!.userId,
      email: dir!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    // Transfer Student A1 from Group A1 to Group A2
    const res = await transferStudent(
      mockRequest(`/api/groups/${groupA1Id}/transfer`, "POST", {
        studentMembershipId: studentA1MembershipId,
        targetGroupId: groupA2Id,
        reason: "Moving to larger group",
      }),
      { params: { id: groupA1Id } }
    );

    expect(res.status).toBe(200);

    // Verify source enrollment is DROPPED and target enrollment is ACTIVE
    const oldEn = await db.enrollment.findUnique({
      where: {
        studentMembershipId_groupId: {
          studentMembershipId: studentA1MembershipId,
          groupId: groupA1Id,
        },
      },
    });
    expect(oldEn?.status).toBe("DROPPED");

    const newEn = await db.enrollment.findUnique({
      where: {
        studentMembershipId_groupId: {
          studentMembershipId: studentA1MembershipId,
          groupId: groupA2Id,
        },
      },
    });
    expect(newEn?.status).toBe("ACTIVE");

    // Check AuditLog
    const audit = await db.auditLog.findFirst({
      where: {
        centerId: centerAId,
        action: "STUDENT_TRANSFERRED",
        resourceId: studentA1MembershipId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.detailsJson).toContain("Moving to larger group");
  });

  it("6. Drop student: marks enrollment as DROPPED and logs reason in audit log", async () => {
    const dir = await db.centerMembership.findUnique({
      where: { id: directorAMembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: dir!.userId,
      email: dir!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "DIRECTOR",
    });

    const res = await dropStudent(
      mockRequest(`/api/groups/${groupA2Id}/enrollments`, "DELETE", {
        studentMembershipId: studentA1MembershipId,
        reason: "Relocated to another city",
      }),
      { params: { id: groupA2Id } }
    );

    expect(res.status).toBe(200);

    const en = await db.enrollment.findUnique({
      where: {
        studentMembershipId_groupId: {
          studentMembershipId: studentA1MembershipId,
          groupId: groupA2Id,
        },
      },
    });
    expect(en?.status).toBe("DROPPED");

    // Check AuditLog
    const audit = await db.auditLog.findFirst({
      where: {
        centerId: centerAId,
        action: "STUDENT_DROPPED",
        resourceId: studentA1MembershipId,
      },
    });
    expect(audit).not.toBeNull();
    expect(audit?.detailsJson).toContain("Relocated to another city");
  });
});
