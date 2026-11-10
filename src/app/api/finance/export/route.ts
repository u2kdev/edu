import { NextResponse } from "next/server";
import { requireFinanceTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getTashkentMonthBounds, TASHKENT_OFFSET_MS } from "@/lib/finance";
import {
  generateFinanceCsv,
  generateFinanceXlsx,
  DEFAULT_FINANCE_EXPORT_PAGE_SIZE,
  MAX_FINANCE_EXPORT_PAGE_SIZE,
  type FinanceExportRow,
} from "@/lib/finance-export";

const MAX_EXPORT_RANGE_MS = 366 * 24 * 3600 * 1000;

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

    const periodParam = searchParams.get("period")?.trim() || null;
    const startDateParam = searchParams.get("startDate")?.trim() || null;
    const endDateParam = searchParams.get("endDate")?.trim() || null;

    let startDate: Date;
    let endDate: Date;
    let periodLabel: string;

    if (periodParam) {
      if (!/^\d{4}-\d{2}$/.test(periodParam)) {
        return NextResponse.json(
          { error: "Invalid period format. Expected period=YYYY-MM" },
          { status: 400 }
        );
      }
      const [yStr, mStr] = periodParam.split("-");
      const bounds = getTashkentMonthBounds(Number(yStr), Number(mStr));
      startDate = bounds.startDate;
      endDate = bounds.endDate;
      periodLabel = periodParam;
    } else if (startDateParam && endDateParam) {
      startDate = new Date(startDateParam);
      endDate = new Date(endDateParam);
      if (
        Number.isNaN(startDate.getTime()) ||
        Number.isNaN(endDate.getTime()) ||
        endDate < startDate ||
        endDate.getTime() - startDate.getTime() > MAX_EXPORT_RANGE_MS
      ) {
        return NextResponse.json(
          { error: "Invalid period date range for export (max range is 366 days)" },
          { status: 400 }
        );
      }
      periodLabel = `${startDate.toISOString().slice(0, 10)}_${endDate.toISOString().slice(0, 10)}`;
    } else {
      return NextResponse.json(
        { error: "Mandatory period filter is required for export (provide period=YYYY-MM or startDate and endDate)" },
        { status: 400 }
      );
    }

    const rawPage = searchParams.get("page");
    const rawPageSize = searchParams.get("pageSize");
    const page = rawPage ? parseInt(rawPage, 10) : 1;
    const pageSize = rawPageSize ? parseInt(rawPageSize, 10) : DEFAULT_FINANCE_EXPORT_PAGE_SIZE;

    if (Number.isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter (must be >= 1)" }, { status: 400 });
    }
    if (Number.isNaN(pageSize) || pageSize < 1 || pageSize > MAX_FINANCE_EXPORT_PAGE_SIZE) {
      return NextResponse.json(
        { error: `Invalid pageSize parameter (must be between 1 and ${MAX_FINANCE_EXPORT_PAGE_SIZE})` },
        { status: 400 }
      );
    }

    const type = searchParams.get("type");
    const accountId = searchParams.get("accountId");
    const categoryId = searchParams.get("categoryId");
    const branchId = searchParams.get("branchId");
    const groupId = searchParams.get("groupId");

    const where: Record<string, unknown> = {
      date: { gte: startDate, lte: endDate },
    };
    if (type === "INCOME" || type === "EXPENSE" || type === "TRANSFER") {
      where.type = type;
    }
    if (accountId) where.accountId = accountId;
    if (categoryId) where.categoryId = categoryId;
    if (branchId) where.branchId = branchId;
    if (groupId) where.groupId = groupId;

    const tenantDb = tenantCtx.getTenantDb();
    const [totalRows, transactions] = await Promise.all([
      tenantDb.financeTransaction.count({ where }),
      tenantDb.financeTransaction.findMany({
        where,
        include: {
          account: { select: { name: true } },
          targetAccount: { select: { name: true } },
          category: { select: { name: true } },
          branch: { select: { name: true } },
          group: { select: { name: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));

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
        totalRows,
        page,
        pageSize,
        period: periodLabel,
      },
      ipAddress: ip,
    });

    const paginationHeaders = {
      "X-Export-Page": String(page),
      "X-Export-Page-Size": String(pageSize),
      "X-Export-Total-Rows": String(totalRows),
      "X-Export-Total-Pages": String(totalPages),
    };

    if (format === "xlsx") {
      const xlsxBuffer = generateFinanceXlsx(exportRows);
      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="finance-export-${periodLabel}-p${page}.xlsx"`,
          ...paginationHeaders,
        },
      });
    }

    const csvContent = generateFinanceCsv(exportRows);
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="finance-export-${periodLabel}-p${page}.csv"`,
        ...paginationHeaders,
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
