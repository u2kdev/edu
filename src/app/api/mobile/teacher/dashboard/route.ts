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

    // 1. Fetch teacher's assigned groups with students
    const groups = await tenantDb.group.findMany({
      where: {
        OR: [
          { teacherMembershipId: teacherMembershipId! },
          { assistantMembershipId: teacherMembershipId! },
        ],
      },
      include: {
        course: { select: { id: true, title: true } },
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
            groupId: { in: groupIds },
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
          take: 10,
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
      groups: groups.map((g) => ({
        id: g.id,
        name: g.name,
        courseTitle: g.course?.title || null,
        activeStudentsCount: g.enrollments.length,
        students: g.enrollments.map((e) => ({
          membershipId: e.student.id,
          fullName: e.student.user.fullName,
          avatarUrl: e.student.user.avatarUrl,
        })),
      })),
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
        homeworkTitle: sub.homework.title,
        studentName: sub.student.user.fullName,
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
