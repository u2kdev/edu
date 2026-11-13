"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  AlertTriangle,
  Clock,
  Shield,
  Sparkles,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  Server,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";

interface DashboardData {
  period: string;
  finance: {
    mrr: number;
    arr: number;
    arpu: number;
    currentMonthNetRevenue: number;
    prevMonthNetRevenue: number;
    deltaPercent: number;
    monthExpenses: number;
    monthProfit: number;
    dueNext7Days: {
      amount: number;
      centersCount: number;
      items: Array<{
        centerId: string;
        centerName: string;
        slug: string;
        planName: string;
        amount: number;
        endsAt: string;
      }>;
    };
    overdueDebtors: {
      amount: number;
      centersCount: number;
      items: Array<{
        id: string;
        centerId: string;
        centerName: string;
        amount: number;
        periodEndsAt: string | null;
      }>;
    };
  };
  growth: {
    timeline: Array<{
      date: string;
      users: number;
      centers: number;
    }>;
    funnel: {
      centersCreated: number;
      trials: number;
      paid: number;
      conversionPercent: number;
    };
    churnRate: number;
  };
  numbers: {
    centers: {
      total: number;
      active: number;
      trial: number;
      paused: number;
      blocked: number;
      byType: {
        HYBRID: number;
        ONLINE: number;
        OFFLINE: number;
      };
      byKind?: {
        LEARNING_CENTER: number;
        SCHOOL: number;
        KINDERGARTEN: number;
        OTHER: number;
      };
    };
    users: {
      total: number;
      students: number;
      teachers: number;
      parents: number;
      directors: number;
      activeLast7Days: number;
      activeLast30Days: number;
    };
    topCenters: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      studentsCount: number;
    }>;
  };
  attentionItems: Array<{
    id: string;
    level: "CRITICAL" | "WARNING" | "INFO";
    title: string;
    description: string;
    actionUrl: string;
    actionLabel: string;
  }>;
  events: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    actorName: string;
    centerName: string | null;
    ipAddress: string | null;
    createdAt: string;
  }>;
  health: {
    dbStatus: string;
    dbPingMs: number;
    uptimeSeconds: number;
    memoryMb: number;
    environment: string;
    isEmailConfigured: boolean;
    emailProvider: string;
    queue: {
      pending: number;
      failed: number;
      sent: number;
    };
  };
}

export default function PlatformDashboardInteractive() {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "year">("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/platform/dashboard?period=${period}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || "Не удалось загрузить данные дашборда");
      }
    } catch {
      setError("Ошибка сетевого соединения");
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const formatUZS = (val: number) => {
    return (val || 0).toLocaleString("ru-RU") + " UZS";
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (24 * 3600));
    const h = Math.floor((seconds % (24 * 3600)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}д ${h}ч`;
    if (h > 0) return `${h}ч ${m}мин`;
    return `${m}мин`;
  };

  return (
    <div className="space-y-8">
      {/* Period Selector Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
            Период среза аналитики:
          </span>
          <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            {[
              { key: "7d", label: "7 дней" },
              { key: "30d", label: "30 дней" },
              { key: "90d", label: "90 дней" },
              { key: "year", label: "Год" },
            ].map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key as "7d" | "30d" | "90d" | "year")}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                  period === p.key
                    ? "bg-indigo-600 text-white font-semibold shadow-sm"
                    : "text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={fetchDashboard}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить срез
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* BLOCK 4: ATTENTION REQUIRED LIST */}
      {data && data.attentionItems.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Требует внимания ({data.attentionItems.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.attentionItems.map((item) => {
              const bg =
                item.level === "CRITICAL"
                  ? "bg-rose-50/80 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                  : item.level === "WARNING"
                  ? "bg-amber-50/80 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40"
                  : "bg-blue-50/80 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40";
              const text =
                item.level === "CRITICAL"
                  ? "text-rose-900 dark:text-rose-200"
                  : item.level === "WARNING"
                  ? "text-amber-900 dark:text-amber-200"
                  : "text-blue-900 dark:text-blue-200";
              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border ${bg} shadow-sm flex flex-col justify-between gap-3`}
                >
                  <div>
                    <div className={`font-semibold text-sm ${text}`}>{item.title}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                      {item.description}
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Link
                      href={item.actionUrl}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {item.actionLabel} &rarr;
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BLOCK 1: FINANCES */}
      {data && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              Блок 1. Финансы платформы
            </h2>
            <Link
              href="/platform-admin/finance"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              Подробная бухгалтерия &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  MRR (Рекуррентно в мес)
                </span>
                <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 flex items-center justify-center text-emerald-600">
                  <Wallet className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {formatUZS(data.finance.mrr)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">ARR: {formatUZS(data.finance.arr)}</div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Выручка тек. месяца
                </span>
                <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/30 flex items-center justify-center text-blue-600">
                  <TrendingUp className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {formatUZS(data.finance.currentMonthNetRevenue)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-xs">
                {data.finance.deltaPercent >= 0 ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                    <TrendingUp className="w-3.5 h-3.5" /> +{data.finance.deltaPercent}%
                  </span>
                ) : (
                  <span className="text-rose-600 font-semibold flex items-center gap-0.5">
                    <TrendingDown className="w-3.5 h-3.5" /> {data.finance.deltaPercent}%
                  </span>
                )}
                <span className="text-zinc-400">к прошлому мес</span>
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  К оплате (7 дней)
                </span>
                <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {formatUZS(data.finance.dueNext7Days.amount)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                {data.finance.dueNext7Days.centersCount} центров ожидают продления
              </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Чистая прибыль мес
                </span>
                <div className="w-9 h-9 rounded-lg bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600">
                  <Sparkles className="w-5 h-5" />
                </div>
              </div>
              <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
                {formatUZS(data.finance.monthProfit)}
              </div>
              <div className="text-xs text-zinc-500 mt-1">
                Расходы: {formatUZS(data.finance.monthExpenses)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 2 & BLOCK 3: GROWTH & NUMBERS */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* BLOCK 2: GROWTH */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
                Блок 2. Рост и воронка конверсии
              </h2>
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                Период: {period}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <div className="text-xs text-zinc-500">Создано центров</div>
                <div className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
                  {data.growth.funnel.centersCreated}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <div className="text-xs text-zinc-500">На триале</div>
                <div className="text-xl font-bold text-blue-600 mt-1">
                  {data.growth.funnel.trials}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                <div className="text-xs text-zinc-500">Оплатили тариф</div>
                <div className="text-xl font-bold text-emerald-600 mt-1">
                  {data.growth.funnel.paid}
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-zinc-500">Конверсия триал &rarr; оплата</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {data.growth.funnel.conversionPercent}%
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold text-zinc-500">Churn Rate (отток)</div>
                <div className="text-lg font-bold text-rose-600 mt-0.5">
                  {data.growth.churnRate}%
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-2">
                Регистрации по дням ({data.growth.timeline.length} дн.)
              </div>
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2 text-xs">
                {data.growth.timeline.slice(-10).reverse().map((t) => (
                  <div
                    key={t.date}
                    className="flex items-center justify-between py-1 px-2 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                  >
                    <span className="font-mono text-zinc-600 dark:text-zinc-400">{t.date}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-blue-600 font-medium">+{t.users} польз.</span>
                      <span className="text-emerald-600 font-medium">+{t.centers} центр.</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BLOCK 3: PLATFORM IN NUMBERS */}
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Блок 3. Платформа в цифрах
              </h2>
              <Link
                href="/platform-admin/centers"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Все центры &rarr;
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                <span className="text-zinc-400 block">Всего</span>
                <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  {data.numbers.centers.total}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/30">
                <span className="text-emerald-600 block font-medium">Активных</span>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {data.numbers.centers.active}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/40 bg-blue-50/30">
                <span className="text-blue-600 block font-medium">Триал</span>
                <span className="text-base font-bold text-blue-700 dark:text-blue-400">
                  {data.numbers.centers.trial}
                </span>
              </div>
              <div className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/40 bg-rose-50/30">
                <span className="text-rose-600 block font-medium">Блок/Пауза</span>
                <span className="text-base font-bold text-rose-700 dark:text-rose-400">
                  {data.numbers.centers.blocked + data.numbers.centers.paused}
                </span>
              </div>
            </div>

            {data.numbers.centers.byKind && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 pt-1">
                <span className="text-zinc-400 font-medium">По типам организаций:</span>
                <span className="px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium">
                  Центры: {data.numbers.centers.byKind.LEARNING_CENTER || 0}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                  Школы: {data.numbers.centers.byKind.SCHOOL || 0}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium">
                  Детсады: {data.numbers.centers.byKind.KINDERGARTEN || 0}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-medium">
                  Другие: {data.numbers.centers.byKind.OTHER || 0}
                </span>
              </div>
            )}

            <div className="p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50/40 dark:bg-zinc-800/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div>
                <span className="text-xs text-zinc-500">Ученики</span>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.numbers.users.students}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Учителя</span>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.numbers.users.teachers}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Родители</span>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.numbers.users.parents}
                </div>
              </div>
              <div>
                <span className="text-xs text-zinc-500">Директора</span>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {data.numbers.users.directors}
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-zinc-500 mb-2">
                Топ-5 центров по числу учеников
              </div>
              <div className="space-y-1.5">
                {data.numbers.topCenters.map((c, idx) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 flex items-center justify-center font-bold text-[10px]">
                        {idx + 1}
                      </span>
                      <Link
                        href={`/platform-admin/centers/${c.id}`}
                        className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-indigo-600"
                      >
                        {c.name}
                      </Link>
                      <span className="text-zinc-400 font-mono text-[10px]">({c.slug})</span>
                    </div>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      {c.studentsCount} учеников
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 5 & BLOCK 6: AUDIT EVENT FEED & SYSTEM HEALTH */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                Блок 5. Лента событий платформы
              </h2>
              <Link
                href="/platform-admin/audit"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Все записи аудита &rarr;
              </Link>
            </div>

            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-80 overflow-y-auto pr-2">
              {data.events.map((ev) => (
                <div key={ev.id} className="py-2.5 flex items-center justify-between text-xs gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {ev.action}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
                        {ev.resource}
                      </span>
                    </div>
                    <div className="text-zinc-500 dark:text-zinc-400 text-[11px]">
                      Актор: {ev.actorName} {ev.centerName ? `• Центр: ${ev.centerName}` : ""}
                    </div>
                  </div>
                  <span className="text-zinc-400 text-[10px] shrink-0 font-mono">
                    {new Date(ev.createdAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Server className="w-5 h-5 text-emerald-600" />
                Блок 6. Здоровье системы
              </h2>
              <Link
                href="/platform-admin/system-health"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Подробнее &rarr;
              </Link>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">База данных PostgreSQL:</span>
                <span className="font-semibold flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" /> {data.health.dbPingMs} ms ({data.health.dbStatus})
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Очередь EmailOutbox:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {data.health.queue.sent} отправл. / {data.health.queue.failed} сбоев
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Память RSS:</span>
                <span className="font-mono font-medium">{data.health.memoryMb} MB</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Время непрерывной работы:</span>
                <span className="font-mono font-medium">{formatUptime(data.health.uptimeSeconds)}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">Почтовый шлюз:</span>
                <span
                  className={`font-semibold ${
                    data.health.isEmailConfigured ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {data.health.emailProvider} {data.health.isEmailConfigured ? "(OK)" : "(Memory)"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
