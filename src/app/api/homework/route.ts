import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";

// GET /api/homework?lessonId=xxx - List homeworks for a lesson (tenant-scoped)
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");

    let whereCondition: any = {
      lesson: { module: { course: { centerId: tenantCtx.center.id } } },
    };

    if (lessonId) {
      // SECURITY: Verify lesson belongs to tenant before filtering by it
      const lesson = await tenantDb.lesson.findFirst({
        where: { id: lessonId },
      });
      if (!lesson) {
        return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
      }
      whereCondition = { lessonId };
    }

    // For STUDENT role: only return homeworks for groups they're enrolled in
    if (tenantCtx.role === "STUDENT" && tenantCtx.membership) {
      const enrollments = await tenantDb.enrollment.findMany({
        where: { studentMembershipId: tenantCtx.membership.id },
        select: { group: { select: { course: { select: { modules: { select: { lessons: { select: { id: true } } } } } } } } },
      });
      const lessonIds: string[] = [];
      for (const en of enrollments) {
        for (const mod of en.group.course.modules) {
          for (const les of mod.lessons) {
            lessonIds.push(les.id);
          }
        }
      }
      whereCondition = { lessonId: { in: lessonIds } };
    }

    const homeworks = await tenantDb.homework.findMany({
      where: whereCondition,
      include: {
        materials: { include: { material: true } },
        submissions: tenantCtx.role === "STUDENT"
          ? {
              where: { studentMembershipId: tenantCtx.membership?.id },
              include: {
                student: { include: { user: { select: { fullName: true, email: true } } } },
              },
            }
          : {
              include: {
                student: { include: { user: { select: { fullName: true, email: true } } } },
              },
            },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ homeworks });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// POST /api/homework - Create homework linked to a lesson
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
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, title, description, dueDate, materialIds } = await req.json();

    if (!lessonId || !title) {
      return NextResponse.json({ error: "lessonId and title are required" }, { status: 400 });
    }

    // SECURITY: Verify lesson belongs to this tenant
    const lesson = await tenantDb.lesson.findFirst({
      where: { id: lessonId },
    });
    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    // SECURITY: For TEACHER role, verify they are assigned to the group that owns this lesson
    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const lessonWithCourse = await tenantDb.lesson.findFirst({
        where: { id: lessonId },
        include: { module: { include: { course: { include: { groups: true } } } } },
      });
      const teacherGroups = lessonWithCourse?.module.course.groups.filter(
        (g) => g.teacherMembershipId === tenantCtx.membership!.id
      );
      if (!teacherGroups || teacherGroups.length === 0) {
        return NextResponse.json({ error: "You are not assigned to this lesson's course" }, { status: 403 });
      }
    }

    const homework = await tenantDb.homework.create({
      data: {
        centerId: tenantCtx.center.id,
        lessonId,
        title,
        description: description || null,
        dueDate: dueDate ? new Date(dueDate) : null,
      },
    });

    // Link materials if provided
    if (Array.isArray(materialIds) && materialIds.length > 0) {
      // Validate all materialIds belong to this tenant
      const validMaterials = await tenantDb.material.findMany({
        where: { id: { in: materialIds } },
        select: { id: true },
      });
      const validMatIds = new Set(validMaterials.map((m) => m.id));

      for (const matId of materialIds) {
        if (!validMatIds.has(matId)) continue; // Skip cross-tenant material IDs silently
        await tenantDb.homeworkMaterial.create({
          data: { homeworkId: homework.id, materialId: matId },
        });
      }
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "HOMEWORK_CREATED",
      resource: "Homework",
      resourceId: homework.id,
      details: { title, dueDate, lessonId },
    });

    // NOTIFICATION: Notify all students enrolled in the lesson's group
    const enrollments = await tenantDb.enrollment.findMany({
      where: {
        group: {
          course: {
            modules: {
              some: {
                lessons: {
                  some: { id: lessonId }
                }
              }
            }
          }
        },
        status: "ACTIVE"
      },
      include: { student: true }
    });

    for (const en of enrollments) {
      if (en.student.userId) {
        await sendNotification({
          userId: en.student.userId,
          centerId: tenantCtx.center.id,
          type: "NEW_HOMEWORK",
          titleKey: "notifications.newHomework",
          bodyKey: "notifications.newHomeworkBody",
          bodyParams: { title: homework.title },
        });
      }
    }

    return NextResponse.json({ success: true, homework });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// PATCH /api/homework - Submit or Grade homework
export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { action, homeworkId, submissionText, filesJson, grade, feedback, studentMembershipId } = await req.json();

    if (!homeworkId) {
      return NextResponse.json({ error: "homeworkId required" }, { status: 400 });
    }

    // SECURITY: Verify homework belongs to this tenant
    const homework = await tenantDb.homework.findFirst({
      where: { id: homeworkId },
    });
    if (!homework) {
      return NextResponse.json({ error: "Homework not found or access denied" }, { status: 404 });
    }

    // Action A: Student submits homework
    if (action === "SUBMIT") {
      if (tenantCtx.role !== "STUDENT" || !tenantCtx.membership) {
        return NextResponse.json({ error: "Only students can submit homework" }, { status: 403 });
      }

      // We cannot use upsert because db-tenant intercepts findUnique but homeworkId_studentMembershipId is compound.
      // We'll manually findFirst and create or update.
      const existing = await tenantDb.homeworkSubmission.findFirst({
        where: { homeworkId, studentMembershipId: tenantCtx.membership.id },
      });

      let submission;
      if (existing) {
        submission = await tenantDb.homeworkSubmission.updateMany({
          where: { homeworkId, studentMembershipId: tenantCtx.membership.id },
          data: {
            submissionText: submissionText || null,
            filesJson: filesJson ? JSON.stringify(filesJson) : null,
            submittedAt: new Date(),
          },
        });
        submission = await tenantDb.homeworkSubmission.findFirst({
           where: { homeworkId, studentMembershipId: tenantCtx.membership.id }
        });
      } else {
        submission = await tenantDb.homeworkSubmission.create({
          data: {
            centerId: tenantCtx.center.id,
            homeworkId,
            studentMembershipId: tenantCtx.membership.id,
            submissionText: submissionText || null,
            filesJson: filesJson ? JSON.stringify(filesJson) : null,
          },
        });
      }

      // Log activity
      await tenantDb.activityLog.create({
        data: {
          userMembershipId: tenantCtx.membership.id,
          centerId: tenantCtx.center.id,
          activityType: "SUBMIT_HOMEWORK",
          resourceType: "Homework",
          resourceId: homeworkId,
        },
      });

      return NextResponse.json({ success: true, submission });
    }

    // Action B: Teacher/Admin grades homework
    if (action === "GRADE") {
      if (
        tenantCtx.role !== "DIRECTOR" &&
        tenantCtx.role !== "CENTER_ADMIN" &&
        tenantCtx.role !== "TEACHER" &&
        !tenantCtx.isPlatformStaff
      ) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (!studentMembershipId) {
        return NextResponse.json({ error: "studentMembershipId required" }, { status: 400 });
      }

      // SECURITY: Verify the studentMembershipId belongs to this tenant
      const studentMem = await tenantDb.centerMembership.findFirst({
        where: {
          id: studentMembershipId,
          role: "STUDENT",
        },
      });
      if (!studentMem) {
        return NextResponse.json({ error: "Student not found in this center" }, { status: 404 });
      }

      // SECURITY: TEACHER can only grade students in their own groups
      if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
        const isInTeacherGroup = await tenantDb.enrollment.findFirst({
          where: {
            studentMembershipId,
            group: { teacherMembershipId: tenantCtx.membership.id },
          },
        });
        if (!isInTeacherGroup) {
          return NextResponse.json({ error: "You can only grade students in your own groups" }, { status: 403 });
        }
      }

      // We use updateMany for composite unique keys because db-tenant doesn't support compound unique updates yet natively without error
      await tenantDb.homeworkSubmission.updateMany({
        where: {
          homeworkId,
          studentMembershipId,
        },
        data: {
          grade: grade !== undefined ? parseInt(grade) : null,
          feedback: feedback || null,
          gradedByMembershipId: tenantCtx.membership?.id,
          gradedAt: new Date(),
        },
      });

      const submission = await tenantDb.homeworkSubmission.findFirst({
        where: { homeworkId, studentMembershipId }
      });

      await logAuditEvent({
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "HOMEWORK_GRADED",
        resource: "HomeworkSubmission",
        resourceId: submission?.id,
        details: { grade, studentMembershipId, homeworkId },
      });

      return NextResponse.json({ success: true, submission });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
