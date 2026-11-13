import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { Prisma } from "@prisma/client";

const createExpenseSchema = z.object({
  categoryId: z.string().min(1, "Категория расхода обязательна"),
  amount: z.number().int().positive("Сумма должна быть положительным числом"),
  title: z.string().min(2, "Название расхода обязательно"),
  description: z.string().optional().nullable(),
  counterparty: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  receiptUrl: z.string().optional().nullable(),
});

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const categoryId = searchParams.get("categoryId")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.PlatformExpenseWhereInput = {};

    if (categoryId && categoryId !== "ALL") {
      where.categoryId = categoryId;
    }

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) where.date.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.date.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { counterparty: { contains: search, mode: "insensitive" } },
      ];
    }

    const [expenses, totalCount, totalExpensesAgg, totalReversalsAgg] = await Promise.all([
      db.platformExpense.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: limit,
        include: {
          category: { select: { id: true, name: true, code: true } },
          creator: { select: { id: true, fullName: true, email: true } },
          reversalOf: { select: { id: true, title: true, amount: true } },
          reversedBy: { select: { id: true, title: true, amount: true, reversalReason: true } },
        },
      }),
      db.platformExpense.count({ where }),
      db.platformExpense.aggregate({
        where: { ...where, isReversal: false },
        _sum: { amount: true },
      }),
      db.platformExpense.aggregate({
        where: { ...where, isReversal: true },
        _sum: { amount: true },
      }),
    ]);

    const regularAmount = totalExpensesAgg._sum.amount || 0;
    const reversalAmount = totalReversalsAgg._sum.amount || 0;
    const netAmount = regularAmount - reversalAmount;

    return NextResponse.json({
      success: true,
      expenses,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalAmount: regularAmount,
        reversalsAmount: reversalAmount,
        netAmount,
        count: totalCount,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.expenses.manage", req);
    const body = await req.json();
    const validated = createExpenseSchema.parse(body);

    const category = await db.platformExpenseCategory.findUnique({
      where: { id: validated.categoryId },
    });
    if (!category) {
      return NextResponse.json({ success: false, error: "Категория не найдена" }, { status: 404 });
    }

    const expenseDate = validated.date ? new Date(validated.date) : new Date();

    const expense = await db.platformExpense.create({
      data: {
        categoryId: validated.categoryId,
        amount: validated.amount,
        title: validated.title,
        description: validated.description || null,
        counterparty: validated.counterparty || null,
        receiptUrl: validated.receiptUrl || null,
        date: expenseDate,
        createdBy: session.user.id,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_EXPENSE_CREATED",
      resource: "PlatformExpense",
      resourceId: expense.id,
      details: {
        title: expense.title,
        amount: expense.amount,
        category: category.name,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      expense,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
