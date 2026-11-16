import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  assertMaterialAccess,
  assertGroupAccess,
  getActorAcademicScope,
  isActorImpersonating,
} from "@/lib/tenant-access";
import {
  sanitizeQuestionForClient,
  evaluateQuestionAnswer,
  buildAttemptReview,
} from "@/lib/test-grading";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const submitAttemptSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
});

export async function GET(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, membership, getTenantDb } = tenantCtx;
    const { id } = context.params;
    const tenantDb = getTenantDb();

    const existing = await tenantDb.test.findFirst({
      where: { id, centerId: center.id },
      select: { id: true, materialId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }

    await assertMaterialAccess(tenantCtx, existing.materialId);

    const canManage =
      hasPermission("materials.manage", session.user.platformRole, role) ||
      role === "TEACHER" ||
      role === "TEACHER_ASSISTANT";

    const academicScope = await getActorAcademicScope(tenantCtx);

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
    } else if (role === "TEACHER" || role === "TEACHER_ASSISTANT") {
      if (!hasPermission("materials.manage", session.user.platformRole, role)) {
        const assignedGroups = await tenantDb.group.findMany({
          where: {
            centerId: center.id,
            ...(role === "TEACHER"
              ? { teacherMembershipId: membership?.id }
              : { assistantMembershipId: membership?.id }),
          },
          select: {
            enrollments: {
              where: { status: "ACTIVE" },
              select: { studentMembershipId: true },
            },
          },
        });
        const studentIds = Array.from(
          new Set(
            assignedGroups.flatMap((g) => g.enrollments.map((e) => e.studentMembershipId))
          )
        );
        attemptsWhere = {
          studentMembershipId: {
            in: studentIds.length > 0 ? studentIds : ["00000000-0000-0000-0000-000000000000"],
          },
        };
      }
    }

    const test = await tenantDb.test.findFirst({
      where: { id, centerId: center.id },
      include: {
        material: {
          include: {
            course: { select: { id: true, title: true } },
            group: { select: { id: true, name: true } },
            lesson: { select: { id: true, title: true } },
          },
        },
        questions: {
          orderBy: { orderIndex: "asc" },
        },
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
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }

    return NextResponse.json({
      test: {
        id: test.id,
        materialId: test.materialId,
        title: test.material.title,
        description: test.material.contentText,
        course: test.material.course,
        group: test.material.group,
        lesson: test.material.lesson,
        timeLimitMinutes: test.timeLimitMinutes,
        maxAttempts: test.maxAttempts,
        passingScorePercent: test.passingScorePercent,
        shuffleQuestions: test.shuffleQuestions,
        createdAt: test.createdAt.toISOString(),
        questionsCount: test.questions.length,
        questions: test.questions.map((q) =>
          sanitizeQuestionForClient(q, canManage)
        ),
        attempts: test.attempts.map((a) => ({
          id: a.id,
          studentMembershipId: a.studentMembershipId,
          studentName: a.student.user.fullName,
          scorePercent: a.scorePercent,
          scorePoints: a.scorePoints,
          maxPoints: a.maxPoints,
          startedAt: a.startedAt.toISOString(),
          completedAt: a.completedAt?.toISOString() || null,
          review: a.completedAt
            ? buildAttemptReview(test.questions, a.answersJson)
            : undefined,
        })),
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/tests/[id] error:", err);
    return NextResponse.json(
      { error: "Не удалось загрузить тест" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, membership, getTenantDb } = tenantCtx;
    const { id } = context.params;

    if (isActorImpersonating(tenantCtx)) {
      return NextResponse.json(
        { error: "Read-only impersonation mode" },
        { status: 403 }
      );
    }

    if (role !== "STUDENT" || !membership) {
      return NextResponse.json(
        { error: "Forbidden: Только ученики могут проходить тесты" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { answers } = submitAttemptSchema.parse(body);

    const tenantDb = getTenantDb();

    const test = await tenantDb.test.findFirst({
      where: { id, centerId: center.id },
      include: {
        material: true,
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        attempts: {
          where: { studentMembershipId: membership.id },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }

    // Verify student has access to this test's group/course
    await assertMaterialAccess(tenantCtx, test.materialId);

    if (test.attempts.length >= test.maxAttempts) {
      return NextResponse.json(
        {
          error: `Исчерпан лимит попыток (${test.maxAttempts}) для этого теста`,
        },
        { status: 400 }
      );
    }

    let scorePoints = 0;
    let maxPoints = 0;

    for (const q of test.questions) {
      maxPoints += q.points;
      const studentVal = answers[q.id];
      const { earnedPoints } = evaluateQuestionAnswer(q, studentVal);
      scorePoints += earnedPoints;
    }

    const scorePercent =
      maxPoints > 0 ? Math.round((scorePoints / maxPoints) * 100) : 0;
    const answersJsonStr = JSON.stringify(answers);

    const attempt = await tenantDb.testAttempt.create({
      data: {
        centerId: center.id,
        testId: test.id,
        studentMembershipId: membership.id,
        answersJson: answersJsonStr,
        scorePoints,
        maxPoints,
        scorePercent,
        completedAt: new Date(),
      },
    });

    await tenantDb.activityLog.create({
      data: {
        centerId: center.id,
        userMembershipId: membership.id,
        activityType: "COMPLETE_TEST",
        resourceType: "Test",
        resourceId: test.id,
      },
    });

    if (test.material.groupId) {
      const groupInfo = await tenantDb.group.findFirst({
        where: { id: test.material.groupId },
        select: { teacherMembershipId: true },
      });
      const fallbackTeacher =
        groupInfo?.teacherMembershipId ||
        (
          await tenantDb.centerMembership.findFirst({
            where: {
              centerId: center.id,
              role: { in: ["TEACHER", "DIRECTOR", "CENTER_ADMIN"] },
            },
            select: { id: true },
          })
        )?.id ||
        membership.id;

      await tenantDb.grade.create({
        data: {
          centerId: center.id,
          studentMembershipId: membership.id,
          groupId: test.material.groupId,
          lessonId: test.material.lessonId,
          teacherMembershipId: fallbackTeacher,
          gradeType: "TEST",
          value: scorePercent,
          maxValue: 100,
          comment: `Тест: ${test.material.title} (${scorePoints}/${maxPoints})`,
          lifecycle: "SUBMITTED",
        },
      });
    }

    const review = buildAttemptReview(test.questions, answersJsonStr);

    return NextResponse.json({
      success: true,
      attempt: {
        id: attempt.id,
        scorePoints,
        maxPoints,
        scorePercent,
        passed: scorePercent >= test.passingScorePercent,
        completedAt: attempt.completedAt?.toISOString() || null,
        review,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Неверный формат ответов" },
        { status: 400 }
      );
    }
    console.error("POST /api/tests/[id] error:", err);
    return NextResponse.json(
      { error: "Ошибка при отправке ответов" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, membership, getTenantDb } = tenantCtx;
    const { id } = context.params;

    if (isActorImpersonating(tenantCtx)) {
      return NextResponse.json(
        { error: "Read-only impersonation mode" },
        { status: 403 }
      );
    }

    const hasGlobalManage = hasPermission("materials.manage", session.user.platformRole, role);

    const tenantDb = getTenantDb();
    const existing = await tenantDb.test.findFirst({
      where: { id, centerId: center.id },
      include: { material: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Тест не найден" }, { status: 404 });
    }

    if (!hasGlobalManage) {
      if (
        (role === "TEACHER" || role === "TEACHER_ASSISTANT") &&
        membership?.id
      ) {
        if (existing.material.groupId) {
          await assertGroupAccess(tenantCtx, existing.material.groupId, "write");
        } else if (existing.material.courseId) {
          const group = await tenantDb.group.findFirst({
            where: {
              centerId: center.id,
              courseId: existing.material.courseId,
              ...(role === "TEACHER"
                ? { teacherMembershipId: membership.id }
                : { assistantMembershipId: membership.id }),
            },
          });
          if (!group) {
            return NextResponse.json(
              { error: "Forbidden: You are not assigned to this course" },
              { status: 403 }
            );
          }
        } else {
          return NextResponse.json(
            { error: "Forbidden: Only center administrators can delete center-wide tests" },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
      }
    }

    await tenantDb.material.delete({
      where: { id: existing.materialId },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "TEST_DELETED",
      resource: "Test",
      resourceId: id,
      details: { title: existing.material.title },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("DELETE /api/tests/[id] error:", err);
    return NextResponse.json(
      { error: "Не удалось удалить тест" },
      { status: 500 }
    );
  }
}
