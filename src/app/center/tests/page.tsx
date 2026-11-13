import { requireTenantPageAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getScopedMaterialWhere,
  getActorAcademicScope,
  isActorImpersonating,
} from "@/lib/tenant-access";
import TestsManager, { TestSummary } from "@/components/tests/TestsManager";
import { Prisma } from "@prisma/client";

export default async function CenterTestsPage() {
  const tenantCtx = await requireTenantPageAccess();
  const { center, role, session, membership, getTenantDb } = tenantCtx;
  const tenantDb = getTenantDb();

  const canManage =
    !isActorImpersonating(tenantCtx) &&
    (hasPermission("materials.manage", session.user.platformRole, role) ||
      hasPermission("materials.upload", session.user.platformRole, role) ||
      role === "TEACHER" ||
      role === "TEACHER_ASSISTANT");

  const [scopedMaterialWhere, academicScope] = await Promise.all([
    getScopedMaterialWhere(tenantCtx),
    getActorAcademicScope(tenantCtx),
  ]);

  let attemptsWhere: Prisma.TestAttemptWhereInput | undefined = undefined;
  if (role === "STUDENT") {
    attemptsWhere = {
      studentMembershipId:
        membership?.id || "00000000-0000-0000-0000-000000000000",
    };
  } else if (role === "PARENT") {
    attemptsWhere = {
      studentMembershipId: {
        in:
          academicScope.studentMembershipIds.length > 0
            ? academicScope.studentMembershipIds
            : ["00000000-0000-0000-0000-000000000000"],
      },
    };
  }

  const [tests, courses, groups] = await Promise.all([
    tenantDb.test.findMany({
      where: {
        centerId: center.id,
        material: scopedMaterialWhere,
      },
      include: {
        material: {
          include: {
            course: { select: { id: true, title: true } },
            group: { select: { id: true, name: true } },
            lesson: { select: { id: true, title: true } },
          },
        },
        questions: { orderBy: { orderIndex: "asc" } },
        attempts: {
          where: attemptsWhere,
          include: {
            student: {
              include: { user: { select: { fullName: true } } },
            },
          },
          orderBy: { startedAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    tenantDb.course.findMany({
      where: academicScope.isUnrestricted
        ? { centerId: center.id }
        : {
            centerId: center.id,
            id: {
              in:
                academicScope.courseIds.length > 0
                  ? academicScope.courseIds
                  : ["00000000-0000-0000-0000-000000000000"],
            },
          },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    tenantDb.group.findMany({
      where: academicScope.isUnrestricted
        ? { centerId: center.id }
        : {
            centerId: center.id,
            id: {
              in:
                academicScope.groupIds.length > 0
                  ? academicScope.groupIds
                  : ["00000000-0000-0000-0000-000000000000"],
            },
          },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const initialTests: TestSummary[] = tests.map((t) => {
    const completedAttempts = t.attempts.filter((a) => a.completedAt !== null);
    const avgScore =
      completedAttempts.length > 0
        ? Math.round(
            completedAttempts.reduce((s, a) => s + (a.scorePercent ?? 0), 0) /
              completedAttempts.length
          )
        : 0;

    return {
      id: t.id,
      title: t.material.title,
      description: t.material.contentText,
      timeLimitMinutes: t.timeLimitMinutes,
      passingScorePercent: t.passingScorePercent,
      maxAttempts: t.maxAttempts,
      questionsCount: t.questions.length,
      totalPoints: t.questions.reduce((acc, q) => acc + q.points, 0),
      courseTitle: t.material.course?.title || null,
      groupName: t.material.group?.name || null,
      courseId: t.material.courseId || null,
      groupId: t.material.groupId || null,
      attemptsCount: t.attempts.length,
      averageScore: avgScore,
      createdAt: t.createdAt.toISOString(),
    };
  });

  return (
    <TestsManager
      initialTests={initialTests}
      canManage={canManage}
      role={role || ""}
      courses={courses}
      groups={groups}
    />
  );
}
