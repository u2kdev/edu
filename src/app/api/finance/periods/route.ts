import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { closeFinancePeriod } from "@/lib/finance";

const closePeriodSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  notes: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isImpersonating || hasPermission("finance.read", "NONE", tenantCtx.role);
    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read finance periods" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const periods = await tenantDb.financePeriod.findMany({
      include: {
        closedBy: {
          select: {
            id: true,
            user: { select: { fullName: true } },
          },
        },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    return NextResponse.json({ periods });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to load finance periods", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canClose =
      !tenantCtx.isImpersonating && hasPermission("finance.period.close", "NONE", tenantCtx.role);

    if (!canClose) {
      return NextResponse.json(
        { error: "Forbidden: Only Director can close a finance period" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_period_close:${tenantCtx.session.user.id}:${ip}`, 20, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = closePeriodSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid period payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const period = await closeFinancePeriod({
      centerId: tenantCtx.center.id,
      year: parsed.data.year,
      month: parsed.data.month,
      actorUserId: tenantCtx.session.user.id,
      actorMembershipId: tenantCtx.membership?.id ?? null,
      actorRole: tenantCtx.role,
      notes: parsed.data.notes ?? null,
    });

    return NextResponse.json({ period });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to close finance period", code: error.code },
      { status: error.status || 400 }
    );
  }
}
