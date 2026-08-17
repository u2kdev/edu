"use client";

import { useEffect, useState } from "react";
import { Building2, Search, ExternalLink, ShieldAlert, CheckCircle2, PauseCircle, Ban, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function TenantsPage() {
  const [centers, setCenters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/platform/centers")
      .then((res) => res.json())
      .then((json) => setCenters(json.centers || []))
      .finally(() => setLoading(false));
  }, []);

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "ACTIVE": return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case "TRIAL": return <ShieldAlert className="w-4 h-4 text-amber-400" />;
      case "PAUSED": return <PauseCircle className="w-4 h-4 text-slate-400" />;
      case "BLOCKED": return <Ban className="w-4 h-4 text-rose-400" />;
      default: return <ShieldAlert className="w-4 h-4 text-slate-400" />;
    }
  };

  const filteredCenters = centers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.owner.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Учебные центры (Tenants)</h1>
          <p className="text-slate-400 text-sm">Управление всеми воркспейсами платформы</p>
        </div>
        <Link href="/platform/tenants/create" className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-brand-500/20">
          + Создать центр
        </Link>
      </div>

      <div className="glass-panel rounded-2xl border border-slate-800 p-2">
        <div className="p-4 border-b border-slate-800/50 flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-5 h-5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Поиск по названию или email владельца..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800">
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Центр</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Владелец</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Тариф</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Статус</th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Загрузка центров...</td></tr>
              ) : filteredCenters.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-slate-500">Центры не найдены</td></tr>
              ) : (
                filteredCenters.map((center) => (
                  <tr key={center.id} className="hover:bg-slate-800/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-brand-400">
                          <Building2 className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">{center.name}</div>
                          <div className="text-xs text-slate-500">slug: {center.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-200">{center.owner.fullName}</div>
                      <div className="text-xs text-slate-500">{center.owner.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {center.subscriptions?.[0]?.plan?.name || "Нет тарифа"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <StatusIcon status={center.status} />
                        {center.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/platform/tenants/${center.id}`} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors">
                        Подробнее
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
