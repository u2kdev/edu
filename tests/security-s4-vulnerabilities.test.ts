import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { MembershipRole, PlatformRole } from "@prisma/client";
import { db } from "../src/lib/db";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { getActorAcademicScope } from "../src/lib/tenant-access";
import { DELETE as deleteLesson, GET as getLesson } from "../src/app/api/lessons/[id]/route";
import { PATCH as updateModule } from "../src/app/api/modules/[id]/route";
import { POST as reorderModules } from "../src/app/api/modules/reorder/route";
import { PATCH as updateMaterial, DELETE as deleteMaterial } from "../src/app/api/materials/[id]/route";
import { DELETE as deleteTest, GET as getTest } from "../src/app/api/tests/[id]/route";
import { POST as startTest } from "../src/app/api/tests/start/route";
import { GET as getHomework, PATCH as reviewHomework } from "../src/app/api/homework/route";
import { GET as getStudent, GET as getStudentPerformance } from "../src/app/api/students/[id]/route";
import { GET as getTickets } from "../src/app/api/tickets/route";
import { GET as getDeveloperAuditLogs } from "../src/app/api/developer/audit-logs/route";
import { POST as switchTenant } from "../src/app/api/auth/switch-tenant/route";
import { POST as presignUpload } from "../src/app/api/upload/presign/route";
import crypto from "crypto";

describe("Stage S4 Vulnerability Reproduction Test Suite (Must Fail on Old Code)", () => {
  let centerId: string = "";
  let directorId: string = "";
  let teacherAId: string = "";
  let teacherBId: string = "";
  let assistantAId: string = "";
  let studentAId: string = "";
  let studentBId: string = "";
  let accountantId: string = "";
  let platformAdminId: string = "";

  let teacherAToken: string = "";
  let teacherBToken: string = "";
  let assistantAToken: string = "";
  let studentAToken: string = "";
  let accountantToken: string = "";
  let platformAdminToken: string = "";

  let teacherAMemId: string = "";
  let teacherBMemId: string = "";
  let assistantAMemId: string = "";
  let studentAMemId: string = "";
  let studentBMemId: string = "";
  let accountantMemId: string = "";

  let courseAId: string = "";
  let courseBId: string = "";
  let groupAId: string = "";
  let groupBId: string = "";
  let moduleBId: string = "";
  let lessonBId: string = "";
  let materialCourseBId: string = "";
  let testBId: string = "";
  let homeworkSharedId: string = "";
  let ticketId: string = "";

  beforeAll(async () => {
    // 1. Create Learning Center
    const directorUser = await db.platformUser.create({
      data: {
        email: `s4-dir-${Date.now()}@test.com`,
        passwordHash: await hashPassword("DirectorPass123!"),
        fullName: "S4 Director",
        platformRole: "NONE",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    directorId = directorUser.id;

    const center = await db.learningCenter.create({
      data: {
        name: `S4 RBAC Center ${Date.now()}`,
        slug: `s4-center-${Date.now()}`,
        ownerId: directorId,
        status: "ACTIVE",
      },
    });
    centerId = center.id;

    await db.centerMembership.create({
      data: {
        userId: directorId,
        centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });

    // Helper to create members
    async function createMember(
      email: string,
      name: string,
      role: MembershipRole | "NONE",
      platformRole: PlatformRole = "NONE"
    ) {
      const u = await db.platformUser.create({
        data: {
          email,
          passwordHash: await hashPassword("MemberPass123!"),
          fullName: name,
          platformRole,
          emailVerified: new Date(),
          isActive: true,
        },
      });
      let m = null;
      if (role && role !== "NONE") {
        m = await db.centerMembership.create({
          data: {
            userId: u.id,
            centerId,
            role,
            status: "ACTIVE",
          },
        });
      }
      const jti = crypto.randomUUID();
      const token = signJWT(
        {
          userId: u.id,
          email: u.email,
          platformRole,
          activeCenterId: m ? centerId : undefined,
          activeCenterRole: m ? role : undefined,
        },
        "1h",
        jti
      );
      await db.userSession.create({
        data: {
          userId: u.id,
          jtiHash: hashJti(jti),
          expiresAt: new Date(Date.now() + 3600000),
        },
      });
      return { user: u, membership: m, token };
    }

    const tA = await createMember(`s4-teacher-a-${Date.now()}@test.com`, "Teacher A", "TEACHER");
    teacherAId = tA.user.id;
    teacherAMemId = tA.membership!.id;
    teacherAToken = tA.token;

    const tB = await createMember(`s4-teacher-b-${Date.now()}@test.com`, "Teacher B", "TEACHER");
    teacherBId = tB.user.id;
    teacherBMemId = tB.membership!.id;
    teacherBToken = tB.token;

    const asA = await createMember(`s4-asst-a-${Date.now()}@test.com`, "Assistant A", "TEACHER_ASSISTANT");
    assistantAId = asA.user.id;
    assistantAMemId = asA.membership!.id;
    assistantAToken = asA.token;

    const sA = await createMember(`s4-student-a-${Date.now()}@test.com`, "Student A", "STUDENT");
    studentAId = sA.user.id;
    studentAMemId = sA.membership!.id;
    studentAToken = sA.token;

    const sB = await createMember(`s4-student-b-${Date.now()}@test.com`, "Student B", "STUDENT");
    studentBId = sB.user.id;
    studentBMemId = sB.membership!.id;

    const acc = await createMember(`s4-acc-${Date.now()}@test.com`, "Accountant", "ACCOUNTANT");
    accountantId = acc.user.id;
    accountantMemId = acc.membership!.id;
    accountantToken = acc.token;

    const pAdmin = await createMember(`s4-padmin-${Date.now()}@test.com`, "Platform Admin", "NONE", "PLATFORM_ADMIN");
    platformAdminId = pAdmin.user.id;
    platformAdminToken = pAdmin.token;

    // 2. Setup Courses & Groups
    // Course A -> Group A (Teacher A, Assistant A, Student A)
    const cA = await db.course.create({
      data: {
        centerId,
        title: "Course A (Teacher A)",
        createdByMembershipId: teacherAMemId,
      },
    });
    courseAId = cA.id;

    const gA = await db.group.create({
      data: {
        centerId,
        name: "Group A",
        courseId: courseAId,
        teacherMembershipId: teacherAMemId,
        assistantMembershipId: assistantAMemId,
      },
    });
    groupAId = gA.id;

    await db.enrollment.create({
      data: {
        centerId,
        groupId: groupAId,
        studentMembershipId: studentAMemId,
        status: "ACTIVE",
      },
    });

    // Course B -> Group B (Teacher B, Student B)
    const cB = await db.course.create({
      data: {
        centerId,
        title: "Course B (Teacher B)",
        createdByMembershipId: teacherBMemId,
      },
    });
    courseBId = cB.id;

    const gB = await db.group.create({
      data: {
        centerId,
        name: "Group B",
        courseId: courseBId,
        teacherMembershipId: teacherBMemId,
      },
    });
    groupBId = gB.id;

    await db.enrollment.create({
      data: {
        centerId,
        groupId: groupBId,
        studentMembershipId: studentBMemId,
        status: "ACTIVE",
      },
    });

    // Course B Module & Lesson
    const mB = await db.courseModule.create({
      data: {
        centerId,
        courseId: courseBId,
        title: "Module B1",
        orderIndex: 1,
      },
    });
    moduleBId = mB.id;

    const lB = await db.lesson.create({
      data: {
        centerId,
        moduleId: moduleBId,
        title: "Lesson B1",
        orderIndex: 1,
      },
    });
    lessonBId = lB.id;

    // Course B Material (course-level, groupId: null)
    const matB = await db.material.create({
      data: {
        centerId,
        courseId: courseBId,
        groupId: null,
        title: "Course B Reference Book",
        materialType: "BOOK",
      },
    });
    materialCourseBId = matB.id;

    // Course B Test
    const testMatB = await db.material.create({
      data: {
        centerId,
        courseId: courseBId,
        title: "Course B Test Material",
        materialType: "TEST",
      },
    });
    const tRecB = await db.test.create({
      data: {
        centerId,
        materialId: testMatB.id,
        passingScorePercent: 60,
      },
    });
    testBId = tRecB.id;

    // Homework on Lesson B
    const hw = await db.homework.create({
      data: {
        centerId,
        lessonId: lessonBId,
        title: "Homework on Course B",
      },
    });
    homeworkSharedId = hw.id;

    // Student B submission on Homework B
    await db.homeworkSubmission.create({
      data: {
        centerId,
        homeworkId: homeworkSharedId,
        studentMembershipId: studentBMemId,
        status: "SUBMITTED",
      },
    });

    // Support ticket with internal note
    const ticket = await db.supportTicket.create({
      data: {
        centerId,
        creatorUserId: studentAId,
        subject: "Cannot access materials",
        status: "OPEN",
      },
    });
    ticketId = ticket.id;

    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: studentAId,
        message: "Please help, I cannot see materials",
        isInternal: false,
      },
    });

    await db.ticketMessage.create({
      data: {
        ticketId: ticket.id,
        senderUserId: directorId,
        message: "Internal admin note: investigate student account",
        isInternal: true,
      },
    });
  });

  afterAll(async () => {
    if (centerId) {
      await db.ticketMessage.deleteMany({ where: { ticket: { centerId } } }).catch(() => {});
      await db.supportTicket.deleteMany({ where: { centerId } }).catch(() => {});
      await db.grade.deleteMany({ where: { centerId } }).catch(() => {});
      await db.homeworkSubmission.deleteMany({ where: { centerId } }).catch(() => {});
      await db.homework.deleteMany({ where: { lesson: { centerId } } }).catch(() => {});
      await db.test.deleteMany({ where: { centerId } }).catch(() => {});
      await db.material.deleteMany({ where: { centerId } }).catch(() => {});
      await db.lesson.deleteMany({ where: { centerId } }).catch(() => {});
      await db.courseModule.deleteMany({ where: { centerId } }).catch(() => {});
      await db.enrollment.deleteMany({ where: { group: { course: { centerId } } } }).catch(() => {});
      await db.group.deleteMany({ where: { course: { centerId } } }).catch(() => {});
      await db.course.deleteMany({ where: { centerId } }).catch(() => {});
      await db.centerMembership.deleteMany({ where: { centerId } }).catch(() => {});
      await db.learningCenter.deleteMany({ where: { id: centerId } }).catch(() => {});
    }
  });

  // =========================================================================
  // S4.1: Accountant MUST NOT have unrestricted academic scope
  // =========================================================================
  it("S4.1: getActorAcademicScope MUST NOT return isUnrestricted=true for ACCOUNTANT", async () => {
    const mockCtx = {
      center: { id: centerId },
      role: "ACCOUNTANT" as const,
      membership: { id: accountantMemId },
      session: { user: { id: accountantId, platformRole: "NONE" } },
      isPlatformStaff: false,
      isImpersonating: false,
      isReadOnly: false,
      getTenantDb: () => db,
    } as unknown as Parameters<typeof getActorAcademicScope>[0];

    const scope = await getActorAcademicScope(mockCtx);

    // On old code: ACCOUNTANT returns isUnrestricted: true!
    // On secure fixed code: ACCOUNTANT returns isUnrestricted: false
    expect(scope.isUnrestricted).toBe(false);
  });

  // =========================================================================
  // S4.2: Teacher A MUST NOT delete Lesson of Teacher B's Course (IDOR)
  // =========================================================================
  it("S4.2: DELETE /api/lessons/[id] MUST reject teacher not assigned to lesson's group/course with 403", async () => {
    const targetLesson = await db.lesson.create({
      data: {
        centerId,
        moduleId: moduleBId,
        title: "Lesson Target For Deletion",
        orderIndex: 99,
      },
    });

    const req = new Request(`http://localhost/api/lessons/${targetLesson.id}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await deleteLesson(req, { params: { id: targetLesson.id } });
    // On old code: Teacher A gets 200/deleted because `actorRole === 'TEACHER'` passes without group check!
    // On secure fixed code: Teacher A is blocked with 403
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // S4.3: Teacher A MUST NOT modify Module of Course B (IDOR)
  // =========================================================================
  it("S4.3: PATCH /api/modules/[id] MUST reject teacher not assigned to course with 403", async () => {
    const req = new Request(`http://localhost/api/modules/${moduleBId}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
        "content-type": "application/json",
      },
      body: JSON.stringify({ title: "Hacked Module Title" }),
    });

    const res = await updateModule(req, { params: { id: moduleBId } });
    // On old code: passes because `actorRole === 'TEACHER'` without course assignment check
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // S4.4: Teacher A MUST NOT delete course-level Material of Course B (IDOR)
  // =========================================================================
  it("S4.4: DELETE /api/materials/[id] MUST reject teacher not assigned to course for course-level material with 403", async () => {
    const req = new Request(`http://localhost/api/materials/${materialCourseBId}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await deleteMaterial(req, { params: { id: materialCourseBId } });
    // On old code: passes because if `groupId === null` assertGroupAccess is skipped!
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // S4.5: Teacher A MUST NOT delete Test of Course B (IDOR)
  // =========================================================================
  it("S4.5: DELETE /api/tests/[id] MUST reject teacher not assigned to test's course with 403", async () => {
    const targetMat = await db.material.create({
      data: {
        centerId,
        courseId: courseBId,
        title: "Course B Target Test Mat",
        materialType: "TEST",
      },
    });
    const targetTest = await db.test.create({
      data: {
        centerId,
        materialId: targetMat.id,
        passingScorePercent: 50,
      },
    });

    const req = new Request(`http://localhost/api/tests/${targetTest.id}`, {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await deleteTest(req, { params: { id: targetTest.id } });
    // On old code: passes because `role === 'TEACHER'` without course check
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // S4.6: POST /api/tests/start MUST reject non-student or un-enrolled member
  // =========================================================================
  it("S4.6: POST /api/tests/start MUST reject teacher or un-enrolled member with 403", async () => {
    // Teacher A trying to start a test
    const reqTeacher = new Request(`http://localhost/api/tests/start`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
        "content-type": "application/json",
      },
      body: JSON.stringify({ testId: testBId }),
    });

    const resTeacher = await startTest(reqTeacher);
    // On old code: only checks membership?.id, allowing teachers and parents to start test attempts!
    expect(resTeacher.status).toBe(403);

    // Student A (not enrolled in Course B) trying to start Test B
    const reqStudent = new Request(`http://localhost/api/tests/start`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${studentAToken}`,
        "x-tenant-id": centerId,
        "content-type": "application/json",
      },
      body: JSON.stringify({ testId: testBId }),
    });

    const resStudent = await startTest(reqStudent);
    // On old code: does not check assertMaterialAccess for testId!
    expect(resStudent.status).toBe(403);
  });

  // =========================================================================
  // S4.7: Teacher A MUST NOT see Homework submissions of Student B from Group B
  // =========================================================================
  it("S4.7: GET /api/homework MUST scope submissions so Teacher A cannot view Student B's submissions", async () => {
    const req = new Request(`http://localhost/api/homework?lessonId=${lessonBId}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${teacherAToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await getHomework(req);
    // On old code: Teacher A without assigned group receives 403 on lesson or if accessed receives all submissions!
    // Either forbidden from lesson B (403), or submissions from Student B are filtered out
    if (res.status === 200) {
      const data = (await res.json()) as {
        homeworks?: Array<{ submissions?: Array<{ studentMembershipId: string }> }>;
      };
      const allSubmissions = data.homeworks?.flatMap((h) => h.submissions || []) || [];
      const hasStudentB = allSubmissions.some((s) => s.studentMembershipId === studentBMemId);
      expect(hasStudentB).toBe(false);
    } else {
      expect(res.status).toBe(403);
    }
  });

  // =========================================================================
  // S4.8: GET /api/developer/audit-logs MUST reject PLATFORM_ADMIN
  // =========================================================================
  it("S4.8: GET /api/developer/audit-logs MUST reject PLATFORM_ADMIN with 403", async () => {
    const req = new Request(`http://localhost/api/developer/audit-logs`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${platformAdminToken}`,
      },
    });

    const res = await getDeveloperAuditLogs(req);
    // On old code: checks "audit.read", which PLATFORM_ADMIN has -> 200!
    // On fixed code: checks "platform.audit.read" -> 403!
    expect(res.status).toBe(403);
  });

  // =========================================================================
  // S4.9: Support tickets MUST NOT leak internal messages to non-platform staff
  // =========================================================================
  it("S4.9: GET /api/tickets MUST NOT return messages where isInternal=true to student or director", async () => {
    const req = new Request(`http://localhost/api/tickets`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${studentAToken}`,
        "x-tenant-id": centerId,
      },
    });

    const res = await getTickets(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as {
      tickets?: Array<{ id: string; messages?: Array<{ isInternal?: boolean }> }>;
    };
    const t = data.tickets?.find((tick) => tick.id === ticketId);
    expect(t).toBeDefined();
    // Messages must NOT contain any internal note
    const hasInternal = t?.messages?.some((m) => m.isInternal === true);
    expect(hasInternal).toBe(false);
  });

  // =========================================================================
  // S4.10: POST /api/upload/presign MUST reject STUDENT for MATERIAL category
  // =========================================================================
  it("S4.10: POST /api/upload/presign MUST reject STUDENT attempting to presign MATERIAL category", async () => {
    process.env.FEATURE_UPLOADS = "true";
    const req = new Request(`http://localhost/api/upload/presign`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${studentAToken}`,
        "x-tenant-id": centerId,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        fileName: "lecture.pdf",
        contentType: "application/pdf",
        sizeBytes: 1024,
        category: "MATERIAL",
      }),
    });

    const res = await presignUpload(req);
    // On old code: passes because presign only checks requireTenantAccess!
    // On fixed code: returns 403
    expect(res.status).toBe(403);
    delete process.env.FEATURE_UPLOADS;
  });
});
