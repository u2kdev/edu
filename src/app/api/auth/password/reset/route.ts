import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { passwordResetSubmitSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    if (!checkRateLimit(ip + "_reset_pwd")) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = passwordResetSubmitSchema.parse(body);
    const { token, newPassword } = parsed;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date() || !resetToken.user.isActive) {
      return apiError("auth.invalidOrExpiredToken", "BAD_REQUEST", 400);
    }

    if (newPassword === resetToken.user.email) {
      return apiError("auth.password.matchesEmail", "BAD_REQUEST", 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.$transaction(async (tx) => {
      // Mark token as used
      await tx.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      });

      // Update password
      const updateData: any = { passwordHash: hashedPassword };
      if (!resetToken.user.emailVerified) {
        updateData.emailVerified = new Date();
      }

      await tx.platformUser.update({
        where: { id: resetToken.userId },
        data: updateData,
      });

      // Revoke all sessions for this user
      await tx.userSession.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: "PASSWORD_RESET_SUCCESS",
          resource: "PlatformUser",
          resourceId: resetToken.userId,
          ipAddress: ip,
        }
      });
    });

    return apiSuccess({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}
