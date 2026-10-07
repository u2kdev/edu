import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { checkSubscriptionLimit } from "@/lib/limits";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    const courses = await tenantDb.course.findMany({
      include: {
        modules: {
          include: {
            lessons: true,
          },
          orderBy: { orderIndex: "asc" },
        },
        groups: {
          include: {
            teacher: {
              include: {
                user: { select: { fullName: true, email: true } },
              },
            },
            enrollments: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ courses });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка загрузки курсов" }, { status: err.status || 400 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав для создания курсов" }, { status: 403 });
    }

    const { title, description, coverImage, isPublished } = await req.json();

    if (!title) {
      return NextResponse.json({ error: "Укажите название курса" }, { status: err.status || 400 });
    }

    if (!tenantCtx.membership?.id) {
      return NextResponse.json({
        error: "Could not resolve your membership in this center. Ensure you have a membership record.",
      }, { status: 403 });
    }

    const canAddCourse = await checkSubscriptionLimit(tenantCtx.center.id, "courses");
    if (!canAddCourse) {
      return NextResponse.json({ error: "PLAN_LIMIT_REACHED: Вы достигли лимита курсов по вашему тарифу." }, { status: 403 });
    }

    const course = await tenantDb.course.create({
      data: {
        centerId: tenantCtx.center.id,
        title,
        description,
        coverImage,
        isPublished: isPublished ?? false,
        createdByMembershipId: tenantCtx.membership.id,
      },
    });

    return NextResponse.json({ success: true, course });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Ошибка создания курса" }, { status: err.status || 400 });
  }
}
