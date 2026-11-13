import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { calculatePlatformMRR } from "@/lib/platform-finance";
import { isEmailConfigured } from "@/lib/email";

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.dashboard", req);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "30d";

    const now = new Date();
    let periodDays = 30;
    if (period === "7d") periodDays = 7;
    else if (period === "90d") periodDays = 90;
    else if (period === "year") periodDays = 365;

    const periodStart = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

    // ==========================================
    // BLOCK 1: FINANCES
    // ==========================================
    const [
      mrrStats,
      currentMonthPayments,
      prevMonthPayments,
      currentMonthExpenses,
      currentMonthReversals,
      upcomingSubs,
      overduePayments,
    ] = await Promise.all([
      calculatePlatformMRR(),
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfMonth }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformPayment.aggregate({
        where: { paidAt: { gte: startOfPrevMonth, lte: endOfPrevMonth }, status: { in: ["PAID", "REFUNDED"] } },
        _sum: { amount: true, refundAmount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfMonth }, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { date: { gte: startOfMonth }, isReversal: true },
        _sum: { amount: true },
      }),
      db.subscription.findMany({
        where: {
          currentPeriodEndsAt: { gte: now, lte: in7Days },
          status: { in: ["ACTIVE", "TRIAL"] },
        },
        include: {
          center: { select: { id: true, name: true, slug: true } },
          plan: { select: { priceMonthly: true, name: true } },
        },
        take: 10,
      }),
      db.platformPayment.findMany({
        where: {
          status: "PENDING",
          periodEndsAt: { lt: now },
        },
        include: {
          center: { select: { id: true, name: true, slug: true } },
        },
      }),
    ]);

    const currentMonthNetRevenue =
      (currentMonthPayments._sum.amount || 0) - (currentMonthPayments._sum.refundAmount || 0);
    const prevMonthNetRevenue =
      (prevMonthPayments._sum.amount || 0) - (prevMonthPayments._sum.refundAmount || 0);

    const deltaPercent =
      prevMonthNetRevenue > 0
        ? Math.round(((currentMonthNetRevenue - prevMonthNetRevenue) / prevMonthNetRevenue) * 100)
        : currentMonthNetRevenue > 0
        ? 100
        : 0;

    const monthExpenses =
      (currentMonthExpenses._sum.amount || 0) - (currentMonthReversals._sum.amount || 0);
    const monthProfit = currentMonthNetRevenue - monthExpenses;

    const dueNext7DaysAmount = upcomingSubs.reduce((acc, s) => acc + (s.plan.priceMonthly || 0), 0);
    const overdueAmount = overduePayments.reduce((acc, p) => acc + p.amount, 0);

    const finance = {
      mrr: mrrStats.mrr,
      arr: mrrStats.arr,
      arpu: mrrStats.arpu,
      currentMonthNetRevenue,
      prevMonthNetRevenue,
      deltaPercent,
      monthExpenses,
      monthProfit,
      dueNext7Days: {
        amount: dueNext7DaysAmount,
        centersCount: upcomingSubs.length,
        items: upcomingSubs.map((s) => ({
          centerId: s.center.id,
          centerName: s.center.name,
          slug: s.center.slug,
          planName: s.plan.name,
          amount: s.plan.priceMonthly,
          endsAt: s.currentPeriodEndsAt,
        })),
      },
      overdueDebtors: {
        amount: overdueAmount,
        centersCount: new Set(overduePayments.map((p) => p.centerId)).size,
        items: overduePayments.slice(0, 10).map((p) => ({
          id: p.id,
          centerId: p.centerId,
          centerName: p.center?.name || "—",
          amount: p.amount,
          periodEndsAt: p.periodEndsAt,
        })),
      },
    };

    // ==========================================
    // BLOCK 2: GROWTH & TIMELINE & FUNNEL
    // ==========================================
    const [periodUsers, periodCenters, totalPaidCenters, cancelledSubs, totalSubs] = await Promise.all([
      db.platformUser.findMany({
        where: { createdAt: { gte: periodStart } },
        select: { createdAt: true },
      }),
      db.learningCenter.findMany({
        where: { createdAt: { gte: periodStart } },
        select: { id: true, createdAt: true, status: true },
      }),
      db.platformPayment.findMany({
        where: { status: "PAID" },
        distinct: ["centerId"],
        select: { centerId: true },
      }),
      db.subscription.count({
        where: { status: "CANCELLED", updatedAt: { gte: periodStart } },
      }),
      db.subscription.count(),
    ]);

    // Aggregate registrations day-by-day
    const timelineMap: Record<string, { date: string; users: number; centers: number }> = {};
    for (let i = 0; i < periodDays; i++) {
      const d = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      timelineMap[key] = { date: key, users: 0, centers: 0 };
    }

    periodUsers.forEach((u) => {
      const key = u.createdAt.toISOString().slice(0, 10);
      if (timelineMap[key]) timelineMap[key].users++;
    });

    periodCenters.forEach((c) => {
      const key = c.createdAt.toISOString().slice(0, 10);
      if (timelineMap[key]) timelineMap[key].centers++;
    });

    const timeline = Object.values(timelineMap);

    const paidCenterIds = new Set(totalPaidCenters.map((p) => p.centerId));
    const paidCentersInPeriod = periodCenters.filter((c) => paidCenterIds.has(c.id)).length;
    const funnelConversion =
      periodCenters.length > 0 ? Math.round((paidCentersInPeriod / periodCenters.length) * 100) : 0;

    const churnRate = totalSubs > 0 ? Number(((cancelledSubs / totalSubs) * 100).toFixed(1)) : 0;

    const growth = {
      timeline,
      funnel: {
        centersCreated: periodCenters.length,
        trials: periodCenters.filter((c) => c.status === "TRIAL").length,
        paid: paidCentersInPeriod,
        conversionPercent: funnelConversion,
      },
      churnRate,
    };

    // ==========================================
    // BLOCK 3: PLATFORM IN NUMBERS
    // ==========================================
    const [
      totalCenters,
      activeCenters,
      trialCenters,
      pausedCenters,
      blockedCenters,
      hybridCenters,
      onlineCenters,
      offlineCenters,
      learningCenterCount,
      schoolCount,
      kindergartenCount,
      otherKindCount,
      activeStudents,
      activeTeachers,
      activeParents,
      activeDirectors,
      totalUsersCount,
      active7DaysUsers,
      active30DaysUsers,
      topCentersByStudents,
    ] = await Promise.all([
      db.learningCenter.count(),
      db.learningCenter.count({ where: { status: "ACTIVE" } }),
      db.learningCenter.count({ where: { status: "TRIAL" } }),
      db.learningCenter.count({ where: { status: "PAUSED" } }),
      db.learningCenter.count({ where: { status: "BLOCKED" } }),
      db.learningCenter.count({ where: { centerType: "HYBRID" } }),
      db.learningCenter.count({ where: { centerType: "ONLINE" } }),
      db.learningCenter.count({ where: { centerType: "OFFLINE" } }),
      db.learningCenter.count({ where: { organizationKind: "LEARNING_CENTER" } }),
      db.learningCenter.count({ where: { organizationKind: "SCHOOL" } }),
      db.learningCenter.count({ where: { organizationKind: "KINDERGARTEN" } }),
      db.learningCenter.count({ where: { organizationKind: "OTHER" } }),
      db.centerMembership.count({ where: { role: "STUDENT", status: "ACTIVE" } }),
      db.centerMembership.count({ where: { role: "TEACHER", status: "ACTIVE" } }),
      db.centerMembership.count({ where: { role: "PARENT", status: "ACTIVE" } }),
      db.centerMembership.count({ where: { role: "DIRECTOR", status: "ACTIVE" } }),
      db.platformUser.count({ where: { deletedAt: null } }),
      db.platformUser.count({ where: { lastLoginAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } }),
      db.platformUser.count({ where: { lastLoginAt: { gte: thirtyDaysAgo } } }),
      db.learningCenter.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          _count: {
            select: {
              memberships: { where: { role: "STUDENT", status: "ACTIVE" } },
            },
          },
        },
        orderBy: {
          memberships: {
            _count: "desc",
          },
        },
        take: 5,
      }),
    ]);

    const numbers = {
      centers: {
        total: totalCenters,
        active: activeCenters,
        trial: trialCenters,
        paused: pausedCenters,
        blocked: blockedCenters,
        byType: {
          HYBRID: hybridCenters,
          ONLINE: onlineCenters,
          OFFLINE: offlineCenters,
        },
        byKind: {
          LEARNING_CENTER: learningCenterCount,
          SCHOOL: schoolCount,
          KINDERGARTEN: kindergartenCount,
          OTHER: otherKindCount,
        },
      },
      users: {
        total: totalUsersCount,
        students: activeStudents,
        teachers: activeTeachers,
        parents: activeParents,
        directors: activeDirectors,
        activeLast7Days: active7DaysUsers,
        activeLast30Days: active30DaysUsers,
      },
      topCenters: topCentersByStudents.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        status: c.status,
        studentsCount: c._count.memberships,
      })),
    };

    // ==========================================
    // BLOCK 4: ATTENTION REQUIRED
    // ==========================================
    // 1. Centers approaching student capacity (>= 90%)
    const activeSubsWithLimits = await db.subscription.findMany({
      where: { status: { in: ["ACTIVE", "TRIAL"] } },
      include: {
        plan: { select: { maxStudents: true, name: true } },
        center: {
          select: {
            id: true,
            name: true,
            slug: true,
            _count: { select: { memberships: { where: { role: "STUDENT", status: "ACTIVE" } } } },
          },
        },
      },
    });

    const nearCapacityCenters = activeSubsWithLimits
      .filter((s) => {
        const max = s.plan.maxStudents;
        if (!max || max <= 0) return false;
        const current = s.center._count.memberships;
        return current / max >= 0.9;
      })
      .map((s) => ({
        centerId: s.center.id,
        name: s.center.name,
        slug: s.center.slug,
        current: s.center._count.memberships,
        max: s.plan.maxStudents,
        percent: Math.round((s.center._count.memberships / s.plan.maxStudents) * 100),
      }));

    // 2. Open support tickets unanswered > 24 hours
    const oldOpenTickets = await db.supportTicket.findMany({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        createdAt: { lte: twentyFourHoursAgo },
      },
      include: {
        center: { select: { name: true } },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: {
            sender: { select: { platformRole: true } },
          },
        },
      },
    });

    const unansweredTickets = oldOpenTickets.filter((t) => {
      const last = t.messages[0];
      if (!last) return true;
      const isStaff = last.isInternal || Boolean(last.sender?.platformRole);
      return !isStaff && last.createdAt <= twentyFourHoursAgo;
    });

    // 3. Failed email outbox in last 24 hours
    const failedEmailsCount = await db.emailOutbox.count({
      where: {
        status: "FAILED",
        updatedAt: { gte: twentyFourHoursAgo },
      },
    });

    // 4. Failed login attempts spike in last 15 min
    const failedLoginsCount = await db.auditLog.count({
      where: {
        action: "LOGIN_FAILED",
        createdAt: { gte: fifteenMinutesAgo },
      },
    });

    // 5. Centers inactive for 14+ days
    const inactiveCenters = await db.learningCenter.findMany({
      where: {
        status: "ACTIVE",
        updatedAt: { lte: fourteenDaysAgo },
      },
      select: { id: true, name: true, slug: true, updatedAt: true },
      take: 5,
    });

    // 6. Overdue debtors > 3 days
    const severeDebtors = overduePayments.filter(
      (p) => p.periodEndsAt && new Date(p.periodEndsAt) <= threeDaysAgo
    );

    const attentionItems = [
      ...(upcomingSubs.length > 0
        ? [
            {
              id: "expiring-subs",
              level: "WARNING",
              title: `Подписки истекают в ближайшие 7 дней (${upcomingSubs.length})`,
              description: `У ${upcomingSubs.length} центров заканчивается срок подписки`,
              actionUrl: "/platform-admin/subscriptions",
              actionLabel: "Подписки",
            },
          ]
        : []),
      ...(severeDebtors.length > 0
        ? [
            {
              id: "severe-debtors",
              level: "CRITICAL",
              title: `Просроченная дебиторка более 3 дней (${severeDebtors.length})`,
              description: `Неоплаченные счета на общую сумму ${severeDebtors.reduce((a, b) => a + b.amount, 0).toLocaleString()} UZS`,
              actionUrl: "/platform-admin/finance",
              actionLabel: "Финансы",
            },
          ]
        : []),
      ...(nearCapacityCenters.length > 0
        ? [
            {
              id: "near-capacity",
              level: "INFO",
              title: `Центры на пределе лимита учеников 90%+ (${nearCapacityCenters.length})`,
              description: `${nearCapacityCenters.map((c) => `${c.name} (${c.percent}%)`).join(", ")}`,
              actionUrl: "/platform-admin/centers",
              actionLabel: "Центры",
            },
          ]
        : []),
      ...(unansweredTickets.length > 0
        ? [
            {
              id: "unanswered-tickets",
              level: "WARNING",
              title: `Тикеты поддержки без ответа более 24 часов (${unansweredTickets.length})`,
              description: "Пользователи ожидают ответа службы поддержки платформы",
              actionUrl: "/platform-admin/support",
              actionLabel: "Поддержка",
            },
          ]
        : []),
      ...(failedEmailsCount > 0
        ? [
            {
              id: "failed-emails",
              level: "CRITICAL",
              title: `Ошибки отправки Email за 24ч (${failedEmailsCount})`,
              description: "Обнаружены неотправленные системные уведомления в очереди",
              actionUrl: "/platform-admin/system-health",
              actionLabel: "Состояние системы",
            },
          ]
        : []),
      ...(failedLoginsCount >= 5
        ? [
            {
              id: "login-spike",
              level: "CRITICAL",
              title: `Всплеск неудачных попыток входа (${failedLoginsCount} за 15 мин)`,
              description: "Возможна попытка подбора паролей или DDoS на шлюз авторизации",
              actionUrl: "/platform-admin/audit",
              actionLabel: "Аудит",
            },
          ]
        : []),
      ...(!isEmailConfigured()
        ? [
            {
              id: "email-unconfigured",
              level: "CRITICAL",
              title: "Почтовый шлюз платформы не настроен",
              description: "Письма отправляются в память и не доходят до адресатов",
              actionUrl: "/platform-admin/system-health",
              actionLabel: "Настройки",
            },
          ]
        : []),
      ...(inactiveCenters.length > 0
        ? [
            {
              id: "inactive-centers",
              level: "INFO",
              title: `Центры без активности более 14 дней (${inactiveCenters.length})`,
              description: inactiveCenters.map((c) => c.name).join(", "),
              actionUrl: "/platform-admin/centers",
              actionLabel: "Центры",
            },
          ]
        : []),
    ];

    // ==========================================
    // BLOCK 5: EVENT FEED (AUDIT LOGS)
    // ==========================================
    const recentEvents = await db.auditLog.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, fullName: true, email: true, platformRole: true } },
        center: { select: { id: true, name: true, slug: true } },
      },
    });

    const events = recentEvents.map((e) => ({
      id: e.id,
      action: e.action,
      resource: e.resource,
      resourceId: e.resourceId,
      actorName: e.actor?.fullName || e.actor?.email || "Система",
      centerName: e.center?.name || null,
      ipAddress: e.ipAddress,
      createdAt: e.createdAt,
    }));

    // ==========================================
    // BLOCK 6: SYSTEM HEALTH
    // ==========================================
    const pingStart = performance.now();
    await db.$queryRaw`SELECT 1`;
    const pingEnd = performance.now();
    const dbPingMs = Math.round(pingEnd - pingStart);

    const [queuePending, queueFailed, queueSent] = await Promise.all([
      db.emailOutbox.count({ where: { status: "PENDING" } }),
      db.emailOutbox.count({ where: { status: "FAILED" } }),
      db.emailOutbox.count({ where: { status: "SENT" } }),
    ]);

    const health = {
      dbStatus: dbPingMs < 200 ? "HEALTHY" : "DEGRADED",
      dbPingMs,
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
      environment: process.env.NODE_ENV || "development",
      isEmailConfigured: isEmailConfigured(),
      emailProvider: (process.env.EMAIL_PROVIDER || "memory").toLowerCase(),
      queue: {
        pending: queuePending,
        failed: queueFailed,
        sent: queueSent,
      },
    };

    return NextResponse.json({
      success: true,
      period,
      finance,
      growth,
      numbers,
      attentionItems,
      events,
      health,
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
