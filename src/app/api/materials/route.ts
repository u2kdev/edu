import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { getScopedMaterialWhere, assertGroupAccess } from "@/lib/tenant-access";
import { checkStorageQuota } from "@/lib/storage";
import { z } from "zod";
import { MaterialType, Prisma } from "@prisma/client";

const createMaterialSchema = z.object({
  title: z.string().min(2, "Title is required"),
  description: z.string().optional().nullable(),
  contentText: z.string().optional().nullable(),
  type: z.string().optional(),
  materialType: z.string().optional(),
  fileUrl: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  fileSizeBytes: z.number().int().optional().nullable(),
  durationMinutes: z.number().int().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
});

function resolveMaterialType(raw?: string, hasExternalOnly?: boolean): MaterialType {
  if (!raw) {
    return hasExternalOnly ? MaterialType.LINK : MaterialType.LECTURE;
  }
  const upper = raw.toUpperCase();
  if (upper in MaterialType) {
    return upper as MaterialType;
  }
  if (upper === "VIDEO") return MaterialType.VIDEO;
  if (upper === "LINK") return MaterialType.LINK;
  if (upper === "BOOK" || upper === "PDF") return MaterialType.BOOK;
  if (upper === "TEST") return MaterialType.TEST;
  return MaterialType.LECTURE;
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();

    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const groupId = searchParams.get("groupId");
    const rawType = searchParams.get("type") || searchParams.get("materialType");
    const search = searchParams.get("search");

    const scopedWhere = await getScopedMaterialWhere(tenantCtx);
    const filterWhere: Prisma.MaterialWhereInput = {};

    if (courseId) filterWhere.courseId = courseId;
    if (groupId) filterWhere.groupId = groupId;
    if (rawType && rawType in MaterialType) {
      filterWhere.materialType = rawType as MaterialType;
    }
    if (search) {
      filterWhere.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { contentText: { contains: search, mode: "insensitive" } },
      ];
    }

    const [materials, quota] = await Promise.all([
      tenantDb.material.findMany({
        where: {
          AND: [scopedWhere, filterWhere],
        },
        include: {
          course: { select: { id: true, title: true } },
          group: { select: { id: true, name: true } },
          lesson: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
      checkStorageQuota(center.id),
    ]);

    return NextResponse.json({
      materials,
      quota: {
        ...quota,
        usedMb: Math.round((quota.usedBytes / (1024 * 1024)) * 100) / 100,
        maxMb: Math.round(quota.maxBytes / (1024 * 1024)),
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[GET /api/materials]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();

    if (
      !hasPermission("materials.upload", session.user.platformRole, role) &&
      !hasPermission("materials.manage", session.user.platformRole, role) &&
      role !== "TEACHER" &&
      role !== "TEACHER_ASSISTANT"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Cannot upload materials" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = createMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      title,
      description,
      contentText,
      type,
      materialType,
      fileUrl,
      externalUrl,
      fileSizeBytes,
      durationMinutes,
      courseId,
      groupId,
      lessonId,
    } = parsed.data;

    if (!fileUrl && !externalUrl && !contentText && !description) {
      return NextResponse.json(
        { error: "File URL, external link, or text content is required" },
        { status: 400 }
      );
    }

    if (groupId && (role === "TEACHER" || role === "TEACHER_ASSISTANT")) {
      await assertGroupAccess(tenantCtx, groupId, "read");
    }

    const resolvedMaterialType = resolveMaterialType(
      materialType || type,
      Boolean(externalUrl && !fileUrl)
    );

    const material = await tenantDb.material.create({
      data: {
        centerId: center.id,
        title: title.trim(),
        contentText: contentText ?? description ?? null,
        materialType: resolvedMaterialType,
        fileUrl: fileUrl || null,
        externalUrl: externalUrl || null,
        fileSizeBytes: fileSizeBytes ?? null,
        durationMinutes: durationMinutes ?? null,
        courseId: courseId || null,
        groupId: groupId || null,
        lessonId: lessonId || null,
      },
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
        lesson: { select: { id: true, title: true } },
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "CREATE_MATERIAL",
      resource: "Material",
      resourceId: material.id,
      details: {
        title: material.title,
        materialType: material.materialType,
        courseId,
        groupId,
      },
    });

    return NextResponse.json({ material }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[POST /api/materials]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
