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

    const invite = pendingInvite.inviteCode;

    if (invite.expiresAt && invite.expiresAt < new Date()) {
      return apiError("Invite expired", "BAD_REQUEST", 400);
    }
    if (invite.usesCount >= invite.maxUses) {
      return apiError("Invite exhausted", "BAD_REQUEST", 400);
    }

    // Atomic increment
    const updateCount = await db.inviteCode.updateMany({
      where: { id: invite.id, usesCount: invite.usesCount },
      data: { usesCount: { increment: 1 } },
    });

    if (updateCount.count === 0) {
      return apiError("Invite exhausted or race condition", "BAD_REQUEST", 400);
    }

    await db.$transaction(async (tx) => {
      // Mark as accepted
      await tx.pendingInvite.update({
        where: { id: pendingInvite.id },
        data: { status: "ACCEPTED" },
      });

      // Check if membership already exists
      let membership = await tx.centerMembership.findFirst({
        where: { userId: session.user.id, centerId: invite.centerId },
      });

      if (!membership) {
        membership = await tx.centerMembership.create({
          data: {
            userId: session.user.id,
            centerId: invite.centerId,
            role: invite.targetRole,
            status: "ACTIVE",
          }
        });
      }

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
              status: "ACTIVE"
            }
          });
        }
      }
    });

    return apiSuccess({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}
