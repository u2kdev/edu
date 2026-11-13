import { NextResponse } from "next/server";
import { z } from "zod";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { syncCenterPaymentToFinance } from "@/lib/finance";

const recordDebtPaymentSchema = z.object({
  studentMembershipId: z.string().uuid(),
  amount: z.number().int().positive("Сумма должна быть положительной"),
  paymentMethod: z.enum(["CASH", "ONLINE", "BANK_TRANSFER"]).default("CASH"),
  groupId: z.string().uuid().optional().nullable(),
  comment: z.string().trim().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isImpersonating || hasPermission("finance.read", "NONE", tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read student debts" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);

    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const statusFilter = searchParams.get("status"); // DEBT, PAID, OVERPAID
    const groupId = searchParams.get("groupId");

    const students = await tenantDb.centerMembership.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        ...(groupId
          ? { enrollments: { some: { groupId, status: "ACTIVE" } } }
          : {}),
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            phone: true,
            email: true,
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            group: {
              include: {
                course: {
                  select: { id: true, title: true, priceMonthly: true },
                },
              },
            },
          },
        },
        payments: {
          where: {
            status: { in: ["PAID", "PARTIALLY_PAID"] },
          },
          select: {
            id: true,
            amount: true,
            createdAt: true,
            status: true,
          },
        },
      },
      orderBy: { joinedAt: "desc" },
    });

    const now = new Date();

    const debtItems = students.map((s) => {
      // Monthly tuition sum
      const monthlyTuition = s.enrollments.reduce(
        (sum, e) => sum + (e.group.course?.priceMonthly || 0),
        0
      );

      // Months enrolled (at least 1)
      const joinedDate = new Date(s.joinedAt);
      const monthsEnrolled = Math.max(
        1,
        (now.getFullYear() - joinedDate.getFullYear()) * 12 +
          (now.getMonth() - joinedDate.getMonth()) +
          1
      );

      // Expected total due
      const totalDue = monthlyTuition * monthsEnrolled;

      // Actual total paid
      const totalPaid = s.payments.reduce((sum, p) => sum + Math.round(p.amount), 0);

      // Balance = totalPaid - totalDue
      const balance = totalPaid - totalDue;
      const debtAmount = balance < 0 ? Math.abs(balance) : 0;
      const overpaidAmount = balance > 0 ? balance : 0;

      let status: "DEBT" | "PAID" | "OVERPAID" = "PAID";
      if (balance < 0) status = "DEBT";
      else if (balance > 0) status = "OVERPAID";

      return {
        studentId: s.id,
        fullName: s.user.fullName,
        phone: s.user.phone,
        email: s.user.email,
        joinedAt: s.joinedAt,
        monthlyTuition,
        totalDue,
        totalPaid,
        balance,
        debtAmount,
        overpaidAmount,
        status,
        enrollments: s.enrollments.map((e) => ({
          groupId: e.groupId,
          groupName: e.group.name,
          courseTitle: e.group.course?.title,
          priceMonthly: e.group.course?.priceMonthly || 0,
        })),
        recentPaymentsCount: s.payments.length,
      };
    });

    // Apply filters
    const filtered = debtItems.filter((item) => {
      const matchesSearch =
        !search ||
        item.fullName.toLowerCase().includes(search) ||
        (item.phone && item.phone.toLowerCase().includes(search));

      const matchesStatus =
        !statusFilter || statusFilter === "ALL" || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Overall metrics
    const totalDebt = debtItems
      .filter((i) => i.status === "DEBT")
      .reduce((sum, i) => sum + i.debtAmount, 0);
    const totalStudentsWithDebt = debtItems.filter((i) => i.status === "DEBT").length;
    const totalMonthlyExpected = debtItems.reduce((sum, i) => sum + i.monthlyTuition, 0);
    const totalPaidSum = debtItems.reduce((sum, i) => sum + i.totalPaid, 0);

    return NextResponse.json({
      students: filtered,
      summary: {
        totalDebt,
        totalStudentsWithDebt,
        totalMonthlyExpected,
        totalPaidSum,
        totalStudentsCount: students.length,
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load student debts" },
      { status: error.status || 500 }
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
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const rawBody = await req.json();
    const parsed = recordDebtPaymentSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid payment payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { studentMembershipId, amount, paymentMethod, groupId, comment } = parsed.data;

    const student = await tenantDb.centerMembership.findFirst({
      where: { id: studentMembershipId, role: "STUDENT" },
      include: { user: { select: { fullName: true } } },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    // 1. Create CenterPayment
    const payment = await tenantDb.centerPayment.create({
      data: {
        centerId: tenantCtx.center.id,
        studentMembershipId,
        groupId: groupId ?? null,
        amount,
        originalAmount: amount,
        currency: "UZS",
        status: "PAID",
        paymentMethod,
        paidAt: new Date(),
      },
    });

    // 2. Sync to FinanceTransaction
    await syncCenterPaymentToFinance({
      centerId: tenantCtx.center.id,
      paymentId: payment.id,
      actorUserId: tenantCtx.session.user.id,
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "STUDENT_DEBT_PAYMENT_RECORDED",
      resource: "CenterPayment",
      resourceId: payment.id,
      details: {
        studentId: studentMembershipId,
        studentName: student.user.fullName,
        amount,
        paymentMethod,
        comment,
      },
    });

    return NextResponse.json(
      {
        success: true,
        payment,
        message: `Оплата на сумму ${amount.toLocaleString("ru-RU")} UZS успешно зафиксирована`,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to record payment" },
      { status: error.status || 500 }
    );
  }
}
