import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { checkSubscriptionLimit } from "@/lib/limits";

// GET /api/tenant/branches - List branches for active center
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    const branches = await db.branch.findMany({
      where: { centerId: tenantCtx.center.id },
      include: {
        _count: { select: { groups: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ branches });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// POST /api/tenant/branches - Create a branch (DIRECTOR/CENTER_ADMIN only)
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: Only directors or admins can create branches" }, { status: 403 });
    }

    const { name, address, phone, email } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    const canAddBranch = await checkSubscriptionLimit(tenantCtx.center.id, "branches");
    if (!canAddBranch) {
      return NextResponse.json({ error: "PLAN_LIMIT_REACHED: Вы достигли лимита филиалов по вашему тарифу." }, { status: 403 });
    }

    const branch = await db.branch.create({
      data: {
        centerId: tenantCtx.center.id,
        name: name.trim(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BRANCH_CREATED",
      resource: "Branch",
      resourceId: branch.id,
      details: { name: branch.name },
    });

    return NextResponse.json({ success: true, branch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// PATCH /api/tenant/branches - Update a branch
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id, name, address, phone, email, isActive } = await req.json();

    if (!id) return NextResponse.json({ error: "Branch ID required" }, { status: 400 });

    // SECURITY: Verify branch belongs to this tenant
    const existing = await db.branch.findFirst({ where: { id, centerId: tenantCtx.center.id } });
    if (!existing) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    const branch = await db.branch.update({
      where: { id },
      data: {
        name: name?.trim() || existing.name,
        address: address !== undefined ? address?.trim() || null : existing.address,
        phone: phone !== undefined ? phone?.trim() || null : existing.phone,
        email: email !== undefined ? email?.trim() || null : existing.email,
        isActive: isActive !== undefined ? isActive : existing.isActive,
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BRANCH_UPDATED",
      resource: "Branch",
      resourceId: branch.id,
    });

    return NextResponse.json({ success: true, branch });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// DELETE /api/tenant/branches - Delete a branch (DIRECTOR only, if no active groups)
export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Only directors can delete branches" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Branch ID required" }, { status: 400 });

    // SECURITY: Verify branch belongs to this tenant
    const existing = await db.branch.findFirst({
      where: { id, centerId: tenantCtx.center.id },
      include: { _count: { select: { groups: true } } },
    });
    if (!existing) return NextResponse.json({ error: "Branch not found" }, { status: 404 });

    if (existing._count.groups > 0) {
      return NextResponse.json({
        error: `Cannot delete branch with ${existing._count.groups} active group(s). Reassign groups first.`,
      }, { status: 409 });
    }

    await db.branch.delete({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BRANCH_DELETED",
      resource: "Branch",
      resourceId: id,
      details: { name: existing.name },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}
