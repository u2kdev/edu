import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { comparePassword, signJWT, JWTPayload, DUMMY_BCRYPT_HASH, signPending2faToken } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { checkRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { sendEmail, enqueueEmailOutbox } from '@/lib/email';
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { loginSchema } from "@/lib/validation/auth";
import { v4 as uuidv4 } from "uuid";
import { cookies } from "next/headers";

const ACCOUNT_GLOBAL_DELAY_THRESHOLD = 20;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const userAgent = req.headers.get("user-agent") || "unknown";

    if (!(await checkRateLimit(ip))) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = loginSchema.parse(body);
    const { password, rememberMe } = parsed;
    const rawLogin = (parsed.login || parsed.email || "").trim();
    const loginLower = rawLogin.toLowerCase();
    const normalizedPhone = normalizePhone(rawLogin);

    // Account-level rate limit across all IPs (mitigates distributed IP brute-force & credential stuffing)
    if (loginLower) {
      const accountKey = `account_login:${loginLower}`;
      if (!(await checkRateLimit(accountKey, 20, 15 * 60 * 1000))) {
        return new Response(
          JSON.stringify({ error: { message: "auth.rate_limited", code: "RATE_LIMITED" } }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": "900",
            },
          }
        );
      }
    }

    // Find user by email, phone, or username (excluding soft-deleted)
    const user = await db.platformUser.findFirst({
      where: {
        OR: [
          { email: loginLower },
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          { username: loginLower },
        ],
        deletedAt: null,
      },
    });

    const email = user ? user.email : loginLower;

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
        const delayMs = Math.min(Math.pow(2, newGlobal.attempts - ACCOUNT_GLOBAL_DELAY_THRESHOLD) * 1000, 15 * 60 * 1000); // 15 mins ceiling
        await db.loginAttempt.update({
          where: { email_ip: { email, ip: "GLOBAL" } },
          data: { lockoutUntil: new Date(Date.now() + delayMs) }
        });
        
        // Send email only when ceiling is reached (or on first hit)
        if (delayMs >= 15 * 60 * 1000 && newGlobal.attempts === ACCOUNT_GLOBAL_DELAY_THRESHOLD + 10) {
          try {
            await sendEmail(email, "Account Locked", "Your account is locked for 15 minutes due to multiple failed login attempts.");
          } catch (err: unknown) {
            await enqueueEmailOutbox({
              to: email,
              subject: "Account Locked",
              body: "Your account is locked for 15 minutes due to multiple failed login attempts.",
              lastError: err instanceof Error ? err.message : String(err),
              attempts: 1,
            }).catch(() => {});
          }
        }
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
      await comparePassword(password, DUMMY_BCRYPT_HASH);
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

    // 2FA TOTP check
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!parsed.twoFactorCode) {
        const twoFactorToken = signPending2faToken({
          id: user.id,
          email: user.email,
          platformRole: user.platformRole,
        });
        return apiSuccess({
          requiresTwoFactor: true,
          twoFactorToken,
          email: user.email,
          message: "auth.twoFactorRequired",
        });
      }

      const { decryptTwoFactorSecret } = await import("@/lib/two-factor-cipher");
      const { verifyTotpCodeWithStep, verifyBackupCode } = await import("@/lib/totp");
      const decryptedSecret = decryptTwoFactorSecret(user.twoFactorSecret);
      const totpResult = verifyTotpCodeWithStep(decryptedSecret, parsed.twoFactorCode, {
        lastStep: user.twoFactorLastStep,
      });
      const backupResult = verifyBackupCode(parsed.twoFactorCode, user.twoFactorBackupCodes);

      if (!totpResult.valid && !backupResult.valid) {
        return await handleFailure("invalid_2fa_code", user.id);
      }

      if (backupResult.valid && backupResult.remainingHashes) {
        await db.platformUser.update({
          where: { id: user.id },
          data: { twoFactorBackupCodes: JSON.stringify(backupResult.remainingHashes) },
        });
      } else if (totpResult.valid && totpResult.step !== undefined) {
        await db.platformUser.update({
          where: { id: user.id },
          data: { twoFactorLastStep: totpResult.step },
        });
      }
    }

    // Success -> Reset ALL attempts for this email and record lastLoginAt
    await Promise.all([
      db.loginAttempt.deleteMany({
        where: { email }
      }),
      db.platformUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      clearRateLimit(`account_login:${loginLower}`),
      ...(email !== loginLower ? [clearRateLimit(`account_login:${email.toLowerCase()}`)] : []),
    ]);

    const jti = uuidv4();
    const expiresIn = rememberMe ? "30d" : "1d";
    const expiresAt = new Date(Date.now() + (rememberMe ? 30 : 1) * 24 * 60 * 60 * 1000);

    const payload: JWTPayload & { jti: string } = {
      userId: user.id,
      email: user.email,
      platformRole: user.platformRole,
      jti,
    };

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

    try {
      cookies().set("auth_token", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: rememberMe ? 30 * 24 * 60 * 60 : 24 * 60 * 60,
      });
    } catch {
      // Outside request context (e.g. unit tests)
    }

    const { getPlatformSetting } = await import("@/lib/platform-settings");
    const require2faForStaff = await getPlatformSetting("security.require2faForStaff", false);
    const isStaff = ["SUPERADMIN", "DEVELOPER", "PLATFORM_ADMIN"].includes(user.platformRole);
    const requires2faSetup = Boolean(require2faForStaff && isStaff && !user.twoFactorEnabled);

    return apiSuccess({
      mustChangePassword: user.mustChangePassword,
      requires2faSetup,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        username: user.username,
        role: user.platformRole,
        mustChangePassword: user.mustChangePassword,
        requires2faSetup,
      }
    });
  } catch (error: unknown) {
    return handleApiError(error);
  }
}
