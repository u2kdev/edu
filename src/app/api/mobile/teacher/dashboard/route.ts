import { NextResponse } from "next/server";
import { requireTenantAccess } from "@/lib/tenant";

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    const tenantDb = tenantCtx.getTenantDb();
    const currentRole = tenantCtx.role;

    if (
      currentRole !== "TEACHER" &&
      currentRole !== "TEACHER_ASSISTANT" &&
      !tenantCtx.isPlatformStaff
    ) {
      return NextResponse.json(
        { error: "Forbidden: Teacher access required" },
        { status: 403 }
      );
    }

    const teacherMembershipId = tenantCtx.membership?.id;
    if (!teacherMembershipId && !tenantCtx.isPlatformStaff) {
      return NextResponse.json(
        { error: "Bad Request: No teacher membership found" },
        { status: 400 }
      );
    }

    // 1. Fetch teacher's assigned groups with students and course lessons
    const groups = await tenantDb.group.findMany({
      where: {
        OR: [
          { teacherMembershipId: teacherMembershipId! },
          { assistantMembershipId: teacherMembershipId! },
        ],
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            modules: {
              orderBy: { orderIndex: "asc" },
              include: {
                lessons: {
                  where: { status: "ACTIVE" },
                  include: {
                    scheduleSlot: { select: { groupId: true } },
                  },
                  orderBy: { orderIndex: "desc" },
                },
              },
            },
          },
        },
        enrollments: {
          where: { status: "ACTIVE" },
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, avatarUrl: true } },
              },
            },
          },
        },
      },
      orderBy: { name: "asc" },
    });

    const groupIds = groups.map((g) => g.id);

    // 2. Fetch teacher's schedule slots
    const scheduleSlots = await tenantDb.scheduleSlot.findMany({
      where: {
        teacherMembershipId: teacherMembershipId!,
        status: "ACTIVE",
      },
      include: {
        group: { select: { name: true } },
        branch: { select: { name: true } },
      },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // 3. Fetch pending homework submissions to review
    const pendingReviews = groupIds.length > 0
      ? await tenantDb.homeworkSubmission.findMany({
          where: {
            status: "SUBMITTED",
            OR: [
              { groupId: { in: groupIds } },
              {
                student: {
                  enrollments: {
                    some: { groupId: { in: groupIds }, status: "ACTIVE" },
                  },
                },
              },
            ],
          },
          include: {
            homework: { select: { id: true, title: true } },
            student: {
              include: {
                user: { select: { fullName: true } },
              },
            },
          },
          orderBy: { submittedAt: "asc" },
          take: 15,
        })
      : [];

    return NextResponse.json({
      success: true,
      teacher: {
        membershipId: teacherMembershipId,
        fullName: tenantCtx.session.user.fullName,
        email: tenantCtx.session.user.email,
        centerName: tenantCtx.center.name,
      },
      groups: groups.map((g) => {
        // Find lessons belonging to this group's course and matching this group's scheduleSlot (or unlinked)
        const groupLessons: Array<{ id: string; title: string }> = [];
        for (const mod of g.course?.modules || []) {
          for (const les of mod.lessons) {
            if (!les.scheduleSlot?.groupId || les.scheduleSlot.groupId === g.id) {
              groupLessons.push({ id: les.id, title: les.title });
            }
          }
        }
        const latestLesson = groupLessons[0] || null;

        return {
          id: g.id,
          name: g.name,
          courseTitle: g.course?.title || null,
          latestLessonId: latestLesson?.id || null,
          latestLessonTitle: latestLesson?.title || null,
          lessons: groupLessons,
          activeStudentsCount: g.enrollments.length,
          students: g.enrollments.map((e) => ({
            membershipId: e.student.id,
            fullName: e.student.user.fullName,
            avatarUrl: e.student.user.avatarUrl,
          })),
        };
      }),
      schedule: scheduleSlots.map((slot) => ({
        id: slot.id,
        groupId: slot.groupId,
        groupName: slot.group.name,
        dayOfWeek: slot.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomName: slot.roomName || "Аудитория не указана",
        branchName: slot.branch?.name || null,
      })),
      pendingReviews: pendingReviews.map((sub) => ({
        id: sub.id,
        homeworkId: sub.homeworkId,
        homeworkTitle: sub.homework.title,
        studentMembershipId: sub.studentMembershipId,
        studentName: sub.student.user.fullName,
        submissionText: sub.submissionText || null,
        submittedAt: sub.submittedAt,
        status: sub.status,
      })),
    });
  } catch (err: unknown) {
    const error = err as { message?: string; status?: number };
    return NextResponse.json(
      { error: error.message || "Failed to load teacher dashboard" },
      { status: error.status || 500 }
    );
  }
}
