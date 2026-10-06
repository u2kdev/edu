import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { comparePassword, signJWT, JWTPayload } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/validation/auth";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

const ACCOUNT_GLOBAL_DELAY_THRESHOLD = 20;

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (!checkRateLimit(ip)) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = loginSchema.parse(body);
    const { email: rawEmail, password, rememberMe } = parsed;
    const email = rawEmail.toLowerCase().trim();

    // 1. Check LoginAttempt (Brute-force protection per IP & GLOBAL)
    const attempts = await db.loginAttempt.findMany({
      where: { email, ip: { in: [ip, "GLOBAL"] } }
    });

    const globalAttempt = attempts.find(a => a.ip === "GLOBAL");
    const ipAttempt = attempts.find(a => a.ip === ip);

    // Global threshold check
    if (globalAttempt && globalAttempt.lockoutUntil && new Date() < globalAttempt.lockoutUntil) {
      const waitMs = globalAttempt.lockoutUntil.getTime() - Date.now();
      return new Response(
        JSON.stringify({ error: { message: "auth.rate_limited", code: "RATE_LIMITED" } }),
        { 
          status: 429, 
          headers: { 
            "Content-Type": "application/json",
            "Retry-After": Math.ceil(waitMs / 1000).toString() 
          } 
        }
      );
    }

    // IP lockout check
    if (ipAttempt && ipAttempt.lockoutUntil && new Date() < ipAttempt.lockoutUntil) {
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    }

    const user = await db.platformUser.findUnique({
      where: { email },
    });

    const handleFailure = async (reason: string, actorUserId: string | null = null) => {
      // 1. IP Attempt Logic
      let ipAttemptsCount = (ipAttempt?.attempts || 0) + 1;
      let ipLockoutUntil: Date | null = null;
      const LOCKOUT_CONFIG = [
        { max: 15, delayMinutes: 60 },
        { max: 10, delayMinutes: 15 },
        { max: 5,  delayMinutes: 1  },
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

      // 2. Global Attempt Logic (Atomic Increment)
      const newGlobal = await db.loginAttempt.upsert({
        where: { email_ip: { email, ip: "GLOBAL" } },
        create: { email, ip: "GLOBAL", attempts: 1 },
        update: { attempts: { increment: 1 } },
      });

      if (newGlobal.attempts >= ACCOUNT_GLOBAL_DELAY_THRESHOLD) {
        // Exponential delay with ceiling of 5 seconds (5000ms)
        const delayMs = Math.min(Math.pow(2, newGlobal.attempts - ACCOUNT_GLOBAL_DELAY_THRESHOLD) * 100, 5000);
        await db.loginAttempt.update({
          where: { email_ip: { email, ip: "GLOBAL" } },
          data: { lockoutUntil: new Date(Date.now() + delayMs) }
        });
      }

      try {
        await db.auditLog.create({
          data: {
            actorUserId,
            action: "LOGIN_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ email, reason, ip, attempts: ipAttemptsCount, lockoutUntil: ipLockoutUntil }),
            ipAddress: ip,
          },
        });
      } catch (e) {}
      
      return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
    };

    if (!user || !user.isActive) {
      return handleFailure("user_not_found_or_inactive");
    }

    const isMatch = await comparePassword(password, user.passwordHash);

    if (!isMatch) {
      return handleFailure("invalid_password", user.id);
    }

    // Success -> Reset ALL attempts for this email
    await db.loginAttempt.deleteMany({
      where: { email }
    });

    const jti = uuidv4();
    const expiresIn = rememberMe ? "30d" : "1d";
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);

    const payload: JWTPayload & { jti: string } = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      jti,
    } as any;

    const token = signJWT(payload, expiresIn);

    const { hashJti } = await import("@/lib/auth");
    
    // Create session in DB
    await db.userSession.create({
      data: {
        userId: user.id,
        jtiHash: hashJti(jti),
        expiresAt,
        ipAddress: ip,
        userAgent,
      }
    });

    try {
      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "LOGIN_SUCCESS",
          resource: "PlatformUser",
          resourceId: user.id,
          ipAddress: ip,
        },
      });
    } catch (e) {}

    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
    });

    return apiSuccess({
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.platformRole,
      }
    });
  } catch (error: any) {
    return handleApiError(error);
  }
}
