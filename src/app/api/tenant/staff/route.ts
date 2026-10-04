import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getTenantDb } from "@/lib/db-tenant";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkSubscriptionLimit } from "@/lib/limits";
import crypto from "crypto";

// GET /api/tenant/staff — List all staff members of the active center
export async function GET() {
  try {
    const tenantCtx = await requireTenantAccess();
    const { session, center, role } = tenantCtx;
    const tenantDb = getTenantDb(center.id);

    // Only Director and Center Admin can view staff list
    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can view staff" },
        { status: 403 }
      );
    }

    const staffMembers = await tenantDb.centerMembership.findMany({
      where: {
        role: { in: ["DIRECTOR", "CENTER_ADMIN", "TEACHER", "CENTER_SUPPORT"] },
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            phone: true,
            fullName: true,
            avatarUrl: true,
            isActive: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ staff: staffMembers });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Forbidden") ? 403 : 500 }
    );
  }
}

// POST /api/tenant/staff — Add a new staff member (Director/Admin only)
// This creates a User (if new) + CenterMembership and should send an invite
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { session, center, role } = tenantCtx;
    const tenantDb = getTenantDb(center.id);

    // Only Director can add staff. CENTER_ADMIN can too if delegated (we'll allow it by default for MVP)
    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can add staff members" },
        { status: 403 }
      );
    }

    const { email, fullName, phone, staffRole } = await req.json();

    // Validate required fields
    if (!email || !fullName || !staffRole) {
      return NextResponse.json(
        { error: "Email, full name, and role are required" },
        { status: 400 }
      );
    }

    // Validate staffRole — only center-level staff roles can be assigned
    const allowedRoles = ["CENTER_ADMIN", "TEACHER", "CENTER_SUPPORT"];
    if (!allowedRoles.includes(staffRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${allowedRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // CENTER_ADMIN cannot create other CENTER_ADMINs unless they are DIRECTOR
    if (staffRole === "CENTER_ADMIN" && role === "CENTER_ADMIN") {
      return NextResponse.json(
        { error: "Only Director can create Center Admin accounts" },
        { status: 403 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if user already has this role in this center
    const existingMembership = await tenantDb.centerMembership.findFirst({
      where: {
        role: staffRole,
        user: { email: cleanEmail },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "This user already has this role in this center" },
        { status: 400 }
      );
    }

    // Find or create the user (Platform Level)
    let user = await db.platformUser.findUnique({
      where: { email: cleanEmail },
    });

    // Generate a temporary password (user will be sent an invite to set their own)
    const tempPassword = crypto.randomBytes(12).toString("base64url");
    const tempPasswordHash = await hashPassword(tempPassword);

    if (!user) {
      user = await db.platformUser.create({
        data: {
          email: cleanEmail,
          fullName,
          phone: phone || null,
          passwordHash: tempPasswordHash,
          preferredLanguage: center.defaultLanguage || "ru",
        },
      });
    }

    if (staffRole === "TEACHER" || staffRole === "TEACHER_ASSISTANT") {
      const canAddTeacher = await checkSubscriptionLimit(center.id, "teachers");
      if (!canAddTeacher) {
        return NextResponse.json({ error: "PLAN_LIMIT_REACHED: Вы достигли лимита учителей по вашему тарифу." }, { status: 403 });
      }
    }

    // Create CenterMembership
    const membership = await tenantDb.centerMembership.create({
      data: {
        centerId: center.id,
        userId: user.id,
        role: staffRole,
        status: "ACTIVE",
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
            phone: true,
          },
        },
      },
    });

    // Audit log
    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "STAFF_MEMBER_ADDED",
      resource: "CenterMembership",
      resourceId: membership.id,
      details: {
        addedUserEmail: cleanEmail,
        addedUserName: fullName,
        assignedRole: staffRole,
      },
    });

    // TODO: Send invite email/SMS with tempPassword or invite link
    // For now, return the temporary password in dev mode only
    return NextResponse.json({
      success: true,
      membership,
      // Only include temp password in development
      ...(process.env.NODE_ENV === "development" ? { tempPassword } : {}),
    });
  } catch (err: any) {
    console.error("Staff creation error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Forbidden") ? 403 : 500 }
    );
  }
}

// PATCH /api/tenant/staff — Update staff member status (activate/deactivate)
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { session, center, role } = tenantCtx;
    const tenantDb = getTenantDb(center.id);

    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can manage staff" },
        { status: 403 }
      );
    }

    const { membershipId, status, newRole } = await req.json();

    if (!membershipId) {
      return NextResponse.json(
        { error: "Membership ID is required" },
        { status: 400 }
      );
    }

    // Verify the membership belongs to this center
    const membership = await tenantDb.centerMembership.findFirst({
      where: { id: membershipId },
      include: { user: { select: { email: true, fullName: true } } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Staff member not found in this center" },
        { status: 404 }
      );
    }

    // Prevent deactivating the Director
    if (membership.role === "DIRECTOR" && status === "INACTIVE") {
      return NextResponse.json(
        { error: "Cannot deactivate the Director. Contact platform support." },
        { status: 403 }
      );
    }

    // CENTER_ADMIN cannot modify other CENTER_ADMINs or DIRECTOR
    if (
      role === "CENTER_ADMIN" &&
      (membership.role === "DIRECTOR" || membership.role === "CENTER_ADMIN")
    ) {
      return NextResponse.json(
        { error: "Only Director can modify this role" },
        { status: 403 }
      );
    }

    const updateData: any = {};
    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED"].includes(status)) {
      updateData.status = status;
    }
    if (newRole && ["CENTER_ADMIN", "TEACHER", "CENTER_SUPPORT"].includes(newRole)) {
      // Only Director can change roles
      if (role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Only Director can change staff roles" },
          { status: 403 }
        );
      }
      updateData.role = newRole;
    }

    await tenantDb.centerMembership.updateMany({
      where: { id: membershipId },
      data: updateData,
    });
    
    const updated = await tenantDb.centerMembership.findFirst({
      where: { id: membershipId },
      include: {
        user: { select: { id: true, email: true, fullName: true } },
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "STAFF_MEMBER_UPDATED",
      resource: "CenterMembership",
      resourceId: membershipId,
      details: {
        targetEmail: membership.user.email,
        changes: updateData,
      },
    });

    return NextResponse.json({ success: true, membership: updated });
  } catch (err: any) {
    console.error("Staff update error:", err);
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Forbidden") ? 403 : 500 }
    );
  }
}
