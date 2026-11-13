"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  Database,
  Mail,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Server,
  RefreshCw,
  HardDrive,
} from "lucide-react";

interface HealthData {
  dbStatus: string;
  dbPingMs: number;
  email: {
    provider: string;
    isConfigured: boolean;
    warning?: string | null;
  };
  cron: {
    lastEmailRunAt?: string | null;
    schedule: string;
  };
  queue: {
    pending: number;
    failed: number;
    sent: number;
  };
  system: {
    uptimeSeconds: number;
    memoryUsageMb: number;
    heapUsedMb: number;
    environment: string;
  };
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/system/health");
      if (!res.ok) throw new Error("Не удалось загрузить данные о состоянии системы");
      const data = await res.json();
      setHealth(data.health);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка запроса");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0) return `${days} д. ${hours} ч. ${minutes} мин.`;
    if (hours > 0) return `${hours} ч. ${minutes} мин.`;
    return `${minutes} мин.`;
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Activity className="w-6 h-6 text-blue-600" />
              <span>Состояние системы</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Мониторинг базы данных, почтового сервиса, очереди EmailOutbox и системных ресурсов
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchHealth}
          disabled={loading}
          className="px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-600" : ""}`} />
          <span>Обновить</span>
        </button>
      </div>

      {/* Production Memory Email Warning Banner */}
      {health?.email.warning && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl flex items-start gap-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs sm:text-sm text-rose-800">
            <strong className="font-bold block mb-0.5">Внимание: Почта не настроена!</strong>
            {health.email.warning}. Пользователи не будут получать ссылки для сброса паролей и подтверждения.
          </div>
        </div>
      )}

      {loading && !health ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Опрос системных сервисов...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : health ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Database */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">База данных</span>
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                health.dbStatus === "HEALTHY" ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
              }`}>
                {health.dbStatus}
              </span>
              <span className="text-xs text-slate-500 font-mono">ping: {health.dbPingMs} ms</span>
            </div>
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
              PostgreSQL connection pooler & schema OK
            </p>
          </div>

          {/* Card 2: Email Transport */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Почта (Email)</span>
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Mail className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900 font-mono uppercase">{health.email.provider}</div>
              <span className={`text-[11px] font-semibold ${health.email.isConfigured ? "text-emerald-600" : "text-amber-600"}`}>
                {health.email.isConfigured ? "Готов к отправке" : "Режим памяти (не для прод)"}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
              Провайдер: Resend / SMTP / Memory
            </p>
          </div>

          {/* Card 3: Outbox Queue */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Очередь Outbox</span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 text-center font-mono">
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                <div className="text-xs text-slate-400">Wait</div>
                <div className="text-sm font-bold text-slate-900">{health.queue.pending}</div>
              </div>
              <div className="bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                <div className="text-xs text-rose-500">Fail</div>
                <div className="text-sm font-bold text-rose-700">{health.queue.failed}</div>
              </div>
              <div className="bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
                <div className="text-xs text-emerald-600">Sent</div>
                <div className="text-sm font-bold text-emerald-700">{health.queue.sent}</div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
              Cron: {health.cron.schedule} {health.cron.lastEmailRunAt ? `(посл: ${new Date(health.cron.lastEmailRunAt).toLocaleTimeString()})` : ""}
            </p>
          </div>

          {/* Card 4: Server Resources */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Сервер</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Server className="w-5 h-5" />
              </div>
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">Uptime: {formatUptime(health.system.uptimeSeconds)}</div>
              <div className="text-xs text-slate-500 font-mono mt-0.5">
                RAM RSS: {health.system.memoryUsageMb} MB • Heap: {health.system.heapUsedMb} MB
              </div>
            </div>
            <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2 font-mono">
              Env: {health.system.environment}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
