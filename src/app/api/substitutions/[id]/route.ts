import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// GET /api/substitutions/[id] - Get single substitution request
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const request = await tenantDb.substitutionRequest.findFirst({
      where: {
        id: params.id,
        centerId: tenantCtx.center.id,
      },
      include: {
        lesson: {
          include: {
            module: { include: { course: true } },
            scheduleSlot: { include: { group: true } },
          },
        },
        requester: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
        proposedSubstitute: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
        substituteTeacher: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
        resolvedBy: { include: { user: { select: { fullName: true } } } },
      },
    });

    if (!request) {
      return NextResponse.json({ error: "Substitution request not found" }, { status: 404 });
    }

    const isPrivileged =
      tenantCtx.role === "DIRECTOR" ||
      tenantCtx.role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    if (!isPrivileged && tenantCtx.membership?.id) {
      const myId = tenantCtx.membership.id;
      if (
        request.requesterMembershipId !== myId &&
        request.proposedSubstituteMembershipId !== myId &&
        request.substituteTeacherMembershipId !== myId
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    return NextResponse.json({ substitutionRequest: request });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Server error" },
      { status: error.status || 500 }
    );
  }
}

// PATCH /api/substitutions/[id] - Approve, reject or cancel substitution
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const subRequest = await tenantDb.substitutionRequest.findFirst({
      where: {
        id: params.id,
        centerId: tenantCtx.center.id,
      },
      include: {
        lesson: {
          include: {
            scheduleSlot: true,
          },
        },
        requester: { include: { user: { select: { fullName: true, id: true } } } },
      },
    });

    if (!subRequest) {
      return NextResponse.json({ error: "Substitution request not found" }, { status: 404 });
    }

    if (subRequest.status !== "REQUESTED") {
      return NextResponse.json(
        { error: `Cannot modify a request that is already ${subRequest.status}` },
        { status: 400 }
      );
    }

    const { action, substituteTeacherMembershipId, resolverComment } = await req.json();

    if (!["APPROVE", "REJECT", "CANCEL"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be APPROVE, REJECT, or CANCEL" },
        { status: 400 }
      );
    }

    const isPrivileged =
      tenantCtx.role === "DIRECTOR" ||
      tenantCtx.role === "CENTER_ADMIN" ||
      tenantCtx.isPlatformStaff;

    // CANCEL can be performed by requester or privileged staff
    if (action === "CANCEL") {
      if (!isPrivileged && subRequest.requesterMembershipId !== tenantCtx.membership?.id) {
        return NextResponse.json({ error: "Forbidden: Only requester can cancel" }, { status: 403 });
      }

      const updated = await tenantDb.substitutionRequest.update({
        where: { id: subRequest.id },
        data: {
          status: "CANCELLED",
          resolverComment: resolverComment?.trim() || null,
        },
      });

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "SUBSTITUTION_REQUEST_CANCELLED",
        resource: "SubstitutionRequest",
        resourceId: subRequest.id,
      });

      return NextResponse.json({ success: true, substitutionRequest: updated });
    }

    // APPROVE / REJECT requires DIRECTOR or CENTER_ADMIN
    if (!isPrivileged) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can resolve substitutions" },
        { status: 403 }
      );
    }

    if (action === "REJECT") {
      const updated = await tenantDb.substitutionRequest.update({
        where: { id: subRequest.id },
        data: {
          status: "REJECTED",
          resolvedByMembershipId: tenantCtx.membership?.id || null,
          resolverComment: resolverComment?.trim() || null,
        },
      });

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "SUBSTITUTION_REQUEST_REJECTED",
        resource: "SubstitutionRequest",
        resourceId: subRequest.id,
        details: { resolverComment },
      });

      // Notify requester
      await tenantDb.notification.create({
        data: {
          centerId: tenantCtx.center.id,
          userId: subRequest.requester.user.id,
          titleKey: "notifications.substitutionRejectedTitle",
          bodyKey: "notifications.substitutionRejectedBody",
          bodyParams: JSON.stringify({
            lesson: subRequest.lesson.title,
            reason: resolverComment || "",
          }),
          type: "GENERAL",
        },
      }).catch(() => {});

      return NextResponse.json({ success: true, substitutionRequest: updated });
    }

    // APPROVE
    const assignedSubstituteId =
      substituteTeacherMembershipId || subRequest.proposedSubstituteMembershipId;

    if (!assignedSubstituteId) {
      return NextResponse.json(
        { error: "A substitute teacher must be assigned to approve" },
        { status: 400 }
      );
    }

    const substituteMember = await tenantDb.centerMembership.findFirst({
      where: {
        id: assignedSubstituteId,
        centerId: tenantCtx.center.id,
        role: { in: ["TEACHER", "TEACHER_ASSISTANT"] },
      },
      include: { user: { select: { id: true, fullName: true } } },
    });

    if (!substituteMember) {
      return NextResponse.json(
        { error: "Assigned substitute teacher not found in this center" },
        { status: 404 }
      );
    }

    // --- TIMETABLE CONFLICT CHECK ---
    const lesson = subRequest.lesson;
    if (lesson.scheduledAt) {
      const lessonStart = new Date(lesson.scheduledAt).getTime();
      const lessonEnd = lessonStart + (lesson.durationMinutes || 60) * 60 * 1000;

      // Find all potentially conflicting active lessons for this substitute teacher
      const candidateLessons = await tenantDb.lesson.findMany({
        where: {
          id: { not: lesson.id },
          status: "ACTIVE",
          scheduledAt: { not: null },
          centerId: tenantCtx.center.id,
          OR: [
            { substituteTeacherMembershipId: assignedSubstituteId },
            { scheduleSlot: { teacherMembershipId: assignedSubstituteId } },
          ],
        },
        select: {
          id: true,
          title: true,
          scheduledAt: true,
          durationMinutes: true,
        },
      });

      for (const cand of candidateLessons) {
        if (cand.scheduledAt) {
          const candStart = new Date(cand.scheduledAt).getTime();
          const candEnd = candStart + (cand.durationMinutes || 60) * 60 * 1000;

          // Check overlap: start1 < end2 && end1 > start2
          if (lessonStart < candEnd && lessonEnd > candStart) {
            return NextResponse.json(
              {
                error: `Schedule conflict: ${substituteMember.user.fullName} already has lesson "${cand.title}" scheduled at that time`,
                conflictLessonId: cand.id,
              },
              { status: 409 }
            );
          }
        }
      }
    }

    // Execute update of SubstitutionRequest and Lesson
    await tenantDb.substitutionRequest.update({
      where: { id: subRequest.id },
      data: {
        status: "APPROVED",
        substituteTeacherMembershipId: assignedSubstituteId,
        resolvedByMembershipId: tenantCtx.membership?.id || null,
        resolverComment: resolverComment?.trim() || null,
      },
    });

    await tenantDb.lesson.update({
      where: { id: subRequest.lessonId },
      data: {
        substituteTeacherMembershipId: assignedSubstituteId,
      },
    });

    const updatedSubRequest = await tenantDb.substitutionRequest.findFirst({
      where: { id: subRequest.id },
      include: {
        substituteTeacher: { include: { user: { select: { fullName: true } } } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SUBSTITUTION_REQUEST_APPROVED",
      resource: "SubstitutionRequest",
      resourceId: subRequest.id,
      details: {
        lessonId: subRequest.lessonId,
        substituteTeacherMembershipId: assignedSubstituteId,
        resolverComment,
      },
    });

    // Notify requester
    await tenantDb.notification.create({
      data: {
        centerId: tenantCtx.center.id,
        userId: subRequest.requester.user.id,
        titleKey: "notifications.substitutionApprovedTitle",
        bodyKey: "notifications.substitutionApprovedBody",
        bodyParams: JSON.stringify({
          lesson: lesson.title,
          substitute: substituteMember.user.fullName,
        }),
        type: "GENERAL",
      },
    }).catch(() => {});

    // Notify assigned substitute teacher
    await tenantDb.notification.create({
      data: {
        centerId: tenantCtx.center.id,
        userId: substituteMember.user.id,
        titleKey: "notifications.substitutionAssignedTitle",
        bodyKey: "notifications.substitutionAssignedBody",
        bodyParams: JSON.stringify({
          lesson: lesson.title,
        }),
        type: "GENERAL",
      },
    }).catch(() => {});

    return NextResponse.json({ success: true, substitutionRequest: updatedSubRequest });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Server error" },
      { status: error.status || 400 }
    );
  }
}
