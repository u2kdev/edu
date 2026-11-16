// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import {
  signJWT,
  hashJti,
  hashToken,
  generateRefreshToken,
  JWTPayload,
  verifyPending2faToken,
} from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { decryptTwoFactorSecret } from "@/lib/two-factor-cipher";
import { verifyTotpCodeWithStep, verifyBackupCode } from "@/lib/totp";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";
import { z } from "zod";

const verify2faLoginSchema = z.object({
  twoFactorToken: z.string().min(10, "2FA token is required"),
  code: z.string().min(6).max(10),
  rememberMe: z.boolean().optional().default(false),
  deviceName: z.string().optional(),
  deviceId: z.string().optional(),
  platform: z.enum(["ios", "android", "web"]).optional(),
});

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (!(await checkRateLimit(ip + "_2fa_verify", 15, 60000))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json().catch(() => ({}));
    const parsed = verify2faLoginSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("Invalid input: code and token are required", "BAD_REQUEST", 400);
    }

    const { twoFactorToken, code, rememberMe, deviceName, deviceId, platform } = parsed.data;

    // 1. Verify pending 2FA token
    const pending = verifyPending2faToken(twoFactorToken);
    if (!pending) {
      return apiError("Invalid or expired 2FA token", "INVALID_TOKEN", 401);
    }

    // 2. Load user with active memberships
    const user = await db.platformUser.findUnique({
      where: { id: pending.userId },
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
    });

    if (!user || !user.isActive || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return apiError("2FA not configured or account inactive", "UNAUTHORIZED", 401);
    }

    const email = user.email;

    // 3. Brute force & lockout protection on 2FA code attempts
    const attempts = await db.loginAttempt.findMany({
      where: { email, ip: { in: [ip, "GLOBAL_2FA"] } },
    });
    const ipAttempt = attempts.find((a) => a.ip === ip);
    const globalAttempt = attempts.find((a) => a.ip === "GLOBAL_2FA");

    if (globalAttempt?.lockoutUntil && new Date() < globalAttempt.lockoutUntil) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }
    if (ipAttempt?.lockoutUntil && new Date() < ipAttempt.lockoutUntil) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }

    const handle2faFailure = async (reason: string) => {
      const ipAttemptsCount = (ipAttempt?.attempts || 0) + 1;
      let ipLockoutUntil: Date | null = null;
      if (ipAttemptsCount >= 5) {
        ipLockoutUntil = new Date(Date.now() + 15 * 60000); // 15 min lockout after 5 fails
      }

      await db.loginAttempt.upsert({
        where: { email_ip: { email, ip } },
        create: { email, ip, attempts: ipAttemptsCount, lockoutUntil: ipLockoutUntil },
        update: { attempts: ipAttemptsCount, lockoutUntil: ipLockoutUntil },
      });

      await db.loginAttempt.upsert({
        where: { email_ip: { email, ip: "GLOBAL_2FA" } },
        create: { email, ip: "GLOBAL_2FA", attempts: 1 },
        update: { attempts: { increment: 1 } },
      });

      try {
        await db.auditLog.create({
          data: {
            actorUserId: user.id,
            action: "2FA_VERIFY_FAILED",
            resource: "PlatformUser",
            resourceId: user.id,
            detailsJson: JSON.stringify({ reason, ip, deviceName, platform }),
            ipAddress: ip,
          },
        });
      } catch {}

      return apiError("auth.invalid2faCode", "UNAUTHORIZED", 401);
    };

    // 4. Verify code (TOTP or backup code)
    const decryptedSecret = decryptTwoFactorSecret(user.twoFactorSecret);
    const totpResult = verifyTotpCodeWithStep(decryptedSecret, code, {
      lastStep: user.twoFactorLastStep,
    });
    const backupResult = verifyBackupCode(code, user.twoFactorBackupCodes);

    if (!totpResult.valid && !backupResult.valid) {
      return await handle2faFailure("invalid_code");
    }

    // 5. Atomic state update: consume backup code or record TOTP step
    if (backupResult.valid && backupResult.remainingHashes) {
      await db.platformUser.update({
        where: { id: user.id },
        data: {
          twoFactorBackupCodes: JSON.stringify(backupResult.remainingHashes),
          lastLoginAt: new Date(),
        },
      });
    } else if (totpResult.valid && totpResult.step !== undefined) {
      await db.platformUser.update({
        where: { id: user.id },
        data: {
          twoFactorLastStep: totpResult.step,
          lastLoginAt: new Date(),
        },
      });
    }

    // Clear failed login attempts
    await db.loginAttempt.deleteMany({
      where: { email },
    });

    // 6. Generate active session
    const jti = uuidv4();
    const expiresIn = rememberMe ? "30d" : "15m";
    const refreshToken = generateRefreshToken();
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);

    const activeMembership = user.memberships[0] || null;

    const payload: JWTPayload & { jti: string } = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      activeCenterId: activeMembership?.centerId,
      activeCenterRole: activeMembership?.role,
      jti,
    };

    const token = signJWT(payload, expiresIn);
    const finalUserAgent = deviceName ? `${deviceName} (${platform || "client"}) - ${userAgent}` : userAgent;

    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash: hashJti(jti),
        refreshTokenHash: hashToken(refreshToken),
        deviceId: deviceId || null,
        expiresAt,
        ipAddress: ip,
        userAgent: finalUserAgent,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "2FA_VERIFY_SUCCESS",
          resource: "PlatformUser",
          resourceId: user.id,
          detailsJson: JSON.stringify({
            method: backupResult.valid ? "BACKUP_CODE" : "TOTP",
            deviceName,
            platform,
          }),
          ipAddress: ip,
        },
      });
    } catch {}

    try {
      cookies().set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
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
      token,
      refreshToken,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        platformRole: user.platformRole,
        preferredLanguage: user.preferredLanguage,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        mustChangePassword: user.mustChangePassword,
      },
      memberships: formattedMemberships,
      activeCenterId: activeMembership?.centerId || null,
      activeCenterRole: activeMembership?.role || null,
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
