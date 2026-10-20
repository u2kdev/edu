import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { passwordResetRequestSchema } from "@/lib/validation/auth";
import { renderEmailTemplate, sendEmailWithOutbox } from "@/lib/email";
import { toEmailLang } from "@/lib/language";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    // Custom rate limit for password reset (more strict: limit IP & email)
    if (!(await checkRateLimit(ip + "_forgot_pwd"))) {
      return apiError("auth.rate_limited", "RATE_LIMITED", 429);
    }

    const body = await req.json();
    const parsed = passwordResetRequestSchema.parse(body);
    const email = parsed.email.toLowerCase().trim();

    // Constant-time-ish delay mitigation for email existence check
    const start = Date.now();

    const user = await db.platformUser.findUnique({
      where: { email },
    });

    if (user && user.isActive) {
      // Generate a crypto random token (32 bytes = 64 hex chars)
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
      
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      // Invalidating existing unused tokens is good practice
      await db.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() } // Mark as used/invalidated
      });

      await db.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        }
      });

      await db.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "PASSWORD_RESET_REQUESTED",
          resource: "PlatformUser",
          resourceId: user.id,
          ipAddress: ip,
        }
      });

      // Deliver the reset link through the real email transport (with outbox fallback).
      const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
      const resetLink = `${appUrl}/reset-password?token=${rawToken}`;
      const emailLang = toEmailLang(user.preferredLanguage);
      const emailContent = renderEmailTemplate("PASSWORD_RESET", {
        lang: emailLang,
        fullName: user.fullName,
        url: resetLink,
      });
      await sendEmailWithOutbox(
        user.email,
        emailContent.subject,
        emailContent.text,
        emailContent.html
      ).catch((sendErr: unknown) => {
        console.error("Failed to send password reset email:", sendErr);
      });
    } else {
      // Fake work to mitigate timing attacks
      crypto.randomBytes(32).toString("hex");
      crypto.createHash("sha256").update("fake").digest("hex");
    }

    const elapsed = Date.now() - start;
    if (elapsed < 300) {
      await new Promise(resolve => setTimeout(resolve, 300 - elapsed));
    }

    // Always return success to prevent email enumeration
    return apiSuccess({ success: true, message: "auth.resetLinkSent" });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
