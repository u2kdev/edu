import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";

const refundSchema = z.object({
  refundAmount: z.number().int().positive("Сумма возврата должна быть положительным числом"),
  reason: z.string().min(5, "Причина возврата обязательна (минимум 5 символов)"),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await requirePlatformPermission("platform.billing.refund", req);
    const body = await req.json();
    const validated = refundSchema.parse(body);

    const payment = await db.platformPayment.findUnique({
      where: { id: params.id },
      include: { center: true },
    });

    if (!payment) {
      return NextResponse.json({ success: false, error: "Платёж не найден" }, { status: 404 });
    }

    if (payment.status === "REFUNDED") {
      return NextResponse.json({ success: false, error: "Платёж уже полностью возвращён" }, { status: 400 });
    }

    const currentRefunded = payment.refundAmount || 0;
    const maxAvailable = payment.amount - currentRefunded;

    if (validated.refundAmount > maxAvailable) {
      return NextResponse.json(
        {
          success: false,
          error: `Сумма возврата (${validated.refundAmount} UZS) превышает доступный остаток (${maxAvailable} UZS)`,
        },
        { status: 400 }
      );
    }

    const newRefundTotal = currentRefunded + validated.refundAmount;
    const isFullRefund = newRefundTotal >= payment.amount;

    const updated = await db.platformPayment.update({
      where: { id: params.id },
      data: {
        refundAmount: newRefundTotal,
        refundReason: validated.reason,
        refundedAt: new Date(),
        status: isFullRefund ? "REFUNDED" : "PAID",
      },
      include: {
        center: { select: { id: true, name: true } },
        plan: { select: { id: true, name: true } },
      },
    });

    await logAuditEvent({
      centerId: payment.centerId,
      actorUserId: session.user.id,
      action: "PLATFORM_PAYMENT_REFUNDED",
      resource: "PlatformPayment",
      resourceId: payment.id,
      details: {
        refundAmount: validated.refundAmount,
        totalRefunded: newRefundTotal,
        originalAmount: payment.amount,
        isFullRefund,
        reason: validated.reason,
        invoiceNumber: payment.invoiceNumber,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      payment: updated,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
