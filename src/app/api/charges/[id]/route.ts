import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const patchChargeSchema = z
  .object({
    action: z.literal("CANCEL"),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();

export async function PATCH(
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
    if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden" },
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

    const parsed = patchChargeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные параметры", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const charge = await tenantDb.charge.findFirst({
      where: { id: params.id },
    });
    if (!charge) {
      return NextResponse.json(
        { error: "Счёт не найден" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }
    if (charge.paidAmount > 0 || charge.status === "PAID" || charge.status === "REFUNDED") {
      return NextResponse.json(
        { error: "Нельзя отменить уже оплаченный или частично оплаченный счёт — оформите возврат" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (charge.status === "CANCELLED") {
      return NextResponse.json({ success: true, charge }, { headers: NO_STORE_HEADERS });
    }

    await tenantDb.charge.updateMany({
      where: { id: charge.id, paidAmount: 0 },
      data: { status: "CANCELLED" },
    });

    const updated = await tenantDb.charge.findFirst({ where: { id: charge.id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "CHARGE_CANCELLED",
      resource: "Charge",
      resourceId: charge.id,
      details: {
        invoiceNumber: charge.invoiceNumber,
        reason: parsed.data.reason ?? null,
      },
    });

    return NextResponse.json({ success: true, charge: updated }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка обновления счёта" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
