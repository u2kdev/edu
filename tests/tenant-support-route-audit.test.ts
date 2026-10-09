import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { signJWT } from "../src/lib/auth";
import type { LearningCenter, PlatformUser } from "@prisma/client";

// Import route handlers
import { POST as postBulkAttendance } from "../src/app/api/attendance/bulk/route";
import { POST as postAttendance } from "../src/app/api/attendance/route";
import { POST as postPayment, PATCH as patchPayment } from "../src/app/api/center-payments/route";
import { POST as postCourse } from "../src/app/api/courses/route";
import { POST as postGrade, PATCH as patchGrade, DELETE as deleteGrade } from "../src/app/api/grades/route";
import { POST as postGroup } from "../src/app/api/groups/route";
import { POST as postHomework, PATCH as patchHomework } from "../src/app/api/homework/route";
import { POST as postBulkImportInvites } from "../src/app/api/invites/bulk-import/route";
import { POST as postGenerateInvite } from "../src/app/api/invites/generate/route";
import { POST as postParentLink } from "../src/app/api/invites/parent-link/route";
import { PATCH as patchInvite } from "../src/app/api/invites/[id]/route";
import { POST as postReorderLessons } from "../src/app/api/lessons/reorder/route";
import { POST as postLesson, PATCH as patchLesson } from "../src/app/api/lessons/route";
import { POST as postMaterial } from "../src/app/api/materials/route";
import { POST as postModule } from "../src/app/api/modules/route";
import { POST as postAnnouncement, PATCH as patchAnnouncement, DELETE as deleteAnnouncement } from "../src/app/api/tenant/announcements/route";
import { POST as postBranch, PATCH as patchBranch, DELETE as deleteBranch } from "../src/app/api/tenant/branches/route";
import { POST as postSchedule, PATCH as patchSchedule, DELETE as deleteSchedule } from "../src/app/api/tenant/schedule/route";
import { POST as postStaff, PATCH as patchStaff } from "../src/app/api/tenant/staff/route";
import { POST as postSubject, PATCH as patchSubject, DELETE as deleteSubject } from "../src/app/api/tenant/subjects/route";
import { POST as postTestAttempt } from "../src/app/api/tests/attempt/route";

let mockToken: string = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => {
      if (name === "auth_token") return { value: mockToken };
      return undefined;
    },
  }),
}));

describe("TRUST-3 Item 8: Audit all tenant write routes - PLATFORM_SUPPORT returns 403", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let platformSupport: PlatformUser;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_audit_${ts}@audit.com`, passwordHash: "x", fullName: "Owner Audit", emailVerified: new Date() },
    });
    platformSupport = await db.platformUser.create({
      data: {
        email: `ps_audit_${ts}@audit.com`,
        passwordHash: "x",
        fullName: "Platform Support Audit",
        platformRole: "PLATFORM_SUPPORT",
        emailVerified: new Date(),
      },
    });

    center = await db.learningCenter.create({
      data: { name: "Audit Center", slug: `ac-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    const plan = await db.subscriptionPlan.create({
      data: {
        name: `Audit Plan ${ts}`,
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

    await db.centerMembership.create({
      data: { userId: owner.id, centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
    });

    mockToken = signJWT({
      userId: platformSupport.id,
      email: platformSupport.email,
      platformRole: "PLATFORM_SUPPORT",
      activeCenterId: center.id,
    });
  });

  afterAll(async () => {
    await db.subscription.deleteMany({ where: { centerId: center.id } });
    await db.subscriptionPlan.deleteMany({ where: { name: { contains: "Audit Plan" } } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({ where: { email: { in: [owner.email, platformSupport.email] } } });
  });

  it("POST /api/center-payments returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/center-payments", {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
    });
    const res = await postPayment(req);
    expect(res.status).toBe(403);
  });

  it("PATCH /api/center-payments returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/center-payments", {
      method: "PATCH",
      body: JSON.stringify({ paymentId: "dummy" }),
    });
    const res = await patchPayment(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/attendance/bulk returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/attendance/bulk", {
      method: "POST",
      body: JSON.stringify({ lessonId: "dummy", groupId: "dummy" }),
    });
    const res = await postBulkAttendance(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/groups returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/groups", {
      method: "POST",
      body: JSON.stringify({ name: "Audit Group" }),
    });
    const res = await postGroup(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/homework returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/homework", {
      method: "POST",
      body: JSON.stringify({ title: "HW" }),
    });
    const res = await postHomework(req);
    expect(res.status).toBe(403);
  });

  it("PATCH /api/grades returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/grades", {
      method: "PATCH",
      body: JSON.stringify({ id: "dummy" }),
    });
    const res = await patchGrade(req);
    expect(res.status).toBe(403);
  });

  it("DELETE /api/grades returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/grades", {
      method: "DELETE",
      body: JSON.stringify({ id: "dummy" }),
    });
    const res = await deleteGrade(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/announcements returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/tenant/announcements", {
      method: "POST",
      body: JSON.stringify({ title: "A" }),
    });
    const res = await postAnnouncement(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/branches returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/tenant/branches", {
      method: "POST",
      body: JSON.stringify({ name: "B" }),
    });
    const res = await postBranch(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/schedule returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/tenant/schedule", {
      method: "POST",
      body: JSON.stringify({}),
    });
    const res = await postSchedule(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/staff returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/tenant/staff", {
      method: "POST",
      body: JSON.stringify({ email: "staff@test.com" }),
    });
    const res = await postStaff(req);
    expect(res.status).toBe(403);
  });

  it("POST /api/tenant/subjects returns 403 for PLATFORM_SUPPORT", async () => {
    const req = new Request("http://localhost/api/tenant/subjects", {
      method: "POST",
      body: JSON.stringify({ name: "Sub" }),
    });
    const res = await postSubject(req);
    expect(res.status).toBe(403);
  });
});
