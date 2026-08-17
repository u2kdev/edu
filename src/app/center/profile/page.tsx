import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { User, Mail, Phone, Calendar, ShieldCheck, CreditCard } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";

export default async function CenterProfilePage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";

  // Get user details
  const user = await db.platformUser.findUnique({
    where: { id: session.user.id },
  });

  if (!user) redirect("/login");

  // Get center membership
  const membership = await db.centerMembership.findFirst({
    where: { userId: user.id, centerId },
    include: {
      center: true,
      enrollments: {
        include: { group: { select: { name: true } } },
      },
      parentLinksAsParent: {
        include: { student: { include: { user: { select: { fullName: true } } } } },
      },
    },
  });

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-white">Мой профиль</h2>
        <p className="text-sm text-slate-400 mt-1">Личная информация и настройки</p>
      </div>

      <div className="glass-panel p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-24 h-24 rounded-full bg-brand-500/20 border-4 border-brand-500/40 flex items-center justify-center text-brand-400 shrink-0">
          <User className="w-12 h-12" />
        </div>
        
        <div className="flex-1 space-y-4">
          <div>
            <h3 className="text-2xl font-bold text-white">{user.fullName}</h3>
            <p className="text-brand-400 font-medium">Роль: {activeRole}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3 text-slate-300">
              <Mail className="w-5 h-5 text-slate-500" />
              <span>{user.email}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Phone className="w-5 h-5 text-slate-500" />
              <span>{user.phone || "Не указан"}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <Calendar className="w-5 h-5 text-slate-500" />
              <span>Зарегистрирован: {formatDateLocalized(user.createdAt, locale)}</span>
            </div>
            <div className="flex items-center gap-3 text-slate-300">
              <ShieldCheck className="w-5 h-5 text-emerald-500" />
              <span className="text-emerald-400">Двухфакторная защита (В разработке)</span>
            </div>
          </div>
        </div>
      </div>

      {activeRole === "STUDENT" && membership && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Мои группы</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {membership.enrollments.length === 0 ? (
              <p className="text-slate-400">Вы пока не состоите ни в одной группе.</p>
            ) : (
              membership.enrollments.map((en: any) => (
                <div key={en.id} className="glass-panel p-5 rounded-2xl border border-slate-800">
                  <div className="font-bold text-white">{en.group.name}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Статус: <span className="text-emerald-400">{en.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeRole === "PARENT" && membership && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-white">Мои дети</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {membership.parentLinksAsParent.length === 0 ? (
              <p className="text-slate-400">У вас нет привязанных учеников.</p>
            ) : (
              membership.parentLinksAsParent.map((link: any) => (
                <div key={link.id} className="glass-panel p-5 rounded-2xl border border-slate-800">
                  <div className="font-bold text-white">{link.student.user.fullName}</div>
                  <div className="text-sm text-slate-400 mt-1">
                    Статус привязки: <span className="text-emerald-400">{link.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

    </div>
  );
}
