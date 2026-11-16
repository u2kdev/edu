import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: SubscriptionPlan and platform SupportTicket rows are global models queried with explicit centerId scoping.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { checkRateLimit, getClientRateLimitKey } from "@/lib/rate-limit";
import { getCenterPlanFeatures, parsePlanFeatures } from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const upgradeRequestSchema = z
  .object({
    requestedPlanId: z.string().trim().min(1).max(120),
    comment: z.string().trim().max(1000).optional().nullable(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (
      !tenantCtx.isPlatformStaff &&
      !["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"].includes(tenantCtx.role)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const [currentPlan, plans, requests] = await Promise.all([
      getCenterPlanFeatures(tenantCtx.center.id),
      db.subscriptionPlan.findMany({
        where: { isActive: true },
        orderBy: { priceMonthly: "asc" },
      }),
      db.supportTicket.findMany({
        where: {
          centerId: tenantCtx.center.id,
          scope: "PLATFORM",
          subject: { startsWith: "Запрос на смену тарифа" },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          subject: true,
          status: true,
          priority: true,
          createdAt: true,
        },
      }),
    ]);

    return NextResponse.json(
      {
        currentPlan,
        plans: plans.map((p) => ({
          id: p.id,
          name: p.name,
          priceMonthly: p.priceMonthly,
          maxStudents: p.maxStudents,
          maxTeachers: p.maxTeachers,
          maxCourses: p.maxCourses,
          maxBranches: p.maxBranches,
          maxStorage: p.maxStorage,
          features: parsePlanFeatures(p.featuresJson),
        })),
        requests,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки тарифов" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (
      tenantCtx.isImpersonating ||
      tenantCtx.session.impersonatorUserId ||
      tenantCtx.session.user.platformRole === "PLATFORM_SUPPORT"
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: NO_STORE_HEADERS });
    }

    if (!["DIRECTOR", "CENTER_ADMIN"].includes(tenantCtx.role)) {
      return NextResponse.json(
        { error: "Forbidden: Только директор или администратор центра может запрашивать смену тарифа" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const rlKey = getClientRateLimitKey(req, `upgrade_req_${tenantCtx.center.id}`);
    const allowed = await checkRateLimit(rlKey, 5, 10 * 60_000, true);
    if (!allowed) {
      return NextResponse.json(
        { error: "Слишком много запросов на смену тарифа. Попробуйте позже." },
        { status: 429, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json({ error: "Некорректный JSON" }, { status: 400, headers: NO_STORE_HEADERS });
    }

    const parsed = upgradeRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные запроса", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const requestedPlan = await db.subscriptionPlan.findFirst({
      where: { id: parsed.data.requestedPlanId, isActive: true },
    });
    if (!requestedPlan) {
      return NextResponse.json(
        { error: "Выбранный тариф не найден или неактивен" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const currentPlan = await getCenterPlanFeatures(tenantCtx.center.id);
    const subject = `Запрос на смену тарифа: ${requestedPlan.name}`;
    const commentPart = parsed.data.comment?.trim()
      ? `\nКомментарий: ${parsed.data.comment.trim()}`
      : "";
    const message =
      `Центр: ${tenantCtx.center.name} (${tenantCtx.center.id})\n` +
      `Текущий тариф: ${currentPlan.planName || "Не назначен"}\n` +
      `Запрашиваемый тариф: ${requestedPlan.name} (${Math.round(requestedPlan.priceMonthly).toLocaleString("ru-RU")} UZS/мес)` +
      commentPart;

    const ticket = await db.supportTicket.create({
      data: {
        centerId: tenantCtx.center.id,
        creatorUserId: tenantCtx.session.user.id,
        subject,
        priority: "HIGH",
        scope: "PLATFORM",
        status: "OPEN",
        messages: {
          create: {
            senderUserId: tenantCtx.session.user.id,
            message,
            isInternal: false,
          },
        },
      },
      select: {
        id: true,
        subject: true,
        status: true,
        priority: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "PLAN_UPGRADE_REQUESTED",
      resource: "SupportTicket",
      resourceId: ticket.id,
      details: {
        currentPlanId: currentPlan.planId,
        currentPlanName: currentPlan.planName,
        requestedPlanId: requestedPlan.id,
        requestedPlanName: requestedPlan.name,
      },
    });

    return NextResponse.json(
      {
        success: true,
        ticket,
        requestedPlan: {
          id: requestedPlan.id,
          name: requestedPlan.name,
          priceMonthly: requestedPlan.priceMonthly,
        },
      },
      { status: 201, headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка отправки заявки на смену тарифа" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
