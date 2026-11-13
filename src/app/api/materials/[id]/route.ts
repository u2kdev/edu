import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { assertMaterialAccess, assertGroupAccess } from "@/lib/tenant-access";
import { deleteStoredFile } from "@/lib/storage";
import { z } from "zod";
import { MaterialType } from "@prisma/client";

const updateMaterialSchema = z.object({
  title: z.string().min(2).optional(),
  contentText: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  materialType: z.nativeEnum(MaterialType).optional(),
  fileUrl: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  courseId: z.string().uuid().optional().nullable(),
  groupId: z.string().uuid().optional().nullable(),
});

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { id } = params;

    const material = await assertMaterialAccess(tenantCtx, id);

    if (tenantCtx.membership?.id) {
      await tenantCtx.getTenantDb().activityLog.create({
        data: {
          centerId: tenantCtx.center.id,
          userMembershipId: tenantCtx.membership.id,
          activityType: "VIEW_MATERIAL",
          resourceType: "Material",
          resourceId: material.id,
        },
      });
    }

    return NextResponse.json({
      material,
      downloadUrl: `/api/materials/${material.id}/download`,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status }
      );
    }
    console.error("[GET /api/materials/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();
    const { id } = params;

    const existing = await tenantDb.material.findFirst({
      where: { id, centerId: center.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const canManageAll = hasPermission(
      "materials.manage",
      session.user.platformRole,
      role
    );
    const isTeacher = role === "TEACHER" || role === "TEACHER_ASSISTANT";

    if (!canManageAll && !isTeacher) {
      return NextResponse.json(
        { error: "Forbidden: Cannot edit this material" },
        { status: 403 }
      );
    }

    if (!canManageAll && existing.groupId) {
      await assertGroupAccess(tenantCtx, existing.groupId, "read");
    }

    const body = await req.json();
    const parsed = updateMaterialSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { description, ...restData } = parsed.data;
    const updated = await tenantDb.material.update({
      where: { id },
      data: {
        ...restData,
        ...(description !== undefined ? { contentText: description } : {}),
      },
      include: {
        course: { select: { id: true, title: true } },
        group: { select: { id: true, name: true } },
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "UPDATE_MATERIAL",
      resource: "Material",
      resourceId: id,
      details: parsed.data,
    });

    return NextResponse.json({ material: updated });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[PATCH /api/materials/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session, getTenantDb } = tenantCtx;
    const tenantDb = getTenantDb();
    const { id } = params;

    const existing = await tenantDb.material.findFirst({
      where: { id, centerId: center.id, deletedAt: null },
    });

    if (!existing) {
      return NextResponse.json({ error: "Material not found" }, { status: 404 });
    }

    const canManageAll = hasPermission(
      "materials.manage",
      session.user.platformRole,
      role
    );
    const isTeacher = role === "TEACHER" || role === "TEACHER_ASSISTANT";

    if (!canManageAll && !isTeacher) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete this material" },
        { status: 403 }
      );
    }

    if (!canManageAll && existing.groupId) {
      await assertGroupAccess(tenantCtx, existing.groupId, "read");
    }

    await tenantDb.material.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    if (existing.fileUrl) {
      await deleteStoredFile(existing.fileUrl);
    }

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "DELETE_MATERIAL",
      resource: "Material",
      resourceId: id,
      details: { title: existing.title },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[DELETE /api/materials/[id]]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
