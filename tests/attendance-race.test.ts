import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import { POST } from "../src/app/api/attendance/route";
import { POST as postBulk } from "../src/app/api/attendance/bulk/route";
import { signJWT, hashJti } from "../src/lib/auth";

let mockToken = "";
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (name: string) => (name === "auth_token" ? { value: mockToken } : undefined),
  }),
}));

describe("Concurrency Race Condition: Upsert Attendance", () => {
  let centerA: string;
  let lessonA: string;
  let moduleIdA: string;
  let groupIdA: string;
  let membershipA: string;
  let user: any;
  let studentA: string;
  let mockRequest: (body: any) => Request;

  beforeAll(async () => {
    // Setup
    user = await db.platformUser.create({ data: { email: `test-race-${Date.now()}@test.com`, passwordHash: "x", fullName: "Race User" } });
    const center = await db.learningCenter.create({ data: { name: "Race Center", slug: `race-${Date.now()}`, ownerId: user.id, status: "ACTIVE" } });
    centerA = center.id;
    const mem = await db.centerMembership.create({ data: { centerId: centerA, userId: user.id, role: "DIRECTOR" } });
    membershipA = mem.id;

    const studentUser = await db.platformUser.create({ data: { email: `student-${Date.now()}@test.com`, passwordHash: "x", fullName: "Student User" } });
    const sMem = await db.centerMembership.create({ data: { centerId: centerA, userId: studentUser.id, role: "STUDENT" } });
    studentA = sMem.id;

    const course = await db.course.create({ data: { centerId: centerA, title: "Course", createdByMembershipId: mem.id } });
    const module = await db.courseModule.create({ data: { centerId: centerA, courseId: course.id, title: "Mod", orderIndex: 1 } });
    moduleIdA = module.id;
    const lesson = await db.lesson.create({ data: { centerId: centerA, moduleId: module.id, title: "Lesson", orderIndex: 1 } });
    lessonA = lesson.id;

    const group = await db.group.create({ data: { centerId: centerA, name: "Race Group", courseId: course.id } });
    groupIdA = group.id;
    await db.enrollment.create({ data: { centerId: centerA, groupId: groupIdA, studentMembershipId: studentA, status: "ACTIVE" } });

    // Create session in DB and token
    await db.userSession.create({
      data: { userId: user.id, jtiHash: hashJti("jti_race"), expiresAt: new Date(Date.now() + 100000) }
    });
    mockToken = signJWT({ userId: user.id, email: user.email, platformRole: "NONE", activeCenterId: centerA, activeCenterRole: "DIRECTOR" }, "7d", "jti_race");

    mockRequest = (body: any) => new Request("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify(body)
    });
  });

  afterAll(async () => {
    await db.attendance.deleteMany({
      where: { lesson: { centerId: centerA } }
    });
    await db.enrollment.deleteMany({ where: { centerId: centerA } });
    await db.group.deleteMany({ where: { centerId: centerA } });
    await db.course.deleteMany({ where: { centerId: centerA } });
    await db.learningCenter.deleteMany({ where: { id: centerA } });
    await db.platformUser.deleteMany({ where: { id: user.id } });
  });

  it("should handle 10 parallel create requests without 500 error and result in exactly 1 record", async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(POST(mockRequest({
        lessonId: lessonA,
        records: [{ studentMembershipId: studentA, status: "PRESENT" }]
      })));
    }

    const results = await Promise.all(promises);
    
    // Check no 500 errors
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    // Check exactly 1 record in DB
    const tenantDb = getTenantDb(centerA);
    const records = await tenantDb.attendance.findMany({ where: { lessonId: lessonA, studentMembershipId: studentA } });
    expect(records.length).toBe(1);
  });

  it("should handle 10 parallel bulk requests without 500 error and result in exactly 1 record", async () => {
    const lessonBulk = await db.lesson.create({ data: { centerId: centerA, moduleId: moduleIdA, title: "Lesson Bulk", orderIndex: 2 } });
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(postBulk(new Request("http://localhost/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: lessonBulk.id,
          groupId: groupIdA,
        })
      })));
    }

    const results = await Promise.all(promises);
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    const tenantDb = getTenantDb(centerA);
    const records = await tenantDb.attendance.findMany({ where: { lessonId: lessonBulk.id, studentMembershipId: studentA } });
    expect(records.length).toBe(1);
  });
});
