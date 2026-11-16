import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  requirePlanFeature,
  PlanFeatureLockedError,
  formatPlanFeatureLockedPayload,
} from "@/lib/plan-features";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const patchPromoSchema = z
  .object({
    isActive: z.boolean().optional(),
    validUntil: z.string().datetime().nullable().optional(),
    maxUses: z.coerce.number().int().positive().nullable().optional(),
    value: z.coerce.number().int().positive().optional(),
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

    await requirePlanFeature(tenantCtx.center.id, "promoCodes");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = patchPromoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные обновления промокода", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const existing = await tenantDb.promoCode.findFirst({
      where: { id: params.id },
    });
    if (!existing) {
      return NextResponse.json(
        { error: "Промокод не найден" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    if (body.value !== undefined && existing.discountType === "PERCENT" && (body.value < 1 || body.value > 100)) {
      return NextResponse.json(
        { error: "Процентная скидка должна быть от 1 до 100" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }
    if (body.maxUses !== undefined && body.maxUses !== null && body.maxUses < existing.usesCount) {
      return NextResponse.json(
        { error: `Лимит использований не может быть меньше уже использованных (${existing.usesCount})` },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const data: Record<string, unknown> = {};
    if (body.isActive !== undefined) data.isActive = body.isActive;
    if (body.validUntil !== undefined) data.validUntil = body.validUntil ? new Date(body.validUntil) : null;
    if (body.maxUses !== undefined) data.maxUses = body.maxUses;
    if (body.value !== undefined) data.value = body.value;

    await tenantDb.promoCode.updateMany({
      where: { id: existing.id },
      data,
    });

    const updated = await tenantDb.promoCode.findFirst({
      where: { id: existing.id },
      include: {
        applicableCourse: { select: { id: true, title: true } },
        applicableGroup: { select: { id: true, name: true } },
        _count: { select: { redemptions: true } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "PROMO_CODE_UPDATED",
      resource: "PromoCode",
      resourceId: existing.id,
      details: { code: existing.code, updates: data },
    });

    return NextResponse.json({ success: true, promoCode: updated }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof PlanFeatureLockedError) {
      return NextResponse.json(formatPlanFeatureLockedPayload(err), {
        status: 403,
        headers: NO_STORE_HEADERS,
      });
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка обновления промокода" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
