import { NextResponse } from "next/server";
import { getAuthSession, comparePassword } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateTotpSecret,
  generateTotpUri,
  verifyTotpCode,
  generateBackupCodes,
} from "@/lib/totp";
import { z } from "zod";

const verify2faSchema = z.object({
  secret: z.string().min(16),
  code: z.string().length(6),
});

const disable2faSchema = z.object({
  password: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    if (action === "setup") {
      if (user.twoFactorEnabled) {
        return NextResponse.json({
          enabled: true,
          message: "2FA is already enabled on this account",
        });
      }

      const secret = generateTotpSecret(20);
      const uri = generateTotpUri(user.email, secret, "e-darschi");

      return NextResponse.json({
        enabled: false,
        secret,
        uri,
      });
    }

    return NextResponse.json({
      enabled: Boolean(user.twoFactorEnabled),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = verify2faSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { secret, code } = parsed.data;

    const isValid = verifyTotpCode(secret, code);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid TOTP verification code" },
        { status: 400 }
      );
    }

    const backupCodes = generateBackupCodes(8);

    await db.platformUser.update({
      where: { id: session.user.id },
      data: {
        twoFactorEnabled: true,
        twoFactorSecret: secret,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "2FA_ENABLED",
        resource: "PlatformUser",
        resourceId: session.user.id,
        detailsJson: JSON.stringify({ method: "TOTP" }),
      },
    });

    return NextResponse.json({
      success: true,
      enabled: true,
      backupCodes,
      message: "Two-factor authentication successfully enabled",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = disable2faSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Password is required to disable 2FA" },
        { status: 400 }
      );
    }

    const user = await db.platformUser.findUnique({
      where: { id: session.user.id },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isMatch = await comparePassword(parsed.data.password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ error: "Invalid password" }, { status: 403 });
    }

    await db.platformUser.update({
      where: { id: user.id },
      data: {
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
    });

    await db.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "2FA_DISABLED",
        resource: "PlatformUser",
        resourceId: user.id,
        detailsJson: JSON.stringify({ reason: "User requested" }),
      },
    });

    return NextResponse.json({
      success: true,
      enabled: false,
      message: "Two-factor authentication disabled",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
