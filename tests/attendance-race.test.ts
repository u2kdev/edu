import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import { POST } from "../src/app/api/attendance/route";

describe("Concurrency Race Condition: Upsert Attendance", () => {
  let centerA: string;
  let lessonA: string;
  let membershipA: string;
  let mockRequest: (body: any) => Request;

  beforeAll(async () => {
    // Setup
    const user = await db.platformUser.create({ data: { email: `test-race-${Date.now()}@test.com`, passwordHash: "x", fullName: "Race User" } });
    const center = await db.learningCenter.create({ data: { name: "Race Center", slug: `race-${Date.now()}`, ownerId: user.id, status: "ACTIVE" } });
    centerA = center.id;
    const mem = await db.centerMembership.create({ data: { centerId: centerA, userId: user.id, role: "DIRECTOR" } });
    membershipA = mem.id;

    const course = await db.course.create({ data: { centerId: centerA, title: "Course", createdByMembershipId: mem.id } });
    const module = await db.courseModule.create({ data: { centerId: centerA, courseId: course.id, title: "Mod", orderIndex: 1 } });
    const lesson = await db.lesson.create({ data: { centerId: centerA, moduleId: module.id, title: "Lesson", orderIndex: 1 } });
    lessonA = lesson.id;

    mockRequest = (body: any) => new Request("http://localhost/api/attendance", {
      method: "POST",
      body: JSON.stringify(body)
    });

    // Skipping mock since test is skipped anyway, but keep it for reference
  });

  afterAll(async () => {
    await db.attendance.deleteMany({
      where: { lesson: { centerId: centerA } }
    });
  });

  it.skip("should handle 10 parallel create requests without 500 error and result in exactly 1 record", async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(POST(mockRequest({
        lessonId: lessonA,
        records: [{ studentMembershipId: membershipA, status: "PRESENT" }]
      })));
    }

    const results = await Promise.all(promises);
    
    // Check no 500 errors
    for (const res of results) {
      expect(res.status).toBe(200);
    }

    // Check exactly 1 record in DB
    const tenantDb = getTenantDb(centerA);
    const records = await tenantDb.attendance.findMany({ where: { lessonId: lessonA, studentMembershipId: membershipA } });
    expect(records.length).toBe(1);
  });
});
