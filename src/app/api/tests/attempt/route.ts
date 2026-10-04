import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { getAuthSession } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// POST /api/tests/attempt - Submit student test answers and calculate auto-grade score
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { testId, studentAnswers } = await req.json(); // studentAnswers: { questionId: string, answer: string | string[] }

    if (!testId || !studentAnswers) {
      return NextResponse.json({ error: "Test ID and answers are required" }, { status: 400 });
    }

    const test = await tenantDb.test.findFirst({
      where: { id: testId },
      include: { questions: true },
    });

    if (!test) {
      return NextResponse.json({ error: "Test not found" }, { status: 404 });
    }

    // Check attempts limit
    const existingAttempts = await tenantDb.testAttempt.count({
      where: {
        testId: test.id,
        studentMembershipId: tenantCtx.membership?.id,
      },
    });

    if (existingAttempts >= test.maxAttempts) {
      return NextResponse.json(
        { error: `You have reached the maximum allowed attempts (${test.maxAttempts}) for this test.` },
        { status: 400 }
      );
    }

    // Auto-grade calculation
    let totalMaxPoints = 0;
    let earnedPoints = 0;

    for (const q of test.questions) {
      totalMaxPoints += q.points;
      const studentAns = studentAnswers[q.id];

      if (!studentAns) continue;

      if (q.questionType === "SINGLE_CHOICE" || q.questionType === "MULTIPLE_CHOICE") {
        if (q.optionsJson) {
          try {
            const options = JSON.parse(q.optionsJson); // [{ text: string, isCorrect: boolean }]
            const correctOptionTexts = options.filter((o: any) => o.isCorrect).map((o: any) => o.text);

            if (Array.isArray(studentAns)) {
              const isMatch =
                studentAns.length === correctOptionTexts.length &&
                studentAns.every((val: string) => correctOptionTexts.includes(val));
              if (isMatch) earnedPoints += q.points;
            } else {
              if (correctOptionTexts.includes(studentAns)) {
                earnedPoints += q.points;
              }
            }
          } catch (e) {
            console.error("Error parsing question options:", e);
          }
        }
      } else if (q.questionType === "TEXT") {
        if (q.correctAnswer && studentAns.trim().toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
          earnedPoints += q.points;
        }
      }
    }

    const scorePercent = totalMaxPoints > 0 ? Math.round((earnedPoints / totalMaxPoints) * 100) : 0;

    const attempt = await tenantDb.testAttempt.create({
      data: {
        centerId: tenantCtx.center.id,
        testId: test.id,
        studentMembershipId: tenantCtx.membership?.id!,
        answersJson: JSON.stringify(studentAnswers),
        scorePercent,
        scorePoints: earnedPoints,
        maxPoints: totalMaxPoints,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });

    // Also log activity
    await tenantDb.activityLog.create({
      data: {
        userMembershipId: tenantCtx.membership?.id!,
        centerId: tenantCtx.center.id,
        activityType: "COMPLETE_TEST",
        resourceType: "Test",
        resourceId: test.id,
        metadataJson: JSON.stringify({ scorePercent, earnedPoints, totalMaxPoints }),
      },
    });

    return NextResponse.json({
      success: true,
      attempt,
      passed: scorePercent >= test.passingScorePercent,
    });
  } catch (err: any) {
    console.error("Test submit attempt error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
