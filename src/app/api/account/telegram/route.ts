import { NextResponse } from "next/server";
// Reason: Exception: Telegram linking is per-PlatformUser across centers and works from Web & Mobile JWT sessions.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { createTelegramLinkToken, unlinkTelegramAccount } from "@/lib/telegram";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    const account = await db.telegramAccount.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        username: true,
        firstName: true,
        languageCode: true,
        isActive: true,
        isBlocked: true,
        linkedAt: true,
        lastInboundAt: true,
      },
    });

    return NextResponse.json(
      {
        linked: Boolean(account && account.isActive),
        account: account
          ? {
              username: account.username,
              firstName: account.firstName,
              languageCode: account.languageCode,
              isActive: account.isActive,
              isBlocked: account.isBlocked,
              linkedAt: account.linkedAt.toISOString(),
              lastInboundAt: account.lastInboundAt ? account.lastInboundAt.toISOString() : null,
            }
          : null,
        botUsername: process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err) {
    console.error("[GET /api/account/telegram]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    if (
      session.user.platformRole === "PLATFORM_SUPPORT" ||
      Boolean(session.impersonatorUserId) ||
      session.allowWrite === false
    ) {
      return NextResponse.json(
        { error: "Forbidden: Platform support has read-only access" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`tg_link:${session.user.id}:${ip}`, 10, 10 * 60 * 1000);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many link requests. Please try again in a few minutes." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    const generated = await createTelegramLinkToken(session.user.id);
    return NextResponse.json(generated, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[POST /api/account/telegram]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: NO_STORE_HEADERS });
    }

    if (
      session.user.platformRole === "PLATFORM_SUPPORT" ||
      Boolean(session.impersonatorUserId) ||
      session.allowWrite === false
    ) {
      return NextResponse.json(
        { error: "Forbidden: Platform support has read-only access" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const res = await unlinkTelegramAccount({ userId: session.user.id });
    return NextResponse.json({ success: true, ...res }, { headers: NO_STORE_HEADERS });
  } catch (err) {
    console.error("[DELETE /api/account/telegram]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
