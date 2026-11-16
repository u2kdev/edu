import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, comparePassword, hashPassword } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { passwordChangeSchema } from "@/lib/validation/auth";
import { validatePasswordPolicy } from "@/lib/password-policy";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    if (!(await checkRateLimit(ip + "_change_pwd"))) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }

    const session = await getAuthSession(req);
    if (!session) {
      return apiError("Unauthorized", "UNAUTHORIZED", 401);
    }

    if (!session.user.emailVerified) {
      return apiError("Email confirmation required for sensitive actions", "FORBIDDEN", 403);
    }

    const body = await req.json();
    const parsed = passwordChangeSchema.parse(body);
    const { currentPassword, newPassword } = parsed;

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
    });

    if (!user || !user.isActive) {
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    }

    // 1. Enforce unified password policy with user context
    const policyResult = validatePasswordPolicy(newPassword, {
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      username: user.username,
    });
    if (!policyResult.valid) {
      return apiError(policyResult.message || "auth.password.weak", "BAD_REQUEST", 400);
    }

    // 2. Validate current password
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

    // 3. Forbid reusing current password
    const isSame = await comparePassword(newPassword, user.passwordHash);
    if (isSame) {
      return apiError("auth.password.cannot_reuse_current", "BAD_REQUEST", 400);
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.$transaction(async (tx) => {
      // Update password and clear mustChangePassword flag
      await tx.platformUser.update({
        where: { id: session.user.id },
        data: {
          passwordHash: hashedPassword,
          mustChangePassword: false,
        },
      });

      // Revoke other sessions (keep current session active if sessionId is present)
      if (session.sessionId) {
        await tx.userSession.updateMany({
          where: { userId: session.user.id, id: { not: session.sessionId }, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      } else {
        await tx.userSession.updateMany({
          where: { userId: session.user.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }

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
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
