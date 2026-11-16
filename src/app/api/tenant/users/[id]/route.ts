import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Tenant user profile management reads and updates global PlatformUser when permissible.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { canManageUserAccount, canActorManageRole } from "@/lib/tenant-user-guard";
import type { MembershipRole, MembershipStatus, Prisma } from "@prisma/client";

const updateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  preferredLanguage: z.enum(["ru", "uz-Latn"]).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  role: z.enum([
    "DIRECTOR",
    "CENTER_ADMIN",
    "ACCOUNTANT",
    "TEACHER",
    "TEACHER_ASSISTANT",
    "CENTER_SUPPORT",
    "STUDENT",
    "PARENT",
  ]).optional(),
  status: z.enum(["ACTIVE", "BLOCKED", "SUSPENDED", "ARCHIVED"]).optional(),
  reason: z.string().min(5, "Причина должна содержать минимум 5 символов").optional(),
}).strict();

export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.read", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const membershipId = params.id;

    // Search by membership ID or by user ID within this center
    const membership = await tenantDb.centerMembership.findFirst({
      where: {
        centerId: center.id,
        OR: [
          { id: membershipId },
          { userId: membershipId },
        ],
      },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            username: true,
            avatarUrl: true,
            preferredLanguage: true,
            isActive: true,
            mustChangePassword: true,
            lastLoginAt: true,
            createdAt: true,
            memberships: {
              where: { status: "ACTIVE" },
              select: {
                id: true,
                centerId: true,
                role: true,
                center: { select: { id: true, name: true } },
              },
            },
          },
        },
        enrollments: {
          include: {
            group: {
              select: { id: true, name: true, course: { select: { title: true } } },
            },
          },
        },
        taughtGroups: {
          select: { id: true, name: true },
        },
        assistedGroups: {
          select: { id: true, name: true },
        },
        parentLinksAsStudent: {
          where: { status: "CONFIRMED" },
          include: {
            parent: {
              include: {
                user: { select: { id: true, fullName: true, phone: true, email: true } },
              },
            },
          },
        },
        parentLinksAsParent: {
          where: { status: "CONFIRMED" },
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, phone: true, email: true } },
              },
            },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Пользователь не найден в данном центре" }, { status: 404 });
    }

    // Check shared status
    const manageability = await canManageUserAccount(center.id, membership.user.id);

    // Get active sessions for this user
    const activeSessions = await db.userSession.findMany({
      where: {
        userId: membership.user.id,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        lastSeenAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    // Get recent audit log for this user/membership
    const auditLogs = await tenantDb.auditLog.findMany({
      where: {
        centerId: center.id,
        OR: [
          { resourceId: membership.id },
          { resourceId: membership.user.id },
          { actorUserId: membership.user.id },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        createdAt: true,
        detailsJson: true,
      },
    });

    const isSyntheticEmail = membership.user.email.endsWith("@noemail.local");

    return NextResponse.json({
      membership: {
        id: membership.id,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt,
      },
      user: {
        id: membership.user.id,
        fullName: membership.user.fullName,
        email: isSyntheticEmail ? null : membership.user.email,
        phone: membership.user.phone,
        username: membership.user.username,
        avatarUrl: membership.user.avatarUrl,
        preferredLanguage: membership.user.preferredLanguage,
        lastLoginAt: membership.user.lastLoginAt,
        createdAt: membership.user.createdAt,
      },
      manageability,
      groups: membership.enrollments.map((e) => e.group) || membership.taughtGroups || [],
      parents: membership.parentLinksAsStudent.map((p) => ({
        id: p.parent.id,
        fullName: p.parent.user.fullName,
        phone: p.parent.user.phone,
        email: p.parent.user.email.endsWith("@noemail.local") ? null : p.parent.user.email,
        relationship: p.relationship,
      })),
      children: membership.parentLinksAsParent.map((c) => ({
        id: c.student.id,
        fullName: c.student.user.fullName,
        phone: c.student.user.phone,
        email: c.student.user.email.endsWith("@noemail.local") ? null : c.student.user.email,
      })),
      activeSessions,
      auditLogs: auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        createdAt: log.createdAt,
        details: log.detailsJson ? JSON.parse(log.detailsJson) : null,
      })),
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("GET /api/tenant/users/[id] error:", err);
    return NextResponse.json({ error: "Failed to fetch user details" }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const actorUser = session.user;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.update", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: No permission to update users" }, { status: 403 });
    }

    const membershipId = params.id;
    const membership = await tenantDb.centerMembership.findFirst({
      where: {
        centerId: center.id,
        OR: [
          { id: membershipId },
          { userId: membershipId },
        ],
      },
      include: { user: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "Пользователь не найден в центре" }, { status: 404 });
    }

    // Role hierarchy check
    const roleCheck = canActorManageRole(actorRole, membership.role, tenantCtx.isPlatformStaff);
    if (!roleCheck.allowed) {
      return NextResponse.json({ error: roleCheck.reason || "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = updateUserSchema.parse(body);

    // If updating target role, check if actor can assign it
    if (parsed.role && parsed.role !== membership.role) {
      const targetRoleCheck = canActorManageRole(actorRole, parsed.role, tenantCtx.isPlatformStaff);
      if (!targetRoleCheck.allowed) {
        return NextResponse.json({ error: targetRoleCheck.reason || "Cannot assign this role" }, { status: 403 });
      }
    }

    // If updating credentials (email, phone, username), verify shared account rule!
    const wantsToChangeCredentials =
      parsed.email !== undefined ||
      parsed.phone !== undefined ||
      parsed.username !== undefined;

    if (wantsToChangeCredentials) {
      const manageability = await canManageUserAccount(center.id, membership.user.id);
      if (!manageability.canManage) {
        return NextResponse.json(
          {
            error:
              manageability.reason ||
              "Пользователь состоит в нескольких центрах, смена доступа возможна только самим пользователем",
            code: "USER_IS_SHARED",
            isShared: true,
            canSendResetLink: true,
          },
          { status: 403 }
        );
      }
    }

    // If blocking or archiving, require reason (min 5 chars)
    if (parsed.status && parsed.status !== membership.status) {
      if (!parsed.reason || parsed.reason.trim().length < 5) {
        return NextResponse.json(
          { error: "Для смены статуса (блокировки/архивации) обязательна причина не менее 5 символов" },
          { status: 400 }
        );
      }
    }

    // Prepare PlatformUser updates
    const userUpdates: Prisma.PlatformUserUpdateInput = {};
    if (parsed.fullName) userUpdates.fullName = parsed.fullName.trim();
    if (parsed.preferredLanguage) {
      userUpdates.preferredLanguage = parsed.preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru";
    }
    if (parsed.avatarUrl !== undefined) userUpdates.avatarUrl = parsed.avatarUrl;

    if (parsed.phone !== undefined) {
      const norm = parsed.phone ? normalizePhone(parsed.phone) : null;
      if (parsed.phone && !norm) {
        return NextResponse.json({ error: "Неверный формат номера телефона" }, { status: 400 });
      }
      userUpdates.phone = norm;
    }

    if (parsed.email !== undefined) {
      const cleanEmail = parsed.email ? parsed.email.trim().toLowerCase() : null;
      if (cleanEmail) {
        const existingEmail = await db.platformUser.findFirst({
          where: { email: cleanEmail, id: { not: membership.user.id } },
        });
        if (existingEmail) {
          return NextResponse.json({ error: "Email уже используется другим пользователем" }, { status: 400 });
        }
        userUpdates.email = cleanEmail;
      }
    }

    if (parsed.username !== undefined) {
      const cleanUsername = parsed.username ? parsed.username.trim().toLowerCase() : null;
      if (cleanUsername) {
        if (!isValidUsername(cleanUsername)) {
          return NextResponse.json({ error: "Неверный формат имени пользователя" }, { status: 400 });
        }
        const existingUsername = await db.platformUser.findFirst({
          where: { username: cleanUsername, id: { not: membership.user.id } },
        });
        if (existingUsername) {
          return NextResponse.json({ error: "Имя пользователя уже занято" }, { status: 400 });
        }
        userUpdates.username = cleanUsername;
      } else {
        userUpdates.username = null;
      }
    }

    if (Object.keys(userUpdates).length > 0) {
      await db.platformUser.update({
        where: { id: membership.user.id },
        data: userUpdates,
      });
    }

    // Update CenterMembership
    const membershipUpdates: Prisma.CenterMembershipUpdateInput = {};
    if (parsed.role) membershipUpdates.role = parsed.role;
    if (parsed.status) {
      membershipUpdates.status = parsed.status === "BLOCKED" ? "SUSPENDED" : parsed.status;
    }

    let updatedMembership = membership;
    if (Object.keys(membershipUpdates).length > 0) {
      updatedMembership = await tenantDb.centerMembership.update({
        where: { id: membership.id },
        data: membershipUpdates,
        include: { user: true },
      });
    }

    // Audit log
    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: parsed.status === "BLOCKED" ? "BLOCK_USER" : "UPDATE_USER",
      resource: "CenterMembership",
      resourceId: membership.id,
      details: {
        actorRole,
        targetUserId: membership.user.id,
        updatedFields: Object.keys({ ...userUpdates, ...membershipUpdates }),
        reason: parsed.reason || null,
        newStatus: parsed.status || null,
        newRole: parsed.role || null,
      },
    });

    return NextResponse.json({
      success: true,
      membership: {
        id: updatedMembership.id,
        role: updatedMembership.role,
        status: updatedMembership.status,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("PATCH /api/tenant/users/[id] error:", err);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const actorUser = session.user;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.block", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: No permission" }, { status: 403 });
    }

    const membershipId = params.id;
    const membership = await tenantDb.centerMembership.findFirst({
      where: {
        centerId: center.id,
        OR: [
          { id: membershipId },
          { userId: membershipId },
        ],
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Пользователь не найден в центре" }, { status: 404 });
    }

    const roleCheck = canActorManageRole(actorRole, membership.role, tenantCtx.isPlatformStaff);
    if (!roleCheck.allowed) {
      return NextResponse.json({ error: roleCheck.reason || "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const reason = url.searchParams.get("reason") || "";
    if (reason.trim().length < 5) {
      return NextResponse.json(
        { error: "Причина удаления обязательна (минимум 5 символов)" },
        { status: 400 }
      );
    }

    // Set membership to ARCHIVED to preserve relational integrity
    await tenantDb.centerMembership.update({
      where: { id: membership.id },
      data: { status: "ARCHIVED" },
    });

    // Revoke sessions
    await db.userSession.deleteMany({
      where: {
        userId: membership.userId,
      },
    });

    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: "ARCHIVE_USER",
      resource: "CenterMembership",
      resourceId: membership.id,
      details: {
        actorRole,
        targetUserId: membership.userId,
        targetRole: membership.role,
        reason,
      },
    });

    return NextResponse.json({ success: true, message: "Пользователь успешно архивирован" });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("DELETE /api/tenant/users/[id] error:", err);
    return NextResponse.json({ error: "Failed to archive user" }, { status: 500 });
  }
}
