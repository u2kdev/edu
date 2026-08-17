import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Building2, MapPin, Phone, Mail, Users, CheckCircle2, XCircle } from "lucide-react";

export default async function BranchesPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const activeRole = session.activeCenterRole || "";

  // Only directors and admins can access branch management
  if (activeRole !== "DIRECTOR" && activeRole !== "CENTER_ADMIN") {
    redirect("/center");
  }

  const branches = await db.branch.findMany({
    where: { centerId },
    include: {
      _count: { select: { groups: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const activeBranches = branches.filter((b) => b.isActive);
  const inactiveBranches = branches.filter((b) => !b.isActive);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-400" />
            Филиалы
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeBranches.length} активных · {inactiveBranches.length} неактивных
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            Управление через API: <code className="text-brand-400">/api/tenant/branches</code>
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Всего филиалов</div>
          <div className="text-3xl font-extrabold text-white mt-1">{branches.length}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Активные</div>
          <div className="text-3xl font-extrabold text-emerald-400 mt-1">{activeBranches.length}</div>
        </div>
        <div className="glass-panel p-5 rounded-2xl border border-slate-800">
          <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Групп в сумме</div>
          <div className="text-3xl font-extrabold text-brand-400 mt-1">
            {branches.reduce((sum, b) => sum + b._count.groups, 0)}
          </div>
        </div>
      </div>

      {/* Branches List */}
      {branches.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <Building2 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Нет филиалов</h3>
          <p className="text-sm text-slate-500">
            Добавьте первый филиал через API <code className="text-brand-400">POST /api/tenant/branches</code>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {branches.map((branch) => (
            <div
              key={branch.id}
              className={`glass-panel p-6 rounded-2xl border space-y-4 transition-all ${
                branch.isActive
                  ? "border-slate-800 hover:border-brand-500/30"
                  : "border-slate-800/50 opacity-60"
              }`}
            >
              {/* Branch Header */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">{branch.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      {branch.isActive ? (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          Активный
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                          <XCircle className="w-3 h-3" />
                          Неактивный
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-extrabold text-brand-400">{branch._count.groups}</div>
                  <div className="text-[10px] text-slate-500">групп</div>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 pt-3 border-t border-slate-800/60">
                {branch.address && (
                  <div className="flex items-start gap-2 text-xs text-slate-400">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-500" />
                    <span>{branch.address}</span>
                  </div>
                )}
                {branch.phone && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Phone className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <a href={`tel:${branch.phone}`} className="hover:text-white transition-colors">
                      {branch.phone}
                    </a>
                  </div>
                )}
                {branch.email && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Mail className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                    <a href={`mailto:${branch.email}`} className="hover:text-white transition-colors truncate">
                      {branch.email}
                    </a>
                  </div>
                )}
                {!branch.address && !branch.phone && !branch.email && (
                  <p className="text-xs text-slate-600 italic">Контактные данные не указаны</p>
                )}
              </div>

              {/* Groups Count */}
              <div className="flex items-center gap-2 pt-2">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs text-slate-400">
                  {branch._count.groups > 0
                    ? `${branch._count.groups} группа(и) в этом филиале`
                    : "Нет групп"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* API Reference Box */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/30">
        <h3 className="text-sm font-bold text-slate-300 mb-3">API для управления филиалами</h3>
        <div className="space-y-2 font-mono text-xs">
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">GET</span>
            <span className="text-slate-400">/api/tenant/branches</span>
            <span className="text-slate-600">— список филиалов</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 border border-brand-500/20">POST</span>
            <span className="text-slate-400">/api/tenant/branches</span>
            <span className="text-slate-600">— создать филиал</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">PATCH</span>
            <span className="text-slate-400">/api/tenant/branches</span>
            <span className="text-slate-600">— обновить филиал</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">DELETE</span>
            <span className="text-slate-400">/api/tenant/branches</span>
            <span className="text-slate-600">— удалить (если нет групп)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
