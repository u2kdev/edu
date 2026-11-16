import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, completeManualOnlineRefund } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const completeSchema = z
  .object({
    note: z.string().trim().min(3, "Укажите причину/комментарий подтверждения").max(500),
    completedAt: z.string().trim().optional(),
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
        { error: "Forbidden: Нет прав на подтверждение возврата" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON в запросе" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = completeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные параметры подтверждения", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    let completedAtDate: Date | undefined;
    if (parsed.data.completedAt) {
      completedAtDate = new Date(parsed.data.completedAt);
      if (Number.isNaN(completedAtDate.getTime())) {
        return NextResponse.json(
          { error: "Некорректная дата выполнения возврата" },
          { status: 400, headers: NO_STORE_HEADERS }
        );
      }
    }

    const updatedPayment = await completeManualOnlineRefund({
      centerId: tenantCtx.center.id,
      paymentId: params.id,
      note: parsed.data.note,
      completedAt: completedAtDate,
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        payment: updatedPayment,
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
      { error: error?.status ? error.message : "Ошибка подтверждения возврата Click" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
