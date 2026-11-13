import { db } from "../db";

/**
 * Idempotent data migration: fixes historical Grade records where teacherMembershipId equals studentMembershipId.
 * Replaces the author with the student's group teacher, or the center's director/admin.
 */
export async function migrateTestGradeAuthors(): Promise<number> {
  const incorrectGrades = await db.grade.findMany({
    where: {
      studentMembershipId: { not: "" },
    },
    select: {
      id: true,
      centerId: true,
      studentMembershipId: true,
      teacherMembershipId: true,
      groupId: true,
    },
  });

  const matching = incorrectGrades.filter(
    (g) => g.teacherMembershipId === g.studentMembershipId
  );

  let updatedCount = 0;

  for (const grade of matching) {
    let resolvedTeacherId: string | null = null;

    if (grade.groupId) {
      const grp = await db.group.findUnique({
        where: { id: grade.groupId },
        select: { teacherMembershipId: true },
      });
      if (grp?.teacherMembershipId && grp.teacherMembershipId !== grade.studentMembershipId) {
        resolvedTeacherId = grp.teacherMembershipId;
      }
    }

    if (!resolvedTeacherId) {
      const enrollment = await db.enrollment.findFirst({
        where: { studentMembershipId: grade.studentMembershipId, status: "ACTIVE" },
        include: { group: { select: { teacherMembershipId: true } } },
      });
      if (enrollment?.group?.teacherMembershipId && enrollment.group.teacherMembershipId !== grade.studentMembershipId) {
        resolvedTeacherId = enrollment.group.teacherMembershipId;
      }
    }

    if (!resolvedTeacherId) {
      const staffMember = await db.centerMembership.findFirst({
        where: {
          centerId: grade.centerId,
          role: { in: ["DIRECTOR", "CENTER_ADMIN", "TEACHER"] },
          id: { not: grade.studentMembershipId },
        },
        select: { id: true },
      });
      resolvedTeacherId = staffMember?.id || null;
    }

    if (resolvedTeacherId && resolvedTeacherId !== grade.studentMembershipId) {
      await db.grade.update({
        where: { id: grade.id },
        data: { teacherMembershipId: resolvedTeacherId },
      });
      updatedCount++;
    }
  }

  return updatedCount;
}
