import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

// GET /api/tenant/my-salary - Self-service teacher and assistant salary report (read-only, own data only)
export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();

    if (!tenantCtx.membership?.id) {
      return NextResponse.json({ error: "No membership found" }, { status: 403 });
    }

    const myMembershipId = tenantCtx.membership.id;
    const { searchParams } = new URL(req.url);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : startOfMonth;
    const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : endOfMonth;

    // Load active rate for this teacher
    const salaryRate = await tenantDb.teacherSalaryRate.findFirst({
      where: {
        centerId: tenantCtx.center.id,
        teacherMembershipId: myMembershipId,
        isActive: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Find all lessons in center for the period where this teacher might have taught
    const lessonsInPeriod = await tenantDb.lesson.findMany({
      where: {
        centerId: tenantCtx.center.id,
        status: "ACTIVE",
        scheduledAt: { gte: fromDate, lte: toDate },
      },
      include: {
        attendances: { select: { id: true, status: true } },
        scheduleSlot: {
          select: {
            teacherMembershipId: true,
            groupId: true,
            group: { select: { id: true, name: true } },
          },
        },
        module: {
          select: {
            title: true,
            course: {
              select: {
                id: true,
                title: true,
                groups: {
                  select: { id: true, name: true, teacherMembershipId: true, assistantMembershipId: true },
                },
              },
            },
          },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });

    const conductedLessons = [];

    for (const l of lessonsInPeriod) {
      const hasAttendance = l.attendances.length > 0;
      const isPast = l.scheduledAt ? l.scheduledAt <= now : false;
      if (!hasAttendance && !isPast) continue;

      let isConductedByMe = false;
      let isSubstitute = false;

      // 1. Was I the substitute teacher?
      if (l.substituteTeacherMembershipId) {
        if (l.substituteTeacherMembershipId === myMembershipId) {
          isConductedByMe = true;
          isSubstitute = true;
        }
      } else {
        // 2. Regular assignment
        if (l.scheduleSlot?.teacherMembershipId === myMembershipId) {
          isConductedByMe = true;
        } else {
          const matchingGroup = l.module?.course?.groups?.find(
            (g) =>
              g.teacherMembershipId === myMembershipId ||
              g.assistantMembershipId === myMembershipId
          );
          if (matchingGroup) {
            isConductedByMe = true;
          }
        }
      }

      if (isConductedByMe) {
        const hours = (l.durationMinutes || 60) / 60;
        const group =
          l.scheduleSlot?.group ||
          l.module?.course?.groups?.[0] || { id: "unknown", name: "Группа" };

        conductedLessons.push({
          id: l.id,
          title: l.title,
          scheduledAt: l.scheduledAt,
          durationMinutes: l.durationMinutes || 60,
          academicHours: hours,
          isSubstitute,
          courseTitle: l.module?.course?.title || "Курс",
          groupName: group.name,
          attendanceCount: l.attendances.length,
          hasAttendance,
        });
      }
    }

    const totalAcademicHours = conductedLessons.reduce((acc, l) => acc + l.academicHours, 0);
    const substituteLessonsCount = conductedLessons.filter((l) => l.isSubstitute).length;

    let calculatedSalary: number | null = null;
    if (salaryRate) {
      if (salaryRate.rateType === "HOURLY") {
        calculatedSalary = Math.round(totalAcademicHours * salaryRate.amount);
      } else if (salaryRate.rateType === "FIXED") {
        calculatedSalary = salaryRate.amount;
      }
    }

    // Payout transactions in this period (FinanceTransaction with type EXPENSE for this member)
    const payoutTransactions = await tenantDb.financeTransaction.findMany({
      where: {
        centerId: tenantCtx.center.id,
        category: { type: "EXPENSE" },
        createdAt: { gte: fromDate, lte: toDate },
        description: { contains: tenantCtx.session.user.fullName },
      },
      select: {
        id: true,
        amount: true,
        createdAt: true,
        description: true,
      },
    });

    const totalPaidAmount = payoutTransactions.reduce((acc, tx) => acc + tx.amount, 0);

    return NextResponse.json({
      teacher: {
        id: tenantCtx.membership.id,
        fullName: tenantCtx.session.user.fullName,
        email: tenantCtx.session.user.email,
        role: tenantCtx.role,
      },
      period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
      },
      conductedLessonsCount: conductedLessons.length,
      substituteLessonsCount,
      totalAcademicHours: Math.round(totalAcademicHours * 10) / 10,
      salaryRate: salaryRate
        ? {
            rateType: salaryRate.rateType,
            amount: salaryRate.amount,
            currency: salaryRate.currency,
          }
        : null,
      calculatedSalary,
      totalPaidAmount,
      payouts: payoutTransactions,
      lessons: conductedLessons,
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.status ? error.message : "Server error" },
      { status: error.status || 500 }
    );
  }
}
