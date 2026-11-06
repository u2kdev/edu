// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { comparePassword, signJWT, hashJti, JWTPayload } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { mobileLoginSchema } from "@/lib/validation/auth";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "mobile-app";

    if (!(await checkRateLimit(ip))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = mobileLoginSchema.parse(body);
    const { email: rawEmail, password, deviceName, platform } = parsed;
    const email = rawEmail.toLowerCase().trim();

    // 1. Check LoginAttempt (Brute-force protection)
    const attempts = await db.loginAttempt.findMany({
      where: { email, ip: { in: [ip, "GLOBAL"] } },
    });

    const globalAttempt = attempts.find((a) => a.ip === "GLOBAL");
    const ipAttempt = attempts.find((a) => a.ip === ip);

    // Global threshold check
    if (globalAttempt && globalAttempt.lockoutUntil && new Date() < globalAttempt.lockoutUntil) {
      const waitMs = globalAttempt.lockoutUntil.getTime() - Date.now();
      return new Response(
        JSON.stringify({ error: { message: "auth.rate_limited", code: "RATE_LIMITED" } }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(waitMs / 1000).toString(),
          },
        }
      );
    }

    // IP lockout check
    if (ipAttempt && ipAttempt.lockoutUntil && new Date() < ipAttempt.lockoutUntil) {
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    }

    const user = await db.platformUser.findUnique({
      where: { email },
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

    const handleFailure = async (reason: string, actorUserId: string | null = null) => {
      const ipAttemptsCount = (ipAttempt?.attempts || 0) + 1;
      let ipLockoutUntil: Date | null = null;
      const LOCKOUT_CONFIG = [
        { max: 15, delayMinutes: 60 },
        { max: 10, delayMinutes: 15 },
        { max: 5, delayMinutes: 1 },
      ];
      for (const config of LOCKOUT_CONFIG) {
        if (ipAttemptsCount >= config.max) {
          ipLockoutUntil = new Date(Date.now() + config.delayMinutes * 60000);
          break;
        }
      }

      await db.loginAttempt.upsert({
        where: { email_ip: { email, ip } },
        create: { email, ip, attempts: ipAttemptsCount, lockoutUntil: ipLockoutUntil },
        update: { attempts: ipAttemptsCount, lockoutUntil: ipLockoutUntil },
      });

      await db.loginAttempt.upsert({
        where: { email_ip: { email, ip: "GLOBAL" } },
        create: { email, ip: "GLOBAL", attempts: 1 },
        update: { attempts: { increment: 1 } },
      });

      try {
        await db.auditLog.create({
          data: {
            actorUserId,
            action: "MOBILE_LOGIN_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ email, reason, ip, deviceName, platform }),
            ipAddress: ip,
          },
        });
      } catch {}

      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    };

    if (!user || !user.isActive) {
      return await handleFailure("user_not_found_or_inactive");
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      return await handleFailure("invalid_password", user.id);
    }

    const isPlatformRole = user.platformRole && user.platformRole !== "NONE";
    if (!user.emailVerified && !isPlatformRole) {
      return apiError(
        "Email verification required. Please check your inbox or request a new confirmation email.",
        "EMAIL_NOT_VERIFIED",
        403,
        { email: user.email }
      );
    }

    // Reset attempts upon success
    await db.loginAttempt.deleteMany({
      where: { email },
    });

    const jti = uuidv4();
    const expiresIn = "30d";
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

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

    const finalUserAgent = deviceName ? `${deviceName} (${platform || "mobile"}) - ${userAgent}` : userAgent;
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash: hashJti(jti),
        expiresAt,
        ipAddress: ip,
        userAgent: finalUserAgent,
      },
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "MOBILE_LOGIN_SUCCESS",
          resource: "PlatformUser",
          resourceId: user.id,
          detailsJson: JSON.stringify({ deviceName, platform }),
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
        maxAge: 30 * 24 * 60 * 60,
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
