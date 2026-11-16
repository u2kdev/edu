import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { assertGroupAccess, requireCenterPermission } from "@/lib/tenant-access";
import {
  BillingError,
  getGroupPricingOverview,
  upsertGroupPricingPlans,
} from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const putPricingSchema = z
  .object({
    plans: z
      .array(
        z
          .object({
            periodMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]),
            price: z.coerce.number().int().min(0),
            isActive: z.boolean().optional().default(true),
          })
          .strict()
      )
      .min(1)
      .max(3),
  })
  .strict();

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    requireCenterPermission(tenantCtx, "groups.read");
    await assertGroupAccess(tenantCtx, params.id, "read");

    const overview = await getGroupPricingOverview(tenantCtx.center.id, params.id);
    if (!overview) {
      return NextResponse.json(
        { error: "Группа не найдена" },
        { status: 404, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json({ pricing: overview }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки тарифов группы" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

export async function PUT(
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
    requireCenterPermission(tenantCtx, "groups.manage");
    await assertGroupAccess(tenantCtx, params.id, "write");

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Некорректный JSON" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = putPricingSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Некорректные данные тарифов группы", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const pricing = await upsertGroupPricingPlans({
      centerId: tenantCtx.center.id,
      groupId: params.id,
      plans: parsed.data.plans,
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json({ success: true, pricing }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка сохранения тарифов группы" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
