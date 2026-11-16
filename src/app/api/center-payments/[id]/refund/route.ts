import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, refundBillingPayment } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const refundSchema = z
  .object({
    amount: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);

    if (tenantCtx.isImpersonating) {
      return NextResponse.json(
        { error: "Forbidden: Impersonation sessions are read-only" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (!tenantCtx.session.user.emailVerified) {
      return NextResponse.json(
        { error: "Email confirmation required for sensitive actions" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.refund", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Нет прав на оформление возврата" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown = {};
    try {
      const text = await req.text();
      if (text.trim()) {
        rawBody = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON в запросе" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = refundSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные параметры возврата", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const updatedPayment = await refundBillingPayment({
      centerId: tenantCtx.center.id,
      paymentId: params.id,
      refundAmount: parsed.data.amount,
      reason: parsed.data.reason?.trim() || "Возврат оплаты",
      actorUserId: tenantCtx.session.user.id,
    });

    const isFullRefund = updatedPayment.status === "REFUNDED";
    const refundAmount = parsed.data.amount ?? updatedPayment.refundedAmount;

    return NextResponse.json(
      {
        success: true,
        payment: updatedPayment,
        refundAmount,
        isFullRefund,
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка возврата оплаты" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
