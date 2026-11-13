// Reason: Exception: Platform cron operates on global models across all centers.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { NotificationType } from "@prisma/client";

export interface SubscriptionCronResult {
  overdueCount: number;
  pausedCount: number;
  notificationsSent: number;
}

export async function processSubscriptionCron(options?: {
  now?: Date;
  gracePeriodDays?: number;
}): Promise<SubscriptionCronResult> {
  const now = options?.now || new Date();
  const gracePeriodDays = options?.gracePeriodDays ?? 5;
  const cutoffDate = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

  let overdueCount = 0;
  let pausedCount = 0;
  let notificationsSent = 0;

  // 1. Move expired ACTIVE/TRIAL to PAST_DUE and center to OVERDUE
  const expiredSubscriptions = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      currentPeriodEndsAt: { lte: now },
    },
    include: {
      center: true,
      plan: true,
    },
  });

  for (const sub of expiredSubscriptions) {
    await db.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: sub.id },
        data: { status: "PAST_DUE" },
      });

      if (sub.center.status !== "BLOCKED" && sub.center.status !== "PAUSED") {
        await tx.learningCenter.update({
          where: { id: sub.centerId },
          data: { status: "OVERDUE" },
        });
      }
    });
    overdueCount++;

    // Notify center directors
    const directors = await db.centerMembership.findMany({
      where: {
        centerId: sub.centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
      include: { user: true },
    });

    const bodyParams = JSON.stringify({
      subscriptionId: sub.id,
      centerName: sub.center.name,
      planName: sub.plan.name,
      expiresAt: sub.currentPeriodEndsAt.toISOString(),
      type: "OVERDUE",
    });

    // Idempotent notification check for this period
    const existing = await db.notification.findFirst({
      where: {
        centerId: sub.centerId,
        type: NotificationType.PAYMENT_OVERDUE,
        bodyParams: { contains: sub.id },
      },
    });

    if (!existing) {
      for (const dir of directors) {
        await db.notification.create({
          data: {
            userId: dir.userId,
            centerId: sub.centerId,
            type: NotificationType.PAYMENT_OVERDUE,
            titleKey: "subscription.overdue.title",
            bodyKey: "subscription.overdue.body",
            bodyParams,
            sentAt: now,
          },
        });
        notificationsSent++;

        if (dir.user.email) {
          await db.emailOutbox.create({
            data: {
              to: dir.user.email,
              subject: `Срок действия подписки истёк — ${sub.center.name}`,
              body: `Уважаемый руководитель! Срок действия подписки учебного центра "${sub.center.name}" истёк. Пожалуйста, продлите подписку во избежание приостановки работы.`,
            },
          });
        }
      }

      // Also notify platform superadmins
      const superadmins = await db.platformUser.findMany({
        where: { platformRole: "SUPERADMIN", deletedAt: null },
      });
      for (const sa of superadmins) {
        await db.notification.create({
          data: {
            userId: sa.id,
            centerId: sub.centerId,
            type: NotificationType.PAYMENT_OVERDUE,
            titleKey: "platform.subscription.center_overdue.title",
            bodyKey: "platform.subscription.center_overdue.body",
            bodyParams,
            sentAt: now,
          },
        });
        notificationsSent++;
      }
    }
  }

  // 2. Subscriptions past grace period -> center to PAUSED
  const graceExpired = await db.subscription.findMany({
    where: {
      status: "PAST_DUE",
      currentPeriodEndsAt: { lte: cutoffDate },
      center: {
        status: { in: ["OVERDUE", "ACTIVE"] },
      },
    },
    include: {
      center: true,
    },
  });

  for (const sub of graceExpired) {
    await db.learningCenter.update({
      where: { id: sub.centerId },
      data: { status: "PAUSED" },
    });
    pausedCount++;

    const directors = await db.centerMembership.findMany({
      where: {
        centerId: sub.centerId,
        role: "DIRECTOR",
        status: "ACTIVE",
      },
      include: { user: true },
    });

    const bodyParams = JSON.stringify({
      subscriptionId: sub.id,
      centerName: sub.center.name,
      type: "PAUSED",
    });

    const existing = await db.notification.findFirst({
      where: {
        centerId: sub.centerId,
        type: NotificationType.PAYMENT_OVERDUE,
        bodyParams: { contains: "PAUSED" },
      },
    });

    if (!existing) {
      for (const dir of directors) {
        await db.notification.create({
          data: {
            userId: dir.userId,
            centerId: sub.centerId,
            type: NotificationType.PAYMENT_OVERDUE,
            titleKey: "subscription.paused.title",
            bodyKey: "subscription.paused.body",
            bodyParams,
            sentAt: now,
          },
        });
        notificationsSent++;

        if (dir.user.email) {
          await db.emailOutbox.create({
            data: {
              to: dir.user.email,
              subject: `Работа центра приостановлена — ${sub.center.name}`,
              body: `Работа центра "${sub.center.name}" временно приостановлена из-за окончания льготного периода неоплаты. Для восстановления доступа обратитесь в поддержку.`,
            },
          });
        }
      }
    }
  }

  // 3. Pre-expiry notifications: 7, 3, 1 days and 0 days
  const activeSubs = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      currentPeriodEndsAt: { gt: now },
    },
    include: {
      center: true,
      plan: true,
    },
  });

  const milestones = [7, 3, 1, 0];

  for (const sub of activeSubs) {
    const diffMs = sub.currentPeriodEndsAt.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (milestones.includes(diffDays)) {
      const milestoneKey = `milestone_${diffDays}_sub_${sub.id}_ends_${sub.currentPeriodEndsAt.toISOString().slice(0, 10)}`;

      const alreadySent = await db.notification.findFirst({
        where: {
          centerId: sub.centerId,
          type: NotificationType.SUBSCRIPTION_EXPIRING,
          bodyParams: { contains: milestoneKey },
        },
      });

      if (!alreadySent) {
        const bodyParams = JSON.stringify({
          milestoneKey,
          daysLeft: diffDays,
          subscriptionId: sub.id,
          centerName: sub.center.name,
          planName: sub.plan.name,
          expiresAt: sub.currentPeriodEndsAt.toISOString(),
        });

        const directors = await db.centerMembership.findMany({
          where: {
            centerId: sub.centerId,
            role: "DIRECTOR",
            status: "ACTIVE",
          },
          include: { user: true },
        });

        for (const dir of directors) {
          await db.notification.create({
            data: {
              userId: dir.userId,
              centerId: sub.centerId,
              type: NotificationType.SUBSCRIPTION_EXPIRING,
              titleKey: "subscription.expiring.title",
              bodyKey: "subscription.expiring.body",
              bodyParams,
              sentAt: now,
            },
          });
          notificationsSent++;

          if (dir.user.email) {
            await db.emailOutbox.create({
              data: {
                to: dir.user.email,
                subject: `Напоминание: подписка истекает через ${diffDays} дн. — ${sub.center.name}`,
                body: `Подписка на тариф "${sub.plan.name}" для центра "${sub.center.name}" истекает через ${diffDays} дн. Пожалуйста, заблаговременно произведите оплату.`,
              },
            });
          }
        }
      }
    }
  }

  return {
    overdueCount,
    pausedCount,
    notificationsSent,
  };
}
