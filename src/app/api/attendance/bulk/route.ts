import { NextResponse } from "next/server";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { z } from "zod";

const AttendanceStatusEnum = z.enum(["PRESENT", "ABSENT", "EXCUSED", "LATE"]);

const BulkAttendanceSchema = z.object({
  lessonId: z.string().min(1, "lessonId is required"),
  groupId: z.string().min(1, "groupId is required"),
  defaultStatus: AttendanceStatusEnum.optional(),
  studentStatusMap: z.record(z.string(), AttendanceStatusEnum).optional(),
});

// POST /api/attendance/bulk - Mark attendance for all students in a group for a lesson in one batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = await req.json();
    const parsed = BulkAttendanceSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid attendance parameters", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { lessonId, groupId, defaultStatus, studentStatusMap } = parsed.data;

    if (tenantCtx.role === "TEACHER" && tenantCtx.membership) {
      const isTeacherGroup = await tenantDb.group.findFirst({
        where: { id: groupId, teacherMembershipId: tenantCtx.membership.id },
      });
      if (!isTeacherGroup) {
        return NextResponse.json({ error: "You can only mark attendance for your own groups" }, { status: 403 });
      }
    }

    // Verify lesson belongs to the group and center
    const lesson = await tenantDb.lesson.findFirst({
      where: { id: lessonId, centerId: tenantCtx.center.id },
      include: {
        module: { select: { courseId: true, centerId: true } },
        scheduleSlot: { select: { groupId: true, centerId: true } },
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found in this center" }, { status: 404 });
    }

    const group = await tenantDb.group.findFirst({
      where: { id: groupId, centerId: tenantCtx.center.id },
      select: { id: true, courseId: true },
    });

    if (!group) {
      return NextResponse.json({ error: "Group not found in this center" }, { status: 404 });
    }

    const matchesCourse = lesson.module.courseId === group.courseId;
    const matchesSlot = !lesson.scheduleSlot?.groupId || lesson.scheduleSlot.groupId === groupId;
    if (!matchesCourse || !matchesSlot) {
      return NextResponse.json(
        { error: "Lesson does not belong to the specified group and center" },
        { status: 400 }
      );
    }

    const enrollments = await tenantDb.enrollment.findMany({
      where: {
        groupId,
        status: "ACTIVE",
        student: { status: "ACTIVE" },
      },
      select: { studentMembershipId: true },
    });

    const activeStudentIds = new Set(enrollments.map((e) => e.studentMembershipId));

    if (studentStatusMap) {
      for (const studentId of Object.keys(studentStatusMap)) {
        if (!activeStudentIds.has(studentId)) {
          return NextResponse.json(
            { error: `Student ${studentId} is not an active non-archived member of group ${groupId}` },
            { status: 400 }
          );
        }
      }
    }

    const markerId = tenantCtx.membership?.id || tenantCtx.center.ownerId;

    // Use updateMany for UPSERT simulation with getTenantDb because prisma extension doesn't fully intercept compound where upserts well yet.
    for (const en of enrollments) {
      const status = studentStatusMap?.[en.studentMembershipId] || defaultStatus || "PRESENT";
      const existing = await tenantDb.attendance.findFirst({
        where: { lessonId, studentMembershipId: en.studentMembershipId }
      });

      if (existing) {
        await tenantDb.attendance.updateMany({
           where: { lessonId, studentMembershipId: en.studentMembershipId },
           data: {
             groupId,
             status,
             markedByMembershipId: markerId,
             markedAt: new Date(),
           }
        });
      } else {
        try {
          await tenantDb.attendance.create({
             data: {
               lessonId,
               studentMembershipId: en.studentMembershipId,
               groupId,
               status,
               markedByMembershipId: markerId,
             }
          });
        } catch (e: unknown) {
          const err = e as { code?: string };
          if (err?.code === 'P2002') {
            await tenantDb.attendance.updateMany({
               where: { lessonId, studentMembershipId: en.studentMembershipId },
               data: {
                 groupId,
                 status,
                 markedByMembershipId: markerId,
                 markedAt: new Date(),
               }
            });
          } else {
            throw e;
          }
        }
      }
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BULK_ATTENDANCE_MARKED",
      resource: "Lesson",
      resourceId: lessonId,
      details: { groupId, count: enrollments.length },
    });

    return NextResponse.json({ success: true, count: enrollments.length });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error("Bulk attendance error:", err);
    return NextResponse.json({ error: error?.message || "Server error" }, { status: (err as { status?: number })?.status || 500 });
  }
}
