import { NextResponse } from "next/server";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requirePlatformPermission, handlePlatformError } from "@/lib/platformAuth";
import { logAuditEvent } from "@/lib/tenant";
import { PlanFeaturesSchema, parsePlanFeatures } from "@/lib/plan-features";

function normalizeFeaturesJson(features: unknown, featuresJson: unknown): string | undefined {
  if (features && typeof features === "object" && !Array.isArray(features)) {
    const validated = PlanFeaturesSchema.parse(features);
    return JSON.stringify(validated);
  }
  if (typeof featuresJson === "string") {
    const trimmed = featuresJson.trim();
    if (!trimmed) return undefined;
    // Validate JSON parses cleanly; if structured feature flags object, normalize through schema
    const parsed: unknown = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return JSON.stringify(parsePlanFeatures(trimmed));
    }
    return trimmed;
  }
  return undefined;
}

export async function GET(req: Request) {
  try {
    await requirePlatformPermission("platform.plans.manage", req);
    const plans = await db.subscriptionPlan.findMany({
      orderBy: { priceMonthly: "asc" },
      include: {
        _count: { select: { subscriptions: { where: { status: "ACTIVE" } } } },
      },
    });
    return NextResponse.json({
      plans: plans.map((p) => ({
        ...p,
        features: parsePlanFeatures(p.featuresJson),
      })),
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.plans.manage", req);
    const {
      name,
      maxStudents,
      maxTeachers,
      maxCourses,
      maxBranches,
      maxStorage,
      priceMonthly,
      featuresJson,
      features,
      isActive,
    } = await req.json();

    if (!name || priceMonthly === undefined || maxStudents === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let normalizedFeaturesJson: string | null = null;
    try {
      normalizedFeaturesJson = normalizeFeaturesJson(features, featuresJson) ?? null;
    } catch {
      return NextResponse.json({ error: "Invalid plan features payload" }, { status: 400 });
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
        featuresJson: normalizedFeaturesJson,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_PLAN_CREATED",
      resource: "SubscriptionPlan",
      resourceId: plan.id,
      details: { name: plan.name },
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        features: parsePlanFeatures(plan.featuresJson),
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requirePlatformPermission("platform.plans.manage", req);
    const {
      id,
      name,
      maxStudents,
      maxTeachers,
      maxCourses,
      maxBranches,
      maxStorage,
      priceMonthly,
      featuresJson,
      features,
      isActive,
    } = await req.json();

    if (!id) return NextResponse.json({ error: "Plan ID required" }, { status: 400 });

    let normalizedFeaturesJson: string | undefined;
    try {
      normalizedFeaturesJson = normalizeFeaturesJson(features, featuresJson);
    } catch {
      return NextResponse.json({ error: "Invalid plan features payload" }, { status: 400 });
    }

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
        ...(normalizedFeaturesJson !== undefined ? { featuresJson: normalizedFeaturesJson } : {}),
        isActive,
      },
    });

    await logAuditEvent({
      actorUserId: session.user.id,
      action: "PLATFORM_PLAN_UPDATED",
      resource: "SubscriptionPlan",
      resourceId: plan.id,
      details: { name: plan.name, updatedFeatures: Boolean(normalizedFeaturesJson) },
    });

    return NextResponse.json({
      success: true,
      plan: {
        ...plan,
        features: parsePlanFeatures(plan.featuresJson),
      },
    });
  } catch (err: unknown) {
    return handlePlatformError(err);
  }
}
