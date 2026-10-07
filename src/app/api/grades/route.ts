import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const studentId = searchParams.get("studentMembershipId");
    const gradeType = searchParams.get("gradeType");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "50"));

    let whereCondition: any = {
      deletedAt: null, // exclude soft-deleted
    };

    // Role-based scoping
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      // Teacher only sees grades for their own groups
      whereCondition.teacherMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      // Student only sees own grades
      whereCondition.studentMembershipId = tenantCtx.membership.id;
    } else if (tenantCtx.role === "PARENT" && tenantCtx.membership) {
      // Parent only sees their children's grades
      const childLinks = await tenantDb.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      whereCondition.studentMembershipId = { in: childLinks.map((l) => l.studentMembershipId) };
    } else if (tenantCtx.role === "TEACHER_ASSISTANT" && tenantCtx.membership) {
      // Assistant can only read grades (not create) — scope to their groups
      const groups = await tenantDb.group.findMany({
        where: { assistantMembershipId: tenantCtx.membership.id },
        select: { id: true },
      });
      whereCondition.groupId = { in: groups.map((g) => g.id) };
    }

    if (groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      whereCondition.groupId = groupId;
    }

    if (studentId) {
      const studentMem = await tenantDb.centerMembership.findFirst({
        where: { id: studentId },
      });
      if (!studentMem) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      whereCondition.studentMembershipId = studentId;
    }

    if (gradeType) {
      whereCondition.gradeType = gradeType;
    }

    const [grades, total] = await tenantDb.$transaction([
      tenantDb.grade.findMany({
        where: whereCondition,
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
          teacher: { include: { user: { select: { fullName: true } } } },
          group: { select: { id: true, name: true } },
          lesson: { select: { id: true, title: true, scheduledAt: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      tenantDb.grade.count({ where: whereCondition }),
    ]);

    return NextResponse.json({ grades, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      tenantCtx.role !== "TEACHER" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden: Cannot create grades" }, { status: 403 });
    }

    const { studentMembershipId, groupId, lessonId, gradeType, value, maxValue, comment } = await req.json();

    if (!studentMembershipId || !gradeType || value === undefined) {
      return NextResponse.json({ error: "studentMembershipId, gradeType, value are required" }, { status: 400 });
    }

    const student = await tenantDb.centerMembership.findFirst({
      where: { id: studentMembershipId, role: "STUDENT" },
    });
    if (!student) return NextResponse.json({ error: "Student not found in this center" }, { status: 404 });

    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (!groupId) return NextResponse.json({ error: "groupId required for teacher grading" }, { status: 400 });
      const isInTeacherGroup = await tenantDb.enrollment.findFirst({
        where: {
          studentMembershipId,
          groupId,
          group: { teacherMembershipId: tenantCtx.membership.id },
        },
      });
      if (!isInTeacherGroup) {
        return NextResponse.json({ error: "You can only grade students in your own groups" }, { status: 403 });
      }
    }

    if (groupId) {
      const group = await tenantDb.group.findFirst({
        where: { id: groupId },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const numericValue = parseFloat(value);
    const numericMax = parseFloat(maxValue || "100");

    if (isNaN(numericValue) || numericValue < 0 || numericValue > numericMax) {
      return NextResponse.json({ error: `Grade value must be between 0 and ${numericMax}` }, { status: 400 });
    }

    const grade = await tenantDb.grade.create({
      data: {
        centerId: tenantCtx.center.id,
        studentMembershipId,
        groupId: groupId || null,
        lessonId: lessonId || null,
        teacherMembershipId: tenantCtx.membership!.id,
        gradeType,
        value: numericValue,
        maxValue: numericMax,
        comment: comment?.trim() || null,
        lifecycle: "DRAFT",
      },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "GRADE_CREATED",
      resource: "Grade",
      resourceId: grade.id,
      details: { gradeType, value: numericValue, studentMembershipId, lifecycle: "DRAFT" },
    });

    return NextResponse.json({ success: true, grade });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { id, value, maxValue, comment, lifecycle } = await req.json();

    if (!id) return NextResponse.json({ error: "Grade ID required" }, { status: 400 });

    const existing = await tenantDb.grade.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Grade not found" }, { status: 404 });

    if (existing.lifecycle === "FINAL") {
      if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
        return NextResponse.json({
          error: "Cannot modify a finalized grade. Contact the center director.",
        }, { status: 403 });
      }
    }

    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (existing.teacherMembershipId !== tenantCtx.membership.id) {
        return NextResponse.json({ error: "You can only edit grades you created" }, { status: 403 });
      }
    }

    if (existing.lifecycle === "FINAL" && lifecycle && lifecycle !== "FINAL") {
      return NextResponse.json({ error: "Cannot revert a finalized grade" }, { status: 400 });
    }

    if (lifecycle) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["SUBMITTED", "FINAL"],
        SUBMITTED: ["FINAL"],
        FINAL: ["FINAL"],
      };
      if (!validTransitions[existing.lifecycle]?.includes(lifecycle)) {
        return NextResponse.json({
          error: `Invalid lifecycle transition: ${existing.lifecycle} → ${lifecycle}`,
        }, { status: 400 });
      }
    }

    const updateData: any = {
      value: value !== undefined ? parseFloat(value) : existing.value,
      maxValue: maxValue !== undefined ? parseFloat(maxValue) : existing.maxValue,
      comment: comment !== undefined ? comment?.trim() || null : existing.comment,
      lifecycle: lifecycle || existing.lifecycle,
    };

    if (lifecycle === "FINAL" && existing.lifecycle !== "FINAL") {
      updateData.finalizedAt = new Date();
      updateData.finalizedById = tenantCtx.membership?.id || null;
    }

    await tenantDb.grade.updateMany({ where: { id }, data: updateData });
    const grade = await tenantDb.grade.findFirst({ where: { id } });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: lifecycle === "FINAL" ? "GRADE_FINALIZED" : "GRADE_UPDATED",
      resource: "Grade",
      resourceId: id,
      details: {
        oldLifecycle: existing.lifecycle,
        newLifecycle: grade?.lifecycle ?? "",
        oldValue: existing.value,
        newValue: grade?.value ?? 0,
      },
    });

    if (lifecycle === "FINAL" && existing.lifecycle !== "FINAL") {
      const studentMembership = await tenantDb.centerMembership.findFirst({
        where: { id: existing.studentMembershipId },
        select: { userId: true },
      });
      if (studentMembership?.userId) {
        await sendNotification({
          userId: studentMembership.userId,
          centerId: tenantCtx.center.id,
          type: "GRADE_POSTED",
          titleKey: "notifications.gradePosted",
          bodyKey: "notifications.gradePostedBody",
          bodyParams: { value: grade?.value ?? 0, maxValue: grade?.maxValue ?? 100 },
        });
      }
    }

    return NextResponse.json({ success: true, grade });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Only directors can delete grades" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Grade ID required" }, { status: 400 });

    const existing = await tenantDb.grade.findFirst({
      where: { id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Grade not found" }, { status: 404 });

    if (existing.lifecycle === "FINAL") {
      return NextResponse.json({
        error: "Cannot delete a finalized grade. Unfinalize it first if you have permission.",
      }, { status: 403 });
    }

    await tenantDb.grade.updateMany({
      where: { id },
      data: { deletedAt: new Date(), deletedById: tenantCtx.membership?.id || null },
    });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "GRADE_DELETED",
      resource: "Grade",
      resourceId: id,
      details: { gradeType: existing.gradeType, value: existing.value },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}
