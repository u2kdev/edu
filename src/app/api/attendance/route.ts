import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess, logAuditEvent } from "@/lib/tenant";
import { sendNotification } from "@/lib/notifications";

// GET /api/attendance?lessonId=xxx - Get attendance for a lesson
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const { searchParams } = new URL(req.url);
    const lessonId = searchParams.get("lessonId");

    if (!lessonId) {
      return NextResponse.json({ error: "lessonId parameter is required" }, { status: 400 });
    }

    // SECURITY: Verify the lesson belongs to this tenant before returning data (IDOR fix)
    const lesson = await tenantDb.lesson.findFirst({
      where: {
        id: lessonId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    const attendances = await tenantDb.attendance.findMany({
      where: { lessonId },
      include: {
        student: {
          include: {
            user: { select: { fullName: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({ attendances });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

// POST /api/attendance - Mark attendance for students (PRESENT, ABSENT, EXCUSED, LATE)
export async function POST(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      tenantCtx.role !== "TEACHER" &&
      tenantCtx.role !== "TEACHER_ASSISTANT" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { lessonId, records } = await req.json();

    if (!lessonId || !Array.isArray(records)) {
      return NextResponse.json({ error: "lessonId and records array required" }, { status: 400 });
    }

    // SECURITY: Verify the lesson belongs to this tenant (IDOR fix)
    const lesson = await tenantDb.lesson.findFirst({
      where: {
        id: lessonId,
      },
    });

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    // SECURITY: Verify all studentMembershipIds belong to this tenant
    if (records.length > 0) {
      const membershipIds = records.map((r: any) => r.studentMembershipId);
      const validMemberships = await tenantDb.centerMembership.findMany({
        where: {
          id: { in: membershipIds },
          role: "STUDENT",
        },
        select: { id: true },
      });
      const validIds = new Set(validMemberships.map((m: any) => m.id));
      const invalidRecord = records.find((r: any) => !validIds.has(r.studentMembershipId));
      if (invalidRecord) {
        return NextResponse.json({ error: "One or more student memberships are invalid or cross-tenant" }, { status: 403 });
      }
    }

    // SECURITY: Use membership.id (not center.ownerId which is a userId, not membershipId)
    if (!tenantCtx.membership?.id) {
      return NextResponse.json({ error: "Could not resolve marker membership" }, { status: 403 });
    }
    const markerId = tenantCtx.membership.id;

    // Use updateMany for UPSERT simulation with getTenantDb because prisma extension doesn't fully intercept compound where upserts well yet.
    for (const r of records) {
      const existing = await tenantDb.attendance.findFirst({
        where: { lessonId, studentMembershipId: r.studentMembershipId }
      });
      if (existing) {
        await tenantDb.attendance.updateMany({
           where: { lessonId, studentMembershipId: r.studentMembershipId },
           data: {
             status: r.status,
             markedByMembershipId: markerId,
             markedAt: new Date(),
           }
        });
      } else {
        await tenantDb.attendance.create({
           data: {
             lessonId,
             studentMembershipId: r.studentMembershipId,
             status: r.status,
             markedByMembershipId: markerId,
           }
        });
      }
    }

    // Auto notification for ABSENT or LATE students to Parents
    for (const r of records) {
      if (r.status === "ABSENT" || r.status === "LATE") {
        const parentLinks = await tenantDb.parentLink.findMany({
          where: { studentMembershipId: r.studentMembershipId, status: "CONFIRMED" },
          include: { parent: { include: { user: true } }, student: { include: { user: true } } },
        });

        for (const link of parentLinks) {
          if (link.parent.userId) {
            await sendNotification({
              userId: link.parent.userId,
              centerId: tenantCtx.center.id,
              type: r.status === "ABSENT" ? "ATTENDANCE_ABSENT" : "ATTENDANCE_LATE",
              titleKey: r.status === "ABSENT" ? "notification.attendanceAbsent.title" : "notification.attendanceLate.title",
              bodyKey: r.status === "ABSENT" ? "notification.attendanceAbsent.body" : "notification.attendanceLate.body",
              bodyParams: { lessonId, studentName: link.student.user.fullName },
              recipientPhone: link.parent.user.phone || undefined,
              channel: link.parent.user.phone ? "SMS" : "IN_APP",
            });
          }
        }
      }
    }

    await logAuditEvent({
      centerId: tenantCtx.center.id,
      actorUserId: tenantCtx.session.user.id,
      action: "ATTENDANCE_MARKED",
      resource: "Lesson",
      resourceId: lessonId,
      details: { count: records.length },
    });

    return NextResponse.json({ success: true, count: records.length });
  } catch (err: any) {
    console.error("Attendance mark error:", err);
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
