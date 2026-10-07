import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// GET /api/tenant/subjects
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    const subjects = await tenantDb.subject.findMany({
      include: { _count: { select: { courses: true, groups: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ subjects });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// POST /api/tenant/subjects
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { name, color } = await req.json();
    if (!name?.trim()) {
      return NextResponse.json({ error: "Subject name is required" }, { status: 400 });
    }

    const subject = await tenantDb.subject.create({
      data: {
        centerId: tenantCtx.center.id,
        name: name.trim(),
        color: color?.trim() || null,
      },
    });

    return NextResponse.json({ success: true, subject });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// PATCH /api/tenant/subjects
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, name, color } = await req.json();
    if (!id) return NextResponse.json({ error: "Subject ID required" }, { status: 400 });

    const existing = await tenantDb.subject.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    await tenantDb.subject.updateMany({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        color: color !== undefined ? color?.trim() || null : existing.color,
      },
    });
    const subject = await tenantDb.subject.findFirst({ where: { id } });

    return NextResponse.json({ success: true, subject });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// DELETE /api/tenant/subjects
export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Only directors can delete subjects" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Subject ID required" }, { status: 400 });

    const existing = await tenantDb.subject.findFirst({
      where: { id },
      include: { _count: { select: { courses: true, groups: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Subject not found" }, { status: 404 });

    if (existing._count.courses > 0 || existing._count.groups > 0) {
      return NextResponse.json({
        error: `Cannot delete subject used by ${existing._count.courses} course(s) and ${existing._count.groups} group(s).`,
      }, { status: 409 });
    }

    await tenantDb.subject.deleteMany({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "SUBJECT_DELETED",
      resource: "Subject",
      resourceId: id,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}
