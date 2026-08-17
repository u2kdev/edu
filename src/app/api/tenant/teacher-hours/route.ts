import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/tenant/teacher-hours - Teacher academic hours and salary report for Director/Admin
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess();
    if (tenantCtx.role !== "DIRECTOR" && tenantCtx.role !== "CENTER_ADMIN" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const centerId = tenantCtx.center.id;

    // Load all teachers in center
    const teachers = await db.centerMembership.findMany({
      where: { centerId, role: "TEACHER" },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        taughtGroups: {
          include: {
            course: { select: { title: true } },
            enrollments: true,
          },
        },
        substituteLessons: {
          include: { module: { include: { course: true } } },
        },
      },
    });

    const report = teachers.map((t) => {
      const groupsCount = t.taughtGroups.length;
      const totalStudentsTaught = t.taughtGroups.reduce((acc, g) => acc + g.enrollments.length, 0);
      const substituteCount = t.substituteLessons.length;
      const estimatedAcademicHours = groupsCount * 12 + substituteCount * 1.5; // ~12 hours per group/month + substitutions

      return {
        teacherId: t.id,
        fullName: t.user.fullName,
        email: t.user.email,
        phone: t.user.phone,
        groupsCount,
        totalStudentsTaught,
        substituteCount,
        estimatedAcademicHours,
      };
    });

    return NextResponse.json({ teacherReport: report });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
