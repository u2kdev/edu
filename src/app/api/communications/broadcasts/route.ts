import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import { executeBroadcast, previewBroadcast } from "@/lib/broadcasts";
import {
  getCenterPlanFeatures,
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const broadcastActionSchema = z
  .object({
    action: z.enum(["preview", "send", "schedule"]).default("send"),
    title: z.string().trim().max(200).optional().default(""),
    bodyRu: z.string().trim().min(1, "Текст на русском обязателен").max(4000),
    bodyUz: z.string().trim().max(4000).optional().nullable(),
    channel: z.enum(["IN_APP", "EMAIL", "SMS", "PUSH", "TELEGRAM"]),
    audience: z.enum(["ALL", "DEBTORS", "OVERDUE", "GROUP", "ROLE"]),
    targetGroupId: z.string().uuid().optional().nullable(),
    targetRole: z
      .enum([
        "DIRECTOR",
        "CENTER_ADMIN",
        "ACCOUNTANT",
        "TEACHER",
        "TEACHER_ASSISTANT",
        "CENTER_SUPPORT",
        "STUDENT",
        "PARENT",
      ])
      .optional()
      .nullable(),
    scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
    confirmed: z.boolean().optional().default(false),
  })
  .strict();

function canReadBroadcasts(tenantCtx: Awaited<ReturnType<typeof requireTenantAccess>>): boolean {
  if (tenantCtx.isPlatformStaff || tenantCtx.isImpersonating) return true;
  return (
    hasPermission("announcements.manage", tenantCtx.session.user.platformRole, tenantCtx.role) ||
    hasPermission("settings.manage", tenantCtx.session.user.platformRole, tenantCtx.role)
  );
}

function canWriteBroadcasts(tenantCtx: Awaited<ReturnType<typeof requireTenantAccess>>): boolean {
  if (
    tenantCtx.isImpersonating ||
    tenantCtx.session.impersonatorUserId ||
    tenantCtx.session.user.platformRole === "PLATFORM_SUPPORT"
  ) {
    return false;
  }
  return hasPermission("announcements.manage", "NONE", tenantCtx.role);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canReadBroadcasts(tenantCtx)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") || "15", 10) || 15));
    const status = searchParams.get("status")?.trim();
    const channel = searchParams.get("channel")?.trim();
    const search = searchParams.get("search")?.trim();

    const where: Record<string, unknown> = {
      centerId: tenantCtx.center.id,
    };
    if (status && ["DRAFT", "SCHEDULED", "SENDING", "COMPLETED", "FAILED"].includes(status)) {
      where.status = status;
    }
    if (channel && ["IN_APP", "EMAIL", "SMS", "PUSH", "TELEGRAM"].includes(channel)) {
      where.channel = channel;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { bodyRu: { contains: search, mode: "insensitive" } },
        { bodyUz: { contains: search, mode: "insensitive" } },
      ];
    }

    const tenantDb = tenantCtx.getTenantDb();
    const [total, broadcasts, groups, planCtx] = await Promise.all([
      tenantDb.broadcast.count({ where }),
      tenantDb.broadcast.findMany({
        where,
        include: {
          createdBy: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tenantDb.group.findMany({
        where: { course: { centerId: tenantCtx.center.id } },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
      getCenterPlanFeatures(tenantCtx.center.id),
    ]);

    return NextResponse.json(
      {
        broadcasts,
        groups,
        planFeatures: planCtx.features,
        planName: planCtx.planName,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки рассылок" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canWriteBroadcasts(tenantCtx)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    await requirePlanFeature(tenantCtx.center.id, "broadcasts");

    const rlKey = getClientRateLimitKey(req, `comm_broadcast_${tenantCtx.session.user.id}`);
    const allowed = await checkRateLimit(rlKey, 30, 60_000, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов на рассылку. Попробуйте позже." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = broadcastActionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные параметры рассылки", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    if (body.channel === "SMS") {
      await requirePlanFeature(tenantCtx.center.id, "smsReminders");
    }

    const tenantDb = tenantCtx.getTenantDb();

    if (body.audience === "GROUP") {
      if (!body.targetGroupId) {
        return NextResponse.json(
          { error: "Для аудитории GROUP необходимо указать группу" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const group = await tenantDb.group.findFirst({
        where: {
          id: body.targetGroupId,
          course: { centerId: tenantCtx.center.id },
        },
        select: { id: true },
      });
      if (!group) {
        return NextResponse.json(
          { error: "Группа не найдена в данном центре" },
          { status: 404, headers: NO_STORE_HEADERS }
        );
      }
    }

    if (body.audience === "ROLE" && !body.targetRole) {
      return NextResponse.json(
        { error: "Для аудитории ROLE необходимо указать роль" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const preview = await previewBroadcast({
      centerId: tenantCtx.center.id,
      audience: body.audience,
      targetGroupId: body.audience === "GROUP" ? body.targetGroupId : null,
      targetRole: body.audience === "ROLE" ? body.targetRole : null,
      channel: body.channel,
      bodyRu: body.bodyRu,
      bodyUz: body.bodyUz ?? null,
    });

    if (body.action === "preview") {
      return NextResponse.json({ success: true, preview }, { headers: NO_STORE_HEADERS });
    }

    if (!body.title.trim()) {
      return NextResponse.json(
        { error: "Заголовок рассылки обязателен" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (body.action === "send" && !body.confirmed) {
      return NextResponse.json(
        {
          error: "Подтвердите массовую отправку (confirmed: true)",
          preview,
        },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (body.action === "schedule") {
      if (!body.scheduledAt) {
        return NextResponse.json(
          { error: "Укажите время запланированной отправки (scheduledAt)" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
      const scheduledDate = new Date(body.scheduledAt);
      if (Number.isNaN(scheduledDate.getTime())) {
        return NextResponse.json(
          { error: "Некорректная дата scheduledAt" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }

      const scheduled = await tenantDb.broadcast.create({
        data: {
          centerId: tenantCtx.center.id,
          createdByUserId: tenantCtx.session.user.id,
          title: body.title.trim(),
          bodyRu: body.bodyRu,
          bodyUz: body.bodyUz ?? null,
          channel: body.channel,
          audience: body.audience,
          targetGroupId: body.audience === "GROUP" ? body.targetGroupId : null,
          targetRole: body.audience === "ROLE" ? body.targetRole : null,
          status: "SCHEDULED",
          scheduledAt: scheduledDate,
          totalRecipients: preview.totalRecipients,
          estimatedCost: preview.estimatedCostUzs,
        },
        include: {
          createdBy: { select: { id: true, fullName: true } },
          group: { select: { id: true, name: true } },
        },
      });

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "BROADCAST_SCHEDULED",
        resource: "Broadcast",
        resourceId: scheduled.id,
        details: {
          channel: body.channel,
          audience: body.audience,
          totalRecipients: preview.totalRecipients,
          scheduledAt: scheduledDate.toISOString(),
        },
      });

      return NextResponse.json(
        { success: true, broadcast: scheduled, preview },
        { status: 201, headers: NO_STORE_HEADERS }
      );
    }

    // Immediate execution
    const created = await tenantDb.broadcast.create({
      data: {
        centerId: tenantCtx.center.id,
        createdByUserId: tenantCtx.session.user.id,
        title: body.title.trim(),
        bodyRu: body.bodyRu,
        bodyUz: body.bodyUz ?? null,
        channel: body.channel,
        audience: body.audience,
        targetGroupId: body.audience === "GROUP" ? body.targetGroupId : null,
        targetRole: body.audience === "ROLE" ? body.targetRole : null,
        status: "DRAFT",
        totalRecipients: preview.totalRecipients,
        estimatedCost: preview.estimatedCostUzs,
      },
    });

    const summary = await executeBroadcast(created.id);
    const updated = await tenantDb.broadcast.findFirst({
      where: { id: created.id },
      include: {
        createdBy: { select: { id: true, fullName: true } },
        group: { select: { id: true, name: true } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BROADCAST_SENT",
      resource: "Broadcast",
      resourceId: created.id,
      details: {
        channel: body.channel,
        audience: body.audience,
        totalRecipients: summary.totalRecipients,
        sentCount: summary.sentCount,
        failedCount: summary.failedCount,
      },
    });

    return NextResponse.json(
      { success: true, broadcast: updated, summary, preview },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка отправки рассылки" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
