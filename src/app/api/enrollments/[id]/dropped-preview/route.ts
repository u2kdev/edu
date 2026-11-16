import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, calculateDroppedRemaining } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const canRead =
      tenantCtx.isPlatformStaff ||
      hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role) ||
      hasPermission("groups.manage", tenantCtx.session.user.platformRole, tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const preview = await calculateDroppedRemaining(tenantCtx.center.id, params.id);
    return NextResponse.json({ preview }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка расчёта остатка" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
