import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";

// POST /api/attendance/bulk - Mark attendance for all students in a group for a lesson in one batch
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && tenantCtx.role !== "TEACHER" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, groupId, defaultStatus, studentStatusMap } = await req.json();
    // studentStatusMap: { [studentMembershipId: string]: 'PRESENT' | 'ABSENT' | 'EXCUSED' | 'LATE' }

    if (!lessonId || !groupId) {
      return NextResponse.json({ error: "lessonId and groupId are required" }, { status: 400 });
    }

    const enrollments = await tenantDb.enrollment.findMany({
      where: { groupId, status: "ACTIVE" },
      select: { studentMembershipId: true },
    });

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
        await tenantDb.attendance.create({
           data: {
             lessonId,
             studentMembershipId: en.studentMembershipId,
             groupId,
             status,
             markedByMembershipId: markerId,
           }
        });
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
  } catch (err: any) {
    console.error("Bulk attendance error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
