import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const currentRole = tenantCtx.role;

    if (currentRole !== "STUDENT" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Student access required" },
        { status: 403 }
      );
    }

    const studentMembershipId = tenantCtx.membership?.id;
    if (!studentMembershipId && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Bad Request: No student membership found" },
        { status: 400 }
      );
    }

    // 1. Fetch active enrollments and groups
    const enrollments = await tenantDb.enrollment.findMany({
      where: {
        studentMembershipId: studentMembershipId!,
        status: "ACTIVE",
      },
      include: {
        group: {
          select: {
            id: true,
            name: true,
            course: { select: { id: true, title: true } },
            subject: { select: { id: true, name: true } },
          },
        },
      },
    });

    const groupIds = enrollments.map((e) => e.groupId);

    // 2. Fetch upcoming schedule slots for student's groups
    const scheduleSlots = groupIds.length > 0
      ? await tenantDb.scheduleSlot.findMany({
          where: {
            groupId: { in: groupIds },
            status: "ACTIVE",
          },
          include: {
            group: { select: { name: true } },
            teacher: {
              include: {
                user: { select: { fullName: true } },
              },
            },
            branch: { select: { name: true, address: true } },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          take: 6,
        })
      : [];

    const upcomingSchedule = scheduleSlots.map((slot) => ({
      id: slot.id,
      groupId: slot.groupId,
      groupName: slot.group.name,
      teacherName: slot.teacher.user.fullName,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: slot.roomName || "Аудитория не указана",
      branchName: slot.branch?.name || null,
      status: slot.status,
    }));

    // 3. Fetch active homework tasks
    const homeworkList = groupIds.length > 0
      ? await tenantDb.homework.findMany({
          where: {
            lesson: {
              module: {
                course: {
                  groups: {
                    some: { id: { in: groupIds } },
                  },
                },
              },
            },
          },
          include: {
            lesson: {
              select: {
                title: true,
              },
            },
            submissions: {
              where: { studentMembershipId: studentMembershipId! },
              select: {
                id: true,
                status: true,
                grade: true,
                submittedAt: true,
                feedback: true,
              },
            },
          },
          orderBy: { dueDate: "asc" },
          take: 5,
        })
      : [];

    const formattedHomework = homeworkList.map((hw) => {
      const submission = hw.submissions[0] || null;
      return {
        id: hw.id,
        title: hw.title,
        lessonTitle: hw.lesson.title,
        dueDate: hw.dueDate,
        status: submission ? submission.status : "NOT_SUBMITTED",
        grade: submission?.grade ?? null,
        feedback: submission?.feedback ?? null,
      };
    });

    // 4. Attendance summary (last 30 records)
    const attendances = await tenantDb.attendance.findMany({
      where: { studentMembershipId: studentMembershipId! },
      orderBy: { markedAt: "desc" },
      take: 30,
    });

    const totalClasses = attendances.length;
    const presentCount = attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const attendancePercent =
      totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

    // 5. Recent Grades & GPA
    const grades = await tenantDb.grade.findMany({
      where: { studentMembershipId: studentMembershipId! },
      include: {
        lesson: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const sumScores = grades.reduce((acc, g) => acc + g.value, 0);
    const averageScore = grades.length > 0 ? Math.round((sumScores / grades.length) * 10) / 10 : null;

    return NextResponse.json({
      success: true,
      student: {
        membershipId: studentMembershipId,
        fullName: tenantCtx.session.user.fullName,
        email: tenantCtx.session.user.email,
        centerName: tenantCtx.center.name,
      },
      groups: enrollments.map((e) => ({
        id: e.group.id,
        name: e.group.name,
        courseTitle: e.group.course?.title || null,
      })),
      upcomingSchedule,
      activeHomework: formattedHomework,
      metrics: {
        attendancePercent,
        totalClasses,
        presentCount,
        missedCount: totalClasses - presentCount,
        averageScore,
      },
      recentGrades: grades.map((g) => ({
        id: g.id,
        score: g.value,
        maxScore: g.maxValue,
        lessonTitle: g.lesson?.title || null,
        comment: g.comment,
        createdAt: g.createdAt,
      })),
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load student dashboard" },
      { status: error.status || 500 }
    );
  }
}
