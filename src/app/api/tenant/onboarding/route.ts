import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAuthSession, signJWT } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return NextResponse.json({ error: "Авторизуйтесь для создания центра" }, { status: 401 });
    }

    const { name, slug, centerType } = await req.json();

    if (!name || !slug) {
      return NextResponse.json({ error: "Укажите название и доменный идентификатор (slug)" }, { status: 400 });
    }

    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-");

    const existingSlug = await db.learningCenter.findUnique({
      where: { slug: cleanSlug },
    });

    if (existingSlug) {
      return NextResponse.json({ error: "Этот slug уже занят другим учебным центром" }, { status: 400 });
    }

    // Get default plan or first plan
    const defaultPlan = await db.subscriptionPlan.findFirst({
      where: { isActive: true },
    });

    if (!defaultPlan) {
      return NextResponse.json({ error: "Тарифные планы еще не настроены платформой" }, { status: 500 });
    }

    // Create center
    const center = await db.learningCenter.create({
      data: {
        name,
        slug: cleanSlug,
        centerType: centerType || "HYBRID",
        status: "TRIAL",
        ownerId: session.user.id,
      },
    });

    // Create trial subscription (14 days)
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14);

    await db.subscription.create({
      data: {
        centerId: center.id,
        planId: defaultPlan.id,
        status: "TRIAL",
        trialEndsAt,
        currentPeriodStartsAt: new Date(),
        currentPeriodEndsAt: trialEndsAt,
      },
    });

    // Create Director membership
    const membership = await db.centerMembership.create({
      data: {
        userId: session.user.id,
        centerId: center.id,
        role: "DIRECTOR",
      },
    });

    // Update JWT token with new active center
    const token = signJWT({
      userId: session.user.id,
      email: session.user.email,
      platformRole: session.user.platformRole,
      activeCenterId: center.id,
      activeCenterRole: "DIRECTOR",
    });

    const response = NextResponse.json({
      success: true,
      center,
      membership,
    });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Ошибка при создании центра" }, { status: 500 });
  }
}
