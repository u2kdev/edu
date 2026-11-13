import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { Prisma } from "@prisma/client";

const patchUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  preferredLanguage: z.enum(["ru", "uz-Latn"]).optional(),
  platformRole: z
    .enum(["NONE", "PLATFORM_ADMIN", "PLATFORM_SUPPORT", "SEO_ADMIN"])
    .optional(),
  reason: z.string().min(5, "Укажите причину изменения (минимум 5 символов)").optional(),
});

const deleteUserSchema = z.object({
  reason: z.string().min(5, "Укажите причину удаления (минимум 5 символов)"),
});

// GET /api/platform/users/[id]
export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;

    const user = await db.platformUser.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        fullName: true,
        avatarUrl: true,
        platformRole: true,
        preferredLanguage: true,
        isActive: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        deletedReason: true,
        memberships: {
          select: {
            id: true,
            centerId: true,
            role: true,
            status: true,
            createdAt: true,
            center: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        userSessions: {
          select: {
            id: true,
            ipAddress: true,
            userAgent: true,
            createdAt: true,
            lastSeenAt: true,
            expiresAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        auditLogs: {
          select: {
            id: true,
            action: true,
            resource: true,
            detailsJson: true,
            ipAddress: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
        ownedCenters: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error("[GET /api/platform/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/platform/users/[id]
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json();
    const parsed = patchUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Role safety restrictions:
    // 1. DEVELOPER cannot be modified except by DEVELOPER
    if (targetUser.platformRole === "DEVELOPER" && session.user.platformRole !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Недостаточно прав для редактирования роли DEVELOPER" },
        { status: 403 }
      );
    }

    // 2. SUPERADMIN cannot modify another SUPERADMIN
    if (
      targetUser.platformRole === "SUPERADMIN" &&
      targetUser.id !== session.user.id &&
      session.user.platformRole !== "DEVELOPER"
    ) {
      return NextResponse.json(
        { error: "SUPERADMIN не может редактировать другого SUPERADMIN" },
        { status: 403 }
      );
    }

    // 3. PLATFORM_ADMIN cannot touch platform users or grant platform roles
    if (session.user.platformRole === "PLATFORM_ADMIN") {
      if (targetUser.platformRole !== "NONE") {
        return NextResponse.json(
          { error: "PLATFORM_ADMIN может управлять только обычными пользователями" },
          { status: 403 }
        );
      }
      if (parsed.data.platformRole && parsed.data.platformRole !== "NONE") {
        return NextResponse.json(
          { error: "PLATFORM_ADMIN не может выдавать платформенные роли" },
          { status: 403 }
        );
      }
    }

    const updateData: Prisma.PlatformUserUpdateInput = {};

    if (parsed.data.fullName) updateData.fullName = parsed.data.fullName.trim();

    if (parsed.data.email) {
      const cleanEmail = parsed.data.email.toLowerCase().trim();
      if (cleanEmail !== targetUser.email) {
        const existing = await db.platformUser.findUnique({ where: { email: cleanEmail } });
        if (existing) {
          return NextResponse.json({ error: "Email уже используется" }, { status: 400 });
        }
        updateData.email = cleanEmail;
      }
    }

    if (parsed.data.phone !== undefined) {
      if (!parsed.data.phone) {
        updateData.phone = null;
      } else {
        const normalized = normalizePhone(parsed.data.phone);
        if (!normalized) {
          return NextResponse.json({ error: "Неверный формат телефона (+998XXXXXXXXX)" }, { status: 400 });
        }
        if (normalized !== targetUser.phone) {
          const existing = await db.platformUser.findFirst({
            where: { phone: normalized, deletedAt: null, id: { not: targetUser.id } },
          });
          if (existing) {
            return NextResponse.json({ error: "Телефон уже используется" }, { status: 400 });
          }
          updateData.phone = normalized;
        }
      }
    }

    if (parsed.data.username !== undefined) {
      if (!parsed.data.username) {
        updateData.username = null;
      } else {
        const cleanUsername = parsed.data.username.trim().toLowerCase();
        if (!isValidUsername(cleanUsername)) {
          return NextResponse.json(
            { error: "Имя пользователя должно содержать 3-32 символа (a-z, 0-9, ., _, -)" },
            { status: 400 }
          );
        }
        if (cleanUsername !== targetUser.username) {
          const existing = await db.platformUser.findUnique({ where: { username: cleanUsername } });
          if (existing) {
            return NextResponse.json({ error: "Username уже используется" }, { status: 400 });
          }
          updateData.username = cleanUsername;
        }
      }
    }

    if (parsed.data.preferredLanguage) {
      updateData.preferredLanguage = parsed.data.preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru";
    }

    if (parsed.data.platformRole && parsed.data.platformRole !== targetUser.platformRole) {
      if (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
        return NextResponse.json({ error: "Только SUPERADMIN может изменять платформенные роли" }, { status: 403 });
      }
      updateData.platformRole = parsed.data.platformRole;
    }

    const updatedUser = await db.platformUser.update({
      where: { id: targetUser.id },
      data: updateData,
    });

    await logAuditEvent({
      action: "PLATFORM_USER_UPDATED",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        changes: Object.keys(updateData),
        reason: parsed.data.reason,
      },
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("[PATCH /api/platform/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/platform/users/[id] - Soft delete user
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.delete", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const parsed = deleteUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Укажите причину удаления (минимум 5 символов)" },
        { status: 400 }
      );
    }

    const targetUser = await db.platformUser.findUnique({
      where: { id },
      include: {
        memberships: {
          where: { role: "DIRECTOR", status: "ACTIVE" },
          include: {
            center: {
              include: {
                memberships: {
                  where: { role: "DIRECTOR", status: "ACTIVE" },
                },
              },
            },
          },
        },
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Protection 1: Cannot delete self
    if (targetUser.id === session.user.id) {
      return NextResponse.json(
        { error: "Нельзя удалить собственную учетную запись" },
        { status: 400 }
      );
    }

    // Protection 2: Cannot delete DEVELOPER or another SUPERADMIN
    if (targetUser.platformRole === "DEVELOPER") {
      return NextResponse.json(
        { error: "Запрещено удалять пользователя с ролью DEVELOPER" },
        { status: 403 }
      );
    }

    if (targetUser.platformRole === "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
      return NextResponse.json(
        { error: "SUPERADMIN не может удалять другого SUPERADMIN" },
        { status: 403 }
      );
    }

    // Protection 3: Cannot delete the last active SUPERADMIN
    if (targetUser.platformRole === "SUPERADMIN") {
      const activeSuperadminsCount = await db.platformUser.count({
        where: {
          platformRole: "SUPERADMIN",
          isActive: true,
          deletedAt: null,
        },
      });
      if (activeSuperadminsCount <= 1) {
        return NextResponse.json(
          { error: "Нельзя удалить последнего активного SUPERADMIN в системе" },
          { status: 400 }
        );
      }
    }

    // Protection 4: Cannot delete a center director without another active director in that center
    for (const directorMembership of targetUser.memberships) {
      const activeDirectorsInCenter = directorMembership.center.memberships.filter(
        (m) => m.userId !== targetUser.id
      );
      if (activeDirectorsInCenter.length === 0) {
        return NextResponse.json(
          {
            error: `Нельзя удалить директора учебного центра "${directorMembership.center.name}" без предварительного назначения нового директора`,
          },
          { status: 400 }
        );
      }
    }

    const timestamp = Date.now();
    const freedEmail = `${targetUser.email}_del_${timestamp}`;
    const freedPhone = targetUser.phone ? `${targetUser.phone}_del_${timestamp}` : null;
    const freedUsername = targetUser.username ? `${targetUser.username}_del_${timestamp}` : null;

    // Perform soft-delete and revoke sessions
    await db.$transaction([
      db.platformUser.update({
        where: { id: targetUser.id },
        data: {
          deletedAt: new Date(),
          deletedReason: parsed.data.reason,
          isActive: false,
          email: freedEmail,
          phone: freedPhone,
          username: freedUsername,
        },
      }),
      db.userSession.deleteMany({
        where: { userId: targetUser.id },
      }),
      db.centerMembership.updateMany({
        where: { userId: targetUser.id },
        data: { status: "ARCHIVED" },
      }),
    ]);

    await logAuditEvent({
      action: "PLATFORM_USER_SOFT_DELETED",
      resource: "PlatformUser",
      resourceId: targetUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        originalEmail: targetUser.email,
        reason: parsed.data.reason,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Пользователь успешно удален (мягкое удаление)",
    });
  } catch (error) {
    console.error("[DELETE /api/platform/users/[id]]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
