import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    let whereCondition: any = {};

    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      whereCondition.studentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      const parentLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      const studentIds = parentLinks.map((l) => l.studentMembershipId);
      whereCondition.studentMembershipId = { in: studentIds };
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

    return NextResponse.json({ payments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка загрузки оплат" }, { status: 400 });
  }
}

// POST /api/center-payments - Record payment, partial payment, or discount
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: Only Director or Center Admin can process payments" }, { status: 403 });
    }

    const {
      studentMembershipId,
      groupId,
      amount,
      originalAmount,
      discountAmount,
      paymentMethod,
      currency,
      status,
      installmentIndex,
    } = await req.json();

    if (!studentMembershipId || !amount) {
      return NextResponse.json({ error: "Student and amount are required" }, { status: 400 });
    }

    const payment = await tenantDb.centerPayment.create({
      data: {
        centerId: tenantCtx.center.id,
        studentMembershipId,
        groupId: groupId || null,
        amount: parseFloat(amount),
        originalAmount: originalAmount ? parseFloat(originalAmount) : parseFloat(amount),
        discountAmount: discountAmount ? parseFloat(discountAmount) : 0,
        currency: currency || "UZS",
        status: status || "PAID", // PAID, PARTIALLY_PAID, PENDING
        paymentMethod: paymentMethod || "CASH",
        installmentIndex: installmentIndex ? parseInt(installmentIndex) : 1,
        paidAt: new Date(),
      },
      include: {
        student: { include: { user: { select: { fullName: true } } } },
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "STUDENT_PAYMENT_RECORDED",
      resource: "CenterPayment",
      resourceId: payment.id,
      details: { amount: payment.amount, status: payment.status, studentId: studentMembershipId },
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка фиксации оплаты" }, { status: 400 });
  }
}

// PATCH /api/center-payments - Issue refund for a payment
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: Only Director can process refunds" }, { status: 403 });
    }

    const { paymentId, status } = await req.json();

    if (!paymentId) {
      return NextResponse.json({ error: "paymentId is required" }, { status: 400 });
    }

    await tenantDb.centerPayment.updateMany({
      where: { id: paymentId },
      data: {
        status: status || "REFUNDED",
        refundedAt: new Date(),
      },
    });
    const payment = await tenantDb.centerPayment.findFirst({ where: { id: paymentId } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "STUDENT_PAYMENT_REFUNDED",
      resource: "CenterPayment",
      resourceId: payment?.id,
      details: { amount: payment?.amount },
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
