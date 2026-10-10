import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import crypto from "crypto";
import type { LearningCenter, PlatformUser, CenterMembership, Course, Group } from "@prisma/client";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-3d Item 3: Platform context with undefined membership across API routes", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let superAdmin: PlatformUser;
  let studentUser: PlatformUser;

  let ownerMember: CenterMembership;
  let studentMember: CenterMembership;
  let course: Course;
  let group: Group;
  let testRecord: { id: string };

  let saToken: string;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_undef_${ts}@test.com`, passwordHash: "x", fullName: "Owner Undef" },
    });
    superAdmin = await db.platformUser.create({
      data: { email: `sa_undef_${ts}@test.com`, passwordHash: "x", fullName: "SA Undef", platformRole: "SUPERADMIN" },
    });
    studentUser = await db.platformUser.create({
      data: { email: `student_undef_${ts}@test.com`, passwordHash: "x", fullName: "Student Undef" },
    });

    center = await db.learningCenter.create({
      data: { name: "Undef Member Center", slug: `undef-cnt-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Undef Plan ${ts}`,
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
      data: { centerId: center.id, userId: owner.id, role: "DIRECTOR", status: "ACTIVE" },
    });
    studentMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: studentUser.id, role: "STUDENT", status: "ACTIVE" },
    });

    course = await db.course.create({
      data: { centerId: center.id, title: "Course Undef", createdByMembershipId: ownerMember.id },
    });

    group = await db.group.create({
      data: { centerId: center.id, courseId: course.id, name: "Group Undef" },
    });

    const courseModule = await db.courseModule.create({
      data: { centerId: center.id, courseId: course.id, title: "Module Undef" },
    });

    const lesson = await db.lesson.create({
      data: { centerId: center.id, moduleId: courseModule.id, title: "Lesson Undef" },
    });

    const material = await db.material.create({
      data: { centerId: center.id, title: "Material Undef", materialType: "TEST" },
    });

    testRecord = await db.test.create({
      data: {
        centerId: center.id,
        materialId: material.id,
        maxAttempts: 3,
        passingScorePercent: 60,
      },
    });

    // SuperAdmin token: no CenterMembership in database!
    const jti = `jti_${Date.now()}_${Math.random()}`;
    const jtiHash = crypto.createHash("sha256").update(jti).digest("hex");
    await db.userSession.create({
      data: {
        userId: superAdmin.id,
        jtiHash,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    saToken = signJWT({
      userId: superAdmin.id,
      email: superAdmin.email,
      platformRole: "SUPERADMIN",
      activeCenterId: center.id,
    }, "1h", jti);
    mockToken = saToken;
  });

  afterAll(async () => {
    await db.testAttempt.deleteMany({ where: { centerId: center.id } });
    await db.test.deleteMany({ where: { centerId: center.id } });
    await db.material.deleteMany({ where: { centerId: center.id } });
    await db.inviteCode.deleteMany({ where: { centerId: center.id } });
    await db.lesson.deleteMany({ where: { centerId: center.id } });
    await db.courseModule.deleteMany({ where: { centerId: center.id } });
    await db.group.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { contains: "Undef Plan" } } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.userSession.deleteMany({ where: { userId: superAdmin.id } });
    await db.platformUser.deleteMany({ where: { id: { in: [owner.id, superAdmin.id, studentUser.id] } } });
  });

  function reqWithSa(url: string, method: string, body?: unknown) {
    return new Request(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${saToken}`,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  it("POST /api/courses rejects platform staff with 403 because creator membership cannot be resolved", async () => {
    const { POST } = await import("../src/app/api/courses/route");
    const res = await POST(reqWithSa(`http://localhost/api/courses?centerId=${center.id}`, "POST", { title: "SA Course" }));
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toContain("Could not resolve your membership");
  });

  it("POST /api/grades rejects platform staff with 403 because teacher membership is required", async () => {
    const { POST } = await import("../src/app/api/grades/route");
    const res = await POST(reqWithSa(`http://localhost/api/grades?centerId=${center.id}`, "POST", {
      studentMembershipId: studentMember.id,
      gradeType: "HOMEWORK",
      value: 100,
    }));
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance rejects platform staff with 403 because marker membership is required", async () => {
    const { POST } = await import("../src/app/api/attendance/route");
    const lesson = await db.lesson.findFirst({ where: { centerId: center.id } });
    const res = await POST(reqWithSa(`http://localhost/api/attendance?centerId=${center.id}`, "POST", {
      lessonId: lesson!.id,
      records: [{ studentMembershipId: studentMember.id, status: "PRESENT" }],
    }));
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/announcements rejects platform staff with 403 because author membership is required", async () => {
    const { POST } = await import("../src/app/api/tenant/announcements/route");
    const res = await POST(reqWithSa(`http://localhost/api/tenant/announcements?centerId=${center.id}`, "POST", {
      title: "Announce",
      body: "Hello",
    }));
    expect(res.status).toBe(403);
  });

  it("POST /api/tests/attempt rejects platform staff with 403 because only students can submit attempts", async () => {
    const { POST } = await import("../src/app/api/tests/attempt/route");
    const res = await POST(reqWithSa(`http://localhost/api/tests/attempt?centerId=${center.id}`, "POST", {
      testId: testRecord.id,
      studentAnswers: {},
    }));
    expect(res.status).toBe(403);
  });

  it("PATCH /api/homework with action SUBMIT rejects platform staff with 403", async () => {
    const { PATCH } = await import("../src/app/api/homework/route");
    const hw = await db.homework.create({
      data: {
        centerId: center.id,
        lessonId: (await db.lesson.findFirst({ where: { centerId: center.id } }))!.id,
        title: "HW Undef",
      },
    });
    const res = await PATCH(reqWithSa(`http://localhost/api/homework?centerId=${center.id}`, "PATCH", {
      action: "SUBMIT",
      homeworkId: hw.id,
    }));
    expect(res.status).toBe(403);
    await db.homework.delete({ where: { id: hw.id } });
  });

  it("POST /api/invites/generate resolves Director membership for platform staff and creates code successfully", async () => {
    const { POST } = await import("../src/app/api/invites/generate/route");
    const res = await POST(reqWithSa(`http://localhost/api/invites/generate?centerId=${center.id}`, "POST", {
      targetRole: "STUDENT",
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.invite.createdByMembershipId).toBe(ownerMember.id);
  });

  it("POST /api/invites/parent-link resolves Director membership for platform staff and creates code successfully", async () => {
    const { POST } = await import("../src/app/api/invites/parent-link/route");
    const res = await POST(reqWithSa(`http://localhost/api/invites/parent-link?centerId=${center.id}`, "POST", {
      action: "INITIATE_BY_ADMIN",
      studentId: studentMember.id,
    }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.parentInviteCode).toBeDefined();
  });

  it("GET /api/groups and /api/students/[id]/performance succeed with 200 without filtering for platform staff", async () => {
    const { GET: getGroups } = await import("../src/app/api/groups/route");
    const groupsRes = await getGroups(reqWithSa(`http://localhost/api/groups?centerId=${center.id}`, "GET"));
    expect(groupsRes.status).toBe(200);

    const { GET: getPerformance } = await import("../src/app/api/students/[id]/performance/route");
    const perfRes = await getPerformance(
      reqWithSa(`http://localhost/api/students/${studentMember.id}/performance?centerId=${center.id}`, "GET"),
      { params: { id: studentMember.id } }
    );
    expect(perfRes.status).toBe(200);
  });
});
