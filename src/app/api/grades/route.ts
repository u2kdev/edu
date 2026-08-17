import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";

// Grade lifecycle: DRAFT → SUBMITTED → FINAL
// Once FINAL, only DIRECTOR can modify (with audit trail)

// GET /api/grades
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { searchParams } = new URL(req.url);
    const groupId = searchParams.get("groupId");
    const studentId = searchParams.get("studentMembershipId");
    const gradeType = searchParams.get("gradeType");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, parseInt(searchParams.get("pageSize") || "50"));

    let whereCondition: any = {
      centerId: tenantCtx.center.id,
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
      const childLinks = await db.parentLink.findMany({
        where: { parentMembershipId: tenantCtx.membership.id, status: "CONFIRMED" },
        select: { studentMembershipId: true },
      });
      whereCondition.studentMembershipId = { in: childLinks.map((l) => l.studentMembershipId) };
    } else if (tenantCtx.role === "TEACHER_ASSISTANT" && tenantCtx.membership) {
      // Assistant can only read grades (not create) — scope to their groups
      const groups = await db.group.findMany({
        where: { assistantMembershipId: tenantCtx.membership.id, course: { centerId: tenantCtx.center.id } },
        select: { id: true },
      });
      whereCondition.groupId = { in: groups.map((g) => g.id) };
    }

    if (groupId) {
      // SECURITY: Validate group belongs to tenant
      const group = await db.group.findFirst({
        where: { id: groupId, course: { centerId: tenantCtx.center.id } },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
      whereCondition.groupId = groupId;
    }

    if (studentId) {
      // SECURITY: Only allow if user has access to this student
      const studentMem = await db.centerMembership.findFirst({
        where: { id: studentId, centerId: tenantCtx.center.id },
      });
      if (!studentMem) return NextResponse.json({ error: "Student not found" }, { status: 404 });
      whereCondition.studentMembershipId = studentId;
    }

    if (gradeType) {
      whereCondition.gradeType = gradeType;
    }

    const [grades, total] = await db.$transaction([
      db.grade.findMany({
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
      db.grade.count({ where: whereCondition }),
    ]);

    return NextResponse.json({ grades, total, page, pageSize });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// POST /api/grades — Create a grade
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    // Only teachers, admins, directors can create grades
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

    // SECURITY: Validate student belongs to this tenant
    const student = await db.centerMembership.findFirst({
      where: { id: studentMembershipId, centerId: tenantCtx.center.id, role: "STUDENT" },
    });
    if (!student) return NextResponse.json({ error: "Student not found in this center" }, { status: 404 });

    // SECURITY: TEACHER can only grade students in their own groups
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (!groupId) return NextResponse.json({ error: "groupId required for teacher grading" }, { status: 400 });
      const isInTeacherGroup = await db.enrollment.findFirst({
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

    // Validate group belongs to this tenant
    if (groupId) {
      const group = await db.group.findFirst({
        where: { id: groupId, course: { centerId: tenantCtx.center.id } },
      });
      if (!group) return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const numericValue = parseFloat(value);
    const numericMax = parseFloat(maxValue || "100");

    if (isNaN(numericValue) || numericValue < 0 || numericValue > numericMax) {
      return NextResponse.json({ error: `Grade value must be between 0 and ${numericMax}` }, { status: 400 });
    }

    const grade = await db.grade.create({
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

// PATCH /api/grades — Update or finalize a grade
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const { id, value, maxValue, comment, lifecycle } = await req.json();

    if (!id) return NextResponse.json({ error: "Grade ID required" }, { status: 400 });

    // SECURITY: Fetch grade and verify it belongs to this tenant
    const existing = await db.grade.findFirst({
      where: { id, centerId: tenantCtx.center.id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Grade not found" }, { status: 404 });

    // FINALIZATION rules:
    // - FINAL grades can only be modified by DIRECTOR (with audit trail)
    // - TEACHER can only update DRAFT/SUBMITTED grades they created
    if (existing.lifecycle === "FINAL") {
      if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
        return NextResponse.json({
          error: "Cannot modify a finalized grade. Contact the center director.",
        }, { status: 403 });
      }
    }

    // TEACHER can only edit their own grades
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      if (existing.teacherMembershipId !== tenantCtx.membership.id) {
        return NextResponse.json({ error: "You can only edit grades you created" }, { status: 403 });
      }
    }

    // Cannot go back from FINAL
    if (existing.lifecycle === "FINAL" && lifecycle && lifecycle !== "FINAL") {
      return NextResponse.json({ error: "Cannot revert a finalized grade" }, { status: 400 });
    }

    // Validate new lifecycle transitions
    if (lifecycle) {
      const validTransitions: Record<string, string[]> = {
        DRAFT: ["SUBMITTED", "FINAL"],
        SUBMITTED: ["FINAL"],
        FINAL: ["FINAL"], // only DIRECTOR can keep it final
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

    const grade = await db.grade.update({ where: { id }, data: updateData });

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: lifecycle === "FINAL" ? "GRADE_FINALIZED" : "GRADE_UPDATED",
      resource: "Grade",
      resourceId: id,
      details: {
        oldLifecycle: existing.lifecycle,
        newLifecycle: grade.lifecycle,
        oldValue: existing.value,
        newValue: grade.value,
      },
    });

    if (lifecycle === "FINAL" && existing.lifecycle !== "FINAL") {
      const studentMembership = await db.centerMembership.findUnique({
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
          bodyParams: { value: grade.value, maxValue: grade.maxValue },
        });
      }
    }

    return NextResponse.json({ success: true, grade });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 400 });
  }
}

// DELETE /api/grades — Soft delete a grade
export async function DELETE(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();

    if (tenantCtx.role !== "DIRECTOR" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Only directors can delete grades" }, { status: 403 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Grade ID required" }, { status: 400 });

    const existing = await db.grade.findFirst({
      where: { id, centerId: tenantCtx.center.id, deletedAt: null },
    });
    if (!existing) return NextResponse.json({ error: "Grade not found" }, { status: 404 });

    // FINALIZED grades require extra confirmation (check lifecycle)
    if (existing.lifecycle === "FINAL") {
      return NextResponse.json({
        error: "Cannot delete a finalized grade. Unfinalize it first if you have permission.",
      }, { status: 403 });
    }

    // Soft delete
    await db.grade.update({
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
