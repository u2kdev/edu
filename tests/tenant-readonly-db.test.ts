import { describe, it, expect, beforeAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import { requireTenantAccess } from "../src/lib/tenant";

describe("Part A - Item 2: PLATFORM_SUPPORT strict read-only at getTenantDb level", () => {
  let centerId: string;
  let supportUserId: string;

  beforeAll(async () => {
    const owner = await db.platformUser.create({
      data: {
        email: `owner-ro-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Owner RO",
      },
    });

    const center = await db.learningCenter.create({
      data: {
        name: "RO Test Center",
        slug: `ro-center-${Date.now()}`,
        status: "ACTIVE",
        ownerId: owner.id,
      },
    });
    centerId = center.id;

    const supportUser = await db.platformUser.create({
      data: {
        email: `support-ro-${Date.now()}@test.com`,
        passwordHash: "x",
        fullName: "Platform Support RO",
        platformRole: "PLATFORM_SUPPORT",
      },
    });
    supportUserId = supportUser.id;
  });

  it("getTenantDb throws on any write operation if readOnly option is true", async () => {
    const readOnlyDb = getTenantDb(centerId, { isReadOnly: true });

    // Read should succeed
    const courses = await readOnlyDb.course.findMany();
    expect(courses).toEqual([]);

    // Create should throw error
    await expect(
      readOnlyDb.course.create({
        data: {
          centerId,
          title: "Illegal Course by Support",
          createdByMembershipId: "dummy-id",
        },
      })
    ).rejects.toThrow(/read-only/i);

    // UpdateMany should throw error
    await expect(
      readOnlyDb.course.updateMany({
        where: {},
        data: { title: "Hacked" },
      })
    ).rejects.toThrow(/read-only/i);

    // DeleteMany should throw error
    await expect(
      readOnlyDb.course.deleteMany({
        where: {},
      })
    ).rejects.toThrow(/read-only/i);
  });
});
