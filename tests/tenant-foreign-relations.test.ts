import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";

describe("TRUST-2 Item 6: Cross-tenant foreign relation validation", () => {
  let centerAId: string;
  let centerBId: string;
  let memberAId: string;
  let memberBId: string;
  let groupBId: string;
  let courseBId: string;
  let moduleBId: string;
  let lessonBId: string;

  beforeAll(async () => {
    const ownerA = await db.platformUser.create({
      data: { email: `ownerA-${Date.now()}@t2i6.com`, passwordHash: "x", fullName: "Owner A" },
    });
    const centerA = await db.learningCenter.create({
      data: { name: "Center A", slug: `ca-${Date.now()}`, ownerId: ownerA.id, status: "ACTIVE" },
    });
    centerAId = centerA.id;

    const ownerB = await db.platformUser.create({
      data: { email: `ownerB-${Date.now()}@t2i6.com`, passwordHash: "x", fullName: "Owner B" },
    });
    const centerB = await db.learningCenter.create({
      data: { name: "Center B", slug: `cb-${Date.now()}`, ownerId: ownerB.id, status: "ACTIVE" },
    });
    centerBId = centerB.id;

    const memA = await db.centerMembership.create({
      data: { centerId: centerAId, userId: ownerA.id, role: "STUDENT" },
    });
    memberAId = memA.id;

    const memB = await db.centerMembership.create({
      data: { centerId: centerBId, userId: ownerB.id, role: "STUDENT" },
    });
    memberBId = memB.id;

    const courseB = await db.course.create({
      data: { centerId: centerBId, title: "Course B", createdByMembershipId: memB.id },
    });
    courseBId = courseB.id;

    const modB = await db.courseModule.create({
      data: { centerId: centerBId, courseId: courseB.id, title: "Module B" },
    });
    moduleBId = modB.id;

    const lesB = await db.lesson.create({
      data: { centerId: centerBId, moduleId: modB.id, title: "Lesson B" },
    });
    lessonBId = lesB.id;

    const grpB = await db.group.create({
      data: { centerId: centerBId, courseId: courseB.id, name: "Group B" },
    });
    groupBId = grpB.id;
  });

  afterAll(async () => {
    await db.enrollment.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.grade.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.centerPayment.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.homework.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.lesson.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.courseModule.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.group.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.course.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.centerMembership.deleteMany({ where: { centerId: { in: [centerAId, centerBId] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerAId, centerBId] } } });
    await db.platformUser.deleteMany({ where: { email: { contains: "@t2i6.com" } } });
  });

  it("enrollment: reject creation with groupId from another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.enrollment.create({
        data: {
          centerId: centerAId,
          groupId: groupBId,
          studentMembershipId: memberAId,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("lesson: reject creation with moduleId from another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.lesson.create({
        data: {
          centerId: centerAId,
          moduleId: moduleBId,
          title: "Infiltrator Lesson",
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("homework: reject creation with lessonId from another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.homework.create({
        data: {
          centerId: centerAId,
          lessonId: lessonBId,
          title: "Cross HW",
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("grade: reject creation with studentMembershipId from another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.grade.create({
        data: {
          centerId: centerAId,
          studentMembershipId: memberBId,
          teacherMembershipId: memberAId,
          gradeType: "HOMEWORK",
          value: 100,
          maxValue: 100,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("payment: reject creation with studentMembershipId from another center", async () => {
    const tenantDbA = getTenantDb(centerAId);
    await expect(
      tenantDbA.centerPayment.create({
        data: {
          centerId: centerAId,
          studentMembershipId: memberBId,
          amount: 500,
          paymentMethod: "CASH",
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });
});
