// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";

export async function DELETE(req: Request) {
  try {
    const ip = getClientIp(req);

    if (!(await checkRateLimit(ip))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    const userId = session.user.id;

    // 1. Soft-delete user: mark inactive and anonymize contact info
    const anonymizedEmail = `deleted_${userId.slice(0, 8)}_${Date.now()}@deleted.local`;
    await db.platformUser.update({
      where: { id: userId },
      data: {
        isActive: false,
        email: anonymizedEmail,
        phone: null,
      },
    });

    // 2. Revoke all active sessions
    await db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 3. Delete all registered push tokens
    await db.devicePushToken.deleteMany({
      where: { userId },
    });

    // 4. Audit log
    try {
      await db.auditLog.create({
        data: {
          actorUserId: userId,
          action: "ACCOUNT_DELETED",
          resource: "PlatformUser",
          resourceId: userId,
          detailsJson: JSON.stringify({ ip, originalEmail: session.user.email }),
          ipAddress: ip,
        },
      });
    } catch {}

    return apiSuccess({
      success: true,
      message: "Account has been successfully deactivated and sessions revoked",
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
