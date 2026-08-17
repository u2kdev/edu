import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// POST /api/lessons - Create a lesson inside a module
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { moduleId, title, lessonType, scheduledAt, durationMinutes, content, videoUrl, onlineMeetingUrl, location, substituteTeacherMembershipId } = await req.json();

    if (!moduleId || !title) {
      return NextResponse.json({ error: "Module ID and title are required" }, { status: 400 });
    }

    // Get highest orderIndex for this module
    const maxLesson = await db.lesson.findFirst({
      where: { moduleId },
      orderBy: { orderIndex: "desc" },
    });

    const nextOrderIndex = (maxLesson?.orderIndex ?? 0) + 1;

    const lesson = await db.lesson.create({
      data: {
        moduleId,
        title,
        lessonType: lessonType || "OFFLINE",
        status: "ACTIVE",
        orderIndex: nextOrderIndex,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        durationMinutes: durationMinutes ? parseInt(durationMinutes) : 60,
        content: content || null,
        videoUrl: videoUrl || null,
        onlineMeetingUrl: onlineMeetingUrl || null,
        location: location || null,
        substituteTeacherMembershipId: substituteTeacherMembershipId || null,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "LESSON_CREATED",
      resource: "Lesson",
      resourceId: lesson.id,
      details: { title, moduleId, lessonType },
    });

    return NextResponse.json({ success: true, lesson });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// PATCH /api/lessons - Update a lesson or soft-archive it
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, title, lessonType, status, scheduledAt, durationMinutes, content, videoUrl, onlineMeetingUrl, location, orderIndex, substituteTeacherMembershipId } = await req.json();

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (lessonType !== undefined) updateData.lessonType = lessonType;
    if (status !== undefined) updateData.status = status; // ACTIVE or ARCHIVED (soft exclusion)
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (durationMinutes !== undefined) updateData.durationMinutes = parseInt(durationMinutes);
    if (content !== undefined) updateData.content = content;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (onlineMeetingUrl !== undefined) updateData.onlineMeetingUrl = onlineMeetingUrl;
    if (location !== undefined) updateData.location = location;
    if (orderIndex !== undefined) updateData.orderIndex = parseInt(orderIndex);
    if (substituteTeacherMembershipId !== undefined) updateData.substituteTeacherMembershipId = substituteTeacherMembershipId || null;

    const lesson = await db.lesson.update({
      where: { id: lessonId },
      data: updateData,
    });

    return NextResponse.json({ success: true, lesson });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
