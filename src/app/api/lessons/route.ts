import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";
import { Prisma } from "@prisma/client";

// POST /api/lessons - Create a lesson inside a module
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { moduleId, title, lessonType, scheduledAt, durationMinutes, content, videoUrl, onlineMeetingUrl, location, substituteTeacherMembershipId } = await req.json();

    if (!moduleId || !title) {
      return NextResponse.json({ error: "Module ID and title are required" }, { status: 400 });
    }

    const courseModule = await tenantDb.courseModule.findUnique({
      where: { id: moduleId },
      select: { id: true, courseId: true },
    });

    if (!courseModule) {
      return NextResponse.json({ error: "Module not found" }, { status: 404 });
    }

    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const teacherGroup = await tenantDb.group.findFirst({
        where: {
          courseId: courseModule.courseId,
          OR: [
            { teacherMembershipId: tenantCtx.membership.id },
            { assistantMembershipId: tenantCtx.membership.id },
          ],
        },
      });

      if (!teacherGroup) {
        return NextResponse.json(
          { error: "Forbidden: Teachers can only create lessons in courses of their groups" },
          { status: 403 }
        );
      }
    }

    if (substituteTeacherMembershipId) {
      const subTeacher = await tenantDb.centerMembership.findFirst({
        where: { id: substituteTeacherMembershipId, role: "TEACHER", status: "ACTIVE" },
      });
      if (!subTeacher) {
        return NextResponse.json({ error: "Substitute teacher must be an active teacher in this center" }, { status: 400 });
      }
    }

    // Get highest orderIndex for this module
    const maxLesson = await tenantDb.lesson.findFirst({
      where: { moduleId },
      orderBy: { orderIndex: "desc" },
    });

    const nextOrderIndex = (maxLesson?.orderIndex ?? 0) + 1;

    const lesson = await tenantDb.lesson.create({
      data: {
        centerId: tenantCtx.center.id,
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
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 });
  }
}

// PATCH /api/lessons - Update a lesson or soft-archive/cancel it
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const {
      lessonId,
      title,
      lessonType,
      status,
      cancelledReason,
      scheduledAt,
      durationMinutes,
      content,
      videoUrl,
      onlineMeetingUrl,
      location,
      orderIndex,
      substituteTeacherMembershipId,
    } = await req.json();

    if (!lessonId) {
      return NextResponse.json({ error: "Lesson ID is required" }, { status: 400 });
    }

    const existingLesson = await tenantDb.lesson.findFirst({
      where: { id: lessonId },
      include: {
        module: {
          include: {
            course: {
              include: {
                groups: true,
              },
            },
          },
        },
        scheduleSlot: true,
      },
    });

    if (!existingLesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Role-based permission check for TEACHER
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const isAssigned =
        existingLesson.scheduleSlot?.teacherMembershipId === tenantCtx.membership.id ||
        existingLesson.substituteTeacherMembershipId === tenantCtx.membership.id ||
        existingLesson.module.course.createdByMembershipId === tenantCtx.membership.id;

      if (!isAssigned) {
        return NextResponse.json({ error: "Forbidden: You are not assigned to this lesson" }, { status: 403 });
      }
    }

    if (substituteTeacherMembershipId) {
      const subTeacher = await tenantDb.centerMembership.findFirst({
        where: { id: substituteTeacherMembershipId, role: "TEACHER", status: "ACTIVE" },
      });
      if (!subTeacher) {
        return NextResponse.json({ error: "Substitute teacher must be an active teacher in this center" }, { status: 400 });
      }
    }

    const updateData: Prisma.LessonUncheckedUpdateInput = {};
    if (title !== undefined) updateData.title = title;
    if (lessonType !== undefined) updateData.lessonType = lessonType;
    if (status !== undefined) updateData.status = status;
    if (cancelledReason !== undefined) updateData.cancelledReason = cancelledReason;
    if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;
    if (durationMinutes !== undefined) updateData.durationMinutes = parseInt(durationMinutes);
    if (content !== undefined) updateData.content = content;
    if (videoUrl !== undefined) updateData.videoUrl = videoUrl;
    if (onlineMeetingUrl !== undefined) updateData.onlineMeetingUrl = onlineMeetingUrl;
    if (location !== undefined) updateData.location = location;
    if (orderIndex !== undefined) updateData.orderIndex = parseInt(orderIndex);
    if (substituteTeacherMembershipId !== undefined) {
      updateData.substituteTeacherMembershipId = substituteTeacherMembershipId || null;
    }

    await tenantDb.lesson.updateMany({
      where: { id: lessonId },
      data: updateData,
    });
    const lesson = await tenantDb.lesson.findFirst({ where: { id: lessonId } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "LESSON_UPDATED",
      resource: "Lesson",
      resourceId: lessonId,
      details: {
        status: status || existingLesson.status,
        cancelledReason: cancelledReason ?? existingLesson.cancelledReason,
        substituteTeacherMembershipId: substituteTeacherMembershipId ?? existingLesson.substituteTeacherMembershipId,
      },
    });

    if (
      status === "CANCELLED" ||
      (substituteTeacherMembershipId && substituteTeacherMembershipId !== existingLesson.substituteTeacherMembershipId)
    ) {
      const groupIds: string[] = [];
      if (existingLesson.scheduleSlot?.groupId) {
        groupIds.push(existingLesson.scheduleSlot.groupId);
      } else {
        groupIds.push(...existingLesson.module.course.groups.map((g) => g.id));
      }

      if (groupIds.length > 0) {
        const enrollments = await tenantDb.enrollment.findMany({
          where: { groupId: { in: groupIds }, status: "ACTIVE" },
          include: { student: true },
        });

        const notifType = status === "CANCELLED" ? "LESSON_CANCELLED" : "LESSON_SUBSTITUTED";
        const titleKey = status === "CANCELLED" ? "notifications.lessonCancelled" : "notifications.lessonSubstituted";
        const bodyKey = status === "CANCELLED" ? "notifications.lessonCancelledBody" : "notifications.lessonSubstitutedBody";

        for (const en of enrollments) {
          if (en.student.userId) {
            await sendNotification({
              userId: en.student.userId,
              centerId: tenantCtx.center.id,
              type: notifType,
              titleKey,
              bodyKey,
              bodyParams: { title: existingLesson.title, reason: cancelledReason || "" },
            });
          }
        }
      }
    }

    return NextResponse.json({ success: true, lesson });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json({ error: error.message || "Server error" }, { status: error.status || 500 });
  }
}
