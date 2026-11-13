import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

const stornoSchema = z.object({
  reason: z.string().min(5, "Причина сторно обязательна (минимум 5 символов)"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePlatformPermission("platform.expenses.manage", req);
    const body = await req.json();
    const validated = stornoSchema.parse(body);

    const expense = await db.platformExpense.findUnique({
      where: { id: params.id },
      include: {
        reversedBy: true,
      },
    });

    if (!expense) {
      return NextResponse.json({ success: false, error: "Расход не найден" }, { status: 404 });
    }

    if (expense.isReversal) {
      return NextResponse.json({ success: false, error: "Нельзя сторнировать запись сторно" }, { status: 400 });
    }

    if (expense.reversedBy) {
      return NextResponse.json({ success: false, error: "Этот расход уже был сторнирован" }, { status: 400 });
    }

    const reversal = await db.platformExpense.create({
      data: {
        categoryId: expense.categoryId,
        amount: expense.amount,
        title: `Сторно: ${expense.title}`,
        description: `Сторнирование расхода #${expense.id}. Причина: ${validated.reason}`,
        counterparty: expense.counterparty,
        isReversal: true,
        reversalOfId: expense.id,
        reversalReason: validated.reason,
        createdBy: session.user.id,
      },
      include: {
        category: { select: { id: true, name: true } },
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_EXPENSE_STORNO",
      resource: "PlatformExpense",
      resourceId: reversal.id,
      details: {
        originalExpenseId: expense.id,
        amount: expense.amount,
        reason: validated.reason,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      reversal,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
