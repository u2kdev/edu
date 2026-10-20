import crypto from "crypto";
import { db } from "./db";
import { renderEmailTemplate, sendEmailWithOutbox } from "./email";
import { toEmailLang } from "./language";

export interface PasswordSetupDelivery {
  resetUrl: string;
  queued: boolean;
}

/**
 * Issues a single-use password reset token for a user and emails them a link to
 * set their own password.
 *
 * Used when a centre administrator creates a staff member or student: those
 * accounts are created with a random, undelivered password hash, so without this
 * the user cannot sign in. Any previously issued unused tokens are invalidated.
 *
 * Never throws on delivery failure — the caller decides how to react.
 */
export async function sendPasswordSetupLink(options: {
  userId: string;
  email: string;
  fullName?: string | null;
  lang?: string | null;
}): Promise<PasswordSetupDelivery> {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  await db.passwordResetToken.updateMany({
    where: { userId: options.userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  await db.passwordResetToken.create({
    data: { userId: options.userId, tokenHash, expiresAt },
  });

  const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  const lang = toEmailLang(options.lang);

  const content = renderEmailTemplate("PASSWORD_RESET", {
    lang,
    fullName: options.fullName ?? undefined,
    url: resetUrl,
  });

  const result = await sendEmailWithOutbox(
    options.email,
    content.subject,
    content.text,
    content.html
  );

  return { resetUrl, queued: result.queued };
}
