"use client";

import { useEffect, useState } from "react";
import { Database, Search } from "lucide-react";

export default function GlobalAuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/developer/audit-logs?limit=200")
      .then((res) => res.json())
      .then((json) => setLogs(json.logs || []))
      .finally(() => setLoading(false));
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.actor.email.toLowerCase().includes(search.toLowerCase()) ||
      log.resource.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <Database className="w-6 h-6 text-emerald-400" />
          Global Audit Logs
        </h1>
        <p className="text-zinc-500 mt-1">Unrestricted view of all platform and tenant activities</p>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded p-4">
        <div className="relative mb-4">
          <Search className="w-5 h-5 text-zinc-600 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Grep logs by action, actor email, or resource..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-black border border-zinc-800 text-zinc-300 rounded pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse font-mono text-xs">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="py-2 pr-4 font-normal">TIMESTAMP</th>
                <th className="py-2 pr-4 font-normal">TENANT</th>
                <th className="py-2 pr-4 font-normal">ACTOR</th>
                <th className="py-2 pr-4 font-normal">ACTION</th>
                <th className="py-2 pr-4 font-normal">RESOURCE</th>
                <th className="py-2 font-normal">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600">
                    Querying logs...
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600">
                    0 matches
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-800/30 text-zinc-300">
                    <td className="py-2 pr-4 whitespace-nowrap text-zinc-500">
                      {new Date(log.createdAt).toISOString().replace("T", " ").substring(0, 19)}
                    </td>
                    <td className="py-2 pr-4 text-emerald-400">
                      {log.center ? log.center.slug : "PLATFORM"}
                    </td>
                    <td className="py-2 pr-4">
                      {log.actor.email}
                    </td>
                    <td className="py-2 pr-4 text-amber-300 font-bold">
                      {log.action}
                    </td>
                    <td className="py-2 pr-4 text-blue-400">
                      {log.resource}
                    </td>
                    <td className="py-2 text-zinc-500 truncate max-w-[120px]">
                      {log.resourceId}
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
