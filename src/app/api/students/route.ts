import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { Prisma } from "@prisma/client";
import { checkSubscriptionLimit } from "@/lib/limits";
import { hashPassword } from "@/lib/auth";
import { generateSecureInviteCode } from "@/lib/invites";
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
    const sortBy = url.searchParams.get("sortBy") || "name"; // name | createdAt
    const sortOrder = url.searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

    const where: Prisma.CenterMembershipWhereInput = {
      centerId: tenantCtx.center.id,
      role: "STUDENT",
    };

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
    } else if (
      currentRole !== "DIRECTOR" &&
      currentRole !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (status) {
      where.status = status;
    }

    if (groupId) {
      where.enrollments = {
        ...(where.enrollments as Prisma.EnrollmentListRelationFilter || {}),
        some: {
          groupId,
          ...(status ? { status } : {}),
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
      { error: error.message || "Failed to load students" },
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
    const { fullName, email, phone, groupId, withInvite } = body;

    if (!fullName || !email) {
      return NextResponse.json(
        { error: "ФИО и email обязательны" },
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
        { error: "Превышен лимит студентов по тарифу подписки" },
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

    const normalizedEmail = email.toLowerCase().trim();

    let user = await tenantDb.platformUser.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      const tempPassword = crypto.randomBytes(16).toString("hex");
      const passwordHash = await hashPassword(tempPassword);
      user = await tenantDb.platformUser.create({
        data: {
          email: normalizedEmail,
          fullName: fullName.trim(),
          phone: phone ? phone.trim() : null,
          passwordHash,
          emailVerified: new Date(),
        },
      });
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

    return NextResponse.json({
      success: true,
      membership,
      enrollment,
      inviteCode: inviteCode?.code || null,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to create student" },
      { status: error.status || 400 }
    );
  }
}
