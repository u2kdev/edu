import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { logAuditEvent } from "@/lib/tenant";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for") || "unknown";
    
    // Rate limit specifically for email confirmation attempts
    if (!checkRateLimit(ip + "_confirm_email", 10, 15 * 60 * 1000)) {
      return apiError("Too many attempts", "RATE_LIMITED", 429);
    }

    const { token } = await req.json();

    if (!token || typeof token !== "string") {
      return apiError("Token is required", "BAD_REQUEST", 400);
    }

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await db.platformUser.findUnique({
      where: { emailConfirmToken: tokenHash },
    });

    if (!user) {
      return apiError("Invalid or expired token", "INVALID_TOKEN", 400);
    }

    if (user.emailConfirmExpires && user.emailConfirmExpires < new Date()) {
      return apiError("Invalid or expired token", "INVALID_TOKEN", 400);
    }

    await db.platformUser.update({
      where: { id: user.id },
      data: {
        emailVerified: new Date(),
        emailConfirmToken: null,
        emailConfirmExpires: null,
      },
    });

    await logAuditEvent({
      centerId: "PLATFORM",
      actorUserId: user.id,
      action: "EMAIL_CONFIRMED",
      resource: "PlatformUser",
      resourceId: user.id,
      ipAddress: ip,
    });

    return apiSuccess({ success: true });
  } catch (err: any) {
    return handleApiError(err);
  }
}
