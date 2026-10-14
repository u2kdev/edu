import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import ScheduleManager, { ScheduleSlotItem, UpcomingLessonItem } from "@/components/ScheduleManager";

export default async function CenterSchedulePage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // Build role-scoped schedule query
  const whereCondition: Prisma.ScheduleSlotWhereInput = {
    centerId,
    status: { in: ["ACTIVE", "CANCELLED"] },
  };

  if (activeRole === "TEACHER" && currentMembership) {
    whereCondition.teacherMembershipId = currentMembership.id;
  } else if (activeRole === "TEACHER_ASSISTANT" && currentMembership) {
    const assistedGroups = await tenantCtx.getTenantDb().group.findMany({
      where: { assistantMembershipId: currentMembership.id, course: { centerId } },
      select: { id: true },
    });
    whereCondition.groupId = { in: assistedGroups.map((g) => g.id) };
  } else if (activeRole === "STUDENT" && currentMembership) {
    const enrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: { studentMembershipId: currentMembership.id, status: "ACTIVE" },
      select: { groupId: true },
    });
    whereCondition.groupId = { in: enrollments.map((e) => e.groupId) };
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await tenantCtx.getTenantDb().parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    const childEnrollments = await tenantCtx.getTenantDb().enrollment.findMany({
      where: {
        studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) },
        status: "ACTIVE",
      },
      select: { groupId: true },
    });
    whereCondition.groupId = { in: childEnrollments.map((e) => e.groupId) };
  }

  const rawSlots = await tenantCtx.getTenantDb().scheduleSlot.findMany({
    where: whereCondition,
    include: {
      group: {
        include: {
          course: { select: { title: true } },
          subject: { select: { name: true, color: true } },
        },
      },
      teacher: { include: { user: { select: { fullName: true, email: true } } } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  const slots: ScheduleSlotItem[] = rawSlots.map((s) => ({
    id: s.id,
    groupId: s.groupId,
    teacherMembershipId: s.teacherMembershipId,
    branchId: s.branchId,
    subjectId: s.subjectId,
    roomName: s.roomName,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    status: s.status,
    cancelledReason: s.cancelledReason,
    group: {
      id: s.group.id,
      name: s.group.name,
      course: { title: s.group.course.title },
      subject: s.group.subject ? { name: s.group.subject.name, color: s.group.subject.color } : null,
    },
    teacher: {
      id: s.teacher.id,
      user: { fullName: s.teacher.user.fullName, email: s.teacher.user.email },
    },
    branch: s.branch ? { id: s.branch.id, name: s.branch.name } : null,
  }));

  // Fetch upcoming one-time scheduled lessons for the next 7 days
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const rawLessons = await tenantCtx.getTenantDb().lesson.findMany({
    where: {
      module: { course: { centerId } },
      status: { in: ["ACTIVE", "CANCELLED"] },
      scheduledAt: { gte: new Date(), lte: nextWeek },
    },
    include: {
      module: { include: { course: { select: { title: true } } } },
      substituteTeacher: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  const upcomingLessons: UpcomingLessonItem[] = rawLessons.map((l) => ({
    id: l.id,
    title: l.title,
    lessonType: l.lessonType,
    status: l.status,
    scheduledAt: l.scheduledAt ? l.scheduledAt.toISOString() : null,
    durationMinutes: l.durationMinutes,
    onlineMeetingUrl: l.onlineMeetingUrl,
    location: l.location,
    cancelledReason: l.cancelledReason,
    module: { course: { title: l.module.course.title } },
    substituteTeacher: l.substituteTeacher
      ? { id: l.substituteTeacher.id, user: { fullName: l.substituteTeacher.user.fullName } }
      : null,
  }));

  // Fetch groups and teachers for modal selects
  const groups = await tenantCtx.getTenantDb().group.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const teachers = await tenantCtx.getTenantDb().centerMembership.findMany({
    where: { role: "TEACHER", status: "ACTIVE" },
    select: {
      id: true,
      user: { select: { fullName: true } },
    },
    orderBy: { user: { fullName: "asc" } },
  });

  return (
    <ScheduleManager
      initialSlots={slots}
      upcomingLessons={upcomingLessons}
      groups={groups}
      teachers={teachers}
      userRole={activeRole}
      locale={locale}
    />
  );
}
