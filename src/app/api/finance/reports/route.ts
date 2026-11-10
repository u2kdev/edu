import { NextResponse } from "next/server";
import { requireFinanceTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getTashkentMonthBounds, getTashkentYearMonth } from "@/lib/finance";
import {
  generateFinanceReport,
  calculateDebtorsReport,
  calculateTeacherSalariesReport,
} from "@/lib/finance-reports";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canRead =
      tenantCtx.isImpersonating || hasPermission("finance.read", "NONE", tenantCtx.role);

    if (!canRead) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read financial reports" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const periodParam = searchParams.get("period"); // YYYY-MM
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const branchId = searchParams.get("branchId");

    let startDate: Date;
    let endDate: Date;

    if (periodParam && /^\d{4}-\d{2}$/.test(periodParam)) {
      const [yStr, mStr] = periodParam.split("-");
      const bounds = getTashkentMonthBounds(Number(yStr), Number(mStr));
      startDate = bounds.startDate;
      endDate = bounds.endDate;
    } else if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
    } else {
      const nowYm = getTashkentYearMonth(new Date());
      const bounds = getTashkentMonthBounds(nowYm.year, nowYm.month);
      startDate = bounds.startDate;
      endDate = bounds.endDate;
    }

    const [report, debtors, salaries] = await Promise.all([
      generateFinanceReport({
        centerId: tenantCtx.center.id,
        startDate,
        endDate,
        branchId,
      }),
      calculateDebtorsReport({
        centerId: tenantCtx.center.id,
      }),
      calculateTeacherSalariesReport({
        centerId: tenantCtx.center.id,
        startDate,
        endDate,
      }),
    ]);

    return NextResponse.json({
      period: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      },
      report,
      debtors,
      salaries,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to generate financial reports", code: error.code },
      { status: error.status || 400 }
    );
  }
}
