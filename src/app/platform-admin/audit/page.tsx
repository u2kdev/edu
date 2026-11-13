import { getAuthSession } from "@/lib/auth";
// Reason: Exception: Platform routes manage global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Shield } from "lucide-react";
import PlatformAuditInteractive from "@/components/platform/PlatformAuditInteractive";

function formatDetails(raw: string | null): string {
  if (!raw) return "—";
  try {
    const parsed = JSON.parse(raw);
    return JSON.stringify(parsed);
  } catch {
    return raw;
  }
}

export default async function PlatformAuditPage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  if (session.user.platformRole !== "SUPERADMIN" && session.user.platformRole !== "DEVELOPER") {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Журнал аудита платформы
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Сквозной протокол действий администраторов, финансовых и системных событий • Всего записей: {logs.length}
            </p>
          </div>
        </div>
      </div>

      {/* Interactive search, filters & export toolbar */}
      <PlatformAuditInteractive />

      {/* Audit Log Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs font-semibold text-zinc-500 uppercase border-b border-zinc-200 dark:border-zinc-700">
              <tr>
                <th className="px-4 py-3">Дата и время</th>
                <th className="px-4 py-3">Действие</th>
                <th className="px-4 py-3">Актор</th>
                <th className="px-4 py-3">Центр</th>
                <th className="px-4 py-3">Ресурс</th>
                <th className="px-4 py-3">IP-адрес</th>
                <th className="px-4 py-3">Детали</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    Журнал аудита пуст
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const actorText = log.actor
                    ? `${log.actor.fullName || log.actor.email} (${log.actor.email})`
                    : "Система";
                  const centerText = log.center ? `${log.center.name} (${log.center.slug})` : "— (Платформа)";
                  const detailsFormatted = formatDetails(log.detailsJson);

                  return (
                    <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-zinc-500 font-mono">
                        {new Date(log.createdAt).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200">
                          {log.actor?.fullName || "Система"}
                        </div>
                        {log.actor?.email && (
                          <div className="text-zinc-400 text-[11px]">{log.actor.email}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400">
                        {centerText}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-600 dark:text-zinc-400">
                        {log.resource}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-500">
                        {log.ipAddress || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono text-zinc-600 dark:text-zinc-300 max-w-xs truncate">
                        {detailsFormatted}
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
