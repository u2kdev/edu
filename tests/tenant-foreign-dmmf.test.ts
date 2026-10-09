import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import { getTenantDb } from "../src/lib/db-tenant";
import type { LearningCenter, PlatformUser, CenterMembership, Course, CourseModule, Lesson, Homework, Test, Branch, Subject } from "@prisma/client";

describe("TRUST-3 Item 5: Dynamic foreign key check via Prisma.dmmf and nested relation protection", () => {
  let centerA: LearningCenter;
  let centerB: LearningCenter;
  let userA: PlatformUser;
  let userB: PlatformUser;
  let memberA: CenterMembership;
  let memberB: CenterMembership;

  let branchB: Branch;
  let subjectB: Subject;
  let courseB: Course;
  let moduleB: CourseModule;
  let lessonB: Lesson;
  let homeworkB: Homework;
  let testB: Test;

  beforeAll(async () => {
    const ts = Date.now();
    userA = await db.platformUser.create({
      data: { email: `userA_${ts}@dmmftest.com`, passwordHash: "x", fullName: "User A" },
    });
    userB = await db.platformUser.create({
      data: { email: `userB_${ts}@dmmftest.com`, passwordHash: "x", fullName: "User B" },
    });

    centerA = await db.learningCenter.create({
      data: { name: "Center A", slug: `dmmf-a-${ts}`, status: "ACTIVE", ownerId: userA.id },
    });
    centerB = await db.learningCenter.create({
      data: { name: "Center B", slug: `dmmf-b-${ts}`, status: "ACTIVE", ownerId: userB.id },
    });

    memberA = await db.centerMembership.create({
      data: { centerId: centerA.id, userId: userA.id, role: "DIRECTOR" },
    });
    memberB = await db.centerMembership.create({
      data: { centerId: centerB.id, userId: userB.id, role: "DIRECTOR" },
    });

    branchB = await db.branch.create({
      data: { centerId: centerB.id, name: "Branch B" },
    });
    subjectB = await db.subject.create({
      data: { centerId: centerB.id, name: "Subject B" },
    });
    courseB = await db.course.create({
      data: { centerId: centerB.id, title: "Course B", createdByMembershipId: memberB.id },
    });
    moduleB = await db.courseModule.create({
      data: { centerId: centerB.id, courseId: courseB.id, title: "Module B" },
    });
    lessonB = await db.lesson.create({
      data: { centerId: centerB.id, moduleId: moduleB.id, title: "Lesson B" },
    });
    homeworkB = await db.homework.create({
      data: { centerId: centerB.id, lessonId: lessonB.id, title: "Homework B" },
    });

    const materialB = await db.material.create({
      data: { centerId: centerB.id, title: "Material B", materialType: "TEST" },
    });
    testB = await db.test.create({
      data: { centerId: centerB.id, materialId: materialB.id },
    });
  });

  afterAll(async () => {
    await db.testQuestion.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.test.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.material.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.homeworkSubmission.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.homework.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.lesson.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.courseModule.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.group.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.course.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.branch.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.subject.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.centerMembership.deleteMany({ where: { centerId: { in: [centerA.id, centerB.id] } } });
    await db.learningCenter.deleteMany({ where: { id: { in: [centerA.id, centerB.id] } } });
    await db.platformUser.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
  });

  it("rejects foreign branchId in group creation", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    const courseA = await tenantDbA.course.create({
      data: { title: "Course A", createdByMembershipId: memberA.id },
    });

    await expect(
      tenantDbA.group.create({
        data: {
          name: "Group with Foreign Branch",
          courseId: courseA.id,
          branchId: branchB.id,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("rejects foreign subjectId in course creation", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    await expect(
      tenantDbA.course.create({
        data: {
          title: "Course with Foreign Subject",
          createdByMembershipId: memberA.id,
          subjectId: subjectB.id,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("rejects foreign moduleId in lesson creation", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    await expect(
      tenantDbA.lesson.create({
        data: {
          title: "Lesson with Foreign Module",
          moduleId: moduleB.id,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("rejects foreign testId in testQuestion creation", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    await expect(
      tenantDbA.testQuestion.create({
        data: {
          questionText: "Question for Foreign Test",
          testId: testB.id,
        },
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("rejects mixed foreign keys in createMany", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    const courseA = await tenantDbA.course.create({
      data: { title: "Course A Valid", createdByMembershipId: memberA.id },
    });

    await expect(
      tenantDbA.group.createMany({
        data: [
          { name: "Group 1", courseId: courseA.id },
          { name: "Group 2", courseId: courseB.id },
        ],
      })
    ).rejects.toThrow(/Cross-tenant relation violation/);
  });

  it("rejects nested relation connect pointing to foreign center", async () => {
    const tenantDbA = getTenantDb(centerA.id);
    type CourseCreateWithConnect = typeof tenantDbA.course & {
      create: (arg: { data: { title: string; createdByMembershipId: string; subject: { connect: { id: string } } } }) => Promise<unknown>;
    };
    const courseDelegate = tenantDbA.course as CourseCreateWithConnect;
    await expect(
      courseDelegate.create({
        data: {
          title: "Course Nested Foreign Subject",
          createdByMembershipId: memberA.id,
          subject: {
            connect: { id: subjectB.id },
          },
        },
      })
    ).rejects.toThrow();
  });
});
