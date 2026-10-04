import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/center-payments/report - Financial report & forecast
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Total paid revenue
    const paidSum = await tenantDb.centerPayment.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
      _count: true,
    });

    // Total pending revenue
    const pendingSum = await tenantDb.centerPayment.aggregate({
      where: { status: "PENDING" },
      _sum: { amount: true },
      _count: true,
    });

    // Count active student enrollments for MRR revenue forecasting
    const activeStudentsCount = await tenantDb.centerMembership.count({
      where: { role: "STUDENT", status: "ACTIVE" },
    });

    // Estimate average payment amount per student from historical payments
    const avgPayment = paidSum._count > 0 ? (paidSum._sum.amount || 0) / paidSum._count : 150000;
    const expectedMRR = Math.round(activeStudentsCount * avgPayment);

    // Debtors: students with pending payments
    const pendingPayments = await tenantDb.centerPayment.findMany({
      where: { status: "PENDING" },
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
