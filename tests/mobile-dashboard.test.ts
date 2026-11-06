import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getStudentDashboard } from "../src/app/api/mobile/student/dashboard/route";
import { GET as getParentDashboard } from "../src/app/api/mobile/parent/dashboard/route";
import { hashPassword, signJWT, hashJti } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Dashboard Endpoints (Student & Parent)", () => {
  let centerId: string;
  let ownerId: string;
  let teacherMemberId: string;
  let student1MemberId: string;
  let student2MemberId: string;
  let parentMemberId: string;
  let groupId: string;
  let courseId: string;
  let moduleId: string;
  let lessonId: string;
  let attendanceId: string;

  let student1Token: string;
  let parentToken: string;

  const ownerEmail = `mb-owner-${Date.now()}@test.com`;
  const teacherEmail = `mb-teacher-${Date.now()}@test.com`;
  const student1Email = `mb-student1-${Date.now()}@test.com`;
  const student2Email = `mb-student2-${Date.now()}@test.com`;
  const parentEmail = `mb-parent-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Create Owner & Center
    const owner = await db.platformUser.create({
      data: {
        email: ownerEmail,
        passwordHash: await hashPassword("OwnerPass123!"),
        fullName: "Center Owner",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    ownerId = owner.id;

    const center = await db.learningCenter.create({
      data: {
        name: "Mobile Dashboard Academy",
        slug: `mobile-dash-${Date.now()}`,
        status: "ACTIVE",
        ownerId,
      },
    });
    centerId = center.id;

    // 2. Create Teacher
    const teacherUser = await db.platformUser.create({
      data: {
        email: teacherEmail,
        passwordHash: await hashPassword("Teacher123!"),
        fullName: "Teacher Bobur",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    const teacherMember = await db.centerMembership.create({
      data: {
        userId: teacherUser.id,
        centerId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMemberId = teacherMember.id;

    // 3. Create Course with creator
    const course = await db.course.create({
      data: {
        centerId,
        title: "IELTS Intensive",
        createdByMembershipId: teacherMemberId,
      },
    });
    courseId = course.id;

    // 4. Create Group
    const group = await db.group.create({
      data: {
        centerId,
        courseId,
        name: "IELTS Group 1",
        teacherMembershipId: teacherMemberId,
      },
    });
    groupId = group.id;

    // 5. Create Schedule Slot
    await db.scheduleSlot.create({
      data: {
        centerId,
        groupId,
        teacherMembershipId: teacherMemberId,
        dayOfWeek: 1, // Mon
        startTime: "14:00",
        endTime: "16:00",
        roomName: "Room 101",
        status: "ACTIVE",
      },
    });

    // 6. Create CourseModule, Lesson & Homework
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
        title: "Lesson 1: Reading strategies",
        orderIndex: 1,
      },
    });
    lessonId = lesson.id;

    await db.homework.create({
      data: {
        centerId,
        lessonId,
        title: "Practice Reading Test 1",
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      },
    });

    // 7. Create Student 1 & Enroll
    const student1User = await db.platformUser.create({
      data: {
        email: student1Email,
        passwordHash: await hashPassword("Student123!"),
        fullName: "Aziza Karimova",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    const student1Member = await db.centerMembership.create({
      data: {
        userId: student1User.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    student1MemberId = student1Member.id;

    await db.enrollment.create({
      data: {
        centerId,
        studentMembershipId: student1MemberId,
        groupId,
        status: "ACTIVE",
      },
    });

    // Attendance & Grade for Student 1
    const att = await db.attendance.create({
      data: {
        lessonId,
        studentMembershipId: student1MemberId,
        groupId,
        markedByMembershipId: teacherMemberId,
        status: "PRESENT",
      },
    });
    attendanceId = att.id;

    await db.grade.create({
      data: {
        centerId,
        studentMembershipId: student1MemberId,
        teacherMembershipId: teacherMemberId,
        lessonId,
        value: 95,
        maxValue: 100,
        comment: "Excellent work",
      },
    });

    // 8. Create Student 2 (Alien student, not linked to parent)
    const student2User = await db.platformUser.create({
      data: {
        email: student2Email,
        passwordHash: await hashPassword("Student123!"),
        fullName: "Alien Student",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    const student2Member = await db.centerMembership.create({
      data: {
        userId: student2User.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    student2MemberId = student2Member.id;

    // 9. Create Parent & Link to Student 1
    const parentUser = await db.platformUser.create({
      data: {
        email: parentEmail,
        passwordHash: await hashPassword("Parent123!"),
        fullName: "Olim Karimov (Parent)",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    const parentMember = await db.centerMembership.create({
      data: {
        userId: parentUser.id,
        centerId,
        role: "PARENT",
        status: "ACTIVE",
      },
    });
    parentMemberId = parentMember.id;

    await db.parentLink.create({
      data: {
        parentMembershipId: parentMemberId,
        studentMembershipId: student1MemberId,
        status: "CONFIRMED",
      },
    });

    // Create session tokens
    const jtiS1 = uuidv4();
    student1Token = signJWT({
      userId: student1User.id,
      email: student1Email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "STUDENT",
      jti: jtiS1,
    });
    await db.userSession.create({
      data: {
        userId: student1User.id,
        jtiHash: hashJti(jtiS1),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "student1-mobile",
      },
    });

    const jtiP = uuidv4();
    parentToken = signJWT({
      userId: parentUser.id,
      email: parentEmail,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "PARENT",
      jti: jtiP,
    });
    await db.userSession.create({
      data: {
        userId: parentUser.id,
        jtiHash: hashJti(jtiP),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        userAgent: "parent-mobile",
      },
    });
  });

  afterAll(async () => {
    if (attendanceId) {
      await db.attendance.deleteMany({ where: { id: attendanceId } });
    }
    if (centerId) {
      await db.grade.deleteMany({ where: { centerId } });
      await db.homeworkSubmission.deleteMany({ where: { centerId } });
      await db.homework.deleteMany({ where: { centerId } });
      await db.lesson.deleteMany({ where: { centerId } });
      if (moduleId) await db.courseModule.deleteMany({ where: { id: moduleId } });
      await db.scheduleSlot.deleteMany({ where: { centerId } });
      await db.enrollment.deleteMany({ where: { centerId } });
      if (parentMemberId) {
        await db.parentLink.deleteMany({ where: { parentMembershipId: parentMemberId } });
      }
      await db.group.deleteMany({ where: { centerId } });
      await db.course.deleteMany({ where: { centerId } });
      await db.centerMembership.deleteMany({ where: { centerId } });
      await db.learningCenter.deleteMany({ where: { id: centerId } });
    }
    await db.userSession.deleteMany({
      where: {
        userId: { in: [ownerId] },
      },
    });
    await db.platformUser.deleteMany({
      where: {
        email: { in: [ownerEmail, teacherEmail, student1Email, student2Email, parentEmail] },
      },
    });
  });

  const mockGetReq = (url: string, token: string) => {
    return new Request(`http://localhost${url}`, {
      method: "GET",
      headers: {
        authorization: `Bearer ${token}`,
        "x-forwarded-for": "127.0.0.1",
      },
    });
  };

  it("GET /api/mobile/student/dashboard: returns complete student summary", async () => {
    const req = mockGetReq("/api/mobile/student/dashboard", student1Token);
    const res = await getStudentDashboard(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.student.fullName).toBe("Aziza Karimova");
    expect(data.groups.length).toBe(1);
    expect(data.groups[0].name).toBe("IELTS Group 1");

    // Upcoming schedule check
    expect(data.upcomingSchedule.length).toBe(1);
    expect(data.upcomingSchedule[0].groupName).toBe("IELTS Group 1");
    expect(data.upcomingSchedule[0].roomName).toBe("Room 101");

    // Active homework check
    expect(data.activeHomework.length).toBe(1);
    expect(data.activeHomework[0].title).toBe("Practice Reading Test 1");

    // Metrics check
    expect(data.metrics.attendancePercent).toBe(100);
    expect(data.metrics.totalClasses).toBe(1);
    expect(data.metrics.averageScore).toBe(95);
  });

  it("GET /api/mobile/student/dashboard: rejects non-student (parent token)", async () => {
    const req = mockGetReq("/api/mobile/student/dashboard", parentToken);
    const res = await getStudentDashboard(req);
    expect(res.status).toBe(403);
  });

  it("GET /api/mobile/parent/dashboard: returns linked children and default active child data", async () => {
    const req = mockGetReq("/api/mobile/parent/dashboard", parentToken);
    const res = await getParentDashboard(req);

    expect(res.status).toBe(200);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.children.length).toBe(1);
    expect(data.children[0].fullName).toBe("Aziza Karimova");
    expect(data.activeChild).toBeDefined();
    expect(data.activeChild.fullName).toBe("Aziza Karimova");
    expect(data.activeChild.metrics.attendancePercent).toBe(100);
    expect(data.activeChild.metrics.averageScore).toBe(95);
  });

  it("GET /api/mobile/parent/dashboard: IDOR guard rejects querying unlinked child (403)", async () => {
    const req = mockGetReq(`/api/mobile/parent/dashboard?childId=${student2MemberId}`, parentToken);
    const res = await getParentDashboard(req);

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Forbidden");
  });
});
