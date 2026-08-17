import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import GroupsManager from "@/components/GroupsManager";

export default async function CenterGroupsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const groups = await db.group.findMany({
    where: { course: { centerId } },
    include: {
      course: true,
      teacher: { include: { user: { select: { fullName: true, email: true } } } },
      enrollments: {
        include: {
          student: { include: { user: { select: { fullName: true, email: true } } } },
        },
      },
    },
  });

  const courses = await db.course.findMany({
    where: { centerId },
    select: { id: true, title: true },
  });

  const teachers = await db.centerMembership.findMany({
    where: { centerId, role: "TEACHER" },
    include: { user: { select: { fullName: true, email: true } } },
  });

  return (
    <GroupsManager
      initialGroups={groups}
      courses={courses}
      teachers={teachers}
      role={session.activeCenterRole || ""}
    />
  );
}
