import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Shield, Clock, User, Building2, Terminal } from "lucide-react";

export default async function PlatformAuditLogPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  if (session.user.platformRole !== "SUPERADMIN") {
    redirect("/platform-admin");
  }

  const logs = await db.auditLog.findMany({
    take: 50,
    orderBy: { createdAt: "desc" },
    include: {
      actor: { select: { id: true, fullName: true, email: true, platformRole: true } },
      center: { select: { id: true, name: true, slug: true } },
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="px-3 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full border border-blue-200">
            SUPERADMIN ONLY
          </span>
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Журнал аудита платформы
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Сквозной протокол безопасности, системных событий, модификации тарифов и статусов учебных центров
        </p>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <span className="text-xs font-semibold text-slate-600 uppercase">
            Последние 50 записей системного аудита
          </span>
          <span className="text-xs font-medium text-slate-500">
            Всего записей: {logs.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                <th className="text-left px-6 py-3.5">Время</th>
                <th className="text-left px-6 py-3.5">Событие / Действие</th>
                <th className="text-left px-6 py-3.5">Инициатор</th>
                <th className="text-left px-6 py-3.5">Учебный центр</th>
                <th className="text-left px-6 py-3.5">Ресурс и детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-slate-400">
                    Журнал аудита пуст
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  let formattedDetails = "";
                  if (log.detailsJson) {
                    try {
                      formattedDetails = JSON.stringify(JSON.parse(log.detailsJson));
                    } catch {
                      formattedDetails = log.detailsJson;
                    }
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="inline-flex px-2.5 py-0.5 rounded-md text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        {log.actor ? (
                          <div>
                            <div className="font-semibold text-slate-900 text-xs">
                              {log.actor.fullName}
                            </div>
                            <div className="text-[11px] text-slate-400">{log.actor.email}</div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Система</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-700">
                        {log.center ? (
                          <div>
                            <span className="font-medium text-slate-900">{log.center.name}</span>
                            <span className="block text-[11px] text-slate-400 font-mono">
                              {log.center.slug}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">— (Платформа)</span>
                        )}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600 font-mono max-w-xs truncate">
                        <div className="font-semibold text-slate-800">{log.resource}</div>
                        {formattedDetails && (
                          <div className="text-[11px] text-slate-500 truncate" title={formattedDetails}>
                            {formattedDetails}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
