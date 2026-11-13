import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { disburseTeacherSalaries } from "@/lib/finance";

const disburseSchema = z.object({
  startDate: z.string().datetime({ offset: true }).or(z.string().min(8)),
  endDate: z.string().datetime({ offset: true }).or(z.string().min(8)),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  teacherMembershipId: z.string().uuid().optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canWrite =
      !tenantCtx.isImpersonating && hasPermission("finance.write", "NONE", tenantCtx.role);

    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden: No permission to disburse teacher salaries" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const rawBody = await req.json();
    const parsed = disburseSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid disbursement payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Verify account exists
    const account = await tenantDb.account.findFirst({
      where: { id: data.accountId },
    });
    if (!account) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // Default category for teacher salary if not specified
    let categoryId = data.categoryId;
    if (!categoryId) {
      const salaryCat =
        (await tenantDb.financeCategory.findFirst({
          where: { name: { contains: "Зарплат", mode: "insensitive" }, type: "EXPENSE" },
        })) ||
        (await tenantDb.financeCategory.create({
          data: {
            centerId: tenantCtx.center.id,
            name: "Зарплата преподавателей",
            type: "EXPENSE",
          },
        }));
      categoryId = salaryCat.id;
    }

    const result = await disburseTeacherSalaries({
      centerId: tenantCtx.center.id,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      accountId: data.accountId,
      categoryId,
      actorUserId: tenantCtx.session.user.id,
      teacherMembershipId: data.teacherMembershipId ?? undefined,
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "TEACHER_SALARIES_DISBURSED",
      resource: "FinanceTransaction",
      details: {
        createdCount: result.createdTransactionsCount,
        totalDisbursedAmount: result.totalDisbursedAmount,
        startDate: data.startDate,
        endDate: data.endDate,
      },
    });

    return NextResponse.json({
      success: true,
      createdCount: result.createdTransactionsCount,
      totalDisbursedAmount: result.totalDisbursedAmount,
      transactions: result.transactions,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to disburse teacher salaries" },
      { status: error.status || 500 }
    );
  }
}
