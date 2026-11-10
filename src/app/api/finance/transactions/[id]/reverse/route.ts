import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { reverseFinanceTransaction } from "@/lib/finance";

const reverseSchema = z.object({
  reason: z.string().trim().min(3, "Reversal reason must be at least 3 characters").max(500),
  date: z.string().optional(),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const canStorno =
      tenantCtx.isPlatformStaff || hasPermission("finance.storno", "NONE", tenantCtx.role);

    if (!canStorno) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Accountant can reverse (storno) transactions" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_storno:${tenantCtx.session.user.id}:${ip}`, 40, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { id } = await context.params;
    const rawBody = await req.json();
    const parsed = reverseSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid reversal payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reversalDate = parsed.data.date ? new Date(parsed.data.date) : new Date();
    const reversal = await reverseFinanceTransaction({
      centerId: tenantCtx.center.id,
      transactionId: id,
      reason: parsed.data.reason,
      actorUserId: tenantCtx.session.user.id,
      date: reversalDate,
    });

    return NextResponse.json({ reversal });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    const msg = error.message || "Failed to reverse transaction";
    const status =
      error.status ||
      (msg.includes("closed finance period") ? 403 : msg.includes("already reversed") ? 409 : 400);
    return NextResponse.json({ error: msg, code: error.code }, { status });
  }
}
