import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";

const acceptSchema = z.object({
  pendingInviteId: z.string().uuid(),
});

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || !session.sessionId) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const body = await req.json();
    const parsed = acceptSchema.parse(body);
    const { pendingInviteId } = parsed;

    const pendingInvite = await db.pendingInvite.findUnique({
      where: { id: pendingInviteId },
      include: { inviteCode: true },
    });

    if (!pendingInvite) {
      return apiError("Invite not found", "NOT_FOUND", 404);
    }

    if (pendingInvite.email !== session.user.email) {
      return apiError("Forbidden", "FORBIDDEN", 403);
    }

    if (pendingInvite.status !== "PENDING") {
      return apiError("Invite already processed", "BAD_REQUEST", 400);
    }

    if (pendingInvite.expiresAt < new Date()) {
      return apiError("Invite expired", "BAD_REQUEST", 400);
    }

    const invite = pendingInvite.inviteCode;

    // Check center status: BLOCKED or CANCELLED centers cannot accept new members
    const center = await db.learningCenter.findUnique({
      where: { id: invite.centerId },
      select: { id: true, status: true, suspensionReason: true },
    });

    if (!center || center.status === "BLOCKED" || center.status === "CANCELLED") {
      return apiError(
        `Learning center is suspended (${center?.status || "NOT_FOUND"}): ${center?.suspensionReason || "access restricted"}`,
        "TENANT_BLOCKED",
        403
      );
    }

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return apiError("Invite expired", "BAD_REQUEST", 400);
    }
    if (invite.maxUses !== null && invite.usesCount >= invite.maxUses) {
      return apiError("Invite exhausted", "BAD_REQUEST", 400);
    }

    // Role conflict check: if membership already exists with a different role
    const existingMembership = await db.centerMembership.findFirst({
      where: { userId: session.user.id, centerId: invite.centerId },
    });

    if (existingMembership && existingMembership.role !== invite.targetRole) {
      return apiError(
        `User already has role ${existingMembership.role} in this center, cannot accept invite for ${invite.targetRole}`,
        "ROLE_CONFLICT",
        409
      );
    }

    // Execute acceptance in an atomic transaction
    await db.$transaction(async (tx) => {
      // 1. Conditional update on pendingInvite: ensures only ONE concurrent call succeeds
      const updatePending = await tx.pendingInvite.updateMany({
        where: { id: pendingInvite.id, status: "PENDING" },
        data: { status: "ACCEPTED" },
      });

      if (updatePending.count === 0) {
        throw new Error("ALREADY_PROCESSED");
      }

      // 2. Atomic increment of invite uses inside transaction
      let updateCount;
      if (invite.maxUses !== null) {
        updateCount = await tx.inviteCode.updateMany({
          where: { id: invite.id, usesCount: { lt: invite.maxUses } },
          data: { usesCount: { increment: 1 } },
        });
      } else {
        updateCount = await tx.inviteCode.updateMany({
          where: { id: invite.id },
          data: { usesCount: { increment: 1 } },
        });
      }

      if (updateCount.count === 0) {
        throw new Error("INVITE_EXHAUSTED");
      }

      // 3. Create membership if doesn't exist
      let membership = existingMembership;
      if (!membership) {
        membership = await tx.centerMembership.create({
          data: {
            userId: session.user.id,
            centerId: invite.centerId,
            role: invite.targetRole,
            status: "ACTIVE",
          },
        });
      }

      // 4. Enroll in group if invite has groupId
      if (invite.groupId) {
        const existingEnrollment = await tx.enrollment.findFirst({
          where: { studentMembershipId: membership.id, groupId: invite.groupId },
        });
        if (!existingEnrollment) {
          await tx.enrollment.create({
            data: {
              centerId: invite.centerId,
              studentMembershipId: membership.id,
              groupId: invite.groupId,
              status: "ACTIVE",
            },
          });
        }
      }

      // 5. Audit log
      await tx.auditLog.create({
        data: {
          centerId: invite.centerId,
          actorUserId: session.user.id,
          action: "INVITE_ACCEPTED",
          resource: "PendingInvite",
          resourceId: pendingInvite.id,
          detailsJson: JSON.stringify({
            inviteCode: invite.code,
            role: invite.targetRole,
          }),
        },
      });
    });

    return apiSuccess({ success: true });
  } catch (err: unknown) {
    const error = err as { message?: string };
    if (error?.message === "ALREADY_PROCESSED") {
      return apiError("Invite already processed", "BAD_REQUEST", 400);
    }
    if (error?.message === "INVITE_EXHAUSTED") {
      return apiError("Invite exhausted or race condition", "BAD_REQUEST", 400);
    }
    return handleApiError(err);
  }
}
