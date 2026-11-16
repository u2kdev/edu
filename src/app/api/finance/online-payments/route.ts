import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  getCenterMerchantConfigSummary,
  reconcileStaleClickIntents,
} from "@/lib/click";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const actionSchema = z
  .object({
    action: z.enum(["reconcile", "mark_failed"]),
    intentId: z.string().uuid().optional(),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isPlatformStaff ||
      hasPermission("finance.read", tenantCtx.session.user.platformRole, tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status")?.trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10) || 25));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (
      statusFilter &&
      ["CREATED", "PREPARED", "CONFIRMED", "CANCELLED", "EXPIRED", "FAILED"].includes(statusFilter)
    ) {
      where.status = statusFilter;
    }

    const [intents, total, events, merchantConfig, manualRefunds] = await Promise.all([
      tenantDb.paymentIntent.findMany({
        where,
        include: {
          student: { include: { user: { select: { fullName: true, phone: true } } } },
          group: { select: { id: true, name: true } },
          centerPayment: { select: { id: true, receiptNumber: true, status: true, paidAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      tenantDb.paymentIntent.count({ where }),
      tenantDb.paymentWebhookEvent.findMany({
        where: { centerId: tenantCtx.center.id },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
      getCenterMerchantConfigSummary(tenantCtx.center.id),
      tenantDb.centerPayment.findMany({
        where: {
          centerId: tenantCtx.center.id,
          paymentMethod: "ONLINE",
          manualRefundStatus: { in: ["PENDING_MANUAL", "COMPLETED"] },
          deletedAt: null,
        },
        select: {
          id: true,
          receiptNumber: true,
          amount: true,
          refundedAmount: true,
          refundedAt: true,
          manualRefundStatus: true,
          manualRefundNote: true,
          manualRefundCompletedAt: true,
          student: { include: { user: { select: { fullName: true, phone: true } } } },
          group: { select: { id: true, name: true } },
        },
        orderBy: [{ manualRefundStatus: "asc" }, { refundedAt: "desc" }],
        take: 50,
      }),
    ]);

    const pendingManualRefundsCount = manualRefunds.filter(
      (r: { manualRefundStatus: string }) => r.manualRefundStatus === "PENDING_MANUAL"
    ).length;

    return NextResponse.json(
      {
        intents,
        events,
        merchantConfig,
        manualRefunds,
        pendingManualRefundsCount,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки онлайн-платежей" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    if (tenantCtx.isImpersonating) {
      return NextResponse.json(
        { error: "Forbidden: Impersonation sessions are read-only" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Только директор может запускать сверку онлайн-платежей" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = actionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные параметры действия", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    if (parsed.data.action === "reconcile") {
      const summary = await reconcileStaleClickIntents(tenantCtx.center.id);
      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "CLICK_INTENTS_RECONCILED",
        resource: "PaymentIntent",
        details: summary,
      });
      return NextResponse.json({ success: true, summary }, { headers: NO_STORE_HEADERS });
    }

    if (!parsed.data.intentId) {
      return NextResponse.json(
        { error: "Укажите intentId" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const existing = await tenantDb.paymentIntent.findFirst({
      where: { id: parsed.data.intentId },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Заявка на оплату не найдена" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }
    if (existing.status === "CONFIRMED") {
      return NextResponse.json(
        { error: "Оплаченную заявку нельзя перевести в FAILED" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    await tenantDb.paymentIntent.updateMany({
      where: { id: existing.id, status: { not: "CONFIRMED" } },
      data: {
        status: "FAILED",
        errorNote: parsed.data.reason || "Marked FAILED manually by Director",
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "CLICK_INTENT_MARKED_FAILED",
      resource: "PaymentIntent",
      resourceId: existing.id,
      details: { reason: parsed.data.reason || "Manual review" },
    });

    return NextResponse.json({ success: true }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка сверки онлайн-платежей" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
