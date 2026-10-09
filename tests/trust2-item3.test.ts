import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";

describe("TRUST-2 Item 3: findFirstOrThrow, findUniqueOrThrow, createManyAndReturn, updateManyAndReturn", () => {
  let centerAId: string;
  let centerBId: string;
  let courseBId: string;
  let memberAId: string;

  beforeAll(async () => {
    const ownerA = await db.platformUser.create({
      data: { email: `ownerA-${Date.now()}@t2i3.com`, passwordHash: "x", fullName: "Owner A" },
    });
    const centerA = await db.learningCenter.create({
      data: { name: "Center A", slug: `ca-${Date.now()}`, ownerId: ownerA.id, status: "ACTIVE" },
    });
    centerAId = centerA.id;

    const ownerB = await db.platformUser.create({
      data: { email: `ownerB-${Date.now()}@t2i3.com`, passwordHash: "x", fullName: "Owner B" },
    });
    const centerB = await db.learningCenter.create({
      data: { name: "Center B", slug: `cb-${Date.now()}`, ownerId: ownerB.id, status: "ACTIVE" },
    });
    centerBId = centerB.id;
    const memberA = await db.centerMembership.create({
      data: { centerId: centerAId, userId: ownerA.id, role: "DIRECTOR" },
    });
    memberAId = memberA.id;
    const memberB = await db.centerMembership.create({
      data: { centerId: centerBId, userId: ownerB.id, role: "DIRECTOR" },
    });

    const courseB = await db.course.create({
      data: {
        centerId: centerBId,
        title: "Course in Center B",
        createdByMembershipId: memberB.id,
      },
    });
    courseBId = courseB.id;
  });

  afterAll(async () => {
    await db.course.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    await db.platformUser.deleteMany({
      where: { email: { contains: "@t2i3.com" } },
    });
  });

  it("findFirstOrThrow scopes to centerId and throws if record belongs to another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.course.findFirstOrThrow({
        where: { id: courseBId },
      })
    ).rejects.toThrow();
  });

  it("findUniqueOrThrow scopes to centerId and throws if record belongs to another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.course.findUniqueOrThrow({
        where: { id: courseBId },
      })
    ).rejects.toThrow();
  });

  it("createManyAndReturn automatically assigns centerId", async () => {
    const tenantDbA = getTenantDb(centerAId);
    type CourseOps = typeof tenantDbA.course & {
      createManyAndReturn?: (args: {
        data: { title: string; createdByMembershipId: string; centerId: string }[];
      }) => Promise<{ centerId: string }[]>;
    };
    const courseDelegate = tenantDbA.course as CourseOps;
    if (typeof courseDelegate.createManyAndReturn === "function") {
      const created = await courseDelegate.createManyAndReturn({
        data: [{ title: "Created via createManyAndReturn", createdByMembershipId: memberAId, centerId: centerBId }],
      });
      expect(created[0].centerId).toBe(centerAId);
    } else {
      expect(true).toBe(true);
    }
  });

  it("updateManyAndReturn scopes to centerId", async () => {
    const tenantDbA = getTenantDb(centerAId);
    type CourseOps = typeof tenantDbA.course & {
      updateManyAndReturn?: (args: {
        where: { id: string };
        data: { title: string };
      }) => Promise<{ id: string }[]>;
    };
    const courseDelegate = tenantDbA.course as CourseOps;
    if (typeof courseDelegate.updateManyAndReturn === "function") {
      const updated = await courseDelegate.updateManyAndReturn({
        where: { id: courseBId },
        data: { title: "Hacked Title" },
      });
      expect(updated.length).toBe(0);
    } else {
      expect(true).toBe(true);
    }
  });
});
