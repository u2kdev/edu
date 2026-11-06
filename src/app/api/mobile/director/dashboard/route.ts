import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const currentRole = tenantCtx.role;

    if (
      currentRole !== "DIRECTOR" &&
      currentRole !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json(
        { error: "Forbidden: Director or Center Admin access required" },
        { status: 403 }
      );
    }

    // 1. KPI Counts
    const [activeStudentsCount, activeTeachersCount, activeGroupsCount] = await Promise.all([
      tenantDb.centerMembership.count({
        where: { role: "STUDENT", status: "ACTIVE" },
      }),
      tenantDb.centerMembership.count({
        where: { role: "TEACHER", status: "ACTIVE" },
      }),
      tenantDb.group.count(),
    ]);

    // 2. Financial Metrics (Total collected revenue from PAID payments)
    const paidPayments = await tenantDb.centerPayment.findMany({
      where: { status: "PAID" },
      select: { amount: true },
    });
    const totalRevenue = paidPayments.reduce((acc, p) => acc + p.amount, 0);

    const pendingPaymentsCount = await tenantDb.centerPayment.count({
      where: { status: "PENDING" },
    });

    // 3. Center Average Attendance %
    const recentAttendances = await tenantDb.attendance.findMany({
      select: { status: true },
      take: 100,
    });
    const totalAtt = recentAttendances.length;
    const presentAtt = recentAttendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const averageAttendancePercent =
      totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 100;

    // 4. Students at Risk (with low attendance)
    const studentMemberships = await tenantDb.centerMembership.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      include: {
        user: { select: { fullName: true, phone: true } },
        attendances: {
          select: { status: true },
          take: 20,
        },
      },
      take: 50,
    });

    const atRiskStudents = studentMemberships
      .map((student) => {
        const total = student.attendances.length;
        if (total < 3) return null;
        const present = student.attendances.filter(
          (a) => a.status === "PRESENT" || a.status === "LATE"
        ).length;
        const percent = Math.round((present / total) * 100);
        if (percent < 75) {
          return {
            membershipId: student.id,
            fullName: student.user.fullName,
            phone: student.user.phone || null,
            attendancePercent: percent,
            missedCount: total - present,
          };
        }
        return null;
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .slice(0, 5);

    return NextResponse.json({
      success: true,
      center: {
        id: tenantCtx.center.id,
        name: tenantCtx.center.name,
        status: tenantCtx.center.status,
      },
      kpis: {
        activeStudentsCount,
        activeTeachersCount,
        activeGroupsCount,
        totalRevenue,
        pendingPaymentsCount,
        averageAttendancePercent,
        riskCount: atRiskStudents.length,
      },
      atRiskStudents,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load director dashboard" },
      { status: error.status || 500 }
    );
  }
}
