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

const ACCOUNT_GLOBAL_DELAY_THRESHOLD = 20; // 20 failed attempts globally across all IPs

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

    // 1. Global account delay check
    const globalAttempts = await db.loginAttempt.aggregate({
      where: { email },
      _sum: { attempts: true }
    });
    const totalAttempts = globalAttempts._sum.attempts || 0;
    if (totalAttempts >= ACCOUNT_GLOBAL_DELAY_THRESHOLD) {
      // Exponential delay with ceiling of 5 seconds
      const delay = Math.min(Math.pow(2, totalAttempts - ACCOUNT_GLOBAL_DELAY_THRESHOLD) * 100, 5000);
      await new Promise(r => setTimeout(r, delay));
    }

    // 2. Check LoginAttempt (Brute-force protection per IP)
    let loginAttempt = await db.loginAttempt.findUnique({
      where: { email_ip: { email, ip } }
    });

    if (loginAttempt && loginAttempt.lockoutUntil) {
      if (new Date() < loginAttempt.lockoutUntil) {
        return apiError("auth.invalidCredentials", "UNAUTHORIZED", 401);
      }
    }

    const user = await db.platformUser.findUnique({
      where: { email },
    });

    const handleFailure = async (reason: string, actorUserId: string | null = null) => {
      let attempts = (loginAttempt?.attempts || 0) + 1;
      let lockoutUntil: Date | null = null;

      // Exponential lockout: starts from 5, caps at max (e.g. 15 -> max ceiling or just let it grow)
      // "Замени setTimeout(2000) на задержку, растущую со счётчиком (экспоненциально, потолок в конфиге)" -> wait, the IP lockout is growing delay?
      // No, IP lockout is full block. Account global delay is the one that grows exponentially and blocks with setTimeout.
      // "задержку, растущую со счётчиком (экспоненциально, потолок в конфиге), без удержания процесса сном дольше потолка" -> this means global account lockout.
      // Let's implement IP lockout progression:
      const LOCKOUT_CONFIG = [
        { max: 15, delayMinutes: 60 },
        { max: 10, delayMinutes: 15 },
        { max: 5,  delayMinutes: 1  },
      ];

      for (const config of LOCKOUT_CONFIG) {
        // Only trigger a new lockout if exactly hitting a threshold or above it and previous expired
        if (attempts >= config.max) {
          lockoutUntil = new Date(Date.now() + config.delayMinutes * 60000);
          break;
        }
      }

      await db.loginAttempt.upsert({
        where: { email_ip: { email, ip } },
        create: { email, ip, attempts, lockoutUntil },
        update: { attempts, lockoutUntil },
      });

      try {
        await db.auditLog.create({
          data: {
            actorUserId,
            action: "LOGIN_FAILED",
            resource: "PlatformUser",
            detailsJson: JSON.stringify({ email, reason, ip, attempts, lockoutUntil }),
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
