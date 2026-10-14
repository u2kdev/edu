"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface SubscriptionItem {
  id: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  autoRenew: boolean;
  center: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
  };
}

export default function PlatformSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(status && { status }),
      });
      const res = await fetch(`/api/platform/subscriptions?${query}`);
      if (!res.ok) throw new Error("Не удалось загрузить подписки");
      const json = await res.json();
      setSubscriptions(json.subscriptions || []);
      setTotalPages(json.meta?.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки подписок");
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const statusBadges: Record<string, { bg: string; text: string; border: string }> = {
    ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    TRIAL: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    PAST_DUE: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
    FROZEN: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    CANCELLED: { bg: "bg-slate-100", text: "text-slate-700", border: "border-slate-200" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Подписки учебных центров
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Контроль действующих тарифных планов, сроков оплаты и биллинга
          </p>
        </div>
        <Link
          href="/platform-admin/plans"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all shrink-0"
        >
          <span>Управление тарифами &rarr;</span>
        </Link>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600 uppercase">Фильтр по статусу:</span>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">ACTIVE (Активные)</option>
            <option value="TRIAL">TRIAL (Пробный период)</option>
            <option value="PAST_DUE">PAST_DUE (Просрочена оплата)</option>
            <option value="FROZEN">FROZEN (Заморожена)</option>
            <option value="CANCELLED">CANCELLED (Отменена)</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка подписок...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Подписки не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">
            По выбранному фильтру подписок не обнаружено.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="text-left px-6 py-3.5">Учебный центр</th>
                  <th className="text-left px-6 py-3.5">Тариф</th>
                  <th className="text-left px-6 py-3.5">Статус</th>
                  <th className="text-left px-6 py-3.5">Период действия</th>
                  <th className="text-left px-6 py-3.5">Автопродление</th>
                  <th className="text-right px-6 py-3.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((sub) => {
                  const badge = statusBadges[sub.status] || {
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  };
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/platform-admin/centers/${sub.center.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors block"
                        >
                          {sub.center.name}
                        </Link>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{sub.center.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{sub.plan.name}</div>
                        <div className="text-xs text-slate-500">${sub.plan.priceMonthly}/мес</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div>До: <strong className="text-slate-900">{new Date(sub.currentPeriodEndsAt).toLocaleDateString()}</strong></div>
                        <div className="text-slate-400 mt-0.5">С: {new Date(sub.currentPeriodStartsAt).toLocaleDateString()}</div>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">
                        {sub.autoRenew ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Включено
                          </span>
                        ) : (
                          <span className="text-slate-400">Отключено</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/platform-admin/centers/${sub.center.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          <span>Карточка центра</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
              <span className="text-xs font-medium text-slate-500">
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <span>Вперед</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
