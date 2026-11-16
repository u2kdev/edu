import { NextResponse } from "next/server";
import type { Update } from "grammy/types";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rate-limit";
import { processTelegramUpdate, timingSafeSecretEqual } from "@/lib/telegram";

export async function POST(req: Request) {
  try {
    const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || "";
    const providedSecret = req.headers.get("x-telegram-bot-api-secret-token");

    if (!expectedSecret || !timingSafeSecretEqual(providedSecret, expectedSecret)) {
      return NextResponse.json({ error: "Unauthorized webhook secret" }, { status: 401 });
    }

    const ip = getClientIp(req);
    const allowedIp = await checkRateLimit(`tg_webhook_ip:${ip}`, 120, 60_000);
    if (!allowedIp) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    let update: Update;
    try {
      update = (await req.json()) as Update;
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!update || typeof update !== "object" || typeof update.update_id !== "number") {
      return NextResponse.json({ error: "Invalid Telegram update payload" }, { status: 400 });
    }

    const chatId =
      update.message?.chat?.id ??
      update.edited_message?.chat?.id ??
      update.callback_query?.message?.chat?.id;
    if (chatId !== undefined) {
      const allowedChat = await checkRateLimit(`tg_webhook_chat:${String(chatId)}`, 30, 60_000);
      if (!allowedChat) {
        return NextResponse.json({ error: "Rate limit exceeded for chat" }, { status: 429 });
      }
    }

    await processTelegramUpdate(update);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[POST /api/webhooks/telegram]", err instanceof Error ? err.message : "error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
