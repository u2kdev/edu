import { NextResponse } from "next/server";
// Reason: Exception: Creation of platform-level models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { checkSubscriptionLimit } from "@/lib/limits";
import { sendPasswordSetupLink } from "@/lib/password-reset";
import { normalizePhone } from "@/lib/phone";
import { generateSecurePassword } from "@/lib/generatePassword";
import type { MembershipRole, MembershipStatus } from "@prisma/client";
import crypto from "crypto";

// GET /api/tenant/staff — List all staff members of the active center
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { session, center, role } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    // Only Director and Center Admin can view staff list
    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can view staff" },
        { status: 403 }
      );
    }

    const staffMembers = await tenantDb.centerMembership.findMany({
      where: {
        role: { in: ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT"] },
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
            lastLoginAt: true,
            createdAt: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    return NextResponse.json({ staff: staffMembers });
  } catch (err: unknown) {
    const error = err as { message?: string; code?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Server error", code: error.code },
      { status: error.status || (error.message?.includes("Forbidden") ? 403 : 500) }
    );
  }
}

// POST /api/tenant/staff — Add a new staff member (Director/Admin only)
// This creates a User (if new) + CenterMembership and should send an invite
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { session, center, role } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    // Only Director can add staff. CENTER_ADMIN can too if delegated (we'll allow it by default for MVP)
    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can add staff members" },
        { status: 403 }
      );
    }

    const { email, fullName, phone, staffRole, password } = await req.json();

    // Validate required fields: Full name & role required, plus either email or phone
    if (!fullName || !staffRole || (!email && !phone)) {
      return NextResponse.json(
        { error: "ФИО, роль и (email или телефон) обязательны" },
        { status: 400 }
      );
    }

    // Validate staffRole — only center-level staff roles can be assigned
    const allowedRoles = ["CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT"];
    if (!allowedRoles.includes(staffRole)) {
      return NextResponse.json(
        { error: `Invalid role. Allowed: ${allowedRoles.join(", ")}` },
        { status: 400 }
      );
    }

    // CENTER_ADMIN cannot create other CENTER_ADMINs or ACCOUNTANTs unless they are DIRECTOR
    if ((staffRole === "CENTER_ADMIN" || staffRole === "ACCOUNTANT") && role === "CENTER_ADMIN") {
      return NextResponse.json(
        { error: "Only Director can create Center Admin or Accountant accounts" },
        { status: 403 }
      );
    }

    const cleanEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const finalEmail = cleanEmail || `phone_${(normalizedPhone || "staff").replace(/[^\d]/g, "")}_${Date.now()}@noemail.local`;

    // Check if user already has this role in this center
    const existingMembership = await tenantDb.centerMembership.findFirst({
      where: {
        role: staffRole,
        user: {
          OR: [
            ...(cleanEmail ? [{ email: cleanEmail }] : []),
            ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ],
        },
      },
    });

    if (existingMembership) {
      return NextResponse.json(
        { error: "This user already has this role in this center" },
        { status: 400 }
      );
    }

    // Find or create the user (Platform Level)
    let user = await db.platformUser.findFirst({
      where: {
        OR: [
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
        ],
      },
    });

    const rawPassword = password && password.trim().length >= 6
      ? password.trim()
      : generateSecurePassword(16);
    const tempPasswordHash = await hashPassword(rawPassword);

    let isNewUser = false;
    if (!user) {
      user = await db.platformUser.create({
        data: {
          email: finalEmail,
          fullName,
          phone: normalizedPhone,
          passwordHash: tempPasswordHash,
          preferredLanguage: center.defaultLanguage || "ru",
          mustChangePassword: true,
          emailVerified: new Date(),
        },
      });
      isNewUser = true;
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

    // Audit log (NEVER LOG PASSWORDS)
    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: "STAFF_MEMBER_ADDED",
      resource: "CenterMembership",
      resourceId: membership.id,
      details: {
        addedUserEmail: cleanEmail || finalEmail,
        addedUserName: fullName,
        assignedRole: staffRole,
      },
    });

    if (isNewUser && cleanEmail) {
      await sendPasswordSetupLink({
        userId: user.id,
        email: user.email,
        fullName: user.fullName,
        lang: center.defaultLanguage,
      }).catch((sendErr: unknown) => {
        console.error("Failed to send staff password setup email:", sendErr);
      });
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://e-darschi.uz";
    const primaryLogin = cleanEmail || normalizedPhone || user.email;

    return NextResponse.json(
      {
        success: true,
        membership,
        credentials: {
          login: primaryLogin,
          password: isNewUser ? rawPassword : "(действующий пароль аккаунта)",
          loginUrl: `${baseUrl}/login`,
          fullName: user.fullName,
          role: staffRole,
          mustChangePassword: true,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("Staff creation error:", err);
    const error = err as { message?: string };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.message?.includes("Forbidden") ? 403 : 500 }
    );
  }
}

// PATCH /api/tenant/staff — Update staff member status (activate/deactivate)
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { session, center, role } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

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

    const updateData: { status?: MembershipStatus; role?: MembershipRole } = {};
    if (status && ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"].includes(status)) {
      updateData.status = status as MembershipStatus;
    }
    if (newRole && ["CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "CENTER_SUPPORT"].includes(newRole)) {
      // Only Director can change roles
      if (role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Only Director can change staff roles" },
          { status: 403 }
        );
      }
      updateData.role = newRole as MembershipRole;
    }

    await tenantDb.centerMembership.updateMany({
      where: { id: membershipId },
      data: updateData,
    });

    if (updateData.status === "ARCHIVED") {
      // Purge push tokens when membership is archived
      await db.devicePushToken.deleteMany({
        where: {
          userId: membership.userId,
          centerId: center.id,
        },
      });
    }
    
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
  } catch (err: unknown) {
    console.error("Staff update error:", err);
    const error = err as { message?: string };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.message?.includes("Forbidden") ? 403 : 500 }
    );
  }
}

// DELETE /api/tenant/staff — Delete a center member (student or staff)
export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { session, center, role } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    if (role !== "DIRECTOR" && role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Only Director or Center Admin can delete members" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    let membershipId = searchParams.get("membershipId");
    let reason = req.headers.get("x-action-reason") || "";

    if (!membershipId) {
      try {
        const body = (await req.json()) as { membershipId?: string; reason?: string };
        membershipId = body?.membershipId || null;
        if (body?.reason) reason = body.reason.trim();
      } catch {
        // Body might be empty
      }
    }

    if (!membershipId) {
      return NextResponse.json(
        { error: "Membership ID is required" },
        { status: 400 }
      );
    }

    const membership = await tenantDb.centerMembership.findFirst({
      where: { id: membershipId },
      include: { user: { select: { email: true, fullName: true } } },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Member not found in this center" },
        { status: 404 }
      );
    }

    // Role-specific authorization and checks
    if (membership.role === "DIRECTOR") {
      return NextResponse.json(
        { error: "Cannot delete the Director" },
        { status: 403 }
      );
    }

    if (membership.role === "STUDENT") {
      // Check if student has related records before attempting delete
      const [hasPayments, hasGrades, hasAttendance, hasEnrollments] = await Promise.all([
        tenantDb.centerPayment.count({ where: { studentMembershipId: membershipId } }),
        tenantDb.grade.count({ where: { studentMembershipId: membershipId } }),
        tenantDb.attendance.count({ where: { studentMembershipId: membershipId } }),
        tenantDb.enrollment.count({ where: { studentMembershipId: membershipId } }),
      ]);

      const hasRecords = hasPayments > 0 || hasGrades > 0 || hasAttendance > 0 || hasEnrollments > 0;
      if (hasRecords) {
        return NextResponse.json(
          {
            error:
              "Невозможно удалить студента с существующими записями (платежи, оценки, посещаемость). Рекомендуется архивировать студента.",
            hint: "архивировать",
            code: "CANNOT_DELETE_HAS_RECORDS",
            details: {
              payments: hasPayments,
              grades: hasGrades,
              attendance: hasAttendance,
              enrollments: hasEnrollments,
            },
          },
          { status: 409 }
        );
      }
    } else {
      // Staff deletion checks
      if (
        role === "CENTER_ADMIN" &&
        ["CENTER_ADMIN", "ACCOUNTANT", "DIRECTOR"].includes(membership.role)
      ) {
        return NextResponse.json(
          { error: "Only Director can delete administrative staff or accountants" },
          { status: 403 }
        );
      }

      if (membership.role === "TEACHER" || membership.role === "TEACHER_ASSISTANT") {
        const activeGroups = await tenantDb.group.count({
          where: { teacherMembershipId: membershipId },
        });
        if (activeGroups > 0) {
          return NextResponse.json(
            {
              error: `Преподаватель прикреплен к ${activeGroups} активным группам. Переназначьте группы перед удалением или архивируйте сотрудника.`,
              hint: "архивировать",
              code: "TEACHER_HAS_ACTIVE_GROUPS",
            },
            { status: 409 }
          );
        }
      }
    }

    try {
      await tenantDb.centerMembership.delete({
        where: { id: membershipId },
      });

      // Purge push tokens when member is deleted
      await db.devicePushToken.deleteMany({
        where: {
          userId: membership.userId,
          centerId: center.id,
        },
      });
    } catch (err: unknown) {
      const errStr = String(err);
      if (
        errStr.includes("P2003") ||
        errStr.includes("23001") ||
        errStr.includes("Foreign key constraint") ||
        errStr.includes("RESTRICT")
      ) {
        return NextResponse.json(
          {
            error:
              "Невозможно удалить запись из-за существующих связей в базе данных. Рекомендуется архивировать участника.",
            hint: "архивировать",
            code: "CANNOT_DELETE_HAS_RECORDS",
          },
          { status: 409 }
        );
      }
      throw err;
    }

    const auditAction = membership.role === "STUDENT" ? "STUDENT_DELETED" : "STAFF_MEMBER_DELETED";

    await logAuditEvent({
      centerId: center.id,
      actorUserId: session.user.id,
      action: auditAction,
      resource: "CenterMembership",
      resourceId: membershipId,
      details: {
        targetEmail: membership.user.email,
        targetRole: membership.role,
        reason: reason || undefined,
      },
    });

    return NextResponse.json({ success: true, message: "Member deleted successfully" });
  } catch (err: unknown) {
    console.error("Member delete error:", err);
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error?.message || "Server error" },
      { status: error?.status || 500 }
    );
  }
}

