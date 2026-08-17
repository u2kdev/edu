import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { randomBytes } from "crypto";

// POST /api/auth/password-reset — Request a password reset
// PATCH /api/auth/password-reset — Confirm token and set new password

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email?.trim()) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.platformUser.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always return success to prevent email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({
        success: true,
        message: "If an account exists with this email, a reset link has been sent.",
      });
    }

    // Invalidate old tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() }, // mark as used/expired
    });

    // Generate a secure random token
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt,
      },
    });

    // In production: send email with reset link
    // For now: log to console (email service integration is a separate step)
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`;
    console.log(`📧 [Password Reset] User: ${user.email} | Reset URL: ${resetUrl}`);

    return NextResponse.json({
      success: true,
      message: "If an account exists with this email, a reset link has been sent.",
      // DEV ONLY: remove this in production
      ...(process.env.NODE_ENV === "development" ? { _devToken: token, _devUrl: resetUrl } : {}),
    });
  } catch (err: any) {
    console.error("Password reset request error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json({ error: "Token and new password are required" }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // Password strength: require at least one number or special character
    if (!/(?=.*[0-9!@#$%^&*])/.test(newPassword)) {
      return NextResponse.json({
        error: "Password must contain at least one number or special character",
      }, { status: 400 });
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token" }, { status: 400 });
    }

    if (!resetToken.user.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    const passwordHash = await hashPassword(newPassword);

    // Update password and mark token as used — in a transaction
    await db.$transaction([
      db.platformUser.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      db.auditLog.create({
        data: {
          actorUserId: resetToken.userId,
          action: "PASSWORD_RESET_COMPLETED",
          resource: "PlatformUser",
          resourceId: resetToken.userId,
          detailsJson: JSON.stringify({ email: resetToken.user.email }),
        },
      }),
    ]);

    return NextResponse.json({ success: true, message: "Password has been reset successfully." });
  } catch (err: any) {
    console.error("Password reset confirm error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
