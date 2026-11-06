import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getTeacherDashboard } from "../src/app/api/mobile/teacher/dashboard/route";
import { GET as getDirectorDashboard } from "../src/app/api/mobile/director/dashboard/route";
import { GET as getPlatformDashboard } from "../src/app/api/mobile/platform/dashboard/route";
import { POST as bulkAttendance } from "../src/app/api/attendance/bulk/route";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Teacher & Director Workspaces", () => {
  let centerId: string;
  let directorId: string;
  let directorMemberId: string;
  let teacherId: string;
  let teacherMemberId: string;
  let studentMemberId: string;
  let groupId: string;
  let courseId: string;
  let moduleId: string;
  let lessonId: string;

  let directorToken: string;
  let teacherToken: string;
  let studentToken: string;

  const directorEmail = `mb-dir-${Date.now()}@test.com`;
  const teacherEmail = `mb-tch-${Date.now()}@test.com`;
  const studentEmail = `mb-stu-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Create Director User & Center
    const dirUser = await db.platformUser.create({
      data: {
        email: directorEmail,
        passwordHash: await hashPassword("DirectorPass123!"),
        fullName: "Director Alisher",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    directorId = dirUser.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Director & Teacher Academy",
        slug: `dir-tch-${Date.now()}`,
        status: "ACTIVE",
        ownerId: directorId,
      },
    });
    centerId = center.id;

    const dirMember = await db.centerMembership.create({
      data: {
        userId: directorId,
        centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
    });
    directorMemberId = dirMember.id;

    // 2. Create Teacher
    const tchUser = await db.platformUser.create({
      data: {
        email: teacherEmail,
        passwordHash: await hashPassword("TeacherPass123!"),
        fullName: "Teacher Jamshid",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    teacherId = tchUser.id;

    const tchMember = await db.centerMembership.create({
      data: {
        userId: teacherId,
        centerId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMemberId = tchMember.id;

    // 3. Create Course & Group
    const course = await db.course.create({
      data: {
        centerId,
        title: "Frontend Engineering",
        createdByMembershipId: directorMemberId,
      },
    });
    courseId = course.id;

    const group = await db.group.create({
      data: {
        centerId,
        courseId,
        name: "React Native Batch 1",
        teacherMembershipId: teacherMemberId,
      },
    });
    groupId = group.id;

    // 4. Create Schedule Slot
    await db.scheduleSlot.create({
      data: {
        centerId,
        groupId,
        teacherMembershipId: teacherMemberId,
        dayOfWeek: 2, // Tue
        startTime: "10:00",
        endTime: "12:00",
        roomName: "Lab 202",
        status: "ACTIVE",
      },
    });

    // 5. Create Module & Lesson
    const mod = await db.courseModule.create({
      data: {
        centerId,
        courseId,
        title: "Module 1",
        orderIndex: 1,
      },
    });
    moduleId = mod.id;

    const lesson = await db.lesson.create({
      data: {
        centerId,
        moduleId,
        title: "Lesson 1: Components",
        orderIndex: 1,
      },
    });
    lessonId = lesson.id;

    // 6. Create Student & Enrollment
    const stuUser = await db.platformUser.create({
      data: {
        email: studentEmail,
        passwordHash: await hashPassword("StudentPass123!"),
        fullName: "Student Bekzod",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    const stuMember = await db.centerMembership.create({
      data: {
        userId: stuUser.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMemberId = stuMember.id;

    await db.enrollment.create({
      data: {
        centerId,
        studentMembershipId: studentMemberId,
        groupId,
        status: "ACTIVE",
      },
    });

    // 7. Create Payment record for director metrics
    await db.centerPayment.create({
      data: {
        centerId,
        studentMembershipId: studentMemberId,
        amount: 500000,
        status: "PAID",
      },
    });

    // Sessions & Tokens
    const jtiD = uuidv4();
    directorToken = signJWT({
      userId: directorId,
      email: directorEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
      jti: jtiD,
    });
    await db.userSession.create({
      data: {
        userId: directorId,
        jtiHash: hashJti(jtiD),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "director-mobile",
      },
    });

    const jtiT = uuidv4();
    teacherToken = signJWT({
      userId: teacherId,
      email: teacherEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "TEACHER",
      jti: jtiT,
    });
    await db.userSession.create({
      data: {
        userId: teacherId,
        jtiHash: hashJti(jtiT),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "teacher-mobile",
      },
    });

    const jtiS = uuidv4();
    studentToken = signJWT({
      userId: stuUser.id,
      email: studentEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "STUDENT",
      jti: jtiS,
    });
    await db.userSession.create({
      data: {
        userId: stuUser.id,
        jtiHash: hashJti(jtiS),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "student-mobile",
      },
    });
  });

  afterAll(async () => {
    if (centerId) {
      await db.attendance.deleteMany({ where: { lessonId } });
      await db.centerPayment.deleteMany({ where: { centerId } });
      await db.lesson.deleteMany({ where: { centerId } });
      if (moduleId) await db.courseModule.deleteMany({ where: { id: moduleId } });
      await db.scheduleSlot.deleteMany({ where: { centerId } });
      await db.enrollment.deleteMany({ where: { centerId } });
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    await db.userSession.deleteMany({
      where: { userId: { in: [directorId, teacherId] } },
    });
    await db.platformUser.deleteMany({
      where: { email: { in: [directorEmail, teacherEmail, studentEmail] } },
    });
  });

  const mockReq = (url: string, method: string, token: string, body?: unknown) => {
    return new Request(`http://localhost${url}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it("GET /api/mobile/teacher/dashboard: returns assigned groups and schedule", async () => {
    const req = mockReq("/api/mobile/teacher/dashboard", "GET", teacherToken);
    const res = await getTeacherDashboard(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.teacher.fullName).toBe("Teacher Jamshid");
    expect(data.groups.length).toBe(1);
    expect(data.groups[0].name).toBe("React Native Batch 1");
    expect(data.groups[0].latestLessonId).toBe(lessonId);
    expect(data.groups[0].activeStudentsCount).toBe(1);
    expect(data.schedule.length).toBe(1);
    expect(data.schedule[0].roomName).toBe("Lab 202");
  });

  it("GET /api/mobile/teacher/dashboard: rejects student access (403)", async () => {
    const req = mockReq("/api/mobile/teacher/dashboard", "GET", studentToken);
    const res = await getTeacherDashboard(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance/bulk: teacher can mark attendance for group", async () => {
    const req = mockReq("/api/attendance/bulk", "POST", teacherToken, {
      groupId,
      lessonId,
      defaultStatus: "PRESENT",
      studentStatusMap: {
        [studentMemberId]: "PRESENT",
      },
    });

    const res = await bulkAttendance(req);
    expect(res.status).toBe(200);

    // Verify record in DB
    const att = await db.attendance.findUnique({
      where: {
        lessonId_studentMembershipId: {
          lessonId,
          studentMembershipId: studentMemberId,
        },
      },
    });
    expect(att).not.toBeNull();
    expect(att?.status).toBe("PRESENT");
  });

  it("GET /api/mobile/director/dashboard: returns complete KPI summary", async () => {
    const req = mockReq("/api/mobile/director/dashboard", "GET", directorToken);
    const res = await getDirectorDashboard(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.center.name).toBe("Director & Teacher Academy");
    expect(data.kpis.activeStudentsCount).toBe(1);
    expect(data.kpis.activeTeachersCount).toBe(1);
    expect(data.kpis.activeGroupsCount).toBe(1);
    expect(data.kpis.totalRevenue).toBe(500000);
    expect(data.kpis.averageAttendancePercent).toBe(100);
  });

  it("GET /api/mobile/director/dashboard: rejects teacher access (403)", async () => {
    const req = mockReq("/api/mobile/director/dashboard", "GET", teacherToken);
    const res = await getDirectorDashboard(req);
    expect(res.status).toBe(403);
  });

  it("GET /api/mobile/platform/dashboard: rejects non-platform user (403)", async () => {
    const req = mockReq("/api/mobile/platform/dashboard", "GET", directorToken);
    const res = await getPlatformDashboard(req);
    expect(res.status).toBe(403);
  });
});
