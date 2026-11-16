import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getCenterFinanceAnalytics, type AnalyticsPeriodPreset } from "@/lib/finance-analytics";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const querySchema = z
  .object({
    period: z.enum(["7d", "30d", "90d", "12m"]).optional().default("30d"),
    branchId: z.string().uuid().optional().nullable(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isPlatformStaff ||
      tenantCtx.isImpersonating ||
      hasPermission(
        "finance.read",
        tenantCtx.session.user.platformRole,
        tenantCtx.role,
        tenantCtx.membership?.permissions ?? null
      );

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to access financial analytics" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const rawPeriod = searchParams.get("period") ?? undefined;
    const rawBranchId = searchParams.get("branchId") ?? undefined;

    const parsed = querySchema.safeParse({
      period: rawPeriod,
      branchId: rawBranchId || null,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid query parameters", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const analytics = await getCenterFinanceAnalytics({
      centerId: tenantCtx.center.id,
      period: parsed.data.period as AnalyticsPeriodPreset,
      branchId: parsed.data.branchId ?? null,
    });

    return NextResponse.json(
      { success: true, analytics },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to load financial analytics", code: error.code },
      { status: error.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}
