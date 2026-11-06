import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const currentRole = tenantCtx.role;

    if (currentRole !== "PARENT" && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Forbidden: Parent access required" },
        { status: 403 }
      );
    }

    const parentMembershipId = tenantCtx.membership?.id;
    if (!parentMembershipId && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Bad Request: No parent membership found" },
        { status: 400 }
      );
    }

    // 1. Fetch all confirmed linked children for this parent
    const parentLinks = await tenantDb.parentLink.findMany({
      where: {
        parentMembershipId: parentMembershipId!,
        status: "CONFIRMED",
      },
      include: {
        student: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                avatarUrl: true,
              },
            },
            enrollments: {
              where: { status: "ACTIVE" },
              include: {
                group: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const childrenList = parentLinks.map((link) => ({
      membershipId: link.student.id,
      fullName: link.student.user.fullName,
      email: link.student.user.email,
      avatarUrl: link.student.user.avatarUrl,
      groups: link.student.enrollments.map((e) => ({
        id: e.group.id,
        name: e.group.name,
      })),
    }));

    if (childrenList.length === 0) {
      return NextResponse.json({
        success: true,
        children: [],
        activeChild: null,
      });
    }

    // 2. Resolve target childId (with IDOR protection)
    const { searchParams } = new URL(req.url);
    const requestedChildId = searchParams.get("childId");

    let activeChildItem = childrenList[0];
    if (requestedChildId) {
      const found = childrenList.find((c) => c.membershipId === requestedChildId);
      if (!found && !tenantCtx.isPlatformStaff) {
        return NextResponse.json(
          { error: "Forbidden: You are not authorized to view this student's data" },
          { status: 403 }
        );
      }
      if (found) {
        activeChildItem = found;
      }
    }

    const targetStudentId = activeChildItem.membershipId;
    const targetGroupIds = activeChildItem.groups.map((g) => g.id);

    // 3. Child's attendance metrics
    const attendances = await tenantDb.attendance.findMany({
      where: { studentMembershipId: targetStudentId },
      orderBy: { markedAt: "desc" },
      take: 30,
    });

    const totalClasses = attendances.length;
    const presentCount = attendances.filter(
      (a) => a.status === "PRESENT" || a.status === "LATE"
    ).length;
    const attendancePercent =
      totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 100;

    // Check today's status
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayAttendanceRecord = attendances.find((a) => {
      const recDate = a.markedAt instanceof Date ? a.markedAt.toISOString().slice(0, 10) : String(a.markedAt).slice(0, 10);
      return recDate === todayStr;
    });

    // 4. Child's recent grades
    const grades = await tenantDb.grade.findMany({
      where: { studentMembershipId: targetStudentId },
      include: {
        lesson: {
          select: {
            title: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    const sumScores = grades.reduce((acc, g) => acc + g.value, 0);
    const averageScore = grades.length > 0 ? Math.round((sumScores / grades.length) * 10) / 10 : null;

    // 5. Child's upcoming schedule
    const scheduleSlots = targetGroupIds.length > 0
      ? await tenantDb.scheduleSlot.findMany({
          where: {
            groupId: { in: targetGroupIds },
            status: "ACTIVE",
          },
          include: {
            group: { select: { name: true } },
            teacher: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
          take: 4,
        })
      : [];

    return NextResponse.json({
      success: true,
      children: childrenList,
      activeChild: {
        ...activeChildItem,
        todayStatus: todayAttendanceRecord ? todayAttendanceRecord.status : "NO_LESSON_TODAY",
        metrics: {
          attendancePercent,
          totalClasses,
          presentCount,
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
        upcomingSchedule: scheduleSlots.map((slot) => ({
          id: slot.id,
          groupName: slot.group.name,
          teacherName: slot.teacher.user.fullName,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
        })),
      },
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load parent dashboard" },
      { status: error.status || 500 }
    );
  }
}
