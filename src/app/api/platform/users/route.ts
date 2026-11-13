import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession, hashPassword } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { generateSecurePassword } from "@/lib/generatePassword";
import { logAuditEvent } from "@/lib/tenant";
import { getClientIp } from "@/lib/ip";
import type { Prisma, PlatformRole, MembershipRole, Language } from "@prisma/client";

const createUserSchema = z.object({
  fullName: z.string().min(2, "Имя должно содержать минимум 2 символа").max(100),
  email: z.string().email("Неверный формат email"),
  phone: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  preferredLanguage: z.enum(["ru", "uz-Latn"]).optional().default("ru"),
  platformRole: z
    .enum(["NONE", "PLATFORM_ADMIN", "PLATFORM_SUPPORT", "SEO_ADMIN"])
    .optional()
    .default("NONE"),
  centerId: z.string().optional().nullable(),
  centerRole: z
    .enum([
      "DIRECTOR",
      "CENTER_ADMIN",
      "ACCOUNTANT",
      "TEACHER",
      "TEACHER_ASSISTANT",
      "CENTER_SUPPORT",
      "STUDENT",
      "PARENT",
    ])
    .optional()
    .nullable(),
  password: z.string().min(8).optional().nullable(),
  mustChangePassword: z.boolean().optional().default(true),
  sendNotification: z.boolean().optional().default(false),
});

// GET /api/platform/users - List users with server-side filters, pagination & search
export async function GET(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const platformRole = searchParams.get("platformRole")?.trim() || "";
    const centerRole = searchParams.get("centerRole")?.trim() || "";
    const centerId = searchParams.get("centerId")?.trim() || "";
    const status = searchParams.get("status")?.trim() || "ALL";
    const dateFrom = searchParams.get("dateFrom")?.trim() || "";
    const dateTo = searchParams.get("dateTo")?.trim() || "";
    const sortBy = searchParams.get("sortBy")?.trim() || "createdAt";
    const sortOrder = searchParams.get("sortOrder")?.toLowerCase() === "asc" ? "asc" : "desc";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10)));

    const where: Prisma.PlatformUserWhereInput = {};

    // Search by name, email, phone, or username
    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phone: { contains: search } },
        { username: { contains: search, mode: "insensitive" } },
      ];
    }

    // Filter by platform role
    if (platformRole && platformRole !== "ALL") {
      where.platformRole = platformRole as PlatformRole;
    }

    // Filter by status
    if (status === "ACTIVE") {
      where.isActive = true;
      where.deletedAt = null;
    } else if (status === "BLOCKED") {
      where.isActive = false;
      where.deletedAt = null;
    } else if (status === "DELETED") {
      where.deletedAt = { not: null };
    }

    // Filter by registration period
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    // Filter by center or center role
    if (centerId || centerRole) {
      where.memberships = {
        some: {
          ...(centerId ? { centerId } : {}),
          ...(centerRole && centerRole !== "ALL" ? { role: centerRole as MembershipRole } : {}),
          status: "ACTIVE",
        },
      };
    }

    // Order by mapping
    const orderBy: Prisma.PlatformUserOrderByWithRelationInput = {};
    if (sortBy === "fullName") orderBy.fullName = sortOrder;
    else if (sortBy === "email") orderBy.email = sortOrder;
    else if (sortBy === "lastLoginAt") orderBy.lastLoginAt = sortOrder;
    else orderBy.createdAt = sortOrder;

    const [total, users] = await Promise.all([
      db.platformUser.count({ where }),
      db.platformUser.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
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
          deletedAt: true,
          deletedReason: true,
          memberships: {
            where: { status: "ACTIVE" },
            select: {
              id: true,
              role: true,
              status: true,
              center: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                },
              },
            },
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      users,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (error) {
    console.error("[GET /api/platform/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/platform/users - Create new user with credential card
export async function POST(req: Request) {
  try {
    const session = await getAuthSession(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasPermission("platform.users.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const {
      fullName,
      email: rawEmail,
      phone: rawPhone,
      username: rawUsername,
      preferredLanguage,
      platformRole,
      centerId,
      centerRole,
      password: manualPassword,
      mustChangePassword,
    } = parsed.data;

    const cleanEmail = rawEmail.toLowerCase().trim();

    // Check platform role assignment permission
    if (platformRole && platformRole !== "NONE") {
      if (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
        return NextResponse.json(
          { error: "Только SUPERADMIN может назначать платформенные роли сотрудникам" },
          { status: 403 }
        );
      }
    }

    // Normalize phone
    let normalizedPhone: string | null = null;
    if (rawPhone && rawPhone.trim()) {
      normalizedPhone = normalizePhone(rawPhone);
      if (!normalizedPhone) {
        return NextResponse.json(
          { error: "Неверный формат номера телефона. Ожидается формат +998XXXXXXXXX" },
          { status: 400 }
        );
      }
    }

    // Validate username
    let cleanUsername: string | null = null;
    if (rawUsername && rawUsername.trim()) {
      cleanUsername = rawUsername.trim().toLowerCase();
      if (!isValidUsername(cleanUsername)) {
        return NextResponse.json(
          { error: "Имя пользователя должно содержать 3-32 символа (a-z, 0-9, ., _, -)" },
          { status: 400 }
        );
      }
    }

    // Check existing email
    const existingEmail = await db.platformUser.findUnique({
      where: { email: cleanEmail },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: "Пользователь с таким email уже существует" },
        { status: 400 }
      );
    }

    // Check existing username
    if (cleanUsername) {
      const existingUser = await db.platformUser.findUnique({
        where: { username: cleanUsername },
      });
      if (existingUser) {
        return NextResponse.json(
          { error: "Пользователь с таким username уже существует" },
          { status: 400 }
        );
      }
    }

    // Check existing phone
    if (normalizedPhone) {
      const existingPhone = await db.platformUser.findFirst({
        where: { phone: normalizedPhone, deletedAt: null },
      });
      if (existingPhone) {
        return NextResponse.json(
          { error: "Пользователь с таким номером телефона уже существует" },
          { status: 400 }
        );
      }
    }

    // Determine initial password
    const effectivePassword = manualPassword?.trim() || generateSecurePassword(16);
    const passwordHash = await hashPassword(effectivePassword);

    // Map language
    const langMap = preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru";

    // Create user and optional center membership in a transaction
    const newUser = await db.$transaction(async (tx) => {
      const user = await tx.platformUser.create({
        data: {
          fullName,
          email: cleanEmail,
          phone: normalizedPhone,
          username: cleanUsername,
          preferredLanguage: langMap as Language,
          platformRole: platformRole as PlatformRole,
          passwordHash,
          mustChangePassword,
          emailVerified: new Date(), // pre-verified by administrator
        },
        select: {
          id: true,
          email: true,
          phone: true,
          username: true,
          fullName: true,
          platformRole: true,
          preferredLanguage: true,
          isActive: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      if (centerId && centerRole) {
        await tx.centerMembership.create({
          data: {
            userId: user.id,
            centerId,
            role: centerRole as MembershipRole,
            status: "ACTIVE",
          },
        });
      }

      return user;
    });

    // Write audit log WITHOUT the password
    await logAuditEvent({
      action: "PLATFORM_USER_CREATED",
      resource: "PlatformUser",
      resourceId: newUser.id,
      actorUserId: session.user.id,
      ipAddress: getClientIp(req),
      details: {
        email: newUser.email,
        username: newUser.username,
        platformRole: newUser.platformRole,
        centerId: centerId || undefined,
        centerRole: centerRole || undefined,
        mustChangePassword,
      },
    });

    return NextResponse.json(
      {
        success: true,
        user: newUser,
        // Provided once so the UI can display credential card
        initialCredentials: {
          login: cleanUsername || newUser.email,
          email: newUser.email,
          password: effectivePassword,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[POST /api/platform/users]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
