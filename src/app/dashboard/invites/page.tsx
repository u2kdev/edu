import { requireTenantAccess } from "@/lib/tenant";
import { getAuthSession } from "@/lib/auth";
import { getTenantDb } from "@/lib/db-tenant";
import { redirect } from "next/navigation";
import InvitesManager from "@/components/InvitesManager";

export default async function InvitesPage() {
  const tenantCtx = await requireTenantAccess();

  const session = await getAuthSession();
  if (!session) redirect("/login");

  const activeCenterId = session.activeCenterId;
  const activeRole = session.activeCenterRole;

  if (!activeCenterId) {
    return (
      <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
        <p className="text-slate-400">Выберите учебный центр для управления инвайтами.</p>
      </div>
    );
  }

  const inviteCodes = await getTenantDb(tenantCtx.center.id).inviteCode.findMany({
    where: { centerId: activeCenterId },
    include: {
      course: { select: { title: true } },
      group: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const courses = await getTenantDb(tenantCtx.center.id).course.findMany({
    where: { centerId: activeCenterId },
    select: { id: true, title: true },
  });

  const groups = await getTenantDb(tenantCtx.center.id).group.findMany({
    where: { course: { centerId: activeCenterId } },
    select: { id: true, name: true, courseId: true },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Инвайты и Доступ к Центру</h1>
        <p className="text-sm text-slate-400 mt-1">
          Генерация кодов приглашений для учеников, учителей и связывание аккаунтов родителей
        </p>
      </div>

      <InvitesManager
        initialInvites={inviteCodes}
        courses={courses}
        groups={groups}
        role={activeRole}
      />
    </div>
  );
}
