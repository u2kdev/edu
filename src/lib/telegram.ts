import crypto from "crypto";
import { Bot, GrammyError, type Context } from "grammy";
import type { InlineKeyboardMarkup, Update, UserFromGetMe } from "grammy/types";
import type { NotificationType } from "@prisma/client";
import QRCode from "qrcode";
// Reason: Exception: Telegram bot links global PlatformUser accounts and resolves user-scoped center data.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { formatTashkentYMD, toTashkentParts } from "@/lib/billing";
import { calculateStudentBalances } from "@/lib/student-balance";
import { createClickPaymentIntent } from "@/lib/click";
import { getCenterPlanFeatures } from "@/lib/plan-features";

export const TELEGRAM_LINK_TTL_MINUTES = 15;

export interface TelegramSendPayload {
  chatId: string;
  text: string;
  actionUrl?: string;
  ctaLabel?: string;
  parseMode?: "Markdown" | "HTML";
}

export interface TelegramSendResult {
  sent: boolean;
  messageId?: string;
  maskedChatId?: string;
  reason?: string;
  error?: string;
}

export type TelegramTransportFn = (params: {
  chatId: string;
  text: string;
  replyMarkup?: InlineKeyboardMarkup;
  parseMode?: "Markdown" | "HTML";
}) => Promise<{ messageId?: string }>;

export function hashTelegramToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

export function maskTelegramChatId(chatId: string): string {
  const s = String(chatId);
  if (s.length <= 4) return "tg:****";
  return `tg:${s.slice(0, 2)}***${s.slice(-2)}`;
}

export function timingSafeSecretEqual(provided: string | null | undefined, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Compare equal-sized hashes so comparison duration stays constant-time
    const ha = crypto.createHash("sha256").update(a).digest();
    const hb = crypto.createHash("sha256").update(b).digest();
    return crypto.timingSafeEqual(ha, hb) && false;
  }
  return crypto.timingSafeEqual(a, b);
}

function getLang(userLang?: string | null, tgLangCode?: string | null): "ru" | "uz" {
  if (userLang === "uz_Latn" || userLang === "uz-Latn" || userLang === "uz_Cyrl" || userLang === "uz-Cyrl") {
    return "uz";
  }
  if (userLang === "ru") return "ru";
  if (tgLangCode && tgLangCode.toLowerCase().startsWith("uz")) return "uz";
  return "ru";
}

function formatMoneyUzs(amount: number): string {
  return `${Math.round(amount).toLocaleString("ru-RU").replace(/\u00a0/g, " ")} UZS`;
}

function getCachedBotInfo(): UserFromGetMe {
  const username = (process.env.TELEGRAM_BOT_USERNAME || "e_darschi_bot").replace(/^@/, "");
  return {
    id: 0,
    is_bot: true,
    first_name: "e-darschi",
    username,
    can_join_groups: false,
    can_read_all_group_messages: false,
    supports_inline_queries: false,
    can_connect_to_business: false,
    has_main_web_app: false,
  } as UserFromGetMe;
}

function buildApiBot(): Bot | null {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) return null;
  return new Bot(token, { botInfo: getCachedBotInfo() });
}

function buildInlineKeyboard(actionUrl?: string, ctaLabel?: string): InlineKeyboardMarkup | undefined {
  if (!actionUrl || !actionUrl.startsWith("https://")) return undefined;
  return {
    inline_keyboard: [[{ text: ctaLabel || "Оплатить через Click", url: actionUrl }]],
  };
}

function isTelegramBlockedError(err: unknown): boolean {
  if (err instanceof GrammyError && err.error_code === 403) return true;
  if (typeof err === "object" && err !== null && "error_code" in err && (err as { error_code?: unknown }).error_code === 403) {
    return true;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return msg.toLowerCase().includes("bot was blocked by the user") || msg.toLowerCase().includes("403");
}

/**
 * Generates a single-use 15-minute SHA-256-hashed link token + deep-link + QR code.
 */
export async function createTelegramLinkToken(
  userId: string,
  options?: { now?: Date }
): Promise<{
  token: string;
  expiresAt: string;
  botUsername: string | null;
  deepLink: string | null;
  qrDataUrl: string | null;
}> {
  const now = options?.now ?? new Date();
  const expiresAt = new Date(now.getTime() + TELEGRAM_LINK_TTL_MINUTES * 60 * 1000);
  const rawToken = crypto.randomBytes(24).toString("base64url");
  const tokenHash = hashTelegramToken(rawToken);

  await db.telegramLinkToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const rawUsername = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || null;
  const deepLink = rawUsername ? `https://t.me/${rawUsername}?start=${rawToken}` : null;
  const qrDataUrl = deepLink ? await QRCode.toDataURL(deepLink, { width: 220, margin: 1 }) : null;

  return {
    token: rawToken,
    expiresAt: expiresAt.toISOString(),
    botUsername: rawUsername,
    deepLink,
    qrDataUrl,
  };
}

/**
 * Atomically claims a single-use Telegram link token and binds telegramId + chatId to 1 PlatformUser.
 */
export async function consumeTelegramLinkToken(params: {
  rawToken: string;
  telegramId: string;
  chatId: string;
  username?: string | null;
  firstName?: string | null;
  languageCode?: string | null;
  now?: Date;
}): Promise<
  | { ok: true; userId: string; fullName: string; lang: "ru" | "uz" }
  | {
      ok: false;
      reason:
        | "TOKEN_INVALID_OR_EXPIRED"
        | "USER_INACTIVE"
        | "CHAT_ALREADY_LINKED_TO_OTHER_USER";
    }
> {
  const now = params.now ?? new Date();
  const tokenHash = hashTelegramToken(params.rawToken.trim());

  return db.$transaction(async (tx) => {
    const tokenRow = await tx.telegramLinkToken.findUnique({
      where: { tokenHash },
      select: {
        id: true,
        userId: true,
        usedAt: true,
        expiresAt: true,
      },
    });

    if (!tokenRow || tokenRow.usedAt || tokenRow.expiresAt <= now) {
      return { ok: false as const, reason: "TOKEN_INVALID_OR_EXPIRED" as const };
    }

    const user = await tx.platformUser.findUnique({
      where: { id: tokenRow.userId },
      select: { id: true, fullName: true, isActive: true, deletedAt: true, preferredLanguage: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      return { ok: false as const, reason: "USER_INACTIVE" as const };
    }

    const colliding = await tx.telegramAccount.findFirst({
      where: {
        OR: [{ telegramId: params.telegramId }, { chatId: params.chatId }],
        userId: { not: tokenRow.userId },
        isActive: true,
      },
      select: { id: true },
    });

    if (colliding) {
      return {
        ok: false as const,
        reason: "CHAT_ALREADY_LINKED_TO_OTHER_USER" as const,
      };
    }

    // Atomic single-use claim prevents two parallel requests consuming the same token
    const claimed = await tx.telegramLinkToken.updateMany({
      where: {
        id: tokenRow.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (claimed.count !== 1) {
      return { ok: false as const, reason: "TOKEN_INVALID_OR_EXPIRED" as const };
    }

    // If an old inactive record exists for this telegramId/chatId under another user, remove it cleanly
    await tx.telegramAccount.deleteMany({
      where: {
        OR: [{ telegramId: params.telegramId }, { chatId: params.chatId }],
        userId: { not: tokenRow.userId },
      },
    });

    await tx.telegramAccount.upsert({
      where: { userId: tokenRow.userId },
      create: {
        userId: tokenRow.userId,
        telegramId: params.telegramId,
        chatId: params.chatId,
        username: params.username ?? null,
        firstName: params.firstName ?? null,
        languageCode: params.languageCode ?? null,
        isActive: true,
        isBlocked: false,
        linkedAt: now,
        lastInboundAt: now,
      },
      update: {
        telegramId: params.telegramId,
        chatId: params.chatId,
        username: params.username ?? null,
        firstName: params.firstName ?? null,
        languageCode: params.languageCode ?? null,
        isActive: true,
        isBlocked: false,
        linkedAt: now,
        lastInboundAt: now,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: tokenRow.userId,
        action: "TELEGRAM_ACCOUNT_LINKED",
        resource: "TelegramAccount",
        resourceId: tokenRow.userId,
        detailsJson: JSON.stringify({
          maskedChatId: maskTelegramChatId(params.chatId),
        }),
      },
    });

    return {
      ok: true as const,
      userId: user.id,
      fullName: user.fullName,
      lang: getLang(user.preferredLanguage, params.languageCode),
    };
  });
}

export async function unlinkTelegramAccount(params: {
  userId?: string;
  chatId?: string;
}): Promise<{ unlinked: boolean }> {
  const where = params.userId
    ? { userId: params.userId }
    : params.chatId
      ? { chatId: params.chatId }
      : null;
  if (!where) return { unlinked: false };

  const existing = await db.telegramAccount.findFirst({ where });
  if (!existing) return { unlinked: false };

  await db.telegramAccount.delete({ where: { id: existing.id } });
  await db.auditLog.create({
    data: {
      actorUserId: existing.userId,
      action: "TELEGRAM_ACCOUNT_UNLINKED",
      resource: "TelegramAccount",
      resourceId: existing.userId,
      detailsJson: JSON.stringify({
        maskedChatId: maskTelegramChatId(existing.chatId),
      }),
    },
  });

  return { unlinked: true };
}

export async function sendTelegramRaw(
  payload: TelegramSendPayload,
  transport?: TelegramTransportFn
): Promise<TelegramSendResult> {
  const maskedChatId = maskTelegramChatId(payload.chatId);
  const replyMarkup = buildInlineKeyboard(payload.actionUrl, payload.ctaLabel);
  const fullText =
    payload.actionUrl && !replyMarkup
      ? `${payload.text}\n\n🔗 ${payload.ctaLabel || "Оплатить"}: ${payload.actionUrl}`
      : payload.text;

  try {
    if (transport) {
      const res = await transport({
        chatId: payload.chatId,
        text: fullText,
        replyMarkup,
        parseMode: payload.parseMode,
      });
      return { sent: true, messageId: res.messageId, maskedChatId };
    }

    const bot = buildApiBot();
    if (!bot) {
      if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
        console.log(`🤖 [Telegram Simulated (No Bot Token)] To: ${maskedChatId}`);
      }
      return {
        sent: true,
        messageId: `tg_sim_${Date.now()}`,
        maskedChatId,
      };
    }

    const sentMsg = await bot.api.sendMessage(payload.chatId, fullText, {
      ...(payload.parseMode ? { parse_mode: payload.parseMode } : {}),
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });

    return {
      sent: true,
      messageId: String(sentMsg.message_id),
      maskedChatId,
    };
  } catch (err) {
    if (isTelegramBlockedError(err)) {
      await db.telegramAccount.updateMany({
        where: { chatId: payload.chatId },
        data: { isBlocked: true, isActive: false },
      });
      return {
        sent: false,
        maskedChatId,
        reason: "USER_BLOCKED_BOT",
        error: "Forbidden: bot was blocked by the user",
      };
    }

    return {
      sent: false,
      maskedChatId,
      reason: "TELEGRAM_API_ERROR",
      error: (err instanceof Error ? err.message : String(err)).slice(0, 400),
    };
  }
}

export async function sendTelegramToUser(params: {
  userId: string;
  centerId?: string | null;
  text: string;
  actionUrl?: string;
  ctaLabel?: string;
  type?: NotificationType;
  eventKey?: string;
  skipDeliveryLog?: boolean;
  transport?: TelegramTransportFn;
}): Promise<TelegramSendResult & { deliveryId?: string }> {
  const tgAccount = await db.telegramAccount.findUnique({
    where: { userId: params.userId },
    include: {
      user: { select: { isActive: true } },
    },
  });

  if (!tgAccount || !tgAccount.isActive || !tgAccount.user.isActive) {
    return { sent: false, reason: "NOT_LINKED" };
  }

  if (tgAccount.isBlocked) {
    return {
      sent: false,
      maskedChatId: maskTelegramChatId(tgAccount.chatId),
      reason: "USER_BLOCKED_BOT",
    };
  }

  if (params.centerId) {
    const planCtx = await getCenterPlanFeatures(params.centerId);
    if (!planCtx.features.telegramBot) {
      return { sent: false, reason: "PLAN_FEATURE_LOCKED" };
    }
  }

  const res = await sendTelegramRaw(
    {
      chatId: tgAccount.chatId,
      text: params.text,
      actionUrl: params.actionUrl,
      ctaLabel: params.ctaLabel,
    },
    params.transport
  );

  let deliveryId: string | undefined;
  if (!params.skipDeliveryLog) {
    try {
      const row = await db.notificationDelivery.create({
        data: {
          userId: params.userId,
          centerId: params.centerId ?? null,
          channel: "TELEGRAM",
          type: params.type ?? "GENERAL",
          eventKey: params.eventKey ?? null,
          recipient: res.maskedChatId ?? maskTelegramChatId(tgAccount.chatId),
          subject: "Telegram",
          status: res.sent ? "SENT" : res.reason === "USER_BLOCKED_BOT" ? "SKIPPED" : "FAILED",
          providerMessageId: res.messageId ?? null,
          errorMessage: res.error ?? res.reason ?? null,
          sentAt: res.sent ? new Date() : null,
        },
        select: { id: true },
      });
      deliveryId = row.id;
    } catch (err) {
      console.error("[Telegram] Failed to write NotificationDelivery:", err);
    }
  }

  return { ...res, deliveryId };
}

/**
 * Generates or reuses an idempotent Click payment link for a student charge/period when
 * the center has a verified Click merchant AND `onlinePaymentsClick` enabled on its plan.
 */
export async function getClickPayLinkForStudent(params: {
  centerId: string;
  studentMembershipId: string;
  chargeId?: string | null;
  groupId?: string | null;
  actorUserId: string;
  idempotencyKey?: string;
}): Promise<{ payUrl: string; merchantTransId: string } | null> {
  try {
    const planCtx = await getCenterPlanFeatures(params.centerId);
    if (!planCtx.features.onlinePaymentsClick) {
      return null;
    }

    const appUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
    const created = await createClickPaymentIntent({
      centerId: params.centerId,
      studentMembershipId: params.studentMembershipId,
      chargeId: params.chargeId ?? undefined,
      groupId: params.chargeId ? undefined : (params.groupId ?? undefined),
      periodMonths: params.chargeId ? undefined : 1,
      returnUrl: `${appUrl}/center/payments`,
      actorUserId: params.actorUserId,
      idempotencyKey: params.idempotencyKey,
    });

    return {
      payUrl: created.clickUrl,
      merchantTransId: created.intent.merchantTransId,
    };
  } catch {
    return null;
  }
}

async function getLinkedContextByChat(chatId: string) {
  const account = await db.telegramAccount.findUnique({
    where: { chatId },
    include: {
      user: {
        select: {
          id: true,
          fullName: true,
          isActive: true,
          deletedAt: true,
          preferredLanguage: true,
          memberships: {
            where: {
              status: "ACTIVE",
              center: { status: "ACTIVE" },
            },
            include: {
              center: {
                select: {
                  id: true,
                  name: true,
                },
              },
              parentLinksAsParent: {
                where: { status: "CONFIRMED" },
                include: {
                  student: {
                    include: {
                      user: { select: { fullName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account || !account.isActive || !account.user.isActive || account.user.deletedAt) {
    return null;
  }

  await db.telegramAccount.update({
    where: { id: account.id },
    data: { lastInboundAt: new Date(), isBlocked: false },
  });

  return account;
}

async function buildBalanceResponse(account: NonNullable<Awaited<ReturnType<typeof getLinkedContextByChat>>>): Promise<{
  text: string;
  actionUrl?: string;
  ctaLabel?: string;
}> {
  const lang = getLang(account.user.preferredLanguage, account.languageCode);
  const lines: string[] = [];
  let firstPayUrl: string | undefined;

  for (const membership of account.user.memberships) {
    const planCtx = await getCenterPlanFeatures(membership.centerId);
    if (!planCtx.features.telegramBot) continue;

    if (membership.role === "STUDENT") {
      const [bal] = await calculateStudentBalances({
        centerId: membership.centerId,
        studentMembershipIds: [membership.id],
      });
      if (!bal) continue;
      const paidStr = bal.earliestPaidUntil
        ? formatTashkentYMD(new Date(bal.earliestPaidUntil))
        : "—";
      if (lang === "uz") {
        lines.push(
          `🏫 ${membership.center.name}\n👤 ${bal.fullName}\n💰 Qarzdorlik: ${formatMoneyUzs(bal.debtAmount)}\n📅 To'langan muddat: ${paidStr}`
        );
      } else {
        lines.push(
          `🏫 ${membership.center.name}\n👤 ${bal.fullName}\n💰 Долг: ${formatMoneyUzs(bal.debtAmount)}\n📅 Оплачено до: ${paidStr}`
        );
      }

      if (bal.debtAmount > 0 && !firstPayUrl) {
        const pay = await getClickPayLinkForStudent({
          centerId: membership.centerId,
          studentMembershipId: membership.id,
          chargeId: bal.nextPayment?.chargeId ?? null,
          groupId: bal.enrollments[0]?.groupId ?? null,
          actorUserId: account.user.id,
          idempotencyKey: `tgbal:${membership.id}:${formatTashkentYMD(new Date())}`,
        });
        if (pay) firstPayUrl = pay.payUrl;
      }
    } else if (membership.role === "PARENT") {
      const childIds = membership.parentLinksAsParent
        .filter((l) => l.status === "CONFIRMED")
        .map((l) => l.studentMembershipId);
      if (childIds.length === 0) {
        lines.push(
          lang === "uz"
            ? `🏫 ${membership.center.name}: Tasdiqlangan farzandlar topilmadi.`
            : `🏫 ${membership.center.name}: Подтверждённые дети не привязаны.`
        );
        continue;
      }
      const childBalances = await calculateStudentBalances({
        centerId: membership.centerId,
        studentMembershipIds: childIds,
      });
      for (const bal of childBalances) {
        const paidStr = bal.earliestPaidUntil
          ? formatTashkentYMD(new Date(bal.earliestPaidUntil))
          : "—";
        if (lang === "uz") {
          lines.push(
            `🏫 ${membership.center.name}\n👶 ${bal.fullName}\n💰 Qarzdorlik: ${formatMoneyUzs(bal.debtAmount)}\n📅 To'langan muddat: ${paidStr}`
          );
        } else {
          lines.push(
            `🏫 ${membership.center.name}\n👶 ${bal.fullName}\n💰 Долг: ${formatMoneyUzs(bal.debtAmount)}\n📅 Оплачено до: ${paidStr}`
          );
        }
        if (bal.debtAmount > 0 && !firstPayUrl) {
          const pay = await getClickPayLinkForStudent({
            centerId: membership.centerId,
            studentMembershipId: bal.studentMembershipId,
            chargeId: bal.nextPayment?.chargeId ?? null,
            groupId: bal.enrollments[0]?.groupId ?? null,
            actorUserId: account.user.id,
            idempotencyKey: `tgbal:${bal.studentMembershipId}:${formatTashkentYMD(new Date())}`,
          });
          if (pay) firstPayUrl = pay.payUrl;
        }
      }
    } else if (["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"].includes(membership.role)) {
      const centerBalances = await calculateStudentBalances({
        centerId: membership.centerId,
      });
      const debtors = centerBalances.filter((b) => b.debtAmount > 0);
      const totalDebt = debtors.reduce((s, b) => s + b.debtAmount, 0);
      if (lang === "uz") {
        lines.push(
          `🏫 ${membership.center.name} (hisobot)\n👥 Qarzdor o'quvchilar: ${debtors.length}\n💰 Umumiy qarzdorlik: ${formatMoneyUzs(totalDebt)}`
        );
      } else {
        lines.push(
          `🏫 ${membership.center.name} (сводка)\n👥 Учеников с долгом: ${debtors.length}\n💰 Общий долг: ${formatMoneyUzs(totalDebt)}`
        );
      }
    }
  }

  if (lines.length === 0) {
    return {
      text:
        lang === "uz"
          ? "Sizda faol markazlar bo'yicha balans ma'lumotlari mavjud emas."
          : "Нет доступных данных баланса по активным учебным центрам.",
    };
  }

  return {
    text: lines.join("\n\n"),
    actionUrl: firstPayUrl,
    ctaLabel: lang === "uz" ? "Click orqali to'lash" : "Оплатить через Click",
  };
}

async function buildScheduleResponse(
  account: NonNullable<Awaited<ReturnType<typeof getLinkedContextByChat>>>
): Promise<string> {
  const lang = getLang(account.user.preferredLanguage, account.languageCode);
  const now = new Date();
  const tashParts = toTashkentParts(now);
  const jsDay = new Date(Date.UTC(tashParts.year, tashParts.month - 1, tashParts.day)).getUTCDay();
  const todayIso = jsDay === 0 ? 7 : jsDay; // 1=Mon..7=Sun
  const tomorrowIso = todayIso === 7 ? 1 : todayIso + 1;

  const lines: string[] = [];

  for (const membership of account.user.memberships) {
    const planCtx = await getCenterPlanFeatures(membership.centerId);
    if (!planCtx.features.telegramBot) continue;

    let groupIds: string[] = [];
    if (membership.role === "STUDENT") {
      const enrollments = await db.enrollment.findMany({
        where: { studentMembershipId: membership.id, centerId: membership.centerId, status: "ACTIVE" },
        select: { groupId: true },
      });
      groupIds = enrollments.map((e) => e.groupId);
    } else if (membership.role === "PARENT") {
      const childIds = membership.parentLinksAsParent
        .filter((l) => l.status === "CONFIRMED")
        .map((l) => l.studentMembershipId);
      if (childIds.length > 0) {
        const enrollments = await db.enrollment.findMany({
          where: { studentMembershipId: { in: childIds }, centerId: membership.centerId, status: "ACTIVE" },
          select: { groupId: true },
        });
        groupIds = enrollments.map((e) => e.groupId);
      }
    }

    const slots = await db.scheduleSlot.findMany({
      where: {
        centerId: membership.centerId,
        status: "ACTIVE",
        dayOfWeek: { in: [todayIso, tomorrowIso] },
        ...(membership.role === "TEACHER" || membership.role === "TEACHER_ASSISTANT"
          ? { teacherMembershipId: membership.id }
          : membership.role === "STUDENT" || membership.role === "PARENT"
            ? { groupId: { in: groupIds.length > 0 ? groupIds : ["__none__"] } }
            : {}),
      },
      include: {
        group: { select: { name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
      take: 15,
    });

    if (slots.length === 0) continue;

    const todaySlots = slots.filter((s) => s.dayOfWeek === todayIso);
    const tomorrowSlots = slots.filter((s) => s.dayOfWeek === tomorrowIso);
    const fmt = (arr: typeof slots) =>
      arr
        .map(
          (s) =>
            `  • ${s.startTime}–${s.endTime} — ${s.group.name}${s.roomName ? ` (${s.roomName})` : ""}`
        )
        .join("\n");

    const parts: string[] = [`🏫 ${membership.center.name}`];
    if (todaySlots.length > 0) {
      parts.push(lang === "uz" ? `📅 Bugun:\n${fmt(todaySlots)}` : `📅 Сегодня:\n${fmt(todaySlots)}`);
    }
    if (tomorrowSlots.length > 0) {
      parts.push(lang === "uz" ? `📅 Ertaga:\n${fmt(tomorrowSlots)}` : `📅 Завтра:\n${fmt(tomorrowSlots)}`);
    }
    lines.push(parts.join("\n"));
  }

  if (lines.length === 0) {
    return lang === "uz"
      ? "Bugun va ertaga uchun rejalashtirilgan darslar topilmadi."
      : "На сегодня и завтра занятий по расписанию не найдено.";
  }

  return lines.join("\n\n");
}

async function buildPaymentsResponse(
  account: NonNullable<Awaited<ReturnType<typeof getLinkedContextByChat>>>
): Promise<string> {
  const lang = getLang(account.user.preferredLanguage, account.languageCode);
  const lines: string[] = [];

  for (const membership of account.user.memberships) {
    const planCtx = await getCenterPlanFeatures(membership.centerId);
    if (!planCtx.features.telegramBot) continue;

    let studentMembershipIds: string[] = [];
    if (membership.role === "STUDENT") {
      studentMembershipIds = [membership.id];
    } else if (membership.role === "PARENT") {
      studentMembershipIds = membership.parentLinksAsParent
        .filter((l) => l.status === "CONFIRMED")
        .map((l) => l.studentMembershipId);
    } else {
      continue;
    }

    if (studentMembershipIds.length === 0) continue;

    const payments = await db.centerPayment.findMany({
      where: {
        centerId: membership.centerId,
        studentMembershipId: { in: studentMembershipIds },
      },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    if (payments.length === 0) continue;
    const itemLines = payments.map((p) => {
      const dateStr = formatTashkentYMD(p.paidAt ?? p.createdAt);
      const grp = p.group?.name ? ` (${p.group.name})` : "";
      return `• ${dateStr}: ${formatMoneyUzs(p.amount)} — ${p.status}${p.receiptNumber ? ` #${p.receiptNumber}` : ""}${grp}`;
    });
    lines.push(`🏫 ${membership.center.name}\n${itemLines.join("\n")}`);
  }

  if (lines.length === 0) {
    return lang === "uz" ? "To'lovlar tarixi topilmadi." : "История платежей пока пуста.";
  }

  return lines.join("\n\n");
}

function getHelpMessage(lang: "ru" | "uz"): string {
  if (lang === "uz") {
    return [
      "Mavjud buyruqlar:",
      "/balance — balans, qarz va to'lov havolasi",
      "/schedule — bugun va ertangi dars jadvali",
      "/payments — oxirgi to'lovlar tarixi",
      "/lang — tilni almashtirish (RU / UZ)",
      "/stop — Telegram hisobni uzish",
    ].join("\n");
  }
  return [
    "Доступные команды:",
    "/balance — баланс, долг и ссылка на оплату",
    "/schedule — расписание на сегодня и завтра",
    "/payments — история последних оплат",
    "/lang — сменить язык (RU / UZ)",
    "/stop — отключить Telegram-уведомления",
  ].join("\n");
}

/**
 * Registers all command handlers on a grammY Bot instance and executes updates
 * through an explicit reply transport (grammY's own api.sendMessage in production
 * or an injected recorder in automated tests).
 */
export function createConfiguredTelegramBot(options?: {
  token?: string;
  transport?: TelegramTransportFn;
}): Bot {
  const token = options?.token || process.env.TELEGRAM_BOT_TOKEN?.trim() || "123456:TEST_TOKEN_DO_NOT_CALL_NETWORK";
  const bot = new Bot(token, { botInfo: getCachedBotInfo() });

  const replyWith = async (
    ctx: Context,
    text: string,
    extra?: { actionUrl?: string; ctaLabel?: string }
  ) => {
    const chatId = String(ctx.chat?.id ?? "");
    if (!chatId) return;
    await sendTelegramRaw(
      {
        chatId,
        text,
        actionUrl: extra?.actionUrl,
        ctaLabel: extra?.ctaLabel,
      },
      options?.transport ??
        (async ({ chatId: targetChatId, text: msgText, replyMarkup }) => {
          const res = await ctx.api.sendMessage(targetChatId, msgText, {
            ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
          });
          return { messageId: String(res.message_id) };
        })
    );
  };

  bot.use(async (ctx, next) => {
    if (!ctx.chat) return;
    if (ctx.chat.type !== "private") {
      await replyWith(
        ctx,
        "Для защиты персональных данных бот работает только в личном чате. / Bot faqat shaxsiy chatda ishlaydi."
      );
      return;
    }
    await next();
  });

  bot.command("start", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const telegramId = String(ctx.from?.id ?? chatId);
    const payload = typeof ctx.match === "string" ? ctx.match.trim() : "";

    if (!payload) {
      const existing = await getLinkedContextByChat(chatId);
      if (existing) {
        const lang = getLang(existing.user.preferredLanguage, existing.languageCode);
        await replyWith(
          ctx,
          `${lang === "uz" ? "Assalomu alaykum" : "Здравствуйте"}, ${existing.user.fullName}!\n\n${getHelpMessage(lang)}`
        );
      } else {
        await replyWith(
          ctx,
          "Добро пожаловать в e-darschi! Откройте «Профиль» в системе e-darschi и перейдите по персональной ссылке или QR-коду для привязки Telegram.\n\ne-darschi tizimiga xush kelibsiz! Profil bo'limidan shaxsiy havola orqali ulaning."
        );
      }
      return;
    }

    const res = await consumeTelegramLinkToken({
      rawToken: payload,
      telegramId,
      chatId,
      username: ctx.from?.username ?? null,
      firstName: ctx.from?.first_name ?? null,
      languageCode: ctx.from?.language_code ?? null,
    });

    if (!res.ok) {
      if (res.reason === "CHAT_ALREADY_LINKED_TO_OTHER_USER") {
        await replyWith(
          ctx,
          "Этот Telegram-аккаунт уже привязан к другому пользователю e-darschi. Отключите прежний аккаунт командой /stop.\n\nBu Telegram akkaunt boshqa foydalanuvchiga ulangan. Avval /stop buyrug'ini yuboring."
        );
      } else {
        await replyWith(
          ctx,
          "Ссылка привязки недействительна или истекла (срок действия 15 минут). Сгенерируйте новую в профиле e-darschi.\n\nUlash havolasi eskirgan yoki noto'g'ri. Profildan yangisini oling."
        );
      }
      return;
    }

    const greeting =
      res.lang === "uz"
        ? `Telegram muvaffaqiyatli ulandi, ${res.fullName}!\n\n${getHelpMessage("uz")}`
        : `Telegram успешно привязан, ${res.fullName}!\n\n${getHelpMessage("ru")}`;
    await replyWith(ctx, greeting);
  });

  bot.command("help", async (ctx) => {
    const existing = await getLinkedContextByChat(String(ctx.chat.id));
    const lang = getLang(existing?.user.preferredLanguage, ctx.from?.language_code);
    await replyWith(ctx, getHelpMessage(lang));
  });

  bot.command("lang", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const existing = await getLinkedContextByChat(chatId);
    if (!existing) {
      await replyWith(
        ctx,
        "Сначала привяжите аккаунт через профиль e-darschi. / Avval hisobingizni ulang."
      );
      return;
    }

    const currentLang = getLang(existing.user.preferredLanguage, existing.languageCode);
    const nextLang = currentLang === "ru" ? "uz" : "ru";

    await db.$transaction([
      db.telegramAccount.update({
        where: { id: existing.id },
        data: { languageCode: nextLang },
      }),
      db.platformUser.update({
        where: { id: existing.user.id },
        data: { preferredLanguage: nextLang === "uz" ? "uz_Latn" : "ru" },
      }),
    ]);

    await replyWith(
      ctx,
      nextLang === "uz"
        ? "Til o'zbek tiliga (Lotin) o'zgartirildi."
        : "Язык переключён на русский."
    );
  });

  bot.command("stop", async (ctx) => {
    const chatId = String(ctx.chat.id);
    const res = await unlinkTelegramAccount({ chatId });
    await replyWith(
      ctx,
      res.unlinked
        ? "Telegram-аккаунт отключён от e-darschi. / Telegram hisobingiz uzildi."
        : "Привязанный аккаунт не найден. / Ulangan hisob topilmadi."
    );
  });

  bot.command("balance", async (ctx) => {
    const existing = await getLinkedContextByChat(String(ctx.chat.id));
    if (!existing) {
      await replyWith(
        ctx,
        "Аккаунт не привязан. Откройте профиль в e-darschi, чтобы получить ссылку привязки."
      );
      return;
    }
    const resp = await buildBalanceResponse(existing);
    await replyWith(ctx, resp.text, {
      actionUrl: resp.actionUrl,
      ctaLabel: resp.ctaLabel,
    });
  });

  bot.command("schedule", async (ctx) => {
    const existing = await getLinkedContextByChat(String(ctx.chat.id));
    if (!existing) {
      await replyWith(
        ctx,
        "Аккаунт не привязан. Откройте профиль в e-darschi, чтобы получить ссылку привязки."
      );
      return;
    }
    const text = await buildScheduleResponse(existing);
    await replyWith(ctx, text);
  });

  bot.command("payments", async (ctx) => {
    const existing = await getLinkedContextByChat(String(ctx.chat.id));
    if (!existing) {
      await replyWith(
        ctx,
        "Аккаунт не привязан. Откройте профиль в e-darschi, чтобы получить ссылку привязки."
      );
      return;
    }
    const text = await buildPaymentsResponse(existing);
    await replyWith(ctx, text);
  });

  return bot;
}

export async function processTelegramUpdate(
  update: Update,
  options?: { transport?: TelegramTransportFn }
): Promise<void> {
  const bot = createConfiguredTelegramBot({ transport: options?.transport });
  await bot.handleUpdate(update);
}
