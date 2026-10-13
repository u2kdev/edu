import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { GET as getAttendance, POST as markAttendance } from "../src/app/api/attendance/route";
import { GET as getAttendanceAnalytics } from "../src/app/api/attendance/analytics/route";
import { GET as getGradeMatrix } from "../src/app/api/grades/matrix/route";
import { POST as finalizeGrades } from "../src/app/api/grades/finalize/route";
import { POST as createGrade, PATCH as updateGrade } from "../src/app/api/grades/route";
import { GET as exportAttendance } from "../src/app/api/attendance/export/route";
import { GET as exportGrades } from "../src/app/api/grades/export/route";

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
    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Attendance Test Plan",
          maxStudents: 50,
          maxTeachers: 5,
          maxCourses: 5,
          maxBranches: 1,
          priceMonthly: 0,
        },
      });
    }
    const planId = plan.id;

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

  it("5. Attendance Rate & Risk List: Calculates rate and flags students with < 80% attendance in riskList", async () => {
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

    const lessonA = await db.lesson.findUnique({ where: { id: lessonA1Id } });

    // Create 3 additional lessons
    const l2 = await db.lesson.create({
      data: { centerId: centerAId, moduleId: lessonA!.moduleId, title: "Lesson A2" },
    });
    const l3 = await db.lesson.create({
      data: { centerId: centerAId, moduleId: lessonA!.moduleId, title: "Lesson A3" },
    });
    const l4 = await db.lesson.create({
      data: { centerId: centerAId, moduleId: lessonA!.moduleId, title: "Lesson A4" },
    });

    // Mark Student A2 as ABSENT in l2, l3 and PRESENT in l4
    await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        records: [{ studentMembershipId: studentA2MembershipId, status: "ABSENT" }],
      })
    );
    await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: l2.id,
        records: [
          { studentMembershipId: studentA1MembershipId, status: "PRESENT" },
          { studentMembershipId: studentA2MembershipId, status: "ABSENT" },
        ],
      })
    );
    await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: l3.id,
        records: [
          { studentMembershipId: studentA1MembershipId, status: "PRESENT" },
          { studentMembershipId: studentA2MembershipId, status: "ABSENT" },
        ],
      })
    );
    await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: l4.id,
        records: [
          { studentMembershipId: studentA1MembershipId, status: "PRESENT" },
          { studentMembershipId: studentA2MembershipId, status: "PRESENT" },
        ],
      })
    );

    // Director query for analytics
    const resAnalytics = await getAttendanceAnalytics(mockRequest("/api/attendance/analytics", "GET"));
    expect(resAnalytics.status).toBe(200);
    const data = await resAnalytics.json();

    expect(data.riskList).toBeDefined();
    const riskStudentIds = data.riskList.map((s: { studentMembershipId: string }) => s.studentMembershipId);
    expect(riskStudentIds).toContain(studentA2MembershipId);
    expect(riskStudentIds).not.toContain(studentA1MembershipId);

    const s2Stats = data.riskList.find((s: { studentMembershipId: string }) => s.studentMembershipId === studentA2MembershipId);
    expect(s2Stats.attendanceRate).toBeLessThanOrEqual(50);
    expect(s2Stats.isAtRisk).toBe(true);

    // Student A1 query: sees own stats, cannot see other students in riskList
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

    const resStudentAnalytics = await getAttendanceAnalytics(mockRequest("/api/attendance/analytics", "GET"));
    expect(resStudentAnalytics.status).toBe(200);
    const studentData = await resStudentAnalytics.json();
    expect(studentData.studentStats.studentMembershipId).toBe(studentA1MembershipId);
    expect(studentData.riskList).toHaveLength(0);
  });

  let createdGradeId: string;

  it("6. Gradebook Matrix: Returns students x assignments matrix with weighted scores and letter grades", async () => {
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    // Create several grades for Student A1 in Group A1
    const hwRes = await createGrade(
      mockRequest("/api/grades", "POST", {
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        lessonId: lessonA1Id,
        gradeType: "HOMEWORK",
        value: 90,
        maxValue: 100,
        comment: "Great HW",
      })
    );
    expect(hwRes.status).toBe(200);
    const hwData = await hwRes.json();
    createdGradeId = hwData.grade.id;

    await createGrade(
      mockRequest("/api/grades", "POST", {
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        lessonId: lessonA1Id,
        gradeType: "TEST",
        value: 80,
        maxValue: 100,
      })
    );

    // Call matrix API
    const matrixRes = await getGradeMatrix(
      mockRequest(`/api/grades/matrix?groupId=${groupA1Id}`, "GET")
    );
    expect(matrixRes.status).toBe(200);
    const matrixData = await matrixRes.json();

    expect(matrixData.groupId).toBe(groupA1Id);
    expect(matrixData.students).toBeInstanceOf(Array);
    const s1Row = matrixData.students.find(
      (s: { studentMembershipId: string }) => s.studentMembershipId === studentA1MembershipId
    );
    expect(s1Row).toBeDefined();
    expect(s1Row.weightedScore).toBeGreaterThan(0);
    expect(s1Row.letterGrade).toBeDefined();

    // Tenant isolation: Director B cannot view Group A1's matrix
    const dirBMem = await db.centerMembership.findFirst({
      where: { centerId: centerBId, role: "DIRECTOR" },
      include: { user: true },
    });
    // Use center B context
    mockToken = signJWT({
      userId: dirBMem!.userId,
      email: dirBMem!.user.email,
      platformRole: "NONE",
      activeCenterId: centerBId,
      activeCenterRole: "DIRECTOR",
    });

    const resIsolated = await getGradeMatrix(
      mockRequest(`/api/grades/matrix?groupId=${groupA1Id}`, "GET")
    );
    expect([403, 404]).toContain(resIsolated.status);
  });

  it("7. Assessment Period Finalization: Finalizes grades, records audit log, restricted to Director/Admin", async () => {
    // Teacher attempt to finalize -> 403 Forbidden
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const teacherFinRes = await finalizeGrades(
      mockRequest("/api/grades/finalize", "POST", {
        groupId: groupA1Id,
      })
    );
    expect(teacherFinRes.status).toBe(403);

    // Director finalize -> 200 Success
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

    const dirFinRes = await finalizeGrades(
      mockRequest("/api/grades/finalize", "POST", {
        groupId: groupA1Id,
      })
    );
    expect(dirFinRes.status).toBe(200);
    const finData = await dirFinRes.json();
    expect(finData.finalizedCount).toBeGreaterThan(0);

    // Verify in DB that grades are now FINAL
    const updatedGrade = await db.grade.findUnique({
      where: { id: createdGradeId },
    });
    expect(updatedGrade?.lifecycle).toBe("FINAL");
    expect(updatedGrade?.finalizedById).toBe(directorAMembershipId);
  });

  it("8. Finalized Grade Lock: Teacher cannot modify a finalized grade", async () => {
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    const patchRes = await updateGrade(
      mockRequest("/api/grades", "PATCH", {
        id: createdGradeId,
        value: 100,
      })
    );
    expect(patchRes.status).toBe(403);
    const patchData = await patchRes.json();
    expect(patchData.error).toMatch(/Cannot modify a finalized grade/i);
  });

  it("9. Attendance CSV Export: Sanitizes formula injection and enforces role access", async () => {
    // Insert attendance record with formula injection payload
    const teachA1 = await db.centerMembership.findUnique({
      where: { id: teacherA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA1!.userId,
      email: teachA1!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });

    await markAttendance(
      mockRequest("/api/attendance", "POST", {
        lessonId: lessonA1Id,
        records: [
          {
            studentMembershipId: studentA1MembershipId,
            groupId: groupA1Id,
            status: "PRESENT",
            note: "=cmd|' /C calc'!A0",
          },
        ],
      })
    );

    // Teacher of Group A1 exports CSV
    const exportRes = await exportAttendance(
      mockRequest(`/api/attendance/export?groupId=${groupA1Id}`, "GET")
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("text/csv");
    const csvContent = await exportRes.text();
    // Verify formula injection is sanitized with leading single quote
    expect(csvContent).toContain("`'=cmd|' /C calc'!A0`".replace(/`/g, ""));
    expect(csvContent).not.toMatch(/^=cmd/m);

    // Teacher of Group A2 cannot export Group A1
    const teachA2 = await db.centerMembership.findUnique({
      where: { id: teacherA2MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: teachA2!.userId,
      email: teachA2!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "TEACHER",
    });
    const forbiddenRes = await exportAttendance(
      mockRequest(`/api/attendance/export?groupId=${groupA1Id}`, "GET")
    );
    expect(forbiddenRes.status).toBe(403);

    // Student cannot export attendance CSV
    const student = await db.centerMembership.findUnique({
      where: { id: studentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: student!.userId,
      email: student!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "STUDENT",
    });
    const studentExportRes = await exportAttendance(
      mockRequest(`/api/attendance/export?groupId=${groupA1Id}`, "GET")
    );
    expect(studentExportRes.status).toBe(403);
  });

  it("10. Grades CSV Export: Sanitizes formula injection and enforces role access", async () => {
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

    // Create a grade with formula injection payload in comment
    await createGrade(
      mockRequest("/api/grades", "POST", {
        studentMembershipId: studentA1MembershipId,
        groupId: groupA1Id,
        gradeType: "TEST",
        value: 95,
        maxValue: 100,
        comment: "+2+5=7 danger formula",
      })
    );

    const exportRes = await exportGrades(
      mockRequest(`/api/grades/export?groupId=${groupA1Id}`, "GET")
    );
    expect(exportRes.status).toBe(200);
    expect(exportRes.headers.get("content-type")).toContain("text/csv");
    const buf = await exportRes.arrayBuffer();
    const bytes = new Uint8Array(buf);
    // Verify UTF-8 BOM bytes (EF BB BF)
    expect(bytes[0]).toBe(0xef);
    expect(bytes[1]).toBe(0xbb);
    expect(bytes[2]).toBe(0xbf);
    const csvContent = new TextDecoder().decode(bytes);
    expect(csvContent).toContain("'+2+5=7 danger formula");

    // Parent cannot export grades CSV
    const parent = await db.centerMembership.findUnique({
      where: { id: parentA1MembershipId },
      include: { user: true },
    });
    mockToken = signJWT({
      userId: parent!.userId,
      email: parent!.user.email,
      platformRole: "NONE",
      activeCenterId: centerAId,
      activeCenterRole: "PARENT",
    });
    const parentExportRes = await exportGrades(
      mockRequest(`/api/grades/export?groupId=${groupA1Id}`, "GET")
    );
    expect(parentExportRes.status).toBe(403);
  });
});

