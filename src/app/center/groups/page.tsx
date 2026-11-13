import { requireTenantPageAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import GroupsManager from "@/components/GroupsManager";
import { getScopedGroupWhere } from "@/lib/tenant-access";

export default async function CenterGroupsPage() {
  const tenantCtx = await requireTenantPageAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const scopedWhere = await getScopedGroupWhere(tenantCtx);

  const [rawGroups, courses, teachers, assistants] = await Promise.all([
    tenantCtx.getTenantDb().group.findMany({
      where: scopedWhere,
      include: {
        course: { select: { id: true, title: true } },
        teacher: { include: { user: { select: { fullName: true, email: true } } } },
        assistant: { include: { user: { select: { fullName: true, email: true } } } },
        enrollments: {
          include: {
            student: {
              include: {
                user: { select: { id: true, fullName: true, email: true, phone: true } },
                parentLinksAsStudent: {
                  where: { status: "CONFIRMED" },
                  include: {
                    parent: {
                      include: {
                        user: { select: { id: true, fullName: true, phone: true } },
                      },
                    },
                  },
                },
                attendances: {
                  select: { status: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    tenantCtx.getTenantDb().course.findMany({
      where: { centerId },
      select: { id: true, title: true },
    }),
    tenantCtx.getTenantDb().centerMembership.findMany({
      where: { centerId, role: "TEACHER", status: "ACTIVE" },
      include: { user: { select: { fullName: true, email: true } } },
    }),
    tenantCtx.getTenantDb().centerMembership.findMany({
      where: { centerId, role: "TEACHER_ASSISTANT", status: "ACTIVE" },
      include: { user: { select: { fullName: true, email: true } } },
    }),
  ]);

  const groups = rawGroups.map((g) => ({
    id: g.id,
    name: g.name,
    maxStudents: g.maxStudents,
    course: g.course,
    teacher: g.teacher,
    assistant: g.assistant,
    enrollments: g.enrollments.map((en) => {
      const attendances = en.student.attendances || [];
      const totalAtt = attendances.length;
      const presentAtt = attendances.filter(
        (a) => a.status === "PRESENT" || a.status === "LATE"
      ).length;
      const attendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : null;
      const isAtRisk = attendanceRate !== null && attendanceRate < 80;

      const primaryParent = en.student.parentLinksAsStudent?.[0]?.parent?.user;

      return {
        id: en.id,
        student: {
          id: en.student.id,
          user: {
            fullName: en.student.user.fullName,
            email: en.student.user.email,
            phone: en.student.user.phone,
          },
          attendanceRate,
          isAtRisk,
          parentName: primaryParent?.fullName || null,
          parentPhone: primaryParent?.phone || null,
        },
      };
    }),
  }));

  return (
    <GroupsManager
      initialGroups={groups}
      courses={courses}
      teachers={teachers}
      assistants={assistants}
      role={session.activeCenterRole || ""}
      locale={session.user.preferredLanguage || "ru"}
    />
  );
}
