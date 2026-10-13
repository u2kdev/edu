import { describe, it, expect, beforeAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT, hashPassword } from "../src/lib/auth";
import { POST as createGrade, PATCH as updateGrade } from "../src/app/api/grades/route";
import { POST as finalizeGrades } from "../src/app/api/grades/finalize/route";
import { POST as unlockGrades } from "../src/app/api/grades/unlock/route";

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

const mockRequest = (url: string, method: "POST" | "PATCH", body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

describe("Grade finalization and unlock security", () => {
  let centerId: string;
  let directorUser: { id: string; email: string };
  let directorMembershipId: string;
  let teacherUser: { id: string; email: string };
  let teacherMembershipId: string;
  let studentMembershipId: string;
  let groupId: string;
  let finalGradeId: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword("Password123!");
    const now = new Date();

    let plan = await db.subscriptionPlan.findFirst();
    if (!plan) {
      plan = await db.subscriptionPlan.create({
        data: {
          name: "Grades Security Plan",
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
        email: `dir-grdsec-${Date.now()}@test.com`,
        fullName: "Director GrdSec",
        passwordHash,
        emailVerified: now,
      },
    });
    directorUser = { id: dirUser.id, email: dirUser.email };

    const center = await db.learningCenter.create({
      data: {
        name: "GrdSec Center",
        slug: `grdsec-center-${Date.now()}`,
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
    directorMembershipId = dirMem.id;

    const teachUser = await db.platformUser.create({
      data: {
        email: `teach-grdsec-${Date.now()}@test.com`,
        fullName: "Teacher GrdSec",
        passwordHash,
        emailVerified: now,
      },
    });
    teacherUser = { id: teachUser.id, email: teachUser.email };

    const teachMem = await db.centerMembership.create({
      data: {
        userId: teachUser.id,
        centerId,
        role: "TEACHER",
        status: "ACTIVE",
      },
    });
    teacherMembershipId = teachMem.id;

    const stuUser = await db.platformUser.create({
      data: {
        email: `stu-grdsec-${Date.now()}@test.com`,
        fullName: "Student GrdSec",
        passwordHash,
        emailVerified: now,
      },
    });
    const stuMem = await db.centerMembership.create({
      data: {
        userId: stuUser.id,
        centerId,
        role: "STUDENT",
        status: "ACTIVE",
      },
    });
    studentMembershipId = stuMem.id;

    const course = await db.course.create({
      data: {
        centerId,
        title: "Course GrdSec",
        createdByMembershipId: dirMem.id,
      },
    });

    const group = await db.group.create({
      data: {
        centerId,
        courseId: course.id,
        name: "Group GrdSec",
        teacherMembershipId,
      },
    });
    groupId = group.id;

    await db.enrollment.create({
      data: {
        centerId,
        groupId,
        studentMembershipId,
        status: "ACTIVE",
      },
    });

    // Create initial grade
    const grade = await db.grade.create({
      data: {
        centerId,
        studentMembershipId,
        groupId,
        teacherMembershipId,
        gradeType: "TEST",
        value: 85,
        maxValue: 100,
        lifecycle: "FINAL",
        finalizedAt: now,
        finalizedById: directorMembershipId,
      },
    });
    finalGradeId = grade.id;
  });

  const setDirectorAuth = () => {
    mockToken = signJWT({
      userId: directorUser.id,
      email: directorUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "DIRECTOR",
    });
  };

  const setTeacherAuth = () => {
    mockToken = signJWT({
      userId: teacherUser.id,
      email: teacherUser.email,
      platformRole: "NONE",
      activeCenterId: centerId,
      activeCenterRole: "TEACHER",
    });
  };

  it("1. Direct modification of FINAL grade by Director returns 409 or 403", async () => {
    setDirectorAuth();
    const res = await updateGrade(
      mockRequest(`/api/grades?centerId=${centerId}`, "PATCH", {
        id: finalGradeId,
        value: 95,
      })
    );
    expect([409, 403]).toContain(res.status);
    expect(res.status).toBe(409);
  });

  it("2. Non-director cannot unlock a grade (403)", async () => {
    setTeacherAuth();
    const res = await unlockGrades(
      mockRequest(`/api/grades/unlock?centerId=${centerId}`, "POST", {
        gradeId: finalGradeId,
        reason: "Teacher wants to fix a mistake",
      })
    );
    expect(res.status).toBe(403);
  });

  it("3. Unlocking requires a reason (400)", async () => {
    setDirectorAuth();
    const res = await unlockGrades(
      mockRequest(`/api/grades/unlock?centerId=${centerId}`, "POST", {
        gradeId: finalGradeId,
        reason: "",
      })
    );
    expect(res.status).toBe(400);
  });

  it("4. Director can unlock with reason, records in AuditLog, and grade can then be updated", async () => {
    setDirectorAuth();
    const unlockRes = await unlockGrades(
      mockRequest(`/api/grades/unlock?centerId=${centerId}`, "POST", {
        gradeId: finalGradeId,
        reason: "Appealed by student and verified by director",
      })
    );
    expect(unlockRes.status).toBe(200);

    // Verify AuditLog record
    const audit = await db.auditLog.findFirst({
      where: {
        centerId,
        action: "GRADE_UNLOCKED",
        resourceId: finalGradeId,
      },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).toBeDefined();
    expect(audit?.detailsJson).toContain("Appealed by student and verified by director");

    // Grade can now be updated
    const updateRes = await updateGrade(
      mockRequest(`/api/grades?centerId=${centerId}`, "PATCH", {
        id: finalGradeId,
        value: 95,
      })
    );
    expect(updateRes.status).toBe(200);
    const updated = await updateRes.json();
    expect(updated.grade.value).toBe(95);
  });

  it("5. Cannot modify grades in a locked assessment period", async () => {
    setDirectorAuth();
    // Finalize assessment period for group
    const finRes = await finalizeGrades(
      mockRequest(`/api/grades/finalize?centerId=${centerId}`, "POST", {
        groupId,
      })
    );
    expect(finRes.status).toBe(200);

    // Teacher attempt to create new grade in locked period -> 409 or 403
    setTeacherAuth();
    const createRes = await createGrade(
      mockRequest(`/api/grades?centerId=${centerId}`, "POST", {
        studentMembershipId,
        groupId,
        gradeType: "HOMEWORK",
        value: 80,
      })
    );
    expect([409, 403]).toContain(createRes.status);
  });
});
