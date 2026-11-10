import { NextResponse } from "next/server";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getTashkentMonthBounds, TASHKENT_OFFSET_MS } from "@/lib/finance";
import {
  generateFinanceCsv,
  generateFinanceXlsx,
  MAX_FINANCE_EXPORT_ROWS,
  type FinanceExportRow,
} from "@/lib/finance-export";

function formatTashkentDateString(date: Date): string {
  const shifted = new Date(date.getTime() + TASHKENT_OFFSET_MS);
  return shifted.toISOString().replace("T", " ").slice(0, 19);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireFinanceTenantAccess(req);
    const canExport =
      tenantCtx.isImpersonating ||
      hasPermission("finance.export", "NONE", tenantCtx.role) ||
      hasPermission("finance.read", "NONE", tenantCtx.role);

    if (!canExport) {
      return NextResponse.json(
        { error: "Forbidden: No permission to export financial data" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_export:${tenantCtx.session.user.id}:${ip}`, 30, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many export requests" }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();
    if (format !== "csv" && format !== "xlsx") {
      return NextResponse.json(
        { error: "Unsupported format. Allowed: csv, xlsx" },
        { status: 400 }
      );
    }

    const rawLimit = searchParams.get("limit");
    const parsedLimit = rawLimit ? parseInt(rawLimit, 10) : MAX_FINANCE_EXPORT_ROWS;
    if (Number.isNaN(parsedLimit) || parsedLimit <= 0 || parsedLimit > MAX_FINANCE_EXPORT_ROWS) {
      return NextResponse.json(
        { error: `Invalid row limit (must be between 1 and ${MAX_FINANCE_EXPORT_ROWS})` },
        { status: 400 }
      );
    }

    const periodParam = searchParams.get("period");
    const type = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const categoryId = searchParams.get("categoryId");
    const branchId = searchParams.get("branchId");
    const groupId = searchParams.get("groupId");

    const where: Record<string, unknown> = {};
    if (type === "INCOME" || type === "EXPENSE" || type === "TRANSFER") {
      where.type = type;
    }
    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (branchId) where.branchId = branchId;
    if (groupId) where.groupId = groupId;

    if (periodParam && /^\d{4}-\d{2}$/.test(periodParam)) {
      const [yStr, mStr] = periodParam.split("-");
      const { startDate, endDate } = getTashkentMonthBounds(Number(yStr), Number(mStr));
      where.date = { gte: startDate, lte: endDate };
    }

    const tenantDb = tenantCtx.getTenantDb();
    const transactions = await tenantDb.financeTransaction.findMany({
      where,
      include: {
        account: { select: { name: true } },
        targetAccount: { select: { name: true } },
        category: { select: { name: true } },
        branch: { select: { name: true } },
        group: { select: { name: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: parsedLimit,
    });

    const exportRows: FinanceExportRow[] = transactions.map((t) => ({
      id: t.id,
      date: formatTashkentDateString(t.date),
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      accountName: t.account?.name ?? "",
      targetAccountName: t.targetAccount?.name ?? "",
      categoryName: t.category?.name ?? "",
      counterparty: t.counterparty ?? "",
      description: t.description ?? "",
      branchName: t.branch?.name ?? "",
      groupName: t.group?.name ?? "",
      isReversal: t.isReversal,
    }));

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "FINANCE_EXPORT_GENERATED",
      resource: "FinanceTransaction",
      details: {
        format,
        rowCount: exportRows.length,
        period: periodParam ?? "ALL",
      },
      ipAddress: ip,
    });

    if (format === "xlsx") {
      const xlsxBuffer = generateFinanceXlsx(exportRows);
      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="finance-export-${periodParam || "all"}.xlsx"`,
        },
      });
    }

    const csvContent = generateFinanceCsv(exportRows);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="finance-export-${periodParam || "all"}.csv"`,
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to export financial data", code: error.code },
      { status: error.status || 400 }
    );
  }
}
