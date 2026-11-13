import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/tenant/teacher-hours - Teacher academic hours and salary report for Director/Admin based on real conducted lessons
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (
      tenantCtx.role !== "DIRECTOR" &&
      tenantCtx.role !== "CENTER_ADMIN" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : startOfMonth;
    const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : endOfMonth;

    // Load all teachers and assistants in center
    const teachers = await tenantDb.centerMembership.findMany({
      where: {
        centerId: tenantCtx.center.id,
        role: { in: ["TEACHER", "TEACHER_ASSISTANT"] },
        status: "ACTIVE",
      },
      include: {
        user: { select: { fullName: true, email: true, phone: true } },
        teacherSalaryRates: {
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    // Load all completed/conducted lessons in date range
    const lessonsInPeriod = await tenantDb.lesson.findMany({
      where: {
        centerId: tenantCtx.center.id,
        status: "ACTIVE",
        scheduledAt: { gte: fromDate, lte: toDate },
      },
      include: {
        attendances: { select: { id: true } },
        scheduleSlot: { select: { teacherMembershipId: true, groupId: true } },
        module: {
          select: {
            course: {
              select: {
                groups: { select: { id: true, teacherMembershipId: true, assistantMembershipId: true } },
              },
            },
          },
        },
      },
    });

    const report = teachers.map((t) => {
      // Filter lessons conducted by this teacher (considering substitutions)
      const conductedLessons = lessonsInPeriod.filter((l) => {
        // Lesson must have attendance marked OR be in the past
        const hasAttendance = l.attendances.length > 0;
        const isPast = l.scheduledAt ? l.scheduledAt <= now : false;
        if (!hasAttendance && !isPast) return false;

        // Check if substituted:
        if (l.substituteTeacherMembershipId) {
          // If this teacher was the substitute, it counts!
          return l.substituteTeacherMembershipId === t.id;
        }

        // Otherwise, check regular assignment
        if (l.scheduleSlot?.teacherMembershipId === t.id) return true;

        const isGroupTeacher = l.module?.course?.groups?.some(
          (g) => g.teacherMembershipId === t.id || g.assistantMembershipId === t.id
        );
        return Boolean(isGroupTeacher);
      });

      const conductedLessonsCount = conductedLessons.length;
      const totalAcademicHours = conductedLessons.reduce((acc, l) => {
        const hours = (l.durationMinutes || 60) / 60;
        return acc + hours;
      }, 0);

      const substituteLessonsCount = conductedLessons.filter(
        (l) => l.substituteTeacherMembershipId === t.id
      ).length;

      const rate = t.teacherSalaryRates[0] || null;
      let calculatedSalary: number | null = null;

      if (rate) {
        if (rate.rateType === "HOURLY") {
          calculatedSalary = Math.round(totalAcademicHours * rate.amount);
        } else if (rate.rateType === "FIXED") {
          calculatedSalary = rate.amount;
        }
      }

      return {
        teacherId: t.id,
        fullName: t.user.fullName,
        email: t.user.email,
        phone: t.user.phone,
        role: t.role,
        conductedLessonsCount,
        substituteLessonsCount,
        totalAcademicHours: Math.round(totalAcademicHours * 10) / 10,
        rateType: rate?.rateType || null,
        rateAmount: rate?.amount || null,
        calculatedSalary,
      };
    });

    return NextResponse.json({
      period: { from: fromDate.toISOString(), to: toDate.toISOString() },
      teacherReport: report,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Server error" },
      { status: error.status || 500 }
    );
  }
}
