// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, comparePassword } from "@/lib/auth";
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

    // 1. Password confirmation
    const body: unknown = await req.json().catch(() => ({}));
    if (
      !body ||
      typeof body !== "object" ||
      !("password" in body) ||
      typeof (body as { password: unknown }).password !== "string" ||
      !(body as { password: string }).password
    ) {
      return apiError("Password is required to delete account", "VALIDATION_ERROR", 400);
    }
    const { password } = body as { password: string };

    const user = await db.platformUser.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return apiError("User not found", "NOT_FOUND", 404);
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return apiError("Invalid password", "VALIDATION_ERROR", 400);
    }

    // 2. Sole DIRECTOR check
    const directorMemberships = await db.centerMembership.findMany({
      where: {
        userId,
        role: "DIRECTOR",
        status: "ACTIVE",
        center: { status: "ACTIVE" },
      },
    });

    for (const mem of directorMemberships) {
      const otherDirectorsCount = await db.centerMembership.count({
        where: {
          centerId: mem.centerId,
          role: "DIRECTOR",
          status: "ACTIVE",
          userId: { not: userId },
        },
      });

      if (otherDirectorsCount === 0) {
        return apiError(
          "Cannot delete account: You are the sole active DIRECTOR of one or more centers. Please transfer the director role before deleting your account.",
          "SOLE_DIRECTOR_CONFLICT",
          409
        );
      }
    }

    // 3. Soft-delete user: anonymize name, email, phone, avatar
    const anonymizedEmail = `deleted_${userId.slice(0, 8)}_${Date.now()}@deleted.local`;
    await db.platformUser.update({
      where: { id: userId },
      data: {
        isActive: false,
        fullName: "Deleted User",
        email: anonymizedEmail,
        phone: null,
        avatarUrl: null,
      },
    });

    // 4. Parent loses access to children: sever ParentLink records
    await db.parentLink.deleteMany({
      where: {
        parent: { userId },
      },
    });

    // 5. Archive memberships
    await db.centerMembership.updateMany({
      where: { userId },
      data: { status: "ARCHIVED" },
    });

    // 6. Revoke all active sessions
    await db.userSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 7. Delete all registered push tokens
    await db.devicePushToken.deleteMany({
      where: { userId },
    });

    // 8. Audit log
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
