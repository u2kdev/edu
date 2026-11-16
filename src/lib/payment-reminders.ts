// Reason: Exception: Payment reminders cron iterates across all active centers globally.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import type { NotificationChannel } from "@prisma/client";
import { diffTashkentCalendarDays, formatTashkentYMD, startOfTashkentDay } from "@/lib/billing";
import { calculateStudentBalances } from "@/lib/student-balance";
import { getCenterPlanFeatures } from "@/lib/plan-features";
import { flushDeferredNotifications, sendNotification } from "@/lib/notifications";
import { getClickPayLinkForStudent } from "@/lib/telegram";
import { processDueScheduledBroadcasts } from "@/lib/broadcasts";

export interface PaymentRemindersCronResult {
  centersChecked: number;
  remindersSent: number;
  remindersDeferred: number;
  remindersSkippedDuplicate: number;
  directorDigestsSent: number;
  deferredFlushed: {
    checked: number;
    sent: number;
    failed: number;
    skipped: number;
    stillDeferred: number;
  };
  scheduledBroadcastsProcessed: number;
}

const DEFAULT_REMINDER_OFFSETS = [-3, 0, 3, 7];

function parseOffsets(raw?: string | null): number[] {
  if (!raw) return DEFAULT_REMINDER_OFFSETS;
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      const nums = Array.from(
        new Set(arr.filter((n): n is number => typeof n === "number" && Number.isInteger(n)))
      );
      if (nums.length > 0) return nums;
    }
  } catch {}
  return DEFAULT_REMINDER_OFFSETS;
}

function formatAmount(amount: number): string {
  return Math.round(amount).toLocaleString("ru-RU").replace(/\u00a0/g, " ");
}

function applyReminderTemplate(
  template: string | null | undefined,
  vars: {
    centerName: string;
    studentName: string;
    amount: string;
    paidUntil: string;
    dueDate: string;
    payUrl: string;
  },
  lang: "ru" | "uz",
  offsetDays: number
): string {
  if (template && template.trim()) {
    return template
      .replace(/\{\{\s*centerName\s*\}\}/g, vars.centerName)
      .replace(/\{\{\s*studentName\s*\}\}/g, vars.studentName)
      .replace(/\{\{\s*amount\s*\}\}/g, vars.amount)
      .replace(/\{\{\s*paidUntil\s*\}\}/g, vars.paidUntil)
      .replace(/\{\{\s*dueDate\s*\}\}/g, vars.dueDate)
      .replace(/\{\{\s*payUrl\s*\}\}/g, vars.payUrl)
      .trim();
  }

  const paySuffix = vars.payUrl
    ? lang === "uz"
      ? ` To'lash: ${vars.payUrl}`
      : ` Оплатить: ${vars.payUrl}`
    : "";

  if (lang === "uz") {
    if (offsetDays < 0) {
      return `${vars.centerName}: ${vars.studentName} uchun o'quv to'lovi muddati ${vars.dueDate} da tugaydi. Summa: ${vars.amount} UZS.${paySuffix}`;
    }
    if (offsetDays === 0) {
      return `${vars.centerName}: Bugun ${vars.studentName} uchun to'lov kuni (${vars.amount} UZS).${paySuffix}`;
    }
    return `${vars.centerName}: ${vars.studentName} bo'yicha to'lov muddati ${offsetDays} kunga kechikdi. Qarz: ${vars.amount} UZS.${paySuffix}`;
  }

  if (offsetDays < 0) {
    return `${vars.centerName}: Срок оплаты за ученика ${vars.studentName} наступает ${vars.dueDate}. Сумма: ${vars.amount} UZS.${paySuffix}`;
  }
  if (offsetDays === 0) {
    return `${vars.centerName}: Сегодня срок оплаты обучения за ученика ${vars.studentName} (${vars.amount} UZS).${paySuffix}`;
  }
  return `${vars.centerName}: Оплата за ученика ${vars.studentName} просрочена на ${offsetDays} дн. К оплате: ${vars.amount} UZS.${paySuffix}`;
}

async function pickPreferredChannelAndRecipient(params: {
  centerId: string;
  studentMembershipId: string;
  centerSmsEnabled: boolean;
  centerEmailEnabled: boolean;
  allowSmsByPlan: boolean;
  allowTelegramByPlan: boolean;
  allowPushByPlan: boolean;
}): Promise<{
  userId: string;
  lang: "ru" | "uz";
  channel: NotificationChannel;
  email: string | null;
  phone: string | null;
} | null> {
  const [studentMem, parentLinks] = await Promise.all([
    db.centerMembership.findUnique({
      where: { id: params.studentMembershipId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            preferredLanguage: true,
            isActive: true,
            telegramAccount: {
              select: { isActive: true, isBlocked: true },
            },
            devicePushTokens: {
              where: { OR: [{ centerId: params.centerId }, { centerId: null }] },
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    }),
    db.parentLink.findMany({
      where: {
        studentMembershipId: params.studentMembershipId,
        status: "CONFIRMED",
        parent: { centerId: params.centerId, status: "ACTIVE" },
      },
      include: {
        parent: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                phone: true,
                preferredLanguage: true,
                isActive: true,
                telegramAccount: {
                  select: { isActive: true, isBlocked: true },
                },
                devicePushTokens: {
                  where: { OR: [{ centerId: params.centerId }, { centerId: null }] },
                  select: { id: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const candidates = [
    ...parentLinks.map((l) => l.parent.user).filter((u) => u && u.isActive),
    ...(studentMem?.user && studentMem.user.isActive ? [studentMem.user] : []),
  ];

  if (candidates.length === 0) return null;

  // Priority 1: TELEGRAM
  if (params.allowTelegramByPlan) {
    const tgTarget = candidates.find(
      (u) => u.telegramAccount && u.telegramAccount.isActive && !u.telegramAccount.isBlocked
    );
    if (tgTarget) {
      return {
        userId: tgTarget.id,
        lang: tgTarget.preferredLanguage === "ru" ? "ru" : "uz",
        channel: "TELEGRAM",
        email: tgTarget.email,
        phone: tgTarget.phone,
      };
    }
  }

  // Priority 2: PUSH
  if (params.allowPushByPlan) {
    const pushTarget = candidates.find((u) => u.devicePushTokens.length > 0);
    if (pushTarget) {
      return {
        userId: pushTarget.id,
        lang: pushTarget.preferredLanguage === "ru" ? "ru" : "uz",
        channel: "PUSH",
        email: pushTarget.email,
        phone: pushTarget.phone,
      };
    }
  }

  // Priority 3: SMS
  if (params.centerSmsEnabled && params.allowSmsByPlan) {
    const smsTarget = candidates.find((u) => Boolean(u.phone && u.phone.trim()));
    if (smsTarget) {
      return {
        userId: smsTarget.id,
        lang: smsTarget.preferredLanguage === "ru" ? "ru" : "uz",
        channel: "SMS",
        email: smsTarget.email,
        phone: smsTarget.phone,
      };
    }
  }

  // Priority 4: EMAIL fallback
  if (params.centerEmailEnabled) {
    const emailTarget = candidates.find((u) => Boolean(u.email && u.email.trim()));
    if (emailTarget) {
      return {
        userId: emailTarget.id,
        lang: emailTarget.preferredLanguage === "ru" ? "ru" : "uz",
        channel: "EMAIL",
        email: emailTarget.email,
        phone: emailTarget.phone,
      };
    }
  }

  // Final IN_APP fallback so notice isn't silently lost
  const primary = candidates[0];
  return {
    userId: primary.id,
    lang: primary.preferredLanguage === "ru" ? "ru" : "uz",
    channel: "IN_APP",
    email: primary.email,
    phone: primary.phone,
  };
}

/**
 * Hourly cron processor:
 * 1) Flushes deferred quiet-hours deliveries once outside quiet hours
 * 2) Runs scheduled broadcasts whose scheduledAt <= now
 * 3) Sends idempotent payment reminders (-3, 0, +3, +7 days in Asia/Tashkent)
 * 4) Sends once-per-day summary digest to center directors when reminders fired
 */
export async function runPaymentRemindersCron(options?: {
  now?: Date;
  centerId?: string;
}): Promise<PaymentRemindersCronResult> {
  const now = options?.now ?? new Date();
  const todayYmd = formatTashkentYMD(now);
  const todayStart = startOfTashkentDay(now);

  const deferredFlushed = await flushDeferredNotifications({ now });
  const scheduledBroadcastsProcessed = await processDueScheduledBroadcasts({ now });

  const centers = await db.learningCenter.findMany({
    where: {
      status: "ACTIVE",
      paymentReminderEnabled: true,
      ...(options?.centerId ? { id: options.centerId } : {}),
    },
    select: {
      id: true,
      name: true,
      smsEnabled: true,
      emailEnabled: true,
      paymentReminderDaysJson: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      reminderTemplateRu: true,
      reminderTemplateUz: true,
      defaultLanguage: true,
    },
  });

  let remindersSent = 0;
  let remindersDeferred = 0;
  let remindersSkippedDuplicate = 0;
  let directorDigestsSent = 0;

  for (const center of centers) {
    const offsets = parseOffsets(center.paymentReminderDaysJson);
    const planCtx = await getCenterPlanFeatures(center.id);
    const balances = await calculateStudentBalances({ centerId: center.id });

    let centerTriggeredCount = 0;

    for (const bal of balances) {
      // Skip frozen enrollments or students with no active non-frozen enrollments
      const activeEnrollments = bal.enrollments.filter((e) => e.status === "ACTIVE");
      if (bal.status === "FROZEN" || activeEnrollments.length === 0) {
        continue;
      }

      // Skip students who neither have unpaid open invoices nor remaining debt
      const primaryCharge = bal.openCharges[0] ?? null;
      const dueDateIso = primaryCharge?.dueDate ?? bal.earliestPaidUntil;
      if (!dueDateIso) continue;

      const dueDate = new Date(dueDateIso);
      const offsetDays = diffTashkentCalendarDays(dueDate, now);
      if (!offsets.includes(offsetDays)) continue;

      // Require real payable obligation:
      // - For overdue offsets (> 0): strictly require debtAmount > 0 or open charge remaining > 0
      // - For upcoming/due offsets (<= 0): require open unpaid charge OR monthlyTuition > 0 on unrenewed period
      const payableAmount = primaryCharge
        ? primaryCharge.remainingAmount
        : bal.debtAmount > 0
          ? bal.debtAmount
          : bal.monthlyTuition;

      if (payableAmount <= 0) continue;
      if (offsetDays > 0 && bal.debtAmount <= 0 && !primaryCharge) continue;

      // If upcoming reminder (-3 or 0), skip if student already paid past todayEnd + 3d without open invoice
      if (!primaryCharge && bal.earliestPaidUntil && offsetDays <= 0) {
        const paidDaysAhead = diffTashkentCalendarDays(todayStart, new Date(bal.earliestPaidUntil));
        if (offsetDays === -3 && paidDaysAhead !== 3) continue;
        if (offsetDays === 0 && paidDaysAhead !== 0) continue;
      }

      const dueDateKey = formatTashkentYMD(dueDate);
      const idempotencyKey = `${center.id}:${bal.studentMembershipId}:${dueDateKey}:${offsetDays}`;

      const target = await pickPreferredChannelAndRecipient({
        centerId: center.id,
        studentMembershipId: bal.studentMembershipId,
        centerSmsEnabled: center.smsEnabled,
        centerEmailEnabled: center.emailEnabled,
        allowSmsByPlan: planCtx.features.smsReminders,
        allowTelegramByPlan: planCtx.features.telegramBot,
        allowPushByPlan: planCtx.features.mobileApp,
      });
      if (!target) continue;

      // Claim idempotent log BEFORE dispatching so two parallel cron executions never double-send
      let claimedLogId: string | null = null;
      try {
        const logRow = await db.paymentReminderLog.create({
          data: {
            centerId: center.id,
            studentMembershipId: bal.studentMembershipId,
            chargeId: primaryCharge?.id ?? null,
            offsetDays,
            dueDateKey,
            channel: target.channel,
            idempotencyKey,
          },
          select: { id: true },
        });
        claimedLogId = logRow.id;
      } catch (err: unknown) {
        const code = (err as { code?: string })?.code;
        if (code === "P2002") {
          remindersSkippedDuplicate++;
          continue;
        }
        throw err;
      }

      const clickLink = await getClickPayLinkForStudent({
        centerId: center.id,
        studentMembershipId: bal.studentMembershipId,
        chargeId: primaryCharge?.id ?? null,
        groupId: activeEnrollments[0]?.groupId ?? null,
        actorUserId: target.userId,
        idempotencyKey: `rem:${idempotencyKey}`,
      });

      const templateRaw =
        target.lang === "uz" ? center.reminderTemplateUz : center.reminderTemplateRu;
      const bodyText = applyReminderTemplate(
        templateRaw,
        {
          centerName: center.name,
          studentName: bal.fullName,
          amount: formatAmount(payableAmount),
          paidUntil: bal.earliestPaidUntil ? formatTashkentYMD(new Date(bal.earliestPaidUntil)) : dueDateKey,
          dueDate: dueDateKey,
          payUrl: clickLink?.payUrl ?? "",
        },
        target.lang,
        offsetDays
      );

      await sendNotification({
        userId: target.userId,
        centerId: center.id,
        type: offsetDays > 0 ? "PAYMENT_OVERDUE" : "PAYMENT_DUE",
        titleKey: offsetDays > 0 ? "notifications.paymentOverdue" : "notifications.paymentDue",
        bodyKey: "notifications.paymentReminderBody",
        bodyParams: {
          centerName: center.name,
          studentName: bal.fullName,
          amount: formatAmount(payableAmount),
          dueDate: dueDateKey,
          paidUntil: bal.earliestPaidUntil ? formatTashkentYMD(new Date(bal.earliestPaidUntil)) : dueDateKey,
          payUrl: clickLink?.payUrl ?? "",
        },
        channel: target.channel,
        recipientEmail: target.email ?? undefined,
        recipientPhone: target.phone ?? undefined,
        lang: target.lang,
        dedupeKey: `payment-rem:${idempotencyKey}:${target.userId}`,
        eventKey: `payment-rem:${idempotencyKey}`,
        messageText: bodyText,
        actionUrl: clickLink?.payUrl,
        ctaLabel: target.lang === "uz" ? "Click orqali to'lash" : "Оплатить через Click",
        now,
      });

      // Check whether this delivery was deferred due to quiet hours
      const deliveryRow = await db.notificationDelivery.findFirst({
        where: {
          centerId: center.id,
          eventKey: `payment-rem:${idempotencyKey}`,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, status: true },
      });

      if (deliveryRow && claimedLogId) {
        await db.paymentReminderLog.update({
          where: { id: claimedLogId },
          data: { deliveryId: deliveryRow.id },
        });
      }

      if (deliveryRow?.status === "DEFERRED") {
        remindersDeferred++;
      } else {
        remindersSent++;
      }
      centerTriggeredCount++;
    }

    // Once-per-day summary digest to center director(s) if any reminders were issued
    if (centerTriggeredCount > 0) {
      const digestKey = `reminder-digest:${center.id}:${todayYmd}`;
      const directors = await db.centerMembership.findMany({
        where: { centerId: center.id, role: "DIRECTOR", status: "ACTIVE" },
        include: {
          user: {
            select: { id: true, preferredLanguage: true, isActive: true },
          },
        },
      });

      for (const dir of directors) {
        if (!dir.user.isActive) continue;
        const perDirectorKey = `${digestKey}:${dir.userId}`;
        const existingDigest = await db.notification.findFirst({
          where: { centerId: center.id, userId: dir.userId, dedupeKey: perDirectorKey },
          select: { id: true },
        });
        if (existingDigest) continue;

        const dirLang = dir.user.preferredLanguage === "ru" ? "ru" : "uz";
        await sendNotification({
          userId: dir.userId,
          centerId: center.id,
          type: "GENERAL",
          titleKey: dirLang === "uz" ? "Kunlik to'lov eslatmalari hisoboti" : "Дневная сводка напоминаний об оплате",
          bodyKey: "RAW_TEXT",
          channel: "IN_APP",
          dedupeKey: perDirectorKey,
          eventKey: digestKey,
          messageText:
            dirLang === "uz"
              ? `${center.name}: Bugun ${centerTriggeredCount} ta to'lov eslatmasi yuborildi.`
              : `${center.name}: Сегодня сформировано напоминаний об оплате: ${centerTriggeredCount}.`,
          now,
        });
        directorDigestsSent++;
      }
    }
  }

  return {
    centersChecked: centers.length,
    remindersSent,
    remindersDeferred,
    remindersSkippedDuplicate,
    directorDigestsSent,
    deferredFlushed,
    scheduledBroadcastsProcessed,
  };
}
