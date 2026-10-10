import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import type { LearningCenter, PlatformUser, Course, CourseModule, Lesson, CenterMembership } from "@prisma/client";

import { GET as getAttendance, POST as postAttendance } from "../src/app/api/attendance/route";
import { GET as getGrades, POST as postGrades } from "../src/app/api/grades/route";
import { GET as getHomework, POST as postHomework } from "../src/app/api/homework/route";
import { GET as getPayments, POST as postPayments } from "../src/app/api/center-payments/route";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-3c Item 3: Platform roles read and write permissions on real database", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let superAdmin: PlatformUser;
  let developer: PlatformUser;
  let platformSupport: PlatformUser;
  let student: PlatformUser;

  let ownerMember: CenterMembership;
  let studentMember: CenterMembership;
  let course: Course;
  let courseModule: CourseModule;
  let lesson: Lesson;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_r3_${ts}@test.com`, passwordHash: "x", fullName: "Owner R3", emailVerified: new Date() },
    });
    superAdmin = await db.platformUser.create({
      data: { email: `sa_r3_${ts}@test.com`, passwordHash: "x", fullName: "SuperAdmin R3", platformRole: "SUPERADMIN", emailVerified: new Date() },
    });
    developer = await db.platformUser.create({
      data: { email: `dev_r3_${ts}@test.com`, passwordHash: "x", fullName: "Developer R3", platformRole: "DEVELOPER", emailVerified: new Date() },
    });
    platformSupport = await db.platformUser.create({
      data: { email: `ps_r3_${ts}@test.com`, passwordHash: "x", fullName: "Support R3", platformRole: "PLATFORM_SUPPORT", emailVerified: new Date() },
    });
    student = await db.platformUser.create({
      data: { email: `stud_r3_${ts}@test.com`, passwordHash: "x", fullName: "Student R3", platformRole: "NONE", emailVerified: new Date() },
    });

    center = await db.learningCenter.create({
      data: { name: "Real Routes Center", slug: `rrc-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Real Plan ${ts}`,
        priceMonthly: 10,
        maxStudents: 100,
        maxTeachers: 50,
        maxCourses: 50,
        maxBranches: 10,
      },
    });

    await db.subscription.create({
      data: {
        centerId: center.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });

    ownerMember = await db.centerMembership.create({
      data: { userId: owner.id, centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    studentMember = await db.centerMembership.create({
      data: { userId: student.id, centerId: center.id, role: "STUDENT", status: "ACTIVE" },
    });

    course = await db.course.create({
      data: { centerId: center.id, title: "Course R3", createdByMembershipId: ownerMember.id },
    });
    courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module R3" },
    });
    lesson = await db.lesson.create({
      data: { centerId: center.id, moduleId: courseModule.id, title: "Lesson R3" },
    });
  });

  afterAll(async () => {
    await db.attendance.deleteMany({ where: { lessonId: lesson.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { contains: "Real Plan" } } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.userSession.deleteMany({
      where: { userId: { in: [owner.id, superAdmin.id, developer.id, platformSupport.id, student.id] } },
    });
    await db.platformUser.deleteMany({
      where: { id: { in: [owner.id, superAdmin.id, developer.id, platformSupport.id, student.id] } },
    });
  });

  const setAuth = async (user: PlatformUser) => {
    const jti = `jti_${Date.now()}_${Math.random()}`;
    const crypto = await import("crypto");
    const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    mockToken = signJWT({
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: center.id,
    }, "1h", jti);
  };

  it("SUPERADMIN reads /api/attendance, /api/grades, /api/homework, /api/center-payments without 500", async () => {
    await setAuth(superAdmin);

    const attRes = await getAttendance(new Request(`http://localhost/api/attendance?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(attRes.status).toBe(200);

    const gradesRes = await getGrades(new Request(`http://localhost/api/grades?centerId=${center.id}`));
    expect(gradesRes.status).toBe(200);

    const hwRes = await getHomework(new Request(`http://localhost/api/homework?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(hwRes.status).toBe(200);

    const payRes = await getPayments(new Request(`http://localhost/api/center-payments?centerId=${center.id}`));
    expect(payRes.status).toBe(200);
  });

  it("DEVELOPER reads /api/attendance, /api/grades, /api/homework, /api/center-payments without 500", async () => {
    await setAuth(developer);

    const attRes = await getAttendance(new Request(`http://localhost/api/attendance?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(attRes.status).toBe(200);

    const gradesRes = await getGrades(new Request(`http://localhost/api/grades?centerId=${center.id}`));
    expect(gradesRes.status).toBe(200);

    const hwRes = await getHomework(new Request(`http://localhost/api/homework?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(hwRes.status).toBe(200);

    const payRes = await getPayments(new Request(`http://localhost/api/center-payments?centerId=${center.id}`));
    expect(payRes.status).toBe(200);
  });

  it("PLATFORM_SUPPORT reads without 500 (200) and writes with 403 on all 4 routes", async () => {
    await setAuth(platformSupport);

    // READS
    const attRes = await getAttendance(new Request(`http://localhost/api/attendance?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(attRes.status).toBe(200);

    const gradesRes = await getGrades(new Request(`http://localhost/api/grades?centerId=${center.id}`));
    expect(gradesRes.status).toBe(200);

    const hwRes = await getHomework(new Request(`http://localhost/api/homework?centerId=${center.id}&lessonId=${lesson.id}`));
    expect(hwRes.status).toBe(200);

    const payRes = await getPayments(new Request(`http://localhost/api/center-payments?centerId=${center.id}`));
    expect(payRes.status).toBe(200);

    // WRITES (All return 403)
    const attWrite = await postAttendance(new Request(`http://localhost/api/attendance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: center.id,
        lessonId: lesson.id,
        records: [{ studentMembershipId: studentMember.id, status: "PRESENT" }],
      }),
    }));
    expect(attWrite.status).toBe(403);

    const gradeWrite = await postGrades(new Request(`http://localhost/api/grades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: center.id,
        studentMembershipId: studentMember.id,
        value: 100,
        gradeType: "TEST",
      }),
    }));
    expect(gradeWrite.status).toBe(403);

    const hwWrite = await postHomework(new Request(`http://localhost/api/homework`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: center.id,
        lessonId: lesson.id,
        title: "HW Test",
      }),
    }));
    expect(hwWrite.status).toBe(403);

    const payWrite = await postPayments(new Request(`http://localhost/api/center-payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        centerId: center.id,
        studentMembershipId: studentMember.id,
        amount: 50,
      }),
    }));
    expect(payWrite.status).toBe(403);
  });
});
