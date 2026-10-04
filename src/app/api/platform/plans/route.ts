import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformOwner, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";

export async function GET() {
  try {
    await requirePlatformOwner();
    const plans = await db.subscriptionPlan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: {
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
    });
    return NextResponse.json({ plans });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformOwner();
    const { name, maxStudents, maxTeachers, maxCourses, maxBranches, maxStorage, priceMonthly, featuresJson, isActive } = await req.json();

    if (!name || priceMonthly === undefined || maxStudents === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const plan = await db.subscriptionPlan.create({
      data: {
        name,
        maxStudents: Number(maxStudents),
        maxTeachers: Number(maxTeachers),
        maxCourses: Number(maxCourses),
        maxBranches: Number(maxBranches) || 1,
        maxStorage: Number(maxStorage) || 5120,
        priceMonthly: Number(priceMonthly),
        featuresJson: featuresJson || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_PLAN_CREATED",
      resource: "SubscriptionPlan",
      resourceId: plan.id,
      details: { name: plan.name },
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requirePlatformOwner();
    const { id, name, maxStudents, maxTeachers, maxCourses, maxBranches, maxStorage, priceMonthly, featuresJson, isActive } = await req.json();

    if (!id) return NextResponse.json({ error: "Plan ID required" }, { status: 400 });

    const plan = await db.subscriptionPlan.update({
      where: { id },
      data: {
        name,
        maxStudents: maxStudents !== undefined ? Number(maxStudents) : undefined,
        maxTeachers: maxTeachers !== undefined ? Number(maxTeachers) : undefined,
        maxCourses: maxCourses !== undefined ? Number(maxCourses) : undefined,
        maxBranches: maxBranches !== undefined ? Number(maxBranches) : undefined,
        maxStorage: maxStorage !== undefined ? Number(maxStorage) : undefined,
        priceMonthly: priceMonthly !== undefined ? Number(priceMonthly) : undefined,
        featuresJson,
        isActive,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_PLAN_UPDATED",
      resource: "SubscriptionPlan",
      resourceId: plan.id,
      details: { name: plan.name },
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    return handlePlatformError(err);
  }
}
