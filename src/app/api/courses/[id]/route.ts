import { NextResponse } from "next/server";
import { z } from "zod";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";

const updateCourseSchema = z.object({
  title: z.string().min(2, "Название должно содержать минимум 2 символа").max(120).optional(),
  description: z.string().optional().nullable(),
  coverImage: z.string().optional().nullable(),
  priceMonthly: z.number().min(0).optional(),
  isPublished: z.boolean().optional(),
  subjectId: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
  reason: z.string().min(5, "Причина должна содержать минимум 5 символов").optional(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const canRead =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.read", session.user.platformRole, actorRole as CenterRole) ||
      ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "TEACHER_ASSISTANT", "STUDENT"].includes(actorRole);

    if (!canRead) {
      return NextResponse.json({ error: "Forbidden: No permission to view courses" }, { status: 403 });
    }

    const course = await tenantDb.course.findFirst({
      where: {
        id: params.id,
        centerId: center.id,
      },
      include: {
        subject: { select: { id: true, name: true } },
        creator: {
          include: {
            user: { select: { id: true, fullName: true, email: true } },
          },
        },
        modules: {
          orderBy: { orderIndex: "asc" },
          include: {
            lessons: {
              orderBy: { orderIndex: "asc" },
              include: {
                materials: {
                  where: { deletedAt: null },
                  select: { id: true, title: true, materialType: true, fileUrl: true, externalUrl: true },
                },
                homeworks: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
        materials: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        groups: {
          select: {
            id: true,
            name: true,
            maxStudents: true,
            teacher: {
              include: {
                user: { select: { fullName: true } },
              },
            },
            _count: {
              select: { enrollments: { where: { status: "ACTIVE" } } },
            },
          },
        },
      },
    });

    if (!course) {
      return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    }

    const totalLessons = course.modules.reduce((sum, mod) => sum + mod.lessons.length, 0);
    const totalStudents = course.groups.reduce((sum, g) => sum + g._count.enrollments, 0);

    return NextResponse.json({
      course,
      stats: {
        modulesCount: course.modules.length,
        lessonsCount: totalLessons,
        groupsCount: course.groups.length,
        studentsCount: totalStudents,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("GET /api/courses/[id] error:", err);
    return NextResponse.json({ error: "Не удалось загрузить курс" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole);

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission to manage courses" }, { status: 403 });
    }

    const course = await tenantDb.course.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!course) {
      return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateCourseSchema.parse(body);

    const updateData: {
      title?: string;
      description?: string | null;
      coverImage?: string | null;
      priceMonthly?: number;
      isPublished?: boolean;
      subjectId?: string | null;
      deletedAt?: Date | null;
    } = {};

    if (parsed.title !== undefined) updateData.title = parsed.title.trim();
    if (parsed.description !== undefined) updateData.description = parsed.description;
    if (parsed.coverImage !== undefined) updateData.coverImage = parsed.coverImage;
    if (parsed.priceMonthly !== undefined) updateData.priceMonthly = parsed.priceMonthly;
    if (parsed.isPublished !== undefined) updateData.isPublished = parsed.isPublished;
    if (parsed.subjectId !== undefined) updateData.subjectId = parsed.subjectId;

    if (parsed.isArchived !== undefined) {
      if (parsed.isArchived && !parsed.reason) {
        return NextResponse.json(
          { error: "Для архивации курса обязательна причина (минимум 5 символов)" },
          { status: 400 }
        );
      }
      updateData.deletedAt = parsed.isArchived ? new Date() : null;
    }

    const updated = await tenantDb.course.update({
      where: { id: course.id },
      data: updateData,
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: parsed.isArchived ? "COURSE_ARCHIVED" : "COURSE_UPDATED",
      resource: "Course",
      resourceId: course.id,
      details: {
        title: updated.title,
        isPublished: updated.isPublished,
        isArchived: Boolean(updated.deletedAt),
        reason: parsed.reason,
      },
    });

    return NextResponse.json({ success: true, course: updated });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("PATCH /api/courses/[id] error:", err);
    return NextResponse.json({ error: "Не удалось обновить курс" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    const canManage =
      tenantCtx.isPlatformStaff ||
      hasPermission("courses.manage", session.user.platformRole, actorRole as CenterRole);

    if (!canManage) {
      return NextResponse.json({ error: "Forbidden: No permission to delete courses" }, { status: 403 });
    }

    const url = new URL(req.url);
    const reason = url.searchParams.get("reason") || "";
    if (reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Для удаления/архивации курса обязательна причина (минимум 5 символов)" },
        { status: 400 }
      );
    }

    const course = await tenantDb.course.findFirst({
      where: { id: params.id, centerId: center.id },
    });

    if (!course) {
      return NextResponse.json({ error: "Курс не найден" }, { status: 404 });
    }

    // Soft delete via deletedAt
    await tenantDb.course.update({
      where: { id: course.id },
      data: {
        deletedAt: new Date(),
        isPublished: false,
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "COURSE_DELETED",
      resource: "Course",
      resourceId: course.id,
      details: {
        title: course.title,
        reason,
      },
    });

    return NextResponse.json({ success: true, message: "Курс архивирован" });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("DELETE /api/courses/[id] error:", err);
    return NextResponse.json({ error: "Не удалось удалить курс" }, { status: 500 });
  }
}
