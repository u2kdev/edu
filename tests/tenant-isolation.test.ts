import { describe, it, expect, beforeAll } from "vitest";
import { getTenantDb } from "../src/lib/db-tenant";
import { db } from "../src/lib/db";

describe("Tenant Isolation (Prisma Extension)", () => {
  let center1Id = "";
  let center2Id = "";

  beforeAll(async () => {
    const c1 = await db.learningCenter.findFirst({ where: { slug: "center-1" } });
    const c2 = await db.learningCenter.findFirst({ where: { slug: "center-2" } });
    center1Id = c1!.id;
    center2Id = c2!.id;
  });

  it("should automatically inject centerId on read (findMany)", async () => {
    const db1 = getTenantDb(center1Id);
    const db2 = getTenantDb(center2Id);

    const c1Courses = await db1.course.findMany();
    const c2Courses = await db2.course.findMany();

    expect(c1Courses.length).toBeGreaterThan(0);
    expect(c2Courses.length).toBeGreaterThan(0);

    // Cross check
    for (const c of c1Courses) {
      expect(c.centerId).toBe(center1Id);
    }
    for (const c of c2Courses) {
      expect(c.centerId).toBe(center2Id);
    }
  });

  it("should enforce centerId on create", async () => {
    const db1 = getTenantDb(center1Id);
    const m = await db.centerMembership.findFirst({ where: { centerId: center1Id, role: "DIRECTOR" } });

    const newCourse = await db1.course.create({
      data: {
        title: "Test Course",
        isPublished: false,
        createdByMembershipId: m!.id,
      } as any
    });

    expect(newCourse.centerId).toBe(center1Id); // Injected automatically
  });

  it("should prevent updating records of another tenant", async () => {
    const db1 = getTenantDb(center1Id);
    
    // Find a course from center 2 using raw db
    const c2Course = await db.course.findFirst({ where: { centerId: center2Id } });

    // Try to update it using db1
    await expect(
      db1.course.update({
        where: { id: c2Course!.id },
        data: { title: "Hacked!" }
      })
    ).rejects.toThrow();

    // Verify it wasn't updated
    const check = await db.course.findUnique({ where: { id: c2Course!.id } });
    expect(check!.title).not.toBe("Hacked!");
  });

  it("should prevent deleting records of another tenant", async () => {
    const db1 = getTenantDb(center1Id);
    
    const c2Course = await db.course.findFirst({ where: { centerId: center2Id } });

    await expect(
      db1.course.delete({
        where: { id: c2Course!.id }
      })
    ).rejects.toThrow();

    // Verify it still exists
    const check = await db.course.findUnique({ where: { id: c2Course!.id } });
    expect(check).not.toBeNull();
  });
});
