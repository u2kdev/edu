import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/center-payments/report - Financial report & forecast
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const centerId = tenantCtx.center.id;

    // Total paid revenue
    const paidSum = await db.centerPayment.aggregate({
      where: { centerId, status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });

    // Total pending revenue
    const pendingSum = await db.centerPayment.aggregate({
      where: { centerId, status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    });

    // Count active student enrollments for MRR revenue forecasting
    const activeStudentsCount = await db.centerMembership.count({
      where: { centerId, role: "STUDENT", status: "ACTIVE" },
    });

    // Estimate average payment amount per student from historical payments
    const avgPayment = paidSum._count > 0 ? (paidSum._sum.amount || 0) / paidSum._count : 150000;
    const expectedMRR = Math.round(activeStudentsCount * avgPayment);

    // Debtors: students with pending payments
    const pendingPayments = await db.centerPayment.findMany({
      where: { centerId, status: "PENDING" },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true, phone: true } },
          },
        },
        group: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      report: {
        totalCollected: paidSum._sum.amount || 0,
        paidCount: paidSum._count,
        totalPending: pendingSum._sum.amount || 0,
        pendingCount: pendingSum._count,
        expectedMRR,
        activeStudentsCount,
        debtors: pendingPayments,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
