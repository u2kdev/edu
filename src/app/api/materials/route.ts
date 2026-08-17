import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// GET /api/materials?lessonId=xxx - List materials for a lesson
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");

    const materials = await db.material.findMany({
      where: {
        centerId: tenantCtx.center.id,
        ...(lessonId ? { lessonId } : {}),
      },
      include: {
        test: {
          include: {
            questions: true,
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json({ materials });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// POST /api/materials - Create a material (Video, Lecture, Book, Test)
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      lessonId,
      title,
      materialType,
      contentText,
      fileUrl,
      externalUrl,
      durationMinutes,
      pagesRange,
      testConfig, // Optional test configuration if materialType === 'TEST'
    } = await req.json();

    if (!title || !materialType) {
      return NextResponse.json({ error: "Title and materialType are required" }, { status: 400 });
    }

    const validTypes = ["VIDEO", "LECTURE", "BOOK", "TEST"];
    if (!validTypes.includes(materialType)) {
      return NextResponse.json({ error: "Invalid materialType" }, { status: 400 });
    }

    // Get max orderIndex
    const maxMat = await db.material.findFirst({
      where: { centerId: tenantCtx.center.id, ...(lessonId ? { lessonId } : {}) },
      orderBy: { orderIndex: "desc" },
    });

    const nextOrder = (maxMat?.orderIndex ?? 0) + 1;

    const material = await db.material.create({
      data: {
        centerId: tenantCtx.center.id,
        lessonId: lessonId || null,
        title,
        materialType,
        contentText: contentText || null,
        fileUrl: fileUrl || null,
        externalUrl: externalUrl || null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : null,
        pagesRange: pagesRange || null,
        orderIndex: nextOrder,
      },
    });

    // If materialType is TEST, create associated Test & Questions
    if (materialType === "TEST" && testConfig) {
      const test = await db.test.create({
        data: {
          materialId: material.id,
          timeLimitMinutes: testConfig.timeLimitMinutes ? parseInt(testConfig.timeLimitMinutes) : null,
          maxAttempts: testConfig.maxAttempts ? parseInt(testConfig.maxAttempts) : 1,
          passingScorePercent: testConfig.passingScorePercent ? parseInt(testConfig.passingScorePercent) : 60,
          shuffleQuestions: testConfig.shuffleQuestions ?? false,
        },
      });

      if (Array.isArray(testConfig.questions) && testConfig.questions.length > 0) {
        for (let i = 0; i < testConfig.questions.length; i++) {
          const q = testConfig.questions[i];
          await db.testQuestion.create({
            data: {
              testId: test.id,
              questionText: q.questionText,
              questionType: q.questionType || "SINGLE_CHOICE",
              optionsJson: q.options ? JSON.stringify(q.options) : null, // [{text, isCorrect}]
              correctAnswer: q.correctAnswer || null,
              points: q.points ? parseInt(q.points) : 1,
              orderIndex: i + 1,
            },
          });
        }
      }
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "MATERIAL_CREATED",
      resource: "Material",
      resourceId: material.id,
      details: { title, materialType, lessonId },
    });

    const fullMaterial = await db.material.findUnique({
      where: { id: material.id },
      include: { test: { include: { questions: true } } },
    });

    return NextResponse.json({ success: true, material: fullMaterial });
  } catch (err: any) {
    console.error("Material create error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
