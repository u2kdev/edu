// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { signJWT, hashJti, hashToken, generateRefreshToken, JWTPayload } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { mobileRefreshTokenSchema } from "@/lib/validation/auth";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);

    if (!(await checkRateLimit(ip))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body: unknown = await req.json().catch(() => ({}));
    const parsed = mobileRefreshTokenSchema.parse(body);
    const { refreshToken, deviceId } = parsed;

    const tokenHash = hashToken(refreshToken);

    const session = await db.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              where: { status: "ACTIVE" },
              include: {
                center: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                    status: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!session) {
      return apiError("Invalid refresh token", "INVALID_REFRESH_TOKEN", 401);
    }

    // Token reuse detection: if a revoked refresh token is presented, revoke all sessions
    if (session.revokedAt) {
      await db.userSession.updateMany({
        where: { userId: session.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return apiError("Session has been revoked", "SESSION_REVOKED", 401);
    }

    // Check expiration
    if (session.expiresAt < new Date()) {
      return apiError("Refresh token has expired", "EXPIRED_REFRESH_TOKEN", 401);
    }

    // Check device binding if deviceId is configured on session
    if (session.deviceId && deviceId && session.deviceId !== deviceId) {
      return apiError("Device mismatch detected", "DEVICE_MISMATCH", 401);
    }

    const user = session.user;
    if (!user || !user.isActive) {
      return apiError("User account is inactive", "UNAUTHORIZED", 401);
    }

    // Generate new tokens (Rotation)
    const newJti = uuidv4();
    const newRefreshToken = generateRefreshToken();
    const newExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for refresh token
    const newRefreshTokenHash = hashToken(newRefreshToken);

    const activeMembership = user.memberships[0] || null;

    const payload: JWTPayload & { jti: string } = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: activeMembership?.centerId,
      activeCenterRole: activeMembership?.role,
      jti: newJti,
    };

    const newAccessToken = signJWT(payload, "15m");

    // Atomically rotate token
    await db.userSession.update({
      where: { id: session.id },
      data: {
        jtiHash: hashJti(newJti),
        refreshTokenHash: newRefreshTokenHash,
        lastSeenAt: new Date(),
        expiresAt: newExpiresAt,
        ipAddress: ip,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "MOBILE_TOKEN_REFRESH",
          resource: "PlatformUser",
          resourceId: user.id,
          detailsJson: JSON.stringify({ deviceId: session.deviceId || deviceId, ip }),
          ipAddress: ip,
        },
      });
    } catch {}

    const formattedMemberships = user.memberships.map((m) => ({
      id: m.id,
      centerId: m.centerId,
      centerName: m.center.name,
      centerSlug: m.center.slug,
      centerStatus: m.center.status,
      role: m.role,
    }));

    return apiSuccess({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        platformRole: user.platformRole,
        preferredLanguage: user.preferredLanguage,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
      },
      memberships: formattedMemberships,
      activeCenterId: activeMembership?.centerId || null,
      activeCenterRole: activeMembership?.role || null,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
