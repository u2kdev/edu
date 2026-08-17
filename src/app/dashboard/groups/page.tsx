import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import GroupsManager from "@/components/GroupsManager";

export default async function GroupsPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole;

  if (!activeCenterId) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <p className="text-slate-400">Выберите учебный центр для управления группами.</p>
      </div>
    );
  }

  const groups = await db.group.findMany({
    where: { course: { centerId: activeCenterId } },
    include: {
      course: { select: { title: true } },
      teacher: { include: { user: { select: { fullName: true } } } },
      enrollments: {
        include: {
          student: { include: { user: { select: { fullName: true, email: true, phone: true } } } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const courses = await db.course.findMany({
    where: { centerId: activeCenterId },
    select: { id: true, title: true },
  });

  const teachers = await db.centerMembership.findMany({
    where: { centerId: activeCenterId, role: "TEACHER" },
    include: { user: { select: { fullName: true } } },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Группы и Ученики</h1>
        <p className="text-sm text-slate-400 mt-1">
          Распределение потоков, назначение преподавателей и списки зачисленных студентов
        </p>
      </div>

      <GroupsManager
        initialGroups={groups}
        courses={courses}
        teachers={teachers}
        role={activeRole}
      />
    </div>
  );
}
