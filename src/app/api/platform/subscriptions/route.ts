import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { Prisma, SubscriptionStatus } from "@prisma/client";

const createSubscriptionSchema = z.object({
  centerId: z.string().min(1, "ID центра обязателен"),
  planId: z.string().min(1, "ID тарифа обязателен"),
  durationMonths: z.number().int().min(1).default(1),
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "FROZEN", "CANCELLED"]).default("ACTIVE"),
  autoRenew: z.boolean().default(true),
});

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.billing.read", req);

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "";
    const planId = searchParams.get("planId")?.trim() || "";
    const expiringInDays = searchParams.get("expiringInDays") ? parseInt(searchParams.get("expiringInDays")!, 10) : null;
    const debtors = searchParams.get("debtors") === "true";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: Prisma.SubscriptionWhereInput = {};

    if (search) {
      where.center = {
        name: { contains: search, mode: "insensitive" },
      };
    }

    if (status && status !== "ALL") {
      where.status = status as SubscriptionStatus;
    }

    if (planId && planId !== "ALL") {
      where.planId = planId;
    }

    const now = new Date();

    if (debtors) {
      where.OR = [
        { status: "PAST_DUE" },
        { currentPeriodEndsAt: { lt: now }, status: { in: ["ACTIVE", "TRIAL"] } },
      ];
    } else if (expiringInDays !== null && !isNaN(expiringInDays)) {
      const future = new Date(now.getTime() + expiringInDays * 24 * 60 * 60 * 1000);
      where.currentPeriodEndsAt = {
        gte: now,
        lte: future,
      };
      where.status = { in: ["ACTIVE", "TRIAL"] };
    }

    const [total, subscriptions] = await Promise.all([
      db.subscription.count({ where }),
      db.subscription.findMany({
        where,
        orderBy: { currentPeriodEndsAt: "asc" },
        skip,
        take: limit,
        include: {
          center: {
            select: {
              id: true,
              name: true,
              slug: true,
              status: true,
            },
          },
          plan: {
            select: {
              id: true,
              name: true,
              priceMonthly: true,
              maxStudents: true,
              maxTeachers: true,
              maxCourses: true,
            },
          },
          platformPayments: {
            where: { status: "PAID" },
            orderBy: { paidAt: "desc" },
            take: 1,
            select: {
              id: true,
              amount: true,
              paidAt: true,
              invoiceNumber: true,
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      subscriptions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.billing.manage", req);
    const body = await req.json();
    const parsed = createSubscriptionSchema.parse(body);

    const { centerId, planId, durationMonths, status, autoRenew } = parsed;

    const center = await db.learningCenter.findUnique({ where: { id: centerId } });
    if (!center) {
      return NextResponse.json({ error: "Учебный центр не найден" }, { status: 404 });
    }

    const plan = await db.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return NextResponse.json({ error: "Тарифный план не найден" }, { status: 404 });
    }

    const now = new Date();
    const endsAt = new Date(now);
    endsAt.setMonth(endsAt.getMonth() + durationMonths);

    // Upsert subscription for center
    const existingSub = await db.subscription.findFirst({ where: { centerId } });
    const subscription = existingSub
      ? await db.subscription.update({
          where: { id: existingSub.id },
          data: {
            planId,
            status,
            autoRenew,
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: endsAt,
            trialEndsAt: status === "TRIAL" ? endsAt : null,
          },
          include: { center: true, plan: true },
        })
      : await db.subscription.create({
          data: {
            centerId,
            planId,
            status,
            autoRenew,
            currentPeriodStartsAt: now,
            currentPeriodEndsAt: endsAt,
            trialEndsAt: status === "TRIAL" ? endsAt : null,
          },
          include: { center: true, plan: true },
        });

    // Sync center status
    const targetCenterStatus = status === "TRIAL" ? "TRIAL" : "ACTIVE";
    await db.learningCenter.update({
      where: { id: centerId },
      data: { status: targetCenterStatus },
    });

    await logAuditEvent({
      action: "PLATFORM_SUBSCRIPTION_ASSIGNED",
      resource: "Subscription",
      resourceId: subscription.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        centerId,
        planId,
        status,
        durationMonths,
      },
    });

    return NextResponse.json({ success: true, subscription }, { status: 201 });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
