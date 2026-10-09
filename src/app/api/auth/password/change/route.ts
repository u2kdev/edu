import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, comparePassword, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { passwordChangeSchema } from "@/lib/validation/auth";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    if (!checkRateLimit(ip + "_change_pwd")) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession();
    if (!session || !session.sessionId) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    if (!session.user.emailVerified) {
      return apiError("Email confirmation required for sensitive actions", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = passwordChangeSchema.parse(body);
    const { currentPassword, newPassword } = parsed;

    if (newPassword === session.user.email) {
      return apiError("auth.password.matchesEmail", "BAD_REQUEST", 400);
    }

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.isActive) {
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    }

    const isMatch = await comparePassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      // Audit log failed attempt
      await db.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "PASSWORD_CHANGE_FAILED",
          resource: "PlatformUser",
          resourceId: session.user.id,
          detailsJson: JSON.stringify({ reason: "invalid_current_password", ip }),
          ipAddress: ip,
        }
      });
      return apiError("auth.invalidCurrentPassword", "BAD_REQUEST", 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.$transaction(async (tx) => {
      // Update password
      await tx.platformUser.update({
        where: { id: session.user.id },
        data: { passwordHash: hashedPassword },
      });

      // Revoke all sessions EXCEPT current
      await tx.userSession.updateMany({
        where: { userId: session.user.id, id: { not: session.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: session.user.id,
          action: "PASSWORD_CHANGED",
          resource: "PlatformUser",
          resourceId: session.user.id,
          ipAddress: ip,
        }
      });
    });

    return apiSuccess({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}
