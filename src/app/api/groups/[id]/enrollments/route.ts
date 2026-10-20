import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";
import { withKeyedLock } from "@/lib/async-lock";

export async function POST(
  req: Request,
  { params }: { params: { id: string } } // params.id = groupId
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const groupId = params.id;

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentMembershipId } = await req.json();

    if (!studentMembershipId) {
      return NextResponse.json(
        { error: "Не указан ID студента" },
        { status: 400 }
      );
    }

    // Verify student membership exists in this center
    const student = await tenantDb.centerMembership.findFirst({
      where: {
        id: studentMembershipId,
        centerId: tenantCtx.center.id,
        role: "STUDENT",
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Студент не найден в этом центре" },
        { status: 404 }
      );
    }

    return await withKeyedLock(`group-enroll:${groupId}`, async () => {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId, centerId: tenantCtx.center.id },
      });

      if (!group) {
        return NextResponse.json({ error: "Группа не найдена" }, { status: 404 });
      }

      const activeCount = await tenantDb.enrollment.count({
        where: {
          groupId,
          status: "ACTIVE",
          centerId: tenantCtx.center.id,
        },
      });

      if (activeCount >= group.maxStudents) {
        return NextResponse.json(
          { error: "Вместимость группы исчерпана" },
          { status: 400 }
        );
      }

      const existingEnrollment = await tenantDb.enrollment.findFirst({
        where: {
          studentMembershipId,
          groupId,
          centerId: tenantCtx.center.id,
        },
      });

      let enrollment;
      if (existingEnrollment) {
        enrollment = await tenantDb.enrollment.update({
          where: { id: existingEnrollment.id },
          data: { status: "ACTIVE" },
        });
      } else {
        enrollment = await tenantDb.enrollment.create({
          data: {
            centerId: tenantCtx.center.id,
            studentMembershipId,
            groupId,
            status: "ACTIVE",
          },
        });
      }

      // Record audit log
      await tenantDb.auditLog.create({
        data: {
          centerId: tenantCtx.center.id,
          actorUserId: tenantCtx.session.user.id,
          action: "STUDENT_ENROLLED",
          resource: "Student",
          resourceId: studentMembershipId,
          detailsJson: JSON.stringify({
            groupId,
            groupName: group.name,
            enrollmentId: enrollment.id,
          }),
        },
      });

      return NextResponse.json({ success: true, enrollment });
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка добавления в группу" },
      { status: error.status || 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } } // params.id = groupId
) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const groupId = params.id;

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { studentMembershipId, reason } = await req.json();

    if (!studentMembershipId) {
      return NextResponse.json(
        { error: "Не указан ID студента" },
        { status: 400 }
      );
    }

    const enrollment = await tenantDb.enrollment.findFirst({
      where: {
        studentMembershipId,
        groupId,
        centerId: tenantCtx.center.id,
      },
      include: { group: true },
    });

    if (!enrollment) {
      return NextResponse.json(
        { error: "Зачисление не найдено" },
        { status: 404 }
      );
    }

    const updated = await tenantDb.enrollment.update({
      where: { id: enrollment.id },
      data: { status: "DROPPED" },
    });

    // Write audit log with reason
    await tenantDb.auditLog.create({
      data: {
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "STUDENT_DROPPED",
        resource: "Student",
        resourceId: studentMembershipId,
        detailsJson: JSON.stringify({
          groupId,
          groupName: enrollment.group.name,
          reason: reason || "Отчислен администратором",
        }),
      },
    });

    return NextResponse.json({ success: true, enrollment: updated });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Ошибка отчисления из группы" },
      { status: error.status || 400 }
    );
  }
}
