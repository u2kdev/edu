import { NextResponse } from "next/server";
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";
import { CenterStatus, OrganizationKind } from "@prisma/client";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.centers.read", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const center = await db.learningCenter.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { id: true, email: true, fullName: true, phone: true } },
        subscriptions: {
          include: {
            plan: true,
          },
          orderBy: { createdAt: "desc" },
        },
        platformPayments: {
          include: {
            plan: true,
          },
          orderBy: { paidAt: "desc" },
          take: 20,
        },
        courses: {
          select: { id: true, title: true, createdAt: true },
          take: 20,
        },
        supportTickets: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            creator: { select: { fullName: true, email: true } },
          },
        },
        memberships: {
          take: 50,
          orderBy: { createdAt: "desc" },
          include: {
            user: { select: { id: true, fullName: true, email: true, phone: true, lastLoginAt: true } },
          },
        },
      },
    });

    if (!center) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [membersGrouped, activeCoursesCount, lastActivityLog] = await Promise.all([
      db.centerMembership.groupBy({
        by: ["role"],
        where: { centerId: params.id, status: "ACTIVE" },
        _count: { id: true },
      }),
      db.course.count({ where: { centerId: params.id } }),
      db.activityLog.findFirst({
        where: { centerId: params.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    const activeStudents = await db.centerMembership.count({
      where: { centerId: params.id, role: "STUDENT", status: "ACTIVE" },
    });
    const activeTeachers = await db.centerMembership.count({
      where: { centerId: params.id, role: "TEACHER", status: "ACTIVE" },
    });

    const activeSub = center.subscriptions[0];
    const limits = {
      maxStudents: activeSub?.plan?.maxStudents ?? 0,
      currentStudents: activeStudents,
      percentUsed:
        activeSub?.plan?.maxStudents && activeSub.plan.maxStudents > 0
          ? Math.round((activeStudents / activeSub.plan.maxStudents) * 100)
          : 0,
    };

    const metrics = {
      usersByRole: membersGrouped.reduce((acc, curr) => {
        acc[curr.role] = curr._count.id;
        return acc;
      }, {} as Record<string, number>),
      activeStudents,
      activeTeachers,
      activeCoursesCount,
      lastActivityAt: lastActivityLog?.createdAt || center.updatedAt,
      limits,
    };

    const auditLogs = await db.auditLog.findMany({
      where: { centerId: params.id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        actor: { select: { fullName: true, email: true } },
      },
    });

    return NextResponse.json({
      data: center,
      center,
      director: center.owner,
      metrics,
      auditLogs,
      memberships: center.memberships,
      tickets: center.supportTickets,
    });
  } catch (err: unknown) {
    console.error("[GET /api/platform/centers/[id]]", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

const patchSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  address: z.string().optional().nullable(),
  inn: z.string().optional().nullable(),
  legalName: z.string().optional().nullable(),
  contactPerson: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  timeZone: z.string().optional(),
  brandingConfig: z.string().optional().nullable(),
  organizationKind: z.nativeEnum(OrganizationKind).optional(),
  status: z.nativeEnum(CenterStatus).optional(),
  action: z.enum(["ARCHIVE", "RESTORE"]).optional(),
  reason: z.string().optional(),
});

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session || !hasPermission("platform.centers.write", session.user.platformRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const parsedBody = patchSchema.safeParse(body);
    if (!parsedBody.success) {
      return NextResponse.json({ error: parsedBody.error.issues }, { status: 400 });
    }

    const existing = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const { action, reason, ...fields } = parsedBody.data;

    let updateData: Record<string, unknown> = { ...fields };

    if (action === "ARCHIVE") {
      if (!reason || reason.trim().length < 5) {
        return NextResponse.json(
          { error: "Причина архивации обязательна (минимум 5 символов)" },
          { status: 400 }
        );
      }
      updateData = {
        ...updateData,
        status: CenterStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelledReason: reason.trim(),
      };
    } else if (action === "RESTORE") {
      updateData = {
        ...updateData,
        status: CenterStatus.ACTIVE,
        cancelledAt: null,
        cancelledReason: null,
      };
    }

    const updated = await db.learningCenter.update({
      where: { id: params.id },
      data: updateData,
    });

    await db.auditLog.create({
      data: {
        centerId: params.id,
        actorUserId: session.user.id,
        action: action ? `PLATFORM_CENTER_${action}` : "PLATFORM_UPDATE_LEARNING_CENTER",
        resource: "LearningCenter",
        detailsJson: JSON.stringify({
          action,
          reason,
          changes: updateData,
        }),
      },
    });

    return NextResponse.json({ success: true, center: updated });
  } catch (err: unknown) {
    console.error("[GET /api/platform/centers/[id]]", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getAuthSession(req);
    if (!session || session.user.platformRole !== "SUPERADMIN") {
      return NextResponse.json({ error: "Forbidden: Superadmin only" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const confirmName = body.confirmName?.trim() || "";
    const reason = body.reason?.trim() || "";

    if (!reason || reason.length < 5) {
      return NextResponse.json(
        { error: "Причина удаления обязательна (минимум 5 символов)" },
        { status: 400 }
      );
    }

    const existing = await db.learningCenter.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    // Rule: deletion ONLY allowed for archived (CANCELLED) centers older than 30 days
    if (existing.status !== CenterStatus.CANCELLED || !existing.cancelledAt) {
      return NextResponse.json(
        { error: "Удаление разрешено только для архивных центров" },
        { status: 400 }
      );
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    if (new Date(existing.cancelledAt) > thirtyDaysAgo) {
      return NextResponse.json(
        { error: "Удаление возможно только по истечении 30 дней после архивации" },
        { status: 400 }
      );
    }

    // Rule: confirm name must match center name exactly
    if (confirmName !== existing.name) {
      return NextResponse.json(
        { error: "Введенное название не совпадает с точным названием центра" },
        { status: 400 }
      );
    }

    await db.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "PLATFORM_DELETE_LEARNING_CENTER",
        resource: "LearningCenter",
        resourceId: params.id,
        detailsJson: JSON.stringify({
          centerName: existing.name,
          slug: existing.slug,
          reason,
          cancelledAt: existing.cancelledAt,
        }),
      },
    });

    await db.learningCenter.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true, deletedId: params.id });
  } catch (err: unknown) {
    console.error("[GET /api/platform/centers/[id]]", err);
    return NextResponse.json({ error: "Internal Error" }, { status: 500 });
  }
}
