import { NextResponse } from "next/server";
import { getTenantDb } from "@/lib/db-tenant";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/students/[id]/performance - Get aggregated performance report for student
export async function GET(
  req: Request,
  { params }: { params: { id: string } } // id = studentMembershipId
) {
  try {
    const tenantCtx = await requireTenantAccess();
    const tenantDb = getTenantDb(tenantCtx.center.id);
    const studentMembershipId = params.id;
    const currentRole = tenantCtx.role;

    // Check target student membership exists in this center
    const targetStudent = await tenantDb.centerMembership.findFirst({
      where: { id: studentMembershipId, role: "STUDENT" },
    });

    if (!targetStudent) {
      return NextResponse.json({ error: "Student not found in this learning center" }, { status: 404 });
    }

    // Security Check (IDOR Prevention):
    // 1. STUDENT role can ONLY view their OWN performance
    if (currentRole === "STUDENT") {
      if (tenantCtx.membership?.id !== studentMembershipId) {
        return NextResponse.json({ error: "Forbidden: You can only view your own performance data" }, { status: 403 });
      }
    }

    // 2. PARENT role can ONLY view their CONFIRMED linked child
    if (currentRole === "PARENT") {
      const parentLink = await tenantDb.parentLink.findFirst({
        where: {
          parentMembershipId: tenantCtx.membership?.id,
          studentMembershipId: studentMembershipId,
          status: "CONFIRMED",
        },
      });

      if (!parentLink && !tenantCtx.isPlatformStaff) {
        return NextResponse.json({ error: "Forbidden: You can only view performance data for your linked children" }, { status: 403 });
      }
    }

    // 3. TEACHER role can ONLY view students in groups assigned to this teacher
    if (currentRole === "TEACHER") {
      const teacherEnrolled = await tenantDb.enrollment.findFirst({
        where: {
          studentMembershipId: studentMembershipId,
          group: { teacherMembershipId: tenantCtx.membership?.id },
        },
      });

      if (!teacherEnrolled && !tenantCtx.isPlatformStaff) {
        return NextResponse.json({ error: "Forbidden: You can only view students in your assigned groups" }, { status: 403 });
      }
    }

    // Load student attendances
    const attendances = await tenantDb.attendance.findMany({
      where: { studentMembershipId },
    });

    const totalAttendanceCount = attendances.length;
    const presentCount = attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const attendancePercent =
      totalAttendanceCount > 0 ? Math.round((presentCount / totalAttendanceCount) * 100) : 100;

    // Load student homework submissions
    const submissions = await tenantDb.homeworkSubmission.findMany({
      where: { studentMembershipId },
    });

    const gradedSubmissions = submissions.filter((s) => s.grade !== null);
    const sumGrades = gradedSubmissions.reduce((acc, curr) => acc + (curr.grade || 0), 0);
    const averageGrade =
      gradedSubmissions.length > 0
        ? Math.round((sumGrades / gradedSubmissions.length) * 10) / 10
        : null;

    // Load test attempts
    const testAttempts = await tenantDb.testAttempt.findMany({
      where: { studentMembershipId },
    });

    // Activity log counts
    const activityLogs = await tenantDb.activityLog.findMany({
      where: { userMembershipId: studentMembershipId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Calculate trend
    let trend = "STABLE";
    if (gradedSubmissions.length >= 4) {
      const recent = gradedSubmissions.slice(-2);
      const previous = gradedSubmissions.slice(-4, -2);
      const recentAvg = recent.reduce((a, b) => a + (b.grade || 0), 0) / recent.length;
      const prevAvg = previous.reduce((a, b) => a + (b.grade || 0), 0) / previous.length;

      if (recentAvg > prevAvg + 0.5) trend = "UP";
      else if (recentAvg < prevAvg - 0.5) trend = "DOWN";
    }

    return NextResponse.json({
      performance: {
        studentMembershipId,
        averageGrade,
        attendancePercent,
        totalAttendanceCount,
        presentCount,
        submissionsCount: submissions.length,
        gradedSubmissionsCount: gradedSubmissions.length,
        testAttemptsCount: testAttempts.length,
        trend,
        recentActivity: activityLogs,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
