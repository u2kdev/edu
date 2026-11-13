import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import { generateNextInvoiceNumber } from "@/lib/platform-finance";
import type { Prisma, PlatformPaymentStatus, PaymentMethod, PlatformPaymentType } from "@prisma/client";

const recordPaymentSchema = z.object({
  centerId: z.string().min(1, "ID центра обязателен"),
  planId: z.string().optional(),
  subscriptionId: z.string().optional(),
  amount: z.number().int().positive("Сумма должна быть положительным числом"),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "ONLINE"]).default("BANK_TRANSFER"),
  paymentType: z.enum(["SUBSCRIPTION", "ADDON", "SETUP", "OTHER"]).default("SUBSCRIPTION"),
  status: z.enum(["PAID", "PENDING"]).default("PAID"),
  periodStartsAt: z.string().optional().nullable(),
  periodEndsAt: z.string().optional().nullable(),
  invoiceNumber: z.string().optional(),
  receiptUrl: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

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
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.PlatformPaymentWhereInput = {};

    if (centerId && centerId !== "ALL") {
      where.centerId = centerId;
    }

    if (status && status !== "ALL") {
      where.status = status as PlatformPaymentStatus;
    }

    if (paymentMethod && paymentMethod !== "ALL") {
      where.paymentMethod = paymentMethod as PaymentMethod;
    }

    if (planId && planId !== "ALL") {
      where.planId = planId;
    }

    if (dateFrom || dateTo) {
      where.paidAt = {};
      if (dateFrom) {
        where.paidAt.gte = new Date(dateFrom);
      }
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

    const [payments, totalCount, summaryAgg] = await Promise.all([
      db.platformPayment.findMany({
        where,
        orderBy: { paidAt: "desc" },
        skip,
        take: limit,
        include: {
          center: {
            select: { id: true, name: true, slug: true, status: true },
          },
          plan: {
            select: { id: true, name: true, priceMonthly: true },
          },
          recorder: {
            select: { id: true, fullName: true, email: true, platformRole: true },
          },
        },
      }),
      db.platformPayment.count({ where }),
      db.platformPayment.aggregate({
        where,
        _sum: {
          amount: true,
          refundAmount: true,
        },
      }),
    ]);

    const totalAmount = summaryAgg._sum.amount || 0;
    const totalRefunded = summaryAgg._sum.refundAmount || 0;
    const netAmount = totalAmount - totalRefunded;

    return NextResponse.json({
      success: true,
      payments,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      summary: {
        totalAmount,
        totalRefunded,
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
    const session = await requirePlatformPermission("platform.billing.manage", req);
    const body = await req.json();
    const validated = recordPaymentSchema.parse(body);

    const center = await db.learningCenter.findUnique({
      where: { id: validated.centerId },
      include: {
        subscriptions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!center) {
      return NextResponse.json({ success: false, error: "Учебный центр не найден" }, { status: 404 });
    }

    const invoiceNumber = validated.invoiceNumber || (await generateNextInvoiceNumber());

    const startDate = validated.periodStartsAt ? new Date(validated.periodStartsAt) : new Date();
    let endDate = validated.periodEndsAt ? new Date(validated.periodEndsAt) : null;

    if (!endDate && validated.paymentType === "SUBSCRIPTION") {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const result = await db.$transaction(async (tx) => {
      let subId = validated.subscriptionId;

      if (!subId && center.subscriptions.length > 0) {
        subId = center.subscriptions[0].id;
      }

      // If subscription exists and payment is PAID, update subscription period and center status
      if (validated.status === "PAID" && validated.paymentType === "SUBSCRIPTION") {
        if (subId) {
          const currentSub = await tx.subscription.findUnique({ where: { id: subId } });
          let newEnd = endDate;
          if (currentSub && currentSub.currentPeriodEndsAt > new Date() && !validated.periodEndsAt) {
            newEnd = new Date(currentSub.currentPeriodEndsAt);
            newEnd.setMonth(newEnd.getMonth() + 1);
          }

          await tx.subscription.update({
            where: { id: subId },
            data: {
              status: "ACTIVE",
              currentPeriodEndsAt: newEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
              planId: validated.planId || currentSub?.planId,
            },
          });
        }

        // Set center status to ACTIVE if it was OVERDUE or TRIAL or PAUSED
        if (["OVERDUE", "TRIAL", "PAUSED"].includes(center.status)) {
          await tx.learningCenter.update({
            where: { id: center.id },
            data: { status: "ACTIVE" },
          });
        }
      }

      const payment = await tx.platformPayment.create({
        data: {
          centerId: validated.centerId,
          subscriptionId: subId,
          planId: validated.planId || center.subscriptions[0]?.planId || null,
          amount: validated.amount,
          status: validated.status as PlatformPaymentStatus,
          paymentMethod: validated.paymentMethod as PaymentMethod,
          paymentType: validated.paymentType as PlatformPaymentType,
          periodStartsAt: startDate,
          periodEndsAt: endDate,
          invoiceNumber,
          receiptUrl: validated.receiptUrl || null,
          notes: validated.notes || null,
          recordedBy: session.user.id,
          paidAt: validated.status === "PAID" ? new Date() : null,
        },
        include: {
          center: { select: { id: true, name: true } },
          plan: { select: { id: true, name: true } },
        },
      });

      return payment;
    });

    await logAuditEvent({
      centerId: validated.centerId,
      actorUserId: session.user.id,
      action: "PLATFORM_PAYMENT_RECORDED",
      resource: "PlatformPayment",
      resourceId: result.id,
      details: {
        invoiceNumber,
        amount: validated.amount,
        status: validated.status,
        method: validated.paymentMethod,
      },
      ipAddress: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      payment: result,
    });
  } catch (err) {
    return handlePlatformError(err);
  }
}
