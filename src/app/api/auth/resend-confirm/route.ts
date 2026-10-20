import { NextResponse } from "next/server";
// Reason: Exception: Auth routes operate on platform models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/ip";
import { apiError, apiSuccess, handleApiError } from "@/lib/api-response";
import { renderEmailTemplate, sendEmailWithOutbox } from "@/lib/email";
import { toEmailLang } from "@/lib/language";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    
    // Strict rate limit for resending emails
    if (!(await checkRateLimit(ip + "_resend_email", 3, 60 * 60 * 1000))) {
      return apiError("Too many attempts. Please try again later.", "RATE_LIMITED", 429);
    }

    const { email } = await req.json();

    if (!email || typeof email !== "string") {
      return apiError("Email is required", "BAD_REQUEST", 400);
    }

    const user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // We do NOT reveal if the email exists. We always return success.
    if (!user || !user.isActive || user.emailVerified) {
      return apiSuccess({ success: true, message: "If an unverified account exists, a confirmation link has been sent." });
    }

    const confirmToken = crypto.randomBytes(32).toString("hex");
    const confirmTokenHash = crypto.createHash("sha256").update(confirmToken).digest("hex");
    const confirmExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await db.platformUser.update({
      where: { id: user.id },
      data: {
        emailConfirmToken: confirmTokenHash,
        emailConfirmExpires: confirmExpires,
      },
    });

    // Deliver the confirmation link through the real email transport (with outbox fallback).
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
    const confirmLink = `${appUrl}/confirm-email?token=${confirmToken}`;
    const emailLang = toEmailLang(user.preferredLanguage);
    const emailContent = renderEmailTemplate("EMAIL_CONFIRMATION", {
      lang: emailLang,
      fullName: user.fullName,
      url: confirmLink,
    });
    await sendEmailWithOutbox(
      user.email,
      emailContent.subject,
      emailContent.text,
      emailContent.html
    ).catch((sendErr: unknown) => {
      console.error("Failed to send confirmation email:", sendErr);
    });

    return apiSuccess({ success: true, message: "If an unverified account exists, a confirmation link has been sent." });
  } catch (err: unknown) {
    return handleApiError(err);
  }
}
