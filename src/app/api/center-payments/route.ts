import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { BillingError, recordBillingPayment, refundBillingPayment } from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const createPaymentSchema = z
  .object({
    studentMembershipId: z.string().uuid(),
    groupId: z.string().uuid().optional().nullable(),
    chargeId: z.string().uuid().optional().nullable(),
    periodMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
    amount: z.coerce.number().int().positive().optional().nullable(),
    originalAmount: z.coerce.number().int().positive().optional().nullable(),
    discountAmount: z.coerce.number().int().min(0).optional(),
    manualDiscountAmount: z.coerce.number().int().min(0).optional(),
    discountReason: z.string().trim().max(300).optional().nullable(),
    promoCode: z.string().trim().max(64).optional().nullable(),
    paymentMethod: z.enum(["CASH", "ONLINE", "BANK_TRANSFER"]).optional().default("CASH"),
    currency: z.enum(["UZS", "USD", "EUR", "RUB"]).optional().default("UZS"),
    status: z.enum(["PENDING", "PAID", "PARTIALLY_PAID"]).optional().default("PAID"),
    installmentIndex: z.coerce.number().int().min(1).max(36).optional().default(1),
    note: z.string().trim().max(500).optional().nullable(),
    paymentDate: z.string().datetime().optional().nullable(),
    targetAccountId: z.string().uuid().optional().nullable(),
  })
  .strict();

const patchPaymentSchema = z
  .object({
    paymentId: z.string().uuid(),
    status: z.enum(["REFUNDED"]).optional().default("REFUNDED"),
    amount: z.coerce.number().int().positive().optional(),
    reason: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    const whereCondition: Record<string, unknown> = { deletedAt: null };

    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      whereCondition.studentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const parentLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const studentIds = parentLinks.map((l: { studentMembershipId: string }) => l.studentMembershipId);
      whereCondition.studentMembershipId = { in: studentIds };
    } else if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const teacherGroups = await tenantDb.group.findMany({
        where: { teacherMembershipId: tenantCtx.membership.id },
        select: { id: true },
      });
      whereCondition.groupId = { in: teacherGroups.map((g: { id: string }) => g.id) };
    } else if (tenantCtx.role === "TEACHER_ASSISTANT" && tenantCtx.membership) {
      const assistantGroups = await tenantDb.group.findMany({
        where: { assistantMembershipId: tenantCtx.membership.id },
        select: { id: true },
      });
      whereCondition.groupId = { in: assistantGroups.map((g: { id: string }) => g.id) };
    } else if (
      !tenantCtx.isPlatformStaff &&
      !hasPermission("payments.read", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Access to payments denied" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const payments = await tenantDb.centerPayment.findMany({
      where: whereCondition,
      include: {
        student: {
          include: { user: { select: { fullName: true, email: true } } },
        },
        group: { select: { name: true, course: { select: { title: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ payments }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка загрузки оплат" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

// POST /api/center-payments - Record payment, partial payment, or discount through billing core
export async function POST(req: Request) {
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
      !hasPermission("payments.manage", tenantCtx.session.user.platformRole, tenantCtx.role)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only Director, Accountant, or Center Admin can process payments" },
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

    const parsed = createPaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные оплаты", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    const manualDiscount = body.manualDiscountAmount ?? body.discountAmount ?? 0;

    if (!body.chargeId && !(body.groupId && body.periodMonths) && !body.amount) {
      return NextResponse.json(
        { error: "Student and amount are required" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const payment = await recordBillingPayment({
      centerId: tenantCtx.center.id,
      studentMembershipId: body.studentMembershipId,
      groupId: body.groupId ?? null,
      chargeId: body.chargeId ?? null,
      periodMonths: body.periodMonths ?? null,
      amount: body.amount ?? null,
      paymentMethod: body.paymentMethod,
      currency: body.currency,
      status: body.status,
      installmentIndex: body.installmentIndex,
      promoCode: body.promoCode ?? null,
      manualDiscountAmount: manualDiscount,
      discountReason: body.discountReason ?? null,
      note: body.note ?? null,
      paymentDate: body.paymentDate ? new Date(body.paymentDate) : undefined,
      targetAccountId: body.targetAccountId ?? null,
      actorUserId: tenantCtx.session.user.id,
      actor: {
        centerRole: tenantCtx.role ?? "NONE",
        platformRole: tenantCtx.session.user.platformRole,
        membershipPermissions: tenantCtx.membership?.permissions ?? null,
      },
    });

    return NextResponse.json({ success: true, payment }, { headers: NO_STORE_HEADERS });
  } catch (err: unknown) {
    if (err instanceof BillingError) {
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status: err.status, headers: NO_STORE_HEADERS }
      );
    }
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Ошибка фиксации оплаты" },
      { status: error?.status || 400, headers: NO_STORE_HEADERS }
    );
  }
}

// PATCH /api/center-payments - Issue full or partial refund for a payment
export async function PATCH(req: Request) {
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
        { error: "Forbidden: No permission to process refunds" },
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

    const parsed = patchPaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Неверные данные возврата", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const updatedPayment = await refundBillingPayment({
      centerId: tenantCtx.center.id,
      paymentId: parsed.data.paymentId,
      refundAmount: parsed.data.amount,
      reason: parsed.data.reason?.trim() || "Возврат оплаты",
      actorUserId: tenantCtx.session.user.id,
    });

    return NextResponse.json(
      {
        success: true,
        payment: updatedPayment,
        isFullRefund: updatedPayment.status === "REFUNDED",
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
      { error: error?.status ? error.message : "Server error" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
