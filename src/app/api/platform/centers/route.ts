import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { logAuditEvent } from "@/lib/tenant";

// GET /api/platform/centers - List all centers for Platform Admins
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session || (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "PLATFORM_ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Only platform admins can list all centers" }, { status: 403 });
    }

    const centers = await db.learningCenter.findMany({
      include: {
        owner: { select: { id: true, fullName: true, email: true, phone: true } },
        subscriptions: { include: { plan: true }, orderBy: { createdAt: "desc" }, take: 1 },
        memberships: { select: { id: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ centers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}

// POST /api/platform/centers - Exclusively for Superadmin / Platform Admin to create a new LearningCenter
export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "PLATFORM_ADMIN")) {
      return NextResponse.json(
        { error: "Forbidden: Только Суперадмин или Админ платформы может создавать учебные центры" },
        { status: 403 }
      );
    }

    const { name, slug, centerType, planId, directorEmail, directorFullName, directorPhone } = await req.json();

    if (!name || !slug || !directorEmail || !directorFullName) {
      return NextResponse.json(
        { error: "Заполните все обязательные поля: название центра, slug, email директора и ФИО директора" },
        { status: 400 }
      );
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const existingSlug = await db.learningCenter.findUnique({
      where: { slug: cleanSlug },
    });

    if (existingSlug) {
      return NextResponse.json({ error: "Этот slug уже занят другим учебным центром" }, { status: 400 });
    }

    // 1. Find or create Director User
    let directorUser = await db.platformUser.findUnique({
      where: { email: directorEmail.toLowerCase().trim() },
    });

    if (!directorUser) {
      const tempPasswordHash = await hashPassword("Password123!");
      directorUser = await db.platformUser.create({
        data: {
          email: directorEmail.toLowerCase().trim(),
          fullName: directorFullName,
          phone: directorPhone || null,
          passwordHash: tempPasswordHash,
        },
      });
    }

    // 2. Create Learning Center
    const center = await db.learningCenter.create({
      data: {
        name,
        slug: cleanSlug,
        centerType: centerType || "HYBRID",
        status: "ACTIVE",
        ownerId: directorUser.id,
      },
    });

    // 3. Create Subscription
    const selectedPlan = planId
      ? await db.subscriptionPlan.findUnique({ where: { id: planId } })
      : await db.subscriptionPlan.findFirst({ where: { isActive: true } });

    if (selectedPlan) {
      const periodEndsAt = new Date();
      periodEndsAt.setDate(periodEndsAt.getDate() + 30);

      await db.subscription.create({
        data: {
          centerId: center.id,
          planId: selectedPlan.id,
          status: "ACTIVE",
          currentPeriodStartsAt: new Date(),
          currentPeriodEndsAt: periodEndsAt,
        },
      });
    }

    // 4. Create Director CenterMembership
    const membership = await db.centerMembership.create({
      data: {
        userId: directorUser.id,
        centerId: center.id,
        role: "DIRECTOR",
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "PLATFORM_CREATE_LEARNING_CENTER",
      resource: "LearningCenter",
      resourceId: center.id,
      details: { name: center.name, slug: center.slug, directorEmail: directorUser.email },
    });

    return NextResponse.json({
      success: true,
      center,
      director: {
        id: directorUser.id,
        email: directorUser.email,
        fullName: directorUser.fullName,
      },
      membership,
    });
  } catch (err: any) {
    console.error("Platform Center Creation Error:", err);
    return NextResponse.json({ error: err.message || "Ошибка при создании центра" }, { status: 500 });
  }
}

// PATCH /api/platform/centers - Change Center Status (ACTIVE, FROZEN, BLOCKED)
export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session || (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "PLATFORM_ADMIN")) {
      return NextResponse.json({ error: "Forbidden: Platform admin privileges required" }, { status: 403 });
    }

    const { centerId, status } = await req.json();

    if (!centerId || !status) {
      return NextResponse.json({ error: "Center ID and status required" }, { status: 400 });
    }

    const center = await db.learningCenter.update({
      where: { id: centerId },
      data: { status },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "PLATFORM_CHANGE_CENTER_STATUS",
      resource: "LearningCenter",
      resourceId: center.id,
      details: { newStatus: status },
    });

    return NextResponse.json({ success: true, center });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка сервера" }, { status: 500 });
  }
}
