import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { Prisma, SubstitutionStatus } from "@prisma/client";

// GET /api/substitutions - List substitution requests
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const isPrivileged =
      tenantCtx.role === "DIRECTOR" ||
      tenantCtx.role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    const where: Prisma.SubstitutionRequestWhereInput = {
      centerId: tenantCtx.center.id,
      ...(status && Object.values(SubstitutionStatus).includes(status as SubstitutionStatus)
        ? { status: status as SubstitutionStatus }
        : {}),
    };

    if (!isPrivileged) {
      if (!tenantCtx.membership?.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const myId = tenantCtx.membership.id;
      where.OR = [
        { requesterMembershipId: myId },
        { proposedSubstituteMembershipId: myId },
        { substituteTeacherMembershipId: myId },
      ];
    }

    const requests = await tenantDb.substitutionRequest.findMany({
      where,
      include: {
        lesson: {
          select: {
            id: true,
            title: true,
            scheduledAt: true,
            durationMinutes: true,
            status: true,
            module: {
              select: {
                id: true,
                title: true,
                course: { select: { id: true, title: true } },
              },
            },
            scheduleSlot: {
              select: {
                id: true,
                dayOfWeek: true,
                startTime: true,
                endTime: true,
                group: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        proposedSubstitute: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        substituteTeacher: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true, email: true } },
          },
        },
        resolvedBy: {
          select: {
            id: true,
            role: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ substitutionRequests: requests });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to fetch substitution requests" },
      { status: error.status || 500 }
    );
  }
}

// POST /api/substitutions - Create a substitution request
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (!tenantCtx.membership?.id) {
      return NextResponse.json({ error: "No membership found" }, { status: 403 });
    }

    const { lessonId, reason, proposedSubstituteMembershipId } = await req.json();

    if (!lessonId || !reason || typeof reason !== "string" || reason.trim().length < 3) {
      return NextResponse.json(
        { error: "Lesson ID and a reason (min 3 chars) are required" },
        { status: 400 }
      );
    }

    const lesson = await tenantDb.lesson.findFirst({
      where: {
        id: lessonId,
        centerId: tenantCtx.center.id,
      },
      include: {
        scheduleSlot: { select: { teacherMembershipId: true, groupId: true } },
        module: {
          include: {
            course: {
              include: {
                groups: { select: { id: true, teacherMembershipId: true, assistantMembershipId: true } },
              },
            },
          },
        },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found in this center" }, { status: 404 });
    }

    const isPrivileged =
      tenantCtx.role === "DIRECTOR" ||
      tenantCtx.role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    if (!isPrivileged) {
      // Must be the teacher or assistant of this lesson's group/schedule
      const isSlotTeacher = lesson.scheduleSlot?.teacherMembershipId === tenantCtx.membership.id;
      const isCourseTeacher = lesson.module.course.groups.some(
        (g) =>
          g.teacherMembershipId === tenantCtx.membership?.id ||
          g.assistantMembershipId === tenantCtx.membership?.id
      );

      if (!isSlotTeacher && !isCourseTeacher) {
        return NextResponse.json(
          { error: "Forbidden: You can only request substitutions for your own lessons" },
          { status: 403 }
        );
      }
    }

    // Check proposed substitute if provided
    if (proposedSubstituteMembershipId) {
      const proposed = await tenantDb.centerMembership.findFirst({
        where: {
          id: proposedSubstituteMembershipId,
          centerId: tenantCtx.center.id,
          role: { in: ["TEACHER", "TEACHER_ASSISTANT"] },
        },
      });
      if (!proposed) {
        return NextResponse.json(
          { error: "Proposed substitute teacher not found in this center" },
          { status: 404 }
        );
      }
    }

    const subRequest = await tenantDb.substitutionRequest.create({
      data: {
        centerId: tenantCtx.center.id,
        lessonId: lesson.id,
        requesterMembershipId: tenantCtx.membership.id,
        proposedSubstituteMembershipId: proposedSubstituteMembershipId || null,
        reason: reason.trim(),
        status: "REQUESTED",
      },
      include: {
        lesson: { select: { id: true, title: true, scheduledAt: true } },
        requester: { select: { user: { select: { fullName: true } } } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SUBSTITUTION_REQUEST_CREATED",
      resource: "SubstitutionRequest",
      resourceId: subRequest.id,
      details: { lessonId, reason, proposedSubstituteMembershipId },
    });

    // Notify center directors/admins
    const admins = await tenantDb.centerMembership.findMany({
      where: {
        centerId: tenantCtx.center.id,
        role: { in: ["DIRECTOR", "CENTER_ADMIN"] },
      },
      select: { userId: true },
    });

    for (const a of admins) {
      await tenantDb.notification.create({
        data: {
          centerId: tenantCtx.center.id,
          userId: a.userId,
          titleKey: "notifications.substitutionRequestTitle",
          bodyKey: "notifications.substitutionRequestBody",
          bodyParams: JSON.stringify({
            requester: subRequest.requester.user.fullName,
            lesson: subRequest.lesson.title,
          }),
          type: "GENERAL",
        },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, substitutionRequest: subRequest });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to create substitution request" },
      { status: error.status || 400 }
    );
  }
}
