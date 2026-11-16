// Reason: Exception: Broadcast engine executes multi-channel deliveries and scheduled queue flushes across centers.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import type {
  BroadcastAudience,
  MembershipRole,
  NotificationChannel,
} from "@prisma/client";
import { formatTashkentYMD, startOfTashkentDay } from "@/lib/billing";
import { calculateStudentBalances } from "@/lib/student-balance";
import { escapeHtml } from "@/lib/email";
import { sendNotification } from "@/lib/notifications";
import { checkRateLimit } from "@/lib/rate-limit";

export const ESTIMATED_SMS_SEGMENT_COST_UZS = 120;
export const BROADCAST_DAILY_LIMIT_PER_CENTER = 2000;

export interface BroadcastTemplateVars {
  studentName: string;
  amount: string;
  paidUntil: string;
  payUrl: string;
  centerName: string;
  groupName: string;
}

/**
 * Safely renders placeholders (`{{studentName}}`, `{{amount}}`, `{{paidUntil}}`, `{{payUrl}}`,
 * `{{centerName}}`, `{{groupName}}`). Escapes HTML entities in variable values when rendering HTML.
 */
export function renderBroadcastText(
  template: string,
  vars: Partial<BroadcastTemplateVars>,
  options?: { escapeHtmlValues?: boolean }
): string {
  const esc = (v: string | undefined) => {
    const val = v ?? "";
    return options?.escapeHtmlValues ? escapeHtml(val) : val;
  };

  return template
    .replace(/\{\{\s*studentName\s*\}\}/g, esc(vars.studentName))
    .replace(/\{\{\s*amount\s*\}\}/g, esc(vars.amount))
    .replace(/\{\{\s*paidUntil\s*\}\}/g, esc(vars.paidUntil))
    .replace(/\{\{\s*payUrl\s*\}\}/g, esc(vars.payUrl))
    .replace(/\{\{\s*centerName\s*\}\}/g, esc(vars.centerName))
    .replace(/\{\{\s*groupName\s*\}\}/g, esc(vars.groupName));
}

export function estimateSmsSegments(text: string): number {
  if (!text) return 0;
  // Detect non-GSM characters (Cyrillic, smart quotes, etc.) -> UCS-2 (70 / 67 chars per segment)
  const hasUnicode = /[^\x00-\x7F]/.test(text);
  const singleMax = hasUnicode ? 70 : 160;
  const concatMax = hasUnicode ? 67 : 153;
  if (text.length <= singleMax) return 1;
  return Math.ceil(text.length / concatMax);
}

export interface BroadcastTargetUser {
  userId: string;
  locale: "ru" | "uz";
  hasEmail: boolean;
  hasPhone: boolean;
  hasTelegram: boolean;
  hasPush: boolean;
  vars: BroadcastTemplateVars;
}

export async function resolveBroadcastRecipients(params: {
  centerId: string;
  audience: BroadcastAudience;
  targetGroupId?: string | null;
  targetRole?: MembershipRole | null;
}): Promise<BroadcastTargetUser[]> {
  const center = await db.learningCenter.findUnique({
    where: { id: params.centerId },
    select: { name: true },
  });
  const centerName = center?.name || "Учебный центр";

  const userMap = new Map<string, BroadcastTargetUser>();

  const enrichUsers = async (
    entries: Array<{
      userId: string;
      vars: Omit<BroadcastTemplateVars, "centerName">;
    }>
  ) => {
    const uniqueIds = Array.from(new Set(entries.map((e) => e.userId)));
    if (uniqueIds.length === 0) return;

    const users = await db.platformUser.findMany({
      where: {
        id: { in: uniqueIds },
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        preferredLanguage: true,
        telegramAccount: { select: { isActive: true, isBlocked: true } },
        devicePushTokens: {
          where: { OR: [{ centerId: params.centerId }, { centerId: null }] },
          select: { id: true },
          take: 1,
        },
      },
    });

    const byId = new Map(users.map((u) => [u.id, u]));
    for (const entry of entries) {
      if (userMap.has(entry.userId)) continue;
      const u = byId.get(entry.userId);
      if (!u) continue;
      userMap.set(u.id, {
        userId: u.id,
        locale: u.preferredLanguage === "ru" ? "ru" : "uz",
        hasEmail: Boolean(u.email?.trim()),
        hasPhone: Boolean(u.phone?.trim()),
        hasTelegram: Boolean(u.telegramAccount && u.telegramAccount.isActive && !u.telegramAccount.isBlocked),
        hasPush: u.devicePushTokens.length > 0,
        vars: {
          ...entry.vars,
          studentName: entry.vars.studentName || u.fullName,
          centerName,
        },
      });
    }
  };

  if (params.audience === "DEBTORS" || params.audience === "OVERDUE") {
    const balances = await calculateStudentBalances({ centerId: params.centerId });
    const filtered = balances.filter((b) => {
      if (b.status === "FROZEN") return false;
      if (params.audience === "OVERDUE") {
        const hasOverdueEnrollment = b.enrollments.some((e) => e.isOverdue);
        const hasOverdueInvoice = b.openCharges.some(
          (c) => new Date(c.dueDate).getTime() < Date.now()
        );
        return b.debtAmount > 0 && (hasOverdueEnrollment || hasOverdueInvoice);
      }
      return b.debtAmount > 0;
    });

    const membershipIds = filtered.map((b) => b.studentMembershipId);
    const memberships = membershipIds.length
      ? await db.centerMembership.findMany({
          where: { id: { in: membershipIds }, centerId: params.centerId },
          select: { id: true, userId: true },
        })
      : [];
    const memToUser = new Map(memberships.map((m) => [m.id, m.userId]));

    await enrichUsers(
      filtered
        .map((b) => {
          const userId = memToUser.get(b.studentMembershipId);
          if (!userId) return null;
          return {
            userId,
            vars: {
              studentName: b.fullName,
              amount: `${Math.round(b.debtAmount).toLocaleString("ru-RU").replace(/\u00a0/g, " ")}`,
              paidUntil: b.earliestPaidUntil ? formatTashkentYMD(new Date(b.earliestPaidUntil)) : "—",
              payUrl: "",
              groupName: b.enrollments[0]?.groupName || "",
            },
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    );

    return Array.from(userMap.values());
  }

  if (params.audience === "GROUP") {
    if (!params.targetGroupId) return [];
    const group = await db.group.findFirst({
      where: { id: params.targetGroupId, centerId: params.centerId },
      select: { id: true, name: true },
    });
    if (!group) return [];

    const enrollments = await db.enrollment.findMany({
      where: {
        centerId: params.centerId,
        groupId: group.id,
        status: "ACTIVE",
        student: { status: "ACTIVE" },
      },
      include: {
        student: {
          select: {
            userId: true,
            user: { select: { fullName: true } },
          },
        },
      },
    });

    await enrichUsers(
      enrollments.map((e) => ({
        userId: e.student.userId,
        vars: {
          studentName: e.student.user.fullName,
          amount: "0",
          paidUntil: e.paidUntil ? formatTashkentYMD(e.paidUntil) : "—",
          payUrl: "",
          groupName: group.name,
        },
      }))
    );
    return Array.from(userMap.values());
  }

  if (params.audience === "ROLE") {
    if (!params.targetRole) return [];
    const members = await db.centerMembership.findMany({
      where: {
        centerId: params.centerId,
        status: "ACTIVE",
        role: params.targetRole,
      },
      include: {
        user: { select: { fullName: true } },
      },
    });

    await enrichUsers(
      members.map((m) => ({
        userId: m.userId,
        vars: {
          studentName: m.user.fullName,
          amount: "0",
          paidUntil: "—",
          payUrl: "",
          groupName: "",
        },
      }))
    );
    return Array.from(userMap.values());
  }

  // ALL active center members
  const allMembers = await db.centerMembership.findMany({
    where: {
      centerId: params.centerId,
      status: "ACTIVE",
    },
    include: {
      user: { select: { fullName: true } },
    },
  });

  await enrichUsers(
    allMembers.map((m) => ({
      userId: m.userId,
      vars: {
        studentName: m.user.fullName,
        amount: "0",
        paidUntil: "—",
        payUrl: "",
        groupName: "",
      },
    }))
  );
  return Array.from(userMap.values());
}

function isReachableOnChannel(u: BroadcastTargetUser, channel: NotificationChannel): boolean {
  switch (channel) {
    case "SMS":
      return u.hasPhone;
    case "EMAIL":
      return u.hasEmail;
    case "TELEGRAM":
      return u.hasTelegram;
    case "PUSH":
      return u.hasPush;
    case "IN_APP":
    default:
      return true;
  }
}

export async function previewBroadcast(params: {
  centerId: string;
  audience: BroadcastAudience;
  targetGroupId?: string | null;
  targetRole?: MembershipRole | null;
  channel: NotificationChannel;
  bodyRu: string;
  bodyUz?: string | null;
}) {
  const targets = await resolveBroadcastRecipients(params);
  const reachable = targets.filter((t) => isReachableOnChannel(t, params.channel));

  let estimatedSmsSegments = 0;
  if (params.channel === "SMS") {
    for (const r of reachable) {
      const tpl = r.locale === "uz" && params.bodyUz?.trim() ? params.bodyUz : params.bodyRu;
      const text = renderBroadcastText(tpl, r.vars);
      estimatedSmsSegments += estimateSmsSegments(text);
    }
  }

  const sampleMessages = reachable.slice(0, 3).map((r) => {
    const tpl = r.locale === "uz" && params.bodyUz?.trim() ? params.bodyUz : params.bodyRu;
    return {
      userId: r.userId,
      locale: r.locale,
      text: renderBroadcastText(tpl, r.vars),
    };
  });

  return {
    totalAudience: targets.length,
    totalRecipients: reachable.length,
    estimatedSmsSegments,
    estimatedCostUzs: estimatedSmsSegments * ESTIMATED_SMS_SEGMENT_COST_UZS,
    sampleMessages,
  };
}

export async function executeBroadcast(
  broadcastId: string,
  options?: { now?: Date }
): Promise<{
  broadcastId: string;
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
}> {
  const now = options?.now ?? new Date();
  const broadcast = await db.broadcast.findUnique({
    where: { id: broadcastId },
  });
  if (!broadcast) {
    throw new Error("Broadcast not found");
  }

  // Atomic lock transition DRAFT/SCHEDULED -> SENDING to prevent duplicate execution under concurrency
  const locked = await db.broadcast.updateMany({
    where: {
      id: broadcast.id,
      status: { in: ["DRAFT", "SCHEDULED"] },
    },
    data: {
      status: "SENDING",
      startedAt: now,
    },
  });

  if (locked.count !== 1) {
    return {
      broadcastId: broadcast.id,
      status: broadcast.status,
      totalRecipients: broadcast.totalRecipients,
      sentCount: broadcast.sentCount,
      failedCount: broadcast.failedCount,
    };
  }

  try {
    const tashkentTodayStart = startOfTashkentDay(now);
    const dailySentCount = await db.broadcastRecipient.count({
      where: {
        centerId: broadcast.centerId,
        createdAt: { gte: tashkentTodayStart },
        status: "SENT",
      },
    });

    const allowedLimit = await checkRateLimit(
      `broadcast_center_daily:${broadcast.centerId}`,
      BROADCAST_DAILY_LIMIT_PER_CENTER,
      24 * 60 * 60 * 1000
    );

    if (!allowedLimit || dailySentCount >= BROADCAST_DAILY_LIMIT_PER_CENTER) {
      await db.broadcast.update({
        where: { id: broadcast.id },
        data: { status: "FAILED", completedAt: new Date() },
      });
      throw new Error("Center daily broadcast cap exceeded");
    }

    const targets = await resolveBroadcastRecipients({
      centerId: broadcast.centerId,
      audience: broadcast.audience,
      targetGroupId: broadcast.targetGroupId,
      targetRole: broadcast.targetRole,
    });
    const reachable = targets.filter((t) => isReachableOnChannel(t, broadcast.channel));

    if (reachable.length > 0) {
      await db.broadcastRecipient.createMany({
        data: reachable.map((r) => ({
          centerId: broadcast.centerId,
          broadcastId: broadcast.id,
          userId: r.userId,
          channel: broadcast.channel,
          locale: r.locale === "uz" ? "uz_Latn" : "ru",
          status: "PENDING",
        })),
        skipDuplicates: true,
      });
    }

    const pendingRecipients = await db.broadcastRecipient.findMany({
      where: {
        broadcastId: broadcast.id,
        status: "PENDING",
      },
    });

    const targetByUserId = new Map(reachable.map((t) => [t.userId, t]));
    let sentCount = 0;
    let failedCount = 0;

    for (const rec of pendingRecipients) {
      const target = targetByUserId.get(rec.userId);
      const locale = rec.locale === "ru" ? "ru" : "uz";
      const rawTemplate =
        locale === "uz" && broadcast.bodyUz?.trim() ? broadcast.bodyUz : broadcast.bodyRu;
      const bodyText = renderBroadcastText(rawTemplate, target?.vars ?? {});

      try {
        const eventKey = `broadcast:${broadcast.id}:${rec.userId}:${rec.channel}`;
        await sendNotification({
          userId: rec.userId,
          centerId: broadcast.centerId,
          type: "BROADCAST",
          titleKey: broadcast.title,
          bodyKey: "RAW_TEXT",
          bodyParams: {
            centerName: target?.vars.centerName || "",
            studentName: target?.vars.studentName || "",
            title: broadcast.title,
          },
          channel: broadcast.channel,
          lang: locale,
          dedupeKey: eventKey,
          eventKey,
          subject: broadcast.title,
          messageText: bodyText,
          now,
        });

        const delivery = await db.notificationDelivery.findFirst({
          where: {
            centerId: broadcast.centerId,
            eventKey,
          },
          orderBy: { createdAt: "desc" },
          select: { id: true, status: true, errorMessage: true },
        });

        const finalStatus = delivery?.status ?? "SENT";
        await db.broadcastRecipient.update({
          where: { id: rec.id },
          data: {
            status: finalStatus,
            deliveryId: delivery?.id ?? null,
            errorMessage: delivery?.errorMessage ?? null,
            sentAt: finalStatus === "SENT" ? now : null,
          },
        });

        if (finalStatus === "FAILED") failedCount++;
        else sentCount++;
      } catch (err) {
        failedCount++;
        await db.broadcastRecipient.update({
          where: { id: rec.id },
          data: {
            status: "FAILED",
            errorMessage: (err instanceof Error ? err.message : String(err)).slice(0, 400),
          },
        });
      }
    }

    await db.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "COMPLETED",
        totalRecipients: pendingRecipients.length,
        sentCount,
        failedCount,
        completedAt: new Date(),
      },
    });

    return {
      broadcastId: broadcast.id,
      status: "COMPLETED",
      totalRecipients: pendingRecipients.length,
      sentCount,
      failedCount,
    };
  } catch (err) {
    await db.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "FAILED", completedAt: new Date() },
    });
    throw err;
  }
}

export async function processDueScheduledBroadcasts(options?: { now?: Date }): Promise<number> {
  const now = options?.now ?? new Date();
  const due = await db.broadcast.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
    select: { id: true },
  });

  let count = 0;
  for (const item of due) {
    try {
      await executeBroadcast(item.id, { now });
      count++;
    } catch (err) {
      console.error("[Broadcasts] Scheduled execution error:", err);
    }
  }
  return count;
}
