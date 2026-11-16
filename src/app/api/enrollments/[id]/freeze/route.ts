import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, freezeEnrollment, unfreezeEnrollment } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const freezeSchema = z
  .object({
    frozenUntil: z.string().min(1, "Укажите дату окончания заморозки"),
    reason: z.string().trim().max(300).optional().nullable(),
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

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role) ||
      hasPermission("groups.manage", tenantCtx.session.user.platformRole, tenantCtx.role);

    if (!canManage) {
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

    const parsed = freezeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные заморозки", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const frozenUntil = new Date(parsed.data.frozenUntil);
    if (Number.isNaN(frozenUntil.getTime())) {
      return NextResponse.json(
        { error: "Неверный формат даты frozenUntil" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const result = await freezeEnrollment({
      centerId: tenantCtx.center.id,
      enrollmentId: params.id,
      startDate: new Date(),
      plannedEndDate: frozenUntil,
      reason: parsed.data.reason?.trim() || "Заморозка абонемента",
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка заморозки обучения" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function DELETE(
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

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role) ||
      hasPermission("groups.manage", tenantCtx.session.user.platformRole, tenantCtx.role);

    if (!canManage) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const result = await unfreezeEnrollment({
      centerId: tenantCtx.center.id,
      enrollmentId: params.id,
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json({ success: true, ...result }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка разморозки обучения" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
