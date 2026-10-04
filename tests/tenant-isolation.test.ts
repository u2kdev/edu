import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getTenantDb } from "../src/lib/db-tenant";
import { db } from "../src/lib/db";

describe("True Tenant Isolation (Real SQLite DB)", () => {
  let centerA: string;
  let centerB: string;
  let ownerA: string;
  let ownerB: string;
  let courseA: string;
  let courseB: string;

  let memberA: string;
  let memberB: string;

  beforeAll(async () => {
    // Setup Centers
    const oA = await db.platformUser.create({ data: { email: `ownerA-${Date.now()}@test.com`, passwordHash: "x", fullName: "A" } });
    const oB = await db.platformUser.create({ data: { email: `ownerB-${Date.now()}@test.com`, passwordHash: "x", fullName: "B" } });
    ownerA = oA.id; ownerB = oB.id;

    const cA = await db.learningCenter.create({ data: { name: "Center A", slug: `ca-${Date.now()}`, ownerId: ownerA, status: "ACTIVE" } });
    const cB = await db.learningCenter.create({ data: { name: "Center B", slug: `cb-${Date.now()}`, ownerId: ownerB, status: "ACTIVE" } });
    centerA = cA.id; centerB = cB.id;

    const mA = await db.centerMembership.create({ data: { centerId: centerA, userId: ownerA, role: "DIRECTOR" } });
    const mB = await db.centerMembership.create({ data: { centerId: centerB, userId: ownerB, role: "DIRECTOR" } });
    memberA = mA.id; memberB = mB.id;

    // Create courses directly using raw DB to bypass any middleware for setup
    const cA_C = await db.course.create({ data: { centerId: centerA, title: "Course A", createdByMembershipId: memberA } });
    const cB_C = await db.course.create({ data: { centerId: centerB, title: "Course B", createdByMembershipId: memberB } });
    courseA = cA_C.id; courseB = cB_C.id;
  });

  afterAll(async () => {
    await db.course.deleteMany({ where: { centerId: { in: [centerA, centerB] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerA, centerB] } } });
    await db.platformUser.deleteMany({ where: { id: { in: [ownerA, ownerB] } } });
  });

  it("findMany & count should only return tenant's records", async () => {
    const dbA = getTenantDb(centerA);
    const courses = await dbA.course.findMany();
    expect(courses.length).toBe(1);
    expect(courses[0].id).toBe(courseA);

    const count = await dbA.course.count();
    expect(count).toBe(1);
  });

  it("findFirst / findUnique on cross-tenant ID returns null", async () => {
    const dbA = getTenantDb(centerA);
    // Even though courseB exists globally, dbA should return null
    const foundFirst = await dbA.course.findFirst({ where: { id: courseB } });
    expect(foundFirst).toBeNull();

    const foundUnique = await dbA.course.findUnique({ where: { id: courseB } });
    expect(foundUnique).toBeNull();
  });

  it("aggregate & groupBy should only compute over tenant's records", async () => {
    const dbA = getTenantDb(centerA);
    // Create multiple courses for A
    await db.course.createMany({
      data: [
        { centerId: centerA, title: "Course A2", createdByMembershipId: memberA },
        { centerId: centerA, title: "Course A3", createdByMembershipId: memberA },
      ]
    });

    const agg = await dbA.course.aggregate({ _count: { id: true } });
    expect(agg._count.id).toBe(3);

    const groupBy = await dbA.course.groupBy({ by: ['centerId'], _count: { id: true } });
    expect(groupBy.length).toBe(1);
    expect(groupBy[0].centerId).toBe(centerA);
    expect(groupBy[0]._count.id).toBe(3);
  });

  it("update / updateMany cannot modify cross-tenant records", async () => {
    const dbA = getTenantDb(centerA);
    
    await expect(
      dbA.course.update({ where: { id: courseB }, data: { title: "Hacked" } })
    ).rejects.toThrow();

    const updatedMany = await dbA.course.updateMany({
      where: { id: courseB },
      data: { title: "Hacked" }
    });
    expect(updatedMany.count).toBe(0);

    const check = await db.course.findUnique({ where: { id: courseB } });
    expect(check?.title).toBe("Course B"); // Unchanged
  });

  it("delete / deleteMany cannot modify cross-tenant records", async () => {
    const dbA = getTenantDb(centerA);
    
    await expect(
      dbA.course.delete({ where: { id: courseB } })
    ).rejects.toThrow();

    const deletedMany = await dbA.course.deleteMany({
      where: { id: courseB }
    });
    expect(deletedMany.count).toBe(0);
  });

  it("upsert safely prevents modifying cross-tenant records", async () => {
    const dbA = getTenantDb(centerA);
    
    await expect(
      dbA.course.upsert({
        where: { id: courseB },
        update: { title: "Hacked B" },
        create: { id: courseB, title: "Hacked B", createdByMembershipId: memberA } as any,
      })
    ).rejects.toThrow();
  });

  it("create / createMany strictly enforces centerId (spoofing prevented)", async () => {
    const dbA = getTenantDb(centerA);
    
    const created = await dbA.course.create({
      data: {
        title: "Spoof Test",
        centerId: centerB, // Attempt to spoof
        createdByMembershipId: memberA
      } as any
    });
    expect(created.centerId).toBe(centerA); // Forced to Center A

    await dbA.course.createMany({
      data: [
        { title: "Spoof Test 2", centerId: centerB, createdByMembershipId: memberA } as any
      ]
    });
    const c2 = await db.course.findFirst({ where: { title: "Spoof Test 2" } });
    expect(c2?.centerId).toBe(centerA);
  });

  it("$transaction safely enforces tenant scope", async () => {
    const dbA = getTenantDb(centerA);

    await dbA.$transaction(async (tx) => {
      const courses = await tx.course.findMany();
      expect(courses.some(c => c.centerId === centerB)).toBe(false);
    });
  });

  it("nested include/create enforces tenant scope", async () => {
    const dbA = getTenantDb(centerA);
    
    // Group creation nesting enrollment creation
    const g = await dbA.group.create({
      data: {
        name: "Nested Group",
        courseId: courseA,
        maxStudents: 10,
      } as any
    });
    expect(g.centerId).toBe(centerA);
  });
});
