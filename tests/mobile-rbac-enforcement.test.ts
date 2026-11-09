import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { GET as getTeacherDashboard } from "../src/app/api/mobile/teacher/dashboard/route";
import { GET as getDirectorDashboard } from "../src/app/api/mobile/director/dashboard/route";
import { POST as markAttendanceBulk } from "../src/app/api/attendance/bulk/route";
import { PATCH as updateHomework } from "../src/app/api/homework/route";
import { signJWT, hashJti, hashPassword } from "../src/lib/auth";
import { db } from "../src/lib/db";
import { v4 as uuidv4 } from "uuid";

describe("Mobile Server-Side RBAC Enforcement", () => {
  let studentUserId: string = "";
  let studentMembershipId: string = "";
  let centerId: string = "";
  let otherCenterId: string = "";
  let studentBearerToken: string = "";
  const studentEmail = `student-rbac-${Date.now()}@test.com`;

  beforeAll(async () => {
    // 1. Create a Platform User for the student
    const studentUser = await db.platformUser.create({
      data: {
        email: studentEmail,
        passwordHash: await hashPassword("MobilePass123!"),
        fullName: "Enrolled Student",
        preferredLanguage: "ru",
        emailVerified: new Date(),
        isActive: true,
      },
    });
    studentUserId = studentUser.id;

    // 2. Create Learning Center A
    const center = await db.learningCenter.create({
      data: {
        name: "RBAC Test Academy",
        slug: `rbac-academy-${Date.now()}`,
        status: "ACTIVE",
        ownerId: studentUserId,
      },
    });
    centerId = center.id;

    // 3. Create Learning Center B (unaudited / other center)
    const otherCenter = await db.learningCenter.create({
      data: {
        name: "Other Academy",
        slug: `other-academy-${Date.now()}`,
        status: "ACTIVE",
        ownerId: studentUserId,
      },
    });
    otherCenterId = otherCenter.id;

    // 4. Enroll user strictly as STUDENT in Center A
    const membership = await db.centerMembership.create({
      data: {
        userId: studentUserId,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMembershipId = membership.id;

    // 5. Issue valid Bearer session token
    const jti = uuidv4();
    studentBearerToken = signJWT(
      {
        userId: studentUserId,
        email: studentEmail,
        platformRole: "NONE",
        activeCenterId: centerId,
        activeCenterRole: "STUDENT",
        jti,
      },
      "15m"
    );

    await db.userSession.create({
      data: {
        userId: studentUserId,
        jtiHash: hashJti(jti),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        userAgent: "student-rbac-tester",
      },
    });
  });

  afterAll(async () => {
    if (studentUserId) {
      await db.auditLog.deleteMany({ where: { actorUserId: studentUserId } });
      await db.userSession.deleteMany({ where: { userId: studentUserId } });
    }
    if (studentMembershipId) {
      await db.centerMembership.deleteMany({ where: { id: studentMembershipId } });
    }
    if (centerId || otherCenterId) {
      await db.learningCenter.deleteMany({ where: { id: { in: [centerId, otherCenterId] } } });
    }
    if (studentUserId) {
      await db.platformUser.deleteMany({ where: { id: studentUserId } });
    }
  });

  const createReq = (url: string, method: string = "GET", body?: unknown, centerHeader: string = centerId) => {
    const headers: Record<string, string> = {
      authorization: `Bearer ${studentBearerToken}`,
      "x-center-id": centerHeader,
    };
    if (body) {
      headers["content-type"] = "application/json";
    }

    return new Request(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  };

  it("STUDENT receives 403 Forbidden on Teacher Dashboard endpoint", async () => {
    const req = createReq("http://localhost/api/mobile/teacher/dashboard");
    const res = await getTeacherDashboard(req);
    expect(res.status).toBe(403);
  });

  it("STUDENT receives 403 Forbidden on Director Dashboard endpoint", async () => {
    const req = createReq("http://localhost/api/mobile/director/dashboard");
    const res = await getDirectorDashboard(req);
    expect(res.status).toBe(403);
  });

  it("STUDENT receives 403 Forbidden when attempting to mark attendance in bulk", async () => {
    const req = createReq("http://localhost/api/attendance/bulk", "POST", {
      lessonId: "mock-lesson-id",
      groupId: "mock-group-id",
      studentStatusMap: {},
    });
    const res = await markAttendanceBulk(req);
    expect(res.status).toBe(403);
  });

  it("STUDENT receives 403 Forbidden when attempting to grade homework", async () => {
    const req = createReq("http://localhost/api/homework", "PATCH", {
      action: "GRADE",
      homeworkId: "mock-hw-id",
      studentMembershipId,
      grade: 100,
    });
    const res = await updateHomework(req);
    expect(res.status).toBe(403);
  });

  it("STUDENT cannot spoof membership into Center B (receives 403)", async () => {
    const req = createReq("http://localhost/api/mobile/teacher/dashboard", "GET", undefined, otherCenterId);
    const res = await getTeacherDashboard(req);
    expect(res.status).toBe(403);
  });
});
