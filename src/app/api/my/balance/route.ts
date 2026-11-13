import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { calculateStudentBalances } from "@/lib/student-balance";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, membership, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();

    const { searchParams } = new URL(req.url);
    const requestedChildId =
      searchParams.get("childId") || searchParams.get("studentId") || null;

    if (role === "STUDENT") {
      if (!membership) {
        return NextResponse.json(
          { error: "Active student membership required" },
          { status: 403 }
        );
      }

      if (requestedChildId && requestedChildId !== membership.id) {
        return NextResponse.json(
          { error: "Forbidden: Students can only view their own balance" },
          { status: 403 }
        );
      }

      const balances = await calculateStudentBalances({
        centerId: center.id,
        studentMembershipIds: [membership.id],
      });

      const myBalance = balances[0] || null;
      return NextResponse.json({
        role: "STUDENT",
        balance: myBalance,
        students: balances,
      });
    }

    if (role === "PARENT") {
      if (!membership) {
        return NextResponse.json(
          { error: "Active parent membership required" },
          { status: 403 }
        );
      }

      const parentLinks = await tenantDb.parentLink.findMany({
        where: {
          parentMembershipId: membership.id,
          status: "CONFIRMED",
        },
        select: { studentMembershipId: true },
      });

      const confirmedChildIds = parentLinks.map(
        (l: { studentMembershipId: string }) => l.studentMembershipId
      );

      if (requestedChildId && !confirmedChildIds.includes(requestedChildId)) {
        return NextResponse.json(
          {
            error:
              "Forbidden: You can only view balance of your confirmed children",
          },
          { status: 403 }
        );
      }

      const targetIds = requestedChildId
        ? [requestedChildId]
        : confirmedChildIds;

      const balances = await calculateStudentBalances({
        centerId: center.id,
        studentMembershipIds: targetIds,
      });

      const totalDebt = balances.reduce((s, b) => s + b.debtAmount, 0);
      const totalPaid = balances.reduce((s, b) => s + b.totalPaid, 0);
      const totalAccrued = balances.reduce((s, b) => s + b.totalAccrued, 0);

      return NextResponse.json({
        role: "PARENT",
        balance: balances[0] || null,
        students: balances,
        summary: {
          childrenCount: confirmedChildIds.length,
          totalDebt,
          totalPaid,
          totalAccrued,
        },
      });
    }

    if (
      role === "DIRECTOR" ||
      role === "CENTER_ADMIN" ||
      role === "ACCOUNTANT" ||
      tenantCtx.isPlatformStaff
    ) {
      if (!requestedChildId) {
        return NextResponse.json(
          { error: "studentId or childId parameter is required for staff" },
          { status: 400 }
        );
      }

      const balances = await calculateStudentBalances({
        centerId: center.id,
        studentMembershipIds: [requestedChildId],
      });

      return NextResponse.json({
        role,
        balance: balances[0] || null,
        students: balances,
      });
    }

    return NextResponse.json(
      { error: "Forbidden: Role does not have access to student balance" },
      { status: 403 }
    );
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[GET /api/my/balance]", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
