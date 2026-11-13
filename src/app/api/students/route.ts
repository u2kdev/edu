import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { Prisma, type MembershipStatus, type EnrollmentStatus } from "@prisma/client";
import { checkSubscriptionLimit } from "@/lib/limits";
import { hashPassword } from "@/lib/auth";
import { generateSecureInviteCode } from "@/lib/invites";
import { sendPasswordSetupLink } from "@/lib/password-reset";
import { normalizePhone } from "@/lib/phone";
import { generateSecurePassword } from "@/lib/generatePassword";
import crypto from "crypto";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const currentRole = tenantCtx.role;

    const url = new URL(req.url);
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20));
    const search = (url.searchParams.get("search") || "").trim();
    const groupId = (url.searchParams.get("groupId") || "").trim();
    const status = (url.searchParams.get("status") || "").trim(); // ACTIVE | ARCHIVED
    const membershipStatus: MembershipStatus | undefined =
      status === "ACTIVE" || status === "ARCHIVED" ? status : undefined;
    const enrollmentStatus: EnrollmentStatus | undefined =
      status === "ACTIVE" || status === "WAITLIST" || status === "COMPLETED" || status === "DROPPED"
        ? status
        : undefined;
    const sortBy = url.searchParams.get("sortBy") || "name"; // name | createdAt
    const sortOrder = url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
    const neverLoggedIn = url.searchParams.get("neverLoggedIn") === "true";
    const inactiveDays = parseInt(url.searchParams.get("inactiveDays") || "0", 10);

    const where: Prisma.CenterMembershipWhereInput = {
      centerId: tenantCtx.center.id,
      role: "STUDENT",
    };

    if (neverLoggedIn) {
      where.user = {
        lastLoginAt: null,
      };
    } else if (inactiveDays > 0) {
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - inactiveDays);
      where.user = {
        OR: [
          { lastLoginAt: null },
          { lastLoginAt: { lt: threshold } },
        ],
      };
    }

    // Role-based scoping:
    if (currentRole === "STUDENT") {
      where.id = tenantCtx.membership?.id;
    } else if (currentRole === "PARENT") {
      const parentLinks = await tenantDb.parentLink.findMany({
        where: {
          parentMembershipId: tenantCtx.membership?.id,
          status: "CONFIRMED",
        },
        select: { studentMembershipId: true },
      });
      where.id = { in: parentLinks.map((l) => l.studentMembershipId) };
    } else if (currentRole === "TEACHER") {
      const teacherGroups = await tenantDb.group.findMany({
        where: {
          centerId: tenantCtx.center.id,
          teacherMembershipId: tenantCtx.membership?.id,
        },
        select: { id: true },
      });
      const teacherGroupIds = teacherGroups.map((g) => g.id);
      where.enrollments = {
        some: {
          groupId: { in: teacherGroupIds },
        },
      };
    } else if (currentRole === "TEACHER_ASSISTANT") {
      const assistantGroups = await tenantDb.group.findMany({
        where: {
          centerId: tenantCtx.center.id,
          assistantMembershipId: tenantCtx.membership?.id,
        },
        select: { id: true },
      });
      const assistantGroupIds = assistantGroups.map((g) => g.id);
      where.enrollments = {
        some: {
          groupId: { in: assistantGroupIds },
        },
      };
    } else if (
      currentRole !== "DIRECTOR" &&
      currentRole !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (membershipStatus) {
      where.status = membershipStatus;
    }

    if (groupId) {
      where.enrollments = {
        ...(where.enrollments as Prisma.EnrollmentListRelationFilter || {}),
        some: {
          groupId,
          ...(enrollmentStatus ? { status: enrollmentStatus } : {}),
        },
      };
    }

    if (search) {
      where.user = {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const totalCount = await tenantDb.centerMembership.count({ where });

    const orderBy: Prisma.CenterMembershipOrderByWithRelationInput =
      sortBy === "createdAt"
        ? { createdAt: sortOrder }
        : { user: { fullName: sortOrder } };

    const students = await tenantDb.centerMembership.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            lastLoginAt: true,
          },
        },
        enrollments: {
          include: {
            group: {
              select: {
                id: true,
                name: true,
                course: { select: { title: true } },
              },
            },
          },
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
      },
    });

    return NextResponse.json({
      students,
      pagination: {
        page,
        pageSize,
        totalCount,
        totalPages: Math.ceil(totalCount / pageSize),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to load students" },
      { status: error.status || 400 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { fullName, email, phone, groupId, withInvite, password } = body;

    if (!fullName || (!email && !phone)) {
      return NextResponse.json(
        { error: "ФИО и (email или телефон) обязательны" },
        { status: 400 }
      );
    }

    const canAddStudent = await checkSubscriptionLimit(
      tenantCtx.center.id,
      "students",
      1
    );
    if (!canAddStudent) {
      return NextResponse.json(
        { error: "Превышен лимит студентов по тарифу подписки", code: "PLAN_LIMIT_REACHED" },
        { status: 400 }
      );
    }

    let targetGroup = null;
    if (groupId) {
      targetGroup = await tenantDb.group.findFirst({
        where: { id: groupId, centerId: tenantCtx.center.id },
        include: {
          _count: {
            select: { enrollments: { where: { status: "ACTIVE" } } },
          },
        },
      });
      if (!targetGroup) {
        return NextResponse.json(
          { error: "Указанная группа не найдена" },
          { status: 404 }
        );
      }
      if (targetGroup._count.enrollments >= targetGroup.maxStudents) {
        return NextResponse.json(
          { error: "Вместимость группы исчерпана" },
          { status: 400 }
        );
      }
    }

    const cleanEmail = email ? email.toLowerCase().trim() : null;
    const normalizedPhone = phone ? normalizePhone(phone) : null;
    const finalEmail = cleanEmail || `phone_${(normalizedPhone || "student").replace(/[^\d]/g, "")}_${Date.now()}@noemail.local`;

    let user = await tenantDb.platformUser.findFirst({
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
    const passwordHash = await hashPassword(rawPassword);

    let isNewUser = false;
    if (!user) {
      isNewUser = true;
      user = await tenantDb.platformUser.create({
        data: {
          email: finalEmail,
          fullName: fullName.trim(),
          phone: normalizedPhone,
          passwordHash,
          mustChangePassword: true,
          emailVerified: cleanEmail ? null : new Date(),
        },
      });

      if (cleanEmail) {
        // Email a single-use "set your password" link if email was provided
        await sendPasswordSetupLink({
          userId: user.id,
          email: user.email,
          fullName: user.fullName,
        }).catch((sendErr: unknown) => {
          console.error("Failed to send student password setup email:", sendErr);
        });
      }
    }

    let membership = await tenantDb.centerMembership.findFirst({
      where: {
        userId: user.id,
        centerId: tenantCtx.center.id,
        role: "STUDENT",
      },
    });

    if (!membership) {
      membership = await tenantDb.centerMembership.create({
        data: {
          userId: user.id,
          centerId: tenantCtx.center.id,
          role: "STUDENT",
          status: "ACTIVE",
        },
      });
    } else if (membership.status === "ARCHIVED") {
      membership = await tenantDb.centerMembership.update({
        where: { id: membership.id },
        data: { status: "ACTIVE" },
      });
    }

    let enrollment = null;
    if (groupId && membership) {
      const existingEnrollment = await tenantDb.enrollment.findUnique({
        where: {
          studentMembershipId_groupId: {
            studentMembershipId: membership.id,
            groupId,
          },
        },
      });

      if (!existingEnrollment) {
        enrollment = await tenantDb.enrollment.create({
          data: {
            centerId: tenantCtx.center.id,
            studentMembershipId: membership.id,
            groupId,
            status: "ACTIVE",
          },
        });
      } else if (existingEnrollment.status !== "ACTIVE") {
        enrollment = await tenantDb.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { status: "ACTIVE" },
        });
      }
    }

    let inviteCode = null;
    if (withInvite) {
      const code = `${tenantCtx.center.slug.toUpperCase()}-${generateSecureInviteCode(8)}`;
      let createdByMembershipId = tenantCtx.membership?.id;
      if (!createdByMembershipId) {
        const dir = await tenantDb.centerMembership.findFirst({
          where: { centerId: tenantCtx.center.id, role: "DIRECTOR" },
        });
        createdByMembershipId = dir?.id;
      }
      if (createdByMembershipId) {
        inviteCode = await tenantDb.inviteCode.create({
          data: {
            centerId: tenantCtx.center.id,
            code,
            targetRole: "STUDENT",
            groupId: groupId || null,
            maxUses: 1,
            createdByMembershipId,
          },
        });
      }
    }

    const baseUrl = process.env.NEXTAUTH_URL || "https://e-darschi.uz";
    const primaryLogin = cleanEmail || normalizedPhone || user.email;

    return NextResponse.json(
      {
        success: true,
        membership,
        enrollment,
        inviteCode: inviteCode?.code || null,
        credentials: {
          login: primaryLogin,
          password: isNewUser ? rawPassword : "(действующий пароль аккаунта)",
          loginUrl: `${baseUrl}/login`,
          fullName: user.fullName,
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
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Failed to create student" },
      { status: error.status || 400 }
    );
  }
}
