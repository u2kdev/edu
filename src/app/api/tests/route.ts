import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getScopedMaterialWhere,
  getActorAcademicScope,
  assertGroupAccess,
  isActorImpersonating,
} from "@/lib/tenant-access";
import {
  sanitizeQuestionForClient,
  buildAttemptReview,
} from "@/lib/test-grading";
import { z } from "zod";
import { Prisma } from "@prisma/client";

const questionOptionSchema = z.object({
  id: z.string().optional(),
  text: z.string().min(1),
  isCorrect: z.boolean().default(false),
});

const questionSchema = z.object({
  questionText: z.string().min(1, "Текст вопроса обязателен"),
  questionType: z
    .enum(["SINGLE_CHOICE", "MULTIPLE_CHOICE", "TEXT", "TRUE_FALSE"])
    .default("SINGLE_CHOICE"),
  options: z.array(questionOptionSchema).optional(),
  correctAnswer: z.string().optional().nullable(),
  points: z.number().int().min(1).max(100).default(1),
});

const createTestSchema = z.object({
  title: z.string().min(1, "Название теста обязательно").max(200),
  description: z.string().max(1000).optional().nullable(),
  courseId: z.string().optional().nullable(),
  groupId: z.string().optional().nullable(),
  lessonId: z.string().optional().nullable(),
  timeLimitMinutes: z.number().int().min(1).max(300).optional().nullable(),
  maxAttempts: z.number().int().min(1).max(50).default(1),
  passingScorePercent: z.number().int().min(1).max(100).default(60),
  shuffleQuestions: z.boolean().default(false),
  questions: z
    .array(questionSchema)
    .min(1, "Добавьте хотя бы один вопрос в тест"),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, membership, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const groupId = searchParams.get("groupId");
    const childId = searchParams.get("childId");

    const canManage =
      hasPermission("materials.manage", session.user.platformRole, role) ||
      role === "TEACHER" ||
      role === "TEACHER_ASSISTANT";

    const [scopedMaterialWhere, academicScope] = await Promise.all([
      getScopedMaterialWhere(tenantCtx),
      getActorAcademicScope(tenantCtx),
    ]);

    if (role === "PARENT" && childId) {
      if (!academicScope.studentMembershipIds.includes(childId)) {
        return NextResponse.json(
          { error: "Forbidden: Child is not linked or not confirmed" },
          { status: 403 }
        );
      }
    }

    const filterMaterialWhere: Prisma.MaterialWhereInput = {};
    if (courseId && courseId !== "ALL") filterMaterialWhere.courseId = courseId;
    if (groupId && groupId !== "ALL") filterMaterialWhere.groupId = groupId;

    let attemptsWhere: Prisma.TestAttemptWhereInput | undefined = undefined;
    if (role === "STUDENT") {
      attemptsWhere = {
        studentMembershipId:
          membership?.id || "00000000-0000-0000-0000-000000000000",
      };
    } else if (role === "PARENT") {
      const targetChildren = childId
        ? [childId]
        : academicScope.studentMembershipIds;
      attemptsWhere = {
        studentMembershipId: {
          in:
            targetChildren.length > 0
              ? targetChildren
              : ["00000000-0000-0000-0000-000000000000"],
        },
      };
    }

    const tests = await tenantDb.test.findMany({
      where: {
        centerId: center.id,
        material: {
          AND: [scopedMaterialWhere, filterMaterialWhere],
        },
      },
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
      orderBy: { createdAt: "desc" },
    });

    const formatted = tests.map((t) => ({
      id: t.id,
      materialId: t.materialId,
      title: t.material.title,
      description: t.material.contentText,
      course: t.material.course,
      group: t.material.group,
      lesson: t.material.lesson,
      timeLimitMinutes: t.timeLimitMinutes,
      maxAttempts: t.maxAttempts,
      passingScorePercent: t.passingScorePercent,
      shuffleQuestions: t.shuffleQuestions,
      createdAt: t.createdAt.toISOString(),
      questionsCount: t.questions.length,
      questions: t.questions.map((q) =>
        sanitizeQuestionForClient(q, canManage)
      ),
      attempts: t.attempts.map((a) => ({
        id: a.id,
        studentMembershipId: a.studentMembershipId,
        studentName: a.student.user.fullName,
        scorePercent: a.scorePercent,
        scorePoints: a.scorePoints,
        maxPoints: a.maxPoints,
        startedAt: a.startedAt.toISOString(),
        completedAt: a.completedAt?.toISOString() || null,
        review: a.completedAt
          ? buildAttemptReview(t.questions, a.answersJson)
          : undefined,
      })),
    }));

    return NextResponse.json({ tests: formatted });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("GET /api/tests error:", err);
    return NextResponse.json(
      { error: "Не удалось загрузить тесты" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, getTenantDb } = tenantCtx;

    if (isActorImpersonating(tenantCtx)) {
      return NextResponse.json(
        { error: "Read-only impersonation mode" },
        { status: 403 }
      );
    }

    const canCreate =
      hasPermission("materials.manage", session.user.platformRole, role) ||
      hasPermission("materials.upload", session.user.platformRole, role) ||
      role === "TEACHER" ||
      role === "TEACHER_ASSISTANT";

    if (!canCreate) {
      return NextResponse.json(
        { error: "Недостаточно прав для создания теста" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createTestSchema.parse(body);

    if (parsed.groupId && (role === "TEACHER" || role === "TEACHER_ASSISTANT")) {
      await assertGroupAccess(tenantCtx, parsed.groupId, "read");
    }

    const tenantDb = getTenantDb();

    const material = await tenantDb.material.create({
      data: {
        centerId: center.id,
        courseId: parsed.courseId || null,
        groupId: parsed.groupId || null,
        lessonId: parsed.lessonId || null,
        title: parsed.title.trim(),
        materialType: "TEST",
        contentText: parsed.description?.trim() || null,
      },
    });

    const test = await tenantDb.test.create({
      data: {
        centerId: center.id,
        materialId: material.id,
        timeLimitMinutes: parsed.timeLimitMinutes || null,
        maxAttempts: parsed.maxAttempts,
        passingScorePercent: parsed.passingScorePercent,
        shuffleQuestions: parsed.shuffleQuestions,
      },
    });

    const createdQuestions = [];
    for (let i = 0; i < parsed.questions.length; i++) {
      const q = parsed.questions[i];
      const normalizedOptions = q.options?.map((o, idx) => ({
        id: o.id ?? String(idx + 1),
        text: o.text,
        isCorrect: o.isCorrect,
      }));
      const correctOption = normalizedOptions?.find((o) => o.isCorrect);

      const createdQ = await tenantDb.testQuestion.create({
        data: {
          centerId: center.id,
          testId: test.id,
          questionText: q.questionText.trim(),
          questionType: q.questionType,
          optionsJson:
            normalizedOptions && normalizedOptions.length > 0
              ? JSON.stringify(normalizedOptions)
              : null,
          correctAnswer:
            q.correctAnswer || (correctOption ? correctOption.text : null),
          points: q.points,
          orderIndex: i + 1,
        },
      });
      createdQuestions.push(createdQ);
    }

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "TEST_CREATED",
      resource: "Test",
      resourceId: test.id,
      details: {
        title: parsed.title,
        questionsCount: parsed.questions.length,
        courseId: parsed.courseId,
        groupId: parsed.groupId,
      },
    });

    return NextResponse.json(
      {
        success: true,
        testId: test.id,
        test: {
          id: test.id,
          title: parsed.title,
          questions: createdQuestions,
        },
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message || "Validation error" },
        { status: 400 }
      );
    }
    console.error("POST /api/tests error:", err);
    return NextResponse.json(
      { error: "Не удалось создать тест" },
      { status: 500 }
    );
  }
}
