import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import {
  BillingError,
  calculateCenterStudentBalances,
  recordBillingPayment,
} from "@/lib/billing";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

const recordDebtPaymentSchema = z
  .object({
    studentMembershipId: z.string().uuid(),
    amount: z.coerce.number().int().positive("Сумма должна быть положительной").optional().nullable(),
    paymentMethod: z.enum(["CASH", "ONLINE", "BANK_TRANSFER"]).default("CASH"),
    groupId: z.string().uuid().optional().nullable(),
    chargeId: z.string().uuid().optional().nullable(),
    periodMonths: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional().nullable(),
    promoCode: z.string().trim().max(64).optional().nullable(),
    manualDiscountAmount: z.coerce.number().int().min(0).optional().default(0),
    discountReason: z.string().trim().max(300).optional().nullable(),
    comment: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isImpersonating || hasPermission("finance.read", "NONE", tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read student debts" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = searchParams.get("status"); // ALL | DEBT | PAID | OVERPAID | FROZEN
    const groupId = searchParams.get("groupId")?.trim() || null;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10) || 50));

    const balances = await calculateCenterStudentBalances({
      centerId: tenantCtx.center.id,
    });

    const mapped = balances.map((b) => ({
      studentId: b.studentMembershipId,
      fullName: b.fullName,
      phone: b.phone,
      email: b.email,
      monthlyTuition: b.monthlyTuition,
      totalDue: b.totalAccrued,
      totalPaid: b.totalPaid,
      balance: b.balance,
      debtAmount: b.debtAmount,
      overpaidAmount: b.balance > 0 ? b.balance : 0,
      status: b.status,
      paidUntil: b.earliestPaidUntil,
      enrollments: b.enrollments.map((e) => ({
        enrollmentId: e.enrollmentId,
        groupId: e.groupId,
        groupName: e.groupName,
        courseTitle: e.courseTitle,
        priceMonthly: e.priceMonthly,
        paidUntil: e.paidUntil,
        daysRemaining: e.daysRemaining,
        status: e.status,
      })),
      openCharges: b.openCharges,
      recentPaymentsCount: b.receipts.length,
    }));

    const filtered = mapped.filter((item) => {
      if (groupId && !item.enrollments.some((e) => e.groupId === groupId)) {
        return false;
      }
      const matchesSearch =
        !search ||
        item.fullName.toLowerCase().includes(search) ||
        (item.phone && item.phone.toLowerCase().includes(search)) ||
        item.email.toLowerCase().includes(search);

      const matchesStatus =
        !statusFilter || statusFilter === "ALL" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    const totalDebt = mapped
      .filter((i) => i.status === "DEBT")
      .reduce((sum, i) => sum + i.debtAmount, 0);
    const totalStudentsWithDebt = mapped.filter((i) => i.status === "DEBT").length;
    const totalMonthlyExpected = mapped.reduce((sum, i) => sum + i.monthlyTuition, 0);
    const totalPaidSum = mapped.reduce((sum, i) => sum + i.totalPaid, 0);

    return NextResponse.json(
      {
        students: paginated,
        pagination: {
          page,
          limit,
          total,
          totalPages,
        },
        summary: {
          totalDebt,
          totalStudentsWithDebt,
          totalMonthlyExpected,
          totalPaidSum,
          totalStudentsCount: mapped.length,
        },
      },
      { headers: NO_STORE_HEADERS }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.status ? error.message : "Failed to load student debts" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canWrite =
      !tenantCtx.isImpersonating && hasPermission("finance.write", "NONE", tenantCtx.role);

    if (!canWrite) {
      return NextResponse.json(
        { error: "Forbidden: No permission to record debt payments" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    if (!tenantCtx.session.user.emailVerified) {
      return NextResponse.json(
        { error: "Email confirmation required for sensitive actions" },
        { status: 403, headers: NO_STORE_HEADERS }
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON payload" },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const parsed = recordDebtPaymentSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment payload", details: parsed.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const body = parsed.data;
    if (!body.chargeId && !(body.groupId && body.periodMonths) && !body.amount) {
      return NextResponse.json(
        { error: "Укажите сумму оплаты либо период и группу" },
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
      promoCode: body.promoCode ?? null,
      manualDiscountAmount: body.manualDiscountAmount,
      discountReason: body.discountReason ?? null,
      note: body.comment ?? null,
      actorUserId: tenantCtx.session.user.id,
      actor: {
        centerRole: tenantCtx.role ?? "NONE",
        platformRole: tenantCtx.session.user.platformRole,
        membershipPermissions: tenantCtx.membership?.permissions ?? null,
      },
    });

    return NextResponse.json(
      {
        success: true,
        payment,
        message: `Оплата на сумму ${payment.amount.toLocaleString("ru-RU")} UZS успешно зафиксирована`,
      },
      { status: 201, headers: NO_STORE_HEADERS }
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
      { error: error?.status ? error.message : "Failed to record payment" },
      { status: error?.status || 500, headers: NO_STORE_HEADERS }
    );
  }
}
