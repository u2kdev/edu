import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import type { Prisma, PlatformPaymentStatus, PaymentMethod } from "@prisma/client";

function escapeCsv(val: unknown): string {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const centerId = searchParams.get("centerId")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const paymentMethod = searchParams.get("paymentMethod")?.trim() || "";
    const planId = searchParams.get("planId")?.trim() || "";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";

    const where: Prisma.PlatformPaymentWhereInput = {};

    if (centerId && centerId !== "ALL") where.centerId = centerId;
    if (status && status !== "ALL") where.status = status as PlatformPaymentStatus;
    if (paymentMethod && paymentMethod !== "ALL") where.paymentMethod = paymentMethod as PaymentMethod;
    if (planId && planId !== "ALL") where.planId = planId;

    if (dateFrom || dateTo) {
      where.paidAt = {};
      if (dateFrom) where.paidAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.paidAt.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { center: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    const payments = await db.platformPayment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: 1000,
      include: {
        center: { select: { name: true } },
        plan: { select: { name: true } },
      },
    });

    const headers = [
      "Номер счёта",
      "Учебный центр",
      "Дата оплаты",
      "Тариф",
      "Способ оплаты",
      "Сумма (UZS)",
      "Возвращено (UZS)",
      "Чистая сумма (UZS)",
      "Статус",
      "Примечание",
    ];

    const rows = payments.map((p) => {
      const net = p.amount - (p.refundAmount || 0);
      return [
        escapeCsv(p.invoiceNumber || ""),
        escapeCsv(p.center.name),
        escapeCsv(p.paidAt ? p.paidAt.toISOString().slice(0, 10) : ""),
        escapeCsv(p.plan?.name || "—"),
        escapeCsv(p.paymentMethod),
        escapeCsv(p.amount),
        escapeCsv(p.refundAmount || 0),
        escapeCsv(net),
        escapeCsv(p.status),
        escapeCsv(p.notes || ""),
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="platform-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
