import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { recordFinanceTransaction, getTashkentMonthBounds } from "@/lib/finance";

const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.number().int().positive("Amount must be a positive integer in UZS"),
  accountId: z.string().uuid(),
  targetAccountId: z.string().uuid().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
  date: z.string().datetime({ offset: true }).or(z.string().min(8)).optional(),
  description: z.string().trim().max(500).optional().nullable(),
  counterparty: z.string().trim().max(200).optional().nullable(),
  studentMembershipId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  branchId: z.string().uuid().optional().nullable(),
  centerPaymentId: z.string().uuid().optional().nullable(),
});

function canReadFinance(role: string, isPlatformStaff: boolean): boolean {
  if (isPlatformStaff) return true;
  return hasPermission("finance.read", "NONE", role);
}

function canWriteFinance(role: string, isPlatformStaff: boolean): boolean {
  if (isPlatformStaff) return true;
  return hasPermission("finance.write", "NONE", role);
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canReadFinance(tenantCtx.role, tenantCtx.isPlatformStaff)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to read finance transactions" },
        { status: 403 }
      );
    }

    const tenantDb = tenantCtx.getTenantDb();
    const { searchParams } = new URL(req.url);

    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));
    const type = searchParams.get("type");
    const categoryId = searchParams.get("categoryId");
    const accountId = searchParams.get("accountId");
    const branchId = searchParams.get("branchId");
    const groupId = searchParams.get("groupId");
    const courseId = searchParams.get("courseId");
    const studentMembershipId = searchParams.get("studentMembershipId");
    const search = searchParams.get("search")?.trim();
    const periodParam = searchParams.get("period"); // YYYY-MM
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    const where: Record<string, unknown> = {};

    if (type === "INCOME" || type === "EXPENSE" || type === "TRANSFER") {
      where.type = type;
    }
    if (categoryId) where.categoryId = categoryId;
    if (accountId) {
      where.OR = [{ accountId }, { targetAccountId: accountId }];
    }
    if (branchId) where.branchId = branchId;
    if (groupId) where.groupId = groupId;
    if (courseId) where.courseId = courseId;
    if (studentMembershipId) where.studentMembershipId = studentMembershipId;

    if (periodParam && /^\d{4}-\d{2}$/.test(periodParam)) {
      const [yStr, mStr] = periodParam.split("-");
      const { startDate, endDate } = getTashkentMonthBounds(Number(yStr), Number(mStr));
      where.date = { gte: startDate, lte: endDate };
    } else if (startDateParam || endDateParam) {
      const dateCond: Record<string, Date> = {};
      if (startDateParam) dateCond.gte = new Date(startDateParam);
      if (endDateParam) dateCond.lte = new Date(endDateParam);
      where.date = dateCond;
    }

    if (search) {
      const searchOr = [
        { description: { contains: search, mode: "insensitive" } },
        { counterparty: { contains: search, mode: "insensitive" } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    const [total, transactions] = await Promise.all([
      tenantDb.financeTransaction.count({ where }),
      tenantDb.financeTransaction.findMany({
        where,
        include: {
          account: { select: { id: true, name: true, type: true } },
          targetAccount: { select: { id: true, name: true, type: true } },
          category: { select: { id: true, name: true, type: true, code: true } },
          group: { select: { id: true, name: true } },
          course: { select: { id: true, title: true } },
          branch: { select: { id: true, name: true } },
          student: {
            select: {
              id: true,
              user: { select: { fullName: true } },
            },
          },
          reversalOf: { select: { id: true, date: true, amount: true } },
          reversedBy: { select: { id: true, date: true, reversalReason: true } },
        },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return NextResponse.json({
      transactions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    return NextResponse.json(
      { error: error.message || "Failed to load finance transactions", code: error.code },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!canWriteFinance(tenantCtx.role, tenantCtx.isPlatformStaff)) {
      return NextResponse.json(
        { error: "Forbidden: No permission to create finance transactions" },
        { status: 403 }
      );
    }

    const ip = getClientIp(req);
    const allowed = await checkRateLimit(`finance_tx_post:${tenantCtx.session.user.id}:${ip}`, 100, 60_000);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawBody = await req.json();
    const parsed = createTransactionSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid transaction payload", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const txDate = data.date ? new Date(data.date) : new Date();
    if (Number.isNaN(txDate.getTime())) {
      return NextResponse.json({ error: "Invalid transaction date" }, { status: 400 });
    }

    const created = await recordFinanceTransaction({
      centerId: tenantCtx.center.id,
      type: data.type,
      amount: data.amount,
      accountId: data.accountId,
      targetAccountId: data.targetAccountId,
      categoryId: data.categoryId,
      date: txDate,
      description: data.description,
      counterparty: data.counterparty,
      studentMembershipId: data.studentMembershipId,
      groupId: data.groupId,
      courseId: data.courseId,
      branchId: data.branchId,
      centerPaymentId: data.centerPaymentId,
      createdBy: tenantCtx.session.user.id,
    });

    return NextResponse.json({ transaction: created }, { status: 201 });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number; code?: string };
    const msg = error.message || "Failed to record finance transaction";
    const status =
      error.status ||
      (msg.includes("Cross-tenant") || msg.includes("closed finance period") ? 403 : 400);
    return NextResponse.json({ error: msg, code: error.code }, { status });
  }
}
