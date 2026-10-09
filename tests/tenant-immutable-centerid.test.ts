import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";

describe("TRUST-2 Item 4: Disallow changing centerId in update/updateMany/upsert", () => {
  let centerAId: string;
  let centerBId: string;
  let courseAId: string;

  beforeAll(async () => {
    const ownerA = await db.platformUser.create({
      data: { email: `ownerA-${Date.now()}@t2i4.com`, passwordHash: "x", fullName: "Owner A" },
    });
    const centerA = await db.learningCenter.create({
      data: { name: "Center A", slug: `ca-${Date.now()}`, ownerId: ownerA.id, status: "ACTIVE" },
    });
    centerAId = centerA.id;

    const ownerB = await db.platformUser.create({
      data: { email: `ownerB-${Date.now()}@t2i4.com`, passwordHash: "x", fullName: "Owner B" },
    });
    const centerB = await db.learningCenter.create({
      data: { name: "Center B", slug: `cb-${Date.now()}`, ownerId: ownerB.id, status: "ACTIVE" },
    });
    centerBId = centerB.id;

    const memberA = await db.centerMembership.create({
      data: { centerId: centerAId, userId: ownerA.id, role: "DIRECTOR" },
    });

    const courseA = await db.course.create({
      data: {
        centerId: centerAId,
        title: "Course in Center A",
        createdByMembershipId: memberA.id,
      },
    });
    courseAId = courseA.id;
  });

  afterAll(async () => {
    await db.course.deleteMany({ where: { id: courseAId } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    await db.platformUser.deleteMany({
      where: { email: { contains: "@t2i4.com" } },
    });
  });

  it("update disallows changing centerId to another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.course.update({
        where: { id: courseAId },
        data: {
          title: "Attempted Hijack",
          centerId: centerBId,
        },
      })
    ).rejects.toThrow("Changing centerId is not allowed");
  });

  it("updateMany disallows changing centerId to another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.course.updateMany({
        where: { id: courseAId },
        data: {
          centerId: centerBId,
        },
      })
    ).rejects.toThrow("Changing centerId is not allowed");
  });
});
