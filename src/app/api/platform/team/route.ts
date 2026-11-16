import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { hasPermission, canAssignPlatformRole } from "@/lib/permissions";
import { generateSecurePassword } from "@/lib/generatePassword";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import { SAFE_USER_SELECT, serializeUser } from "@/lib/user-dto";
import type { Prisma } from "@prisma/client";

const addTeamMemberSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["PLATFORM_ADMIN", "PLATFORM_SUPPORT", "SEO_ADMIN"]),
  password: z.string().min(8).optional(),
}).strict();

const patchTeamMemberSchema = z.object({
  id: z.string().min(1),
  role: z.enum(["PLATFORM_ADMIN", "PLATFORM_SUPPORT", "SEO_ADMIN", "NONE"]).optional(),
  isActive: z.boolean().optional(),
}).strict();

// GET /api/platform/team - List platform team members
export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.team.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const members = await db.platformUser.findMany({
      where: {
        platformRole: { in: ["SUPERADMIN", "PLATFORM_ADMIN", "PLATFORM_SUPPORT", "SEO_ADMIN"] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        username: true,
        phone: true,
        platformRole: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, members });
  } catch (error) {
    console.error("[GET /api/platform/team]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/platform/team - Add new platform team member
export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.team.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = addTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { fullName, email: rawEmail, role, password: manualPassword } = parsed.data;
    if (!canAssignPlatformRole(session.user.platformRole, role)) {
      return NextResponse.json({ error: "Forbidden: cannot assign this platform role" }, { status: 403 });
    }
    const cleanEmail = rawEmail.toLowerCase().trim();

    const existing = await db.platformUser.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 400 });
    }

    const effectivePassword = manualPassword?.trim() || generateSecurePassword(16);
    const passwordHash = await hashPassword(effectivePassword);

    const user = await db.platformUser.create({
      data: {
        fullName,
        email: cleanEmail,
        platformRole: role,
        passwordHash,
        mustChangePassword: true,
        emailVerified: new Date(),
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        platformRole: true,
        isActive: true,
        createdAt: true,
      },
    });

    await logAuditEvent({
      action: "PLATFORM_TEAM_MEMBER_CREATED",
      resource: "PlatformUser",
      resourceId: user.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: { email: user.email, role: user.platformRole },
    });

    return NextResponse.json(
      {
        success: true,
        member: user,
        initialPassword: effectivePassword,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/platform/team]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PATCH /api/platform/team - Update role or status of platform team member
export async function PATCH(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasPermission("platform.team.manage", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = patchTeamMemberSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || "Validation failed" }, { status: 400 });
    }

    const { id, role, isActive } = parsed.data;
    if (role !== undefined && !canAssignPlatformRole(session.user.platformRole, role)) {
      return NextResponse.json({ error: "Forbidden: cannot assign this platform role" }, { status: 403 });
    }

    const targetUser = await db.platformUser.findUnique({ where: { id } });
    if (!targetUser) return NextResponse.json({ error: "Сотрудник не найден" }, { status: 404 });

    // Safeguards
    if (targetUser.id === session.user.id && isActive === false) {
      return NextResponse.json({ error: "Нельзя заблокировать себя" }, { status: 400 });
    }
    if (targetUser.platformRole === "DEVELOPER") {
      return NextResponse.json({ error: "Нельзя изменять статус или роль разработчика" }, { status: 403 });
    }
    if (targetUser.platformRole === "SUPERADMIN" && targetUser.id !== session.user.id && session.user.platformRole !== "DEVELOPER") {
      return NextResponse.json({ error: "SUPERADMIN не может менять другого SUPERADMIN" }, { status: 403 });
    }

    const updateData: Prisma.PlatformUserUpdateInput = {};
    if (role !== undefined) updateData.platformRole = role;
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await db.platformUser.update({
      where: { id },
      data: updateData,
      select: SAFE_USER_SELECT,
    });

    if (isActive === false) {
      await db.userSession.deleteMany({ where: { userId: id } });
    }

    await logAuditEvent({
      action: "PLATFORM_TEAM_MEMBER_UPDATED",
      resource: "PlatformUser",
      resourceId: id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: { role, isActive },
    });

    return NextResponse.json({ success: true, member: serializeUser(updated) });
  } catch (error) {
    console.error("[PATCH /api/platform/team]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
