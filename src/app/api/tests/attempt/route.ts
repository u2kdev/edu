import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { assertMaterialAccess } from "@/lib/tenant-access";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

interface QuestionOption {
  text: string;
  isCorrect?: boolean;
}

interface ReviewItem {
  questionId: string;
  questionText: string;
  questionType: string;
  isCorrect: boolean;
  studentAnswer: unknown;
  correctAnswer: unknown;
  points: number;
  maxPoints: number;
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const { testId, attemptId, studentAnswers } = await req.json();

    if (!testId || !studentAnswers) {
      return NextResponse.json(
        { error: "Test ID and answers are required" },
        { status: 400 }
      );
    }

    if (tenantCtx.role !== "STUDENT" || !tenantCtx.membership?.id) {
      return NextResponse.json(
        { error: "Only student members can submit test attempts" },
        { status: 403 }
      );
    }

    const studentMembershipId = tenantCtx.membership.id;

    // Rate limiting: max 30 submissions per minute
    const ip = getClientIp(req);
    const rateLimitKey = `test_attempt:${studentMembershipId}:${ip}`;
    const allowed = await checkRateLimit(rateLimitKey, 30, 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many attempts submitted, please slow down" },
        { status: 429 }
      );
    }

    const test = await tenantDb.test.findFirst({
      where: { id: testId },
      include: {
        questions: {
          orderBy: { orderIndex: "asc" },
        },
        attempts: {
          where: { studentMembershipId, completedAt: { not: null } },
        },
      },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    await assertMaterialAccess(tenantCtx, test.materialId);

    if (test.attempts.length >= test.maxAttempts) {
      return NextResponse.json(
        {
          error: `Исчерпан лимит попыток (${test.maxAttempts}) для этого теста`,
        },
        { status: 400 }
      );
    }

    let attempt = null;
    let isTimeExceeded = false;

    if (attemptId) {
      attempt = await tenantDb.testAttempt.findFirst({
        where: { id: attemptId, testId: test.id, studentMembershipId },
      });
      if (!attempt) {
        return NextResponse.json(
          { error: "Attempt not found or invalid" },
          { status: 404 }
        );
      }
      if (attempt.completedAt !== null) {
        return NextResponse.json(
          { error: "Attempt has already been completed" },
          { status: 400 }
        );
      }

      // Check server-side time limit
      if (test.timeLimitMinutes && attempt.startedAt) {
        const elapsedMinutes =
          (Date.now() - new Date(attempt.startedAt).getTime()) / (60 * 1000);
        // Allow 30 seconds (0.5 min) grace period for network delays
        if (elapsedMinutes > test.timeLimitMinutes + 0.5) {
          isTimeExceeded = true;
        }
      }
    }

    // Auto-grade calculation
    let totalMaxPoints = 0;
    let earnedPoints = 0;
    const review: ReviewItem[] = [];

    const answersRecord = studentAnswers as Record<string, unknown>;

    for (const q of test.questions) {
      totalMaxPoints += q.points;
      const studentAns = answersRecord[q.id];
      let isCorrect = false;
      let expectedAnswerDisplay: unknown = null;

      if (q.questionType === "SINGLE_CHOICE") {
        if (q.optionsJson) {
          try {
            const options = JSON.parse(q.optionsJson) as QuestionOption[];
            const correctOption = options.find((o) => o.isCorrect);
            expectedAnswerDisplay = correctOption?.text || null;
            if (
              correctOption &&
              typeof studentAns === "string" &&
              studentAns.trim() === correctOption.text.trim()
            ) {
              isCorrect = true;
            }
          } catch {
            // Ignored
          }
        }
      } else if (q.questionType === "MULTIPLE_CHOICE") {
        if (q.optionsJson) {
          try {
            const options = JSON.parse(q.optionsJson) as QuestionOption[];
            const correctTexts = options
              .filter((o) => o.isCorrect)
              .map((o) => o.text.trim());
            expectedAnswerDisplay = correctTexts;

            if (Array.isArray(studentAns)) {
              const studentList = studentAns.map((a: unknown) =>
                String(a).trim()
              );
              const allCorrectSelected =
                correctTexts.length === studentList.length &&
                correctTexts.every((t) => studentList.includes(t)) &&
                studentList.every((t) => correctTexts.includes(t));
              if (allCorrectSelected) {
                isCorrect = true;
              }
            }
          } catch {
            // Ignored
          }
        }
      } else if (q.questionType === "TRUE_FALSE") {
        expectedAnswerDisplay = q.correctAnswer || "false";
        if (
          q.correctAnswer &&
          studentAns !== undefined &&
          studentAns !== null &&
          String(studentAns).trim().toLowerCase() ===
            q.correctAnswer.trim().toLowerCase()
        ) {
          isCorrect = true;
        }
      } else if (q.questionType === "TEXT") {
        expectedAnswerDisplay = q.correctAnswer || "";
        if (
          q.correctAnswer &&
          studentAns !== undefined &&
          studentAns !== null &&
          String(studentAns).trim().toLowerCase() ===
            q.correctAnswer.trim().toLowerCase()
        ) {
          isCorrect = true;
        }
      }

      const pointsAwarded = isCorrect ? q.points : 0;
      earnedPoints += pointsAwarded;

      review.push({
        questionId: q.id,
        questionText: q.questionText,
        questionType: q.questionType,
        isCorrect,
        studentAnswer: studentAns ?? null,
        correctAnswer: expectedAnswerDisplay,
        points: pointsAwarded,
        maxPoints: q.points,
      });
    }

    const scorePercent =
      totalMaxPoints > 0
        ? Math.round((earnedPoints / totalMaxPoints) * 100)
        : 0;

    let savedAttempt;
    if (attempt) {
      await tenantDb.testAttempt.updateMany({
        where: { id: attempt.id },
        data: {
          answersJson: JSON.stringify(studentAnswers),
          scorePercent: isTimeExceeded ? 0 : scorePercent,
          scorePoints: isTimeExceeded ? 0 : earnedPoints,
          maxPoints: totalMaxPoints,
          completedAt: new Date(),
        },
      });
      savedAttempt = await tenantDb.testAttempt.findFirst({
        where: { id: attempt.id },
      });
    } else {
      savedAttempt = await tenantDb.testAttempt.create({
        data: {
          centerId: tenantCtx.center.id,
          testId: test.id,
          studentMembershipId,
          answersJson: JSON.stringify(studentAnswers),
          scorePercent: isTimeExceeded ? 0 : scorePercent,
          scorePoints: isTimeExceeded ? 0 : earnedPoints,
          maxPoints: totalMaxPoints,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    // Sync with Gradebook: resolve correct teacher author
    const enrollment = await tenantDb.enrollment.findFirst({
      where: { studentMembershipId, status: "ACTIVE" },
      include: { group: { select: { teacherMembershipId: true } } },
    });

    let realTeacherMembershipId: string | null = enrollment?.group?.teacherMembershipId || null;

    if (!realTeacherMembershipId && test.materialId) {
      const mat = await tenantDb.material.findUnique({
        where: { id: test.materialId },
        include: {
          group: { select: { teacherMembershipId: true } },
          course: { select: { createdByMembershipId: true } },
        },
      });
      realTeacherMembershipId = mat?.group?.teacherMembershipId || mat?.course?.createdByMembershipId || null;
    }

    if (!realTeacherMembershipId) {
      const staffMember = await tenantDb.centerMembership.findFirst({
        where: {
          centerId: tenantCtx.center.id,
          role: { in: ["TEACHER", "DIRECTOR", "CENTER_ADMIN"] },
        },
        select: { id: true },
      });
      realTeacherMembershipId = staffMember?.id || null;
    }

    if (!realTeacherMembershipId) {
      const anyMember = await tenantDb.centerMembership.findFirst({
        where: { centerId: tenantCtx.center.id },
        select: { id: true },
      });
      realTeacherMembershipId = anyMember?.id || studentMembershipId;
    }

    await tenantDb.grade.create({
      data: {
        centerId: tenantCtx.center.id,
        studentMembershipId,
        groupId: enrollment?.groupId || null,
        teacherMembershipId: realTeacherMembershipId,
        gradeType: "TEST",
        value: isTimeExceeded ? 0 : scorePercent,
        maxValue: 100,
        comment: isTimeExceeded
          ? "Time limit exceeded (0%) [TEST_AUTO]"
          : `Test: ${earnedPoints}/${totalMaxPoints} (${scorePercent}%) [TEST_AUTO]`,
        lifecycle: "SUBMITTED",
      },
    });

    // Activity log
    await tenantDb.activityLog.create({
      data: {
        userMembershipId: studentMembershipId,
        centerId: tenantCtx.center.id,
        activityType: "COMPLETE_TEST",
        resourceType: "Test",
        resourceId: test.id,
        metadataJson: JSON.stringify({
          scorePercent,
          earnedPoints,
          totalMaxPoints,
          isTimeExceeded,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      attempt: savedAttempt,
      passed: !isTimeExceeded && scorePercent >= test.passingScorePercent,
      isTimeExceeded,
      review,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.status || 500 }
    );
  }
}
