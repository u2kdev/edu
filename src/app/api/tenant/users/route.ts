import { NextResponse } from "next/server";
import { z } from "zod";
// Reason: Exception: Tenant user management creates platform user accounts when users are new.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { requireTenantAccess, logAuditEvent, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import type { CenterRole } from "@/lib/permissions";
import { checkSubscriptionLimit } from "@/lib/limits";
import { normalizePhone, isValidUsername } from "@/lib/phone";
import { generateSecurePassword } from "@/lib/generatePassword";
import { renderEmailTemplate, renderSmsTemplate, sendEmailWithOutbox } from "@/lib/email";
import { canActorManageRole } from "@/lib/tenant-user-guard";
import type { MembershipRole, MembershipStatus, Language, Prisma } from "@prisma/client";

const createUserSchema = z.object({
  fullName: z.string().min(2, "Имя должно содержать минимум 2 символа").max(100),
  email: z.string().email("Неверный формат email").optional().nullable(),
  phone: z.string().optional().nullable(),
  username: z.string().optional().nullable(),
  preferredLanguage: z.enum(["ru", "uz-Latn"]).optional().default("ru"),
  role: z.enum([
    "DIRECTOR",
    "CENTER_ADMIN",
    "ACCOUNTANT",
    "TEACHER",
    "TEACHER_ASSISTANT",
    "CENTER_SUPPORT",
    "STUDENT",
    "PARENT",
  ]),
  groupId: z.string().optional().nullable(),
  parent: z
    .object({
      fullName: z.string().min(2).optional().nullable(),
      phone: z.string().optional().nullable(),
      email: z.string().email().optional().nullable(),
      relationship: z
        .enum(["MOTHER", "FATHER", "GUARDIAN", "OTHER"])
        .optional()
        .default("GUARDIAN"),
    })
    .optional()
    .nullable(),
  password: z.string().min(6).optional().nullable(),
  generatePassword: z.boolean().optional(),
  mustChangePassword: z.boolean().optional().default(true),
  sendNotification: z.boolean().optional().default(false),
}).strict();

// GET /api/tenant/users - List users in the active center with search, filters & pagination
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role, session } = tenantCtx;
    const tenantDb = tenantCtx.getTenantDb();

    if (!hasPermission("users.read", session.user.platformRole, role as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const url = new URL(req.url);
    const search = (url.searchParams.get("search") || "").trim();
    const filterRole = url.searchParams.get("role") as MembershipRole | null;
    const filterStatus = url.searchParams.get("status") as MembershipStatus | null;
    const inactiveDays = parseInt(url.searchParams.get("inactiveDays") || "0", 10);
    const neverLoggedIn = url.searchParams.get("neverLoggedIn") === "true";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CenterMembershipWhereInput = {
      centerId: center.id,
    };

    if (filterRole) {
      where.role = filterRole;
    }

    if (filterStatus) {
      where.status = filterStatus;
    }

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { username: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    if (neverLoggedIn) {
      where.user = {
        ...(where.user as Prisma.PlatformUserWhereInput || {}),
        lastLoginAt: { equals: null },
      };
    } else if (inactiveDays > 0) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - inactiveDays);
      where.user = {
        ...(where.user as Prisma.PlatformUserWhereInput || {}),
        OR: [
          { lastLoginAt: { equals: null } },
          { lastLoginAt: { lt: threshold } },
        ],
      };
    }

    const [total, memberships] = await Promise.all([
      tenantDb.centerMembership.count({ where }),
      tenantDb.centerMembership.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: "desc" },
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
              lastLoginAt: true,
              createdAt: true,
              _count: {
                select: {
                  memberships: {
                    where: { status: "ACTIVE" },
                  },
                },
              },
            },
          },
          enrollments: {
            where: { status: "ACTIVE" },
            include: {
              group: { select: { id: true, name: true } },
            },
          },
          taughtGroups: {
            select: { id: true, name: true },
          },
          parentLinksAsStudent: {
            where: { status: "CONFIRMED" },
            include: {
              parent: {
                include: {
                  user: { select: { fullName: true, phone: true, email: true } },
                },
              },
            },
          },
          parentLinksAsParent: {
            where: { status: "CONFIRMED" },
            include: {
              student: {
                include: {
                  user: { select: { fullName: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    const formatted = memberships.map((m) => {
      const isSyntheticEmail = m.user.email.endsWith("@noemail.local");
      const isShared = (m.user._count?.memberships ?? 0) > 1;

      return {
        id: m.id,
        centerId: center.id,
        userId: m.user.id,
        fullName: m.user.fullName,
        email: isSyntheticEmail ? null : m.user.email,
        phone: m.user.phone,
        username: m.user.username,
        role: m.role,
        status: m.status,
        joinedAt: m.joinedAt,
        lastLoginAt: m.user.lastLoginAt,
        neverLoggedIn: !m.user.lastLoginAt,
        isShared,
        groups: m.enrollments.map((e) => e.group) || m.taughtGroups || [],
        parents: m.parentLinksAsStudent.map((p) => ({
          id: p.parent.id,
          name: p.parent.user.fullName,
          phone: p.parent.user.phone,
          relationship: p.relationship,
        })),
        children: m.parentLinksAsParent.map((c) => ({
          id: c.student.id,
          name: c.student.user.fullName,
        })),
      };
    });

    return NextResponse.json({
      users: formatted,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("GET /api/tenant/users error:", err);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// POST /api/tenant/users - Unified user creation
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const { center, role: actorRole, session } = tenantCtx;
    const actorUser = session.user;
    const tenantDb = tenantCtx.getTenantDb();

    // Check base permission
    if (!hasPermission("users.create", session.user.platformRole, actorRole as CenterRole) && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden: No permission to create users" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = createUserSchema.parse(body);

    // Validate role hierarchy
    const roleCheck = canActorManageRole(actorRole, parsed.role, tenantCtx.isPlatformStaff);
    if (!roleCheck.allowed) {
      return NextResponse.json({ error: roleCheck.reason || "Forbidden" }, { status: 403 });
    }

    // Require either email or phone
    if (!parsed.email && !parsed.phone) {
      return NextResponse.json(
        { error: "Необходимо указать email или номер телефона" },
        { status: 400 }
      );
    }

    // Check subscription limits based on role
    if (parsed.role === "STUDENT") {
      const allowed = await checkSubscriptionLimit(center.id, "students", 1);
      if (!allowed) {
        return NextResponse.json(
          {
            error: "Превышен лимит студентов по тарифу подписки",
            code: "PLAN_LIMIT_REACHED",
            upgradeUrl: "/center/support",
          },
          { status: 400 }
        );
      }
    } else if (parsed.role === "TEACHER" || parsed.role === "TEACHER_ASSISTANT") {
      const allowed = await checkSubscriptionLimit(center.id, "teachers", 1);
      if (!allowed) {
        return NextResponse.json(
          {
            error: "Превышен лимит преподавателей по тарифу подписки",
            code: "PLAN_LIMIT_REACHED",
            upgradeUrl: "/center/support",
          },
          { status: 400 }
        );
      }
    }

    const normalizedPhone = parsed.phone ? normalizePhone(parsed.phone) : null;
    if (parsed.phone && !normalizedPhone) {
      return NextResponse.json({ error: "Неверный формат номера телефона" }, { status: 400 });
    }

    let cleanUsername = parsed.username ? parsed.username.trim().toLowerCase() : null;
    if (cleanUsername) {
      if (!isValidUsername(cleanUsername)) {
        return NextResponse.json(
          { error: "Имя пользователя должно содержать 3-32 символа (буквы, цифры, _, -)" },
          { status: 400 }
        );
      }
      // Check username uniqueness
      const existingUsername = await db.platformUser.findUnique({
        where: { username: cleanUsername },
      });
      if (existingUsername) {
        return NextResponse.json({ error: "Данное имя пользователя уже занято" }, { status: 400 });
      }
    }

    // Determine email or synthetic email
    const cleanEmail = parsed.email ? parsed.email.trim().toLowerCase() : null;
    const finalEmail =
      cleanEmail ||
      `phone_${(normalizedPhone || "user").replace(/[^\d]/g, "")}_${Date.now()}@noemail.local`;

    // Check password
    const rawPassword = parsed.password && parsed.password.trim().length >= 6
      ? parsed.password.trim()
      : generateSecurePassword(16);

    const passwordHash = await hashPassword(rawPassword);

    // Look for existing PlatformUser by email, phone, or username
    let user = await db.platformUser.findFirst({
      where: {
        OR: [
          ...(cleanEmail ? [{ email: cleanEmail }] : []),
          ...(normalizedPhone ? [{ phone: normalizedPhone }] : []),
          ...(cleanUsername ? [{ username: cleanUsername }] : []),
        ],
      },
    });

    let createdNewUser = false;

    if (!user) {
      createdNewUser = true;
      user = await db.platformUser.create({
        data: {
          fullName: parsed.fullName.trim(),
          email: finalEmail,
          phone: normalizedPhone,
          username: cleanUsername,
          passwordHash,
          preferredLanguage: (parsed.preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru") as unknown as Language,
          mustChangePassword: parsed.mustChangePassword ?? true,
          emailVerified: cleanEmail ? null : new Date(), // verified by director if created without email
        },
      });
    } else {
      // Check if user already has membership with this role in this center
      const existingMembership = await tenantDb.centerMembership.findFirst({
        where: {
          userId: user.id,
          centerId: center.id,
          role: parsed.role,
        },
      });

      if (existingMembership) {
        return NextResponse.json(
          { error: `Пользователь уже имеет роль «${parsed.role}» в этом учебном центре` },
          { status: 400 }
        );
      }
    }

    // Create center membership
    const membership = await tenantDb.centerMembership.create({
      data: {
        centerId: center.id,
        userId: user.id,
        role: parsed.role,
        status: "ACTIVE",
      },
    });

    // If student and groupId specified, enroll into group
    if (parsed.role === "STUDENT" && parsed.groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: parsed.groupId, centerId: center.id },
        include: { _count: { select: { enrollments: { where: { status: "ACTIVE" } } } } },
      });

      if (group) {
        if (group._count.enrollments >= group.maxStudents) {
          return NextResponse.json(
            { error: `Группа «${group.name}» заполнена (макс. ${group.maxStudents} учеников)` },
            { status: 400 }
          );
        }

        await tenantDb.enrollment.create({
          data: {
            centerId: center.id,
            studentMembershipId: membership.id,
            groupId: group.id,
            status: "ACTIVE",
          },
        });
      }
    }

    // If student and parent info provided, link or create parent
    let parentCredentials: { login: string; password?: string; fullName: string } | null = null;
    if (parsed.role === "STUDENT" && parsed.parent && (parsed.parent.phone || parsed.parent.email)) {
      const parentPhone = parsed.parent.phone ? normalizePhone(parsed.parent.phone) : null;
      const parentEmail = parsed.parent.email ? parsed.parent.email.trim().toLowerCase() : null;

      let parentUser = await db.platformUser.findFirst({
        where: {
          OR: [
            ...(parentEmail ? [{ email: parentEmail }] : []),
            ...(parentPhone ? [{ phone: parentPhone }] : []),
          ],
        },
      });

      let parentRawPassword = "";
      if (!parentUser) {
        parentRawPassword = generateSecurePassword(16);
        const parentHash = await hashPassword(parentRawPassword);
        const parentFinalEmail =
          parentEmail ||
          `parent_${(parentPhone || "user").replace(/[^\d]/g, "")}_${Date.now()}@noemail.local`;

        parentUser = await db.platformUser.create({
          data: {
            fullName: (parsed.parent.fullName || "Родитель").trim(),
            email: parentFinalEmail,
            phone: parentPhone,
            passwordHash: parentHash,
            preferredLanguage: (parsed.preferredLanguage === "uz-Latn" ? "uz_Latn" : "ru") as unknown as Language,
            mustChangePassword: true,
            emailVerified: parentEmail ? null : new Date(),
          },
        });
      }

      // Check or create parent center membership
      let parentMem = await tenantDb.centerMembership.findFirst({
        where: { userId: parentUser.id, centerId: center.id, role: "PARENT" },
      });

      if (!parentMem) {
        parentMem = await tenantDb.centerMembership.create({
          data: {
            centerId: center.id,
            userId: parentUser.id,
            role: "PARENT",
            status: "ACTIVE",
          },
        });
      }

      // Create ParentLink
      await tenantDb.parentLink.upsert({
        where: {
          parentMembershipId_studentMembershipId: {
            parentMembershipId: parentMem.id,
            studentMembershipId: membership.id,
          },
        },
        create: {
          parentMembershipId: parentMem.id,
          studentMembershipId: membership.id,
          relationship: parsed.parent.relationship || "GUARDIAN",
          status: "CONFIRMED",
          initiatedBy: "ADMIN",
          confirmedAt: new Date(),
        },
        update: {
          relationship: parsed.parent.relationship || "GUARDIAN",
          status: "CONFIRMED",
          confirmedAt: new Date(),
        },
      });

      parentCredentials = {
        fullName: parentUser.fullName,
        login: parentUser.email.endsWith("@noemail.local")
          ? parentUser.phone || parentUser.fullName
          : parentUser.email,
        password: parentRawPassword || undefined,
      };
    }

    // Notifications (email / SMS)
    const baseUrl = process.env.NEXTAUTH_URL || "https://e-darschi.uz";
    const loginUrl = `${baseUrl}/login`;
    const primaryLogin =
      cleanEmail || normalizedPhone || cleanUsername || user.email;

    if (parsed.sendNotification && createdNewUser) {
      const lang = parsed.preferredLanguage === "uz-Latn" ? "uz" : "ru";

      if (cleanEmail) {
        const emailContent = renderEmailTemplate("LOGIN_CREDENTIALS", {
          lang,
          fullName: user.fullName,
          centerName: center.name,
          login: primaryLogin,
          password: rawPassword,
          url: loginUrl,
        });

        await sendEmailWithOutbox(
          cleanEmail,
          emailContent.subject,
          emailContent.text,
          emailContent.html
        ).catch((err) => console.error("Failed to send credentials email:", err));
      }
    }

    // Audit Log — NEVER LOG PASSWORDS
    await logAuditEvent({
      centerId: center.id,
      actorUserId: actorUser.id,
      action: "CREATE_USER",
      resource: "CenterMembership",
      resourceId: membership.id,
      details: {
        actorRole,
        targetUserId: user.id,
        role: parsed.role,
        fullName: user.fullName,
        hasPhone: Boolean(normalizedPhone),
        hasEmail: Boolean(cleanEmail),
        hasUsername: Boolean(cleanUsername),
        mustChangePassword: parsed.mustChangePassword ?? true,
      },
    });

    const response = NextResponse.json(
      {
        success: true,
        credentials: {
          login: primaryLogin,
          password: rawPassword,
          loginUrl,
          fullName: user.fullName,
          role: parsed.role,
          mustChangePassword: parsed.mustChangePassword ?? true,
        },
        parentCredentials,
        membership: {
          id: membership.id,
          role: membership.role,
          status: membership.status,
          userId: user.id,
          user: {
            id: user.id,
            fullName: user.fullName,
            email: cleanEmail,
            phone: normalizedPhone,
            username: cleanUsername,
          },
        },
        user: {
          id: user.id,
          membershipId: membership.id,
          fullName: user.fullName,
          role: parsed.role,
          email: cleanEmail,
          phone: normalizedPhone,
          username: cleanUsername,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      }
    );

    return response;
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message || "Validation error" }, { status: 400 });
    }
    console.error("POST /api/tenant/users error:", err);
    return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
  }
}
