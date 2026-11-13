import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { SubscriptionStatus, CenterStatus } from "@prisma/client";

const patchSubscriptionSchema = z.object({
  extendDays: z.number().int().min(1).optional(),
  extendMonths: z.number().int().min(1).optional(),
  currentPeriodStartsAt: z.string().datetime().optional(),
  currentPeriodEndsAt: z.string().datetime().optional(),
  planId: z.string().optional(),
  status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "FROZEN", "CANCELLED"]).optional(),
  autoRenew: z.boolean().optional(),
  force: z.boolean().optional().default(false),
  reason: z.string().min(3).optional(),
});

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    await requirePlatformPermission("platform.billing.read", req);
    const { id } = params;

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: {
        center: true,
        plan: true,
        platformPayments: {
          orderBy: { paidAt: "desc" },
          take: 20,
        },
      },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 });
    }

    return NextResponse.json({ success: true, subscription });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requirePlatformPermission("platform.billing.manage", req);
    const { id } = params;
    const body = await req.json();
    const parsed = patchSubscriptionSchema.parse(body);

    const subscription = await db.subscription.findUnique({
      where: { id },
      include: { center: true, plan: true },
    });

    if (!subscription) {
      return NextResponse.json({ error: "Подписка не найдена" }, { status: 404 });
    }

    const updateData: {
      planId?: string;
      status?: SubscriptionStatus;
      autoRenew?: boolean;
      currentPeriodStartsAt?: Date;
      currentPeriodEndsAt?: Date;
    } = {};

    let targetCenterStatus: CenterStatus | undefined;

    // 1. Plan Change with Limit Checking
    if (parsed.planId && parsed.planId !== subscription.planId) {
      const newPlan = await db.subscriptionPlan.findUnique({ where: { id: parsed.planId } });
      if (!newPlan) {
        return NextResponse.json({ error: "Выбранный тариф не найден" }, { status: 404 });
      }

      // Check current counts for center
      const [currentStudents, currentTeachers] = await Promise.all([
        db.centerMembership.count({
          where: { centerId: subscription.centerId, role: "STUDENT", status: "ACTIVE" },
        }),
        db.centerMembership.count({
          where: {
            centerId: subscription.centerId,
            role: { in: ["TEACHER", "TEACHER_ASSISTANT"] },
            status: "ACTIVE",
          },
        }),
      ]);

      const studentsExceeded = currentStudents > newPlan.maxStudents;
      const teachersExceeded = currentTeachers > newPlan.maxTeachers;

      if ((studentsExceeded || teachersExceeded) && !parsed.force) {
        return NextResponse.json(
          {
            error: "Текущее количество студентов или учителей превышает лимиты выбранного тарифа",
            warning: "LIMIT_EXCEEDED",
            requiresOverride: true,
            details: {
              currentStudents,
              maxStudents: newPlan.maxStudents,
              studentsExceeded,
              currentTeachers,
              maxTeachers: newPlan.maxTeachers,
              teachersExceeded,
            },
          },
          { status: 400 }
        );
      }

      updateData.planId = newPlan.id;
    }

    // 2. Extend subscription
    if (parsed.extendDays) {
      const baseDate = new Date(subscription.currentPeriodEndsAt) > new Date()
        ? new Date(subscription.currentPeriodEndsAt)
        : new Date();
      baseDate.setDate(baseDate.getDate() + parsed.extendDays);
      updateData.currentPeriodEndsAt = baseDate;
      updateData.status = "ACTIVE";
      targetCenterStatus = "ACTIVE";
    } else if (parsed.extendMonths) {
      const baseDate = new Date(subscription.currentPeriodEndsAt) > new Date()
        ? new Date(subscription.currentPeriodEndsAt)
        : new Date();
      baseDate.setMonth(baseDate.getMonth() + parsed.extendMonths);
      updateData.currentPeriodEndsAt = baseDate;
      updateData.status = "ACTIVE";
      targetCenterStatus = "ACTIVE";
    }

    // 3. Custom dates
    if (parsed.currentPeriodStartsAt) {
      updateData.currentPeriodStartsAt = new Date(parsed.currentPeriodStartsAt);
    }
    if (parsed.currentPeriodEndsAt) {
      updateData.currentPeriodEndsAt = new Date(parsed.currentPeriodEndsAt);
    }

    // 4. Status change & sync with Center
    if (parsed.status) {
      updateData.status = parsed.status as SubscriptionStatus;
      if (parsed.status === "ACTIVE") targetCenterStatus = "ACTIVE";
      else if (parsed.status === "TRIAL") targetCenterStatus = "TRIAL";
      else if (parsed.status === "PAST_DUE") targetCenterStatus = "OVERDUE";
      else if (parsed.status === "FROZEN") targetCenterStatus = "PAUSED";
      else if (parsed.status === "CANCELLED") targetCenterStatus = "CANCELLED";
    }

    // 5. AutoRenew
    if (parsed.autoRenew !== undefined) {
      updateData.autoRenew = parsed.autoRenew;
    }

    // Perform DB updates in transaction
    const [updatedSub] = await db.$transaction([
      db.subscription.update({
        where: { id },
        data: updateData,
        include: { center: true, plan: true },
      }),
      ...(targetCenterStatus
        ? [
            db.learningCenter.update({
              where: { id: subscription.centerId },
              data: { status: targetCenterStatus },
            }),
          ]
        : []),
    ]);

    await logAuditEvent({
      action: "PLATFORM_SUBSCRIPTION_UPDATED",
      resource: "Subscription",
      resourceId: id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        centerId: subscription.centerId,
        changes: updateData,
        reason: parsed.reason,
      },
    });

    return NextResponse.json({ success: true, subscription: updatedSub });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
