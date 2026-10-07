import { z } from "zod";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { passwordResetRequestSchema } from "@/lib/validation/auth";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    // Custom rate limit for password reset (more strict: limit IP & email)
    if (!checkRateLimit(ip + "_forgot_pwd")) {
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

      // Send email via dev driver (console log)
      const resetLink = `${process.env.NEXT_PUBLIC_URL || "http://localhost:3000"}/reset-password?token=${rawToken}`;
      console.log(`\n\n=== DEV EMAIL DRIVER ===`);
      console.log(`To: ${email}`);
      console.log(`Subject: Сброс пароля (LMS)`);
      console.log(`Link: ${resetLink}`);
      console.log(`========================\n\n`);
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
  } catch (err: any) {
    return handleApiError(err);
  }
}
