import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// POST /api/attendance/bulk - Mark attendance for all students in a group for a lesson in one batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, groupId, defaultStatus, studentStatusMap } = await req.json();
    // studentStatusMap: { [studentMembershipId: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE' }

    if (!lessonId || !groupId) {
      return NextResponse.json({ error: "lessonId and groupId are required" }, { status: 400 });
    }

    const enrollments = await db.enrollment.findMany({
      where: { groupId, status: "ACTIVE" },
      select: { studentMembershipId: true },
    });

    const markerId = tenantCtx.membership?.id || tenantCtx.center.ownerId;

    const upserts = enrollments.map((en) => {
      const status = studentStatusMap?.[en.studentMembershipId] || defaultStatus || "PRESENT";
      return db.attendance.upsert({
        where: {
          lessonId_studentMembershipId: {
            lessonId,
            studentMembershipId: en.studentMembershipId,
          },
        },
        update: {
          groupId,
          status,
          markedByMembershipId: markerId,
          markedAt: new Date(),
        },
        create: {
          lessonId,
          studentMembershipId: en.studentMembershipId,
          groupId,
          status,
          markedByMembershipId: markerId,
        },
      });
    });

    await db.$transaction(upserts);

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "BULK_ATTENDANCE_MARKED",
      resource: "Lesson",
      resourceId: lessonId,
      details: { groupId, count: enrollments.length },
    });

    return NextResponse.json({ success: true, count: enrollments.length });
  } catch (err: any) {
    console.error("Bulk attendance error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
