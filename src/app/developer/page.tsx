"use client";

import { useEffect, useState } from "react";
import { Activity, Database, Server, Clock, HardDrive } from "lucide-react";

export default function DeveloperDashboard() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/developer/health")
      .then((res) => res.json())
      .then((json) => setHealth(json.health))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-zinc-500 animate-pulse">Running diagnostics...</div>;
  if (!health) return <div className="text-rose-500">Failed to connect to health API.</div>;

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600*24));
    const h = Math.floor(seconds % (3600*24) / 3600);
    const m = Math.floor(seconds % 3600 / 60);
    return `${d}d ${h}h ${m}m`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
          <Activity className="w-6 h-6 text-emerald-400" />
          System Diagnostics
        </h1>
        <p className="text-zinc-500 mt-1">Real-time infrastructure health and telemetry</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DB Status */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-400 font-semibold">PostgreSQL</span>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div className={`text-xl font-bold ${health.dbStatus === 'HEALTHY' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {health.dbStatus}
            </div>
            <div className="text-xs text-zinc-500">{health.dbPingMs}ms ping</div>
          </div>
        </div>

        {/* Redis Status */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Server className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-400 font-semibold">Redis Cache</span>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div className="text-xl font-bold text-zinc-500">
              {health.redisStatus}
            </div>
          </div>
        </div>

        {/* Uptime */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-400 font-semibold">Node Process Uptime</span>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div className="text-xl font-bold text-zinc-200">
              {formatUptime(health.uptimeSeconds)}
            </div>
          </div>
        </div>

        {/* Memory */}
        <div className="p-5 bg-zinc-900 border border-zinc-800 rounded flex flex-col">
          <div className="flex items-center gap-3 mb-4">
            <HardDrive className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-400 font-semibold">Heap Usage</span>
          </div>
          <div className="flex items-end justify-between mt-auto">
            <div className="text-xl font-bold text-zinc-200">
              {formatBytes(health.memoryUsage.heapUsed)}
            </div>
            <div className="text-xs text-zinc-500">/ {formatBytes(health.memoryUsage.heapTotal)}</div>
          </div>
        </div>
      </div>

      <div className="mt-8 p-4 bg-zinc-900 border border-zinc-800 rounded">
        <h3 className="text-sm text-zinc-400 font-semibold mb-3">Environment Detail</h3>
        <pre className="text-xs text-emerald-400 overflow-x-auto">
          {JSON.stringify({ env: health.environment, node: process.version, platform: process.platform }, null, 2)}
        </pre>
      </div>
    </div>
  );
}
