import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function POST(
  req: Request,
  { params }: { params: { id: string } } // source groupId
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const sourceGroupId = params.id;

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentMembershipId, targetGroupId, reason } = await req.json();

    if (!studentMembershipId || !targetGroupId) {
      return NextResponse.json(
        { error: "Не указан ID студента или целевой группы" },
        { status: 400 }
      );
    }

    if (sourceGroupId === targetGroupId) {
      return NextResponse.json(
        { error: "Исходная и целевая группы совпадают" },
        { status: 400 }
      );
    }

    const [sourceGroup, targetGroup] = await Promise.all([
      tenantDb.group.findFirst({
        where: { id: sourceGroupId, centerId: tenantCtx.center.id },
      }),
      tenantDb.group.findFirst({
        where: { id: targetGroupId, centerId: tenantCtx.center.id },
        include: {
          _count: {
            select: { enrollments: { where: { status: "ACTIVE" } } },
          },
        },
      }),
    ]);

    if (!sourceGroup || !targetGroup) {
      return NextResponse.json(
        { error: "Одна из групп не найдена" },
        { status: 404 }
      );
    }

    // Check capacity of target group
    if (targetGroup._count.enrollments >= targetGroup.maxStudents) {
      return NextResponse.json(
        { error: "Вместимость целевой группы исчерпана" },
        { status: 400 }
      );
    }

    // Check source enrollment
    const sourceEnrollment = await tenantDb.enrollment.findFirst({
      where: {
        studentMembershipId,
        groupId: sourceGroupId,
        centerId: tenantCtx.center.id,
      },
    });

    if (!sourceEnrollment) {
      return NextResponse.json(
        { error: "Студент не зачислен в исходную группу" },
        { status: 404 }
      );
    }

    // Execute transfer: mark old enrollment DROPPED/TRANSFERRED, create or activate new enrollment
    const updatedSource = await tenantDb.enrollment.update({
      where: { id: sourceEnrollment.id },
      data: { status: "DROPPED" },
    });

    const existingTarget = await tenantDb.enrollment.findFirst({
      where: {
        studentMembershipId,
        groupId: targetGroupId,
        centerId: tenantCtx.center.id,
      },
    });

    let targetEnrollment;
    if (existingTarget) {
      targetEnrollment = await tenantDb.enrollment.update({
        where: { id: existingTarget.id },
        data: { status: "ACTIVE" },
      });
    } else {
      targetEnrollment = await tenantDb.enrollment.create({
        data: {
          centerId: tenantCtx.center.id,
          studentMembershipId,
          groupId: targetGroupId,
          status: "ACTIVE",
        },
      });
    }

    // Write audit log
    await tenantDb.auditLog.create({
      data: {
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "STUDENT_TRANSFERRED",
        resource: "Student",
        resourceId: studentMembershipId,
        detailsJson: JSON.stringify({
          fromGroupId: sourceGroupId,
          fromGroupName: sourceGroup.name,
          toGroupId: targetGroupId,
          toGroupName: targetGroup.name,
          reason: reason || "Перевод администратором",
        }),
      },
    });

    return NextResponse.json({
      success: true,
      sourceEnrollment: updatedSource,
      targetEnrollment,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка перевода студента" },
      { status: error.status || 400 }
    );
  }
}
