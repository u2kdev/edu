import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/lib/db";
import type { LearningCenter, PlatformUser, CenterMembership, Group } from "@prisma/client";
import fs from "fs";
import path from "path";

describe("TRUST-3c Item 2: Migration deletes platform CenterMemberships and transfers references to SetNull", () => {
  let center: LearningCenter;
  let owner: PlatformUser;
  let superAdmin: PlatformUser;
  let normalTeacher: PlatformUser;

  let ownerMember: CenterMembership;
  let superAdminMember: CenterMembership;
  let normalTeacherMember: CenterMembership;

  let groupWithAdminTeacher: Group;
  let groupWithNormalTeacher: Group;

  beforeAll(async () => {
    const ts = Date.now();
    owner = await db.platformUser.create({
      data: { email: `owner_mig_${ts}@test.com`, passwordHash: "x", fullName: "Owner Mig" },
    });
    superAdmin = await db.platformUser.create({
      data: { email: `sa_mig_${ts}@test.com`, passwordHash: "x", fullName: "Super Admin Mig", platformRole: "SUPERADMIN" },
    });
    normalTeacher = await db.platformUser.create({
      data: { email: `teacher_mig_${ts}@test.com`, passwordHash: "x", fullName: "Normal Teacher Mig", platformRole: "NONE" },
    });

    center = await db.learningCenter.create({
      data: { name: "Migration Test Center", slug: `mig-center-${ts}`, ownerId: owner.id, status: "ACTIVE" },
    });

    ownerMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: owner.id, role: "DIRECTOR" },
    });
    superAdminMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: superAdmin.id, role: "DIRECTOR" },
    });
    normalTeacherMember = await db.centerMembership.create({
      data: { centerId: center.id, userId: normalTeacher.id, role: "TEACHER" },
    });

    const course = await db.course.create({
      data: { centerId: center.id, title: "Course Mig", createdByMembershipId: ownerMember.id },
    });

    // Group assigned to superAdmin teacher
    groupWithAdminTeacher = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Admin Group",
        teacherMembershipId: superAdminMember.id,
      },
    });

    // Group assigned to normal teacher
    groupWithNormalTeacher = await db.group.create({
      data: {
        centerId: center.id,
        courseId: course.id,
        name: "Normal Group",
        teacherMembershipId: normalTeacherMember.id,
      },
    });
  });

  afterAll(async () => {
    await db.group.deleteMany({ where: { centerId: center.id } });
    await db.course.deleteMany({ where: { centerId: center.id } });
    await db.centerMembership.deleteMany({ where: { centerId: center.id } });
    await db.learningCenter.deleteMany({ where: { id: center.id } });
    await db.platformUser.deleteMany({ where: { id: { in: [owner.id, superAdmin.id, normalTeacher.id] } } });
  });

  it("data before migration: superAdmin has CenterMembership and is assigned as group teacher", async () => {
    const saMember = await db.centerMembership.findUnique({ where: { id: superAdminMember.id } });
    expect(saMember).not.toBeNull();

    const group = await db.group.findUnique({ where: { id: groupWithAdminTeacher.id } });
    expect(group?.teacherMembershipId).toBe(superAdminMember.id);
  });

  it("executing migration SQL sets nullable references to NULL and removes platform CenterMembership", async () => {
    const migrationPath = path.resolve(
      process.cwd(),
      "prisma/migrations/20261009192930_remove_platform_memberships/migration.sql"
    );
    const sql = fs.readFileSync(migrationPath, "utf-8");

    // Execute migration statements
    const cleanSql = sql.replace(/--.*$/gm, "").trim();
    const statements = cleanSql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const stmt of statements) {
      await db.$executeRawUnsafe(stmt);
    }

    // 1. superAdmin membership is DELETED
    const saMemberAfter = await db.centerMembership.findUnique({ where: { id: superAdminMember.id } });
    expect(saMemberAfter).toBeNull();

    // 2. groupWithAdminTeacher has teacherMembershipId = null (SetNull)
    const adminGroupAfter = await db.group.findUnique({ where: { id: groupWithAdminTeacher.id } });
    expect(adminGroupAfter?.teacherMembershipId).toBeNull();

    // 3. normal teacher membership is UNTOUCHED
    const normalMemberAfter = await db.centerMembership.findUnique({ where: { id: normalTeacherMember.id } });
    expect(normalMemberAfter).not.toBeNull();

    // 4. normal teacher group is UNTOUCHED
    const normalGroupAfter = await db.group.findUnique({ where: { id: groupWithNormalTeacher.id } });
    expect(normalGroupAfter?.teacherMembershipId).toBe(normalTeacherMember.id);
  });
});
