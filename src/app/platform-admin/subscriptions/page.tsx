"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  FileText,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Calendar,
  CreditCard,
  Search,
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
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expiringInDays, setExpiringInDays] = useState("");
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Extend modal state
  const [extendSub, setExtendSub] = useState<SubscriptionItem | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [extending, setExtending] = useState(false);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(search && { search }),
        ...(status && { status }),
        ...(expiringInDays && { expiringInDays }),
        ...(debtorsOnly && { debtors: "true" }),
      });
      const res = await fetch(`/api/platform/subscriptions?${query}`);
      if (!res.ok) throw new Error("Не удалось загрузить подписки");
      const json = await res.json();
      setSubscriptions(json.subscriptions || []);
      setTotalPages(json.pagination?.totalPages || json.meta?.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки подписок");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, expiringInDays, debtorsOnly]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleQuickExtend = async () => {
    if (!extendSub) return;
    setExtending(true);
    try {
      const res = await fetch(`/api/platform/subscriptions/${extendSub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendMonths, status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Ошибка продления");
      } else {
        setExtendSub(null);
        fetchSubscriptions();
      }
    } catch {
      alert("Ошибка сети при продлении");
    } finally {
      setExtending(false);
    }
  };

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
            Контроль действующих тарифных планов, сроков оплаты и задолженностей
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/platform-admin/finance/payments"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <CreditCard className="w-4 h-4" />
            <span>Платежи центров</span>
          </Link>
          <Link
            href="/platform-admin/plans"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <span>Тарифы &rarr;</span>
          </Link>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          {/* Search */}
          <div className="relative min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Поиск по центру..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
            />
          </div>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              <option value="">Все статусы</option>
              <option value="ACTIVE">ACTIVE (Активные)</option>
              <option value="TRIAL">TRIAL (Пробный)</option>
              <option value="PAST_DUE">PAST_DUE (Просрочена)</option>
              <option value="FROZEN">FROZEN (Заморожена)</option>
              <option value="CANCELLED">CANCELLED (Отменена)</option>
            </select>
          </div>

          {/* Expiring In Days */}
          <select
            value={expiringInDays}
            onChange={(e) => {
              setExpiringInDays(e.target.value);
              setPage(1);
            }}
            className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="">Срок окончания: Любой</option>
            <option value="3">Истекают через 3 дня</option>
            <option value="7">Истекают через 7 дней</option>
            <option value="14">Истекают через 14 дней</option>
            <option value="30">Истекают через 30 дней</option>
          </select>

          {/* Debtors checkbox */}
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={debtorsOnly}
              onChange={(e) => {
                setDebtorsOnly(e.target.checked);
                setPage(1);
              }}
              className="rounded text-indigo-600 focus:ring-indigo-500"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            Только должники
          </label>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка реестра подписок...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : subscriptions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Подписки не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">По выбранным фильтрам записей не обнаружено.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left px-6 py-3.5">Учебный центр</th>
                  <th className="text-left px-6 py-3.5">Тариф</th>
                  <th className="text-left px-6 py-3.5">Статус</th>
                  <th className="text-left px-6 py-3.5">Период действия</th>
                  <th className="text-left px-6 py-3.5">Автопродление</th>
                  <th className="text-right px-6 py-3.5">Быстрые действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscriptions.map((sub) => {
                  const badge = statusBadges[sub.status] || {
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  };
                  const isExpired = new Date(sub.currentPeriodEndsAt) < new Date();
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/platform-admin/centers/${sub.center.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 transition-colors block"
                        >
                          {sub.center.name}
                        </Link>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{sub.center.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-800">{sub.plan.name}</div>
                        <div className="text-xs text-slate-500">{sub.plan.priceMonthly.toLocaleString()} UZS/мес</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {sub.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-600">
                        <div className={isExpired ? "text-rose-600 font-bold" : ""}>
                          До: {new Date(sub.currentPeriodEndsAt).toLocaleDateString()}
                          {isExpired && " (Истекла)"}
                        </div>
                        <div className="text-slate-400 mt-0.5">
                          С: {new Date(sub.currentPeriodStartsAt).toLocaleDateString()}
                        </div>
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
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => {
                              setExtendSub(sub);
                              setExtendMonths(1);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                          >
                            <Calendar className="w-3 h-3" />
                            Продлить
                          </button>
                          <Link
                            href={`/platform-admin/finance/payments?centerId=${sub.center.id}&planId=${sub.plan.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
                          >
                            <CreditCard className="w-3 h-3" />
                            Записать оплату
                          </Link>
                          <Link
                            href={`/platform-admin/centers/${sub.center.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <span>Вперед</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Quick Extend Modal */}
      {extendSub && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              Продлить подписку: {extendSub.center.name}
            </h3>
            <p className="text-sm text-slate-600">
              Текущий тариф: <strong>{extendSub.plan.name}</strong>. Действует до:{" "}
              <strong>{new Date(extendSub.currentPeriodEndsAt).toLocaleDateString()}</strong>
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Количество месяцев для продления
              </label>
              <select
                value={extendMonths}
                onChange={(e) => setExtendMonths(parseInt(e.target.value, 10))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value={1}>1 месяц</option>
                <option value={3}>3 месяца (Квартал)</option>
                <option value={6}>6 месяцев (Полгода)</option>
                <option value={12}>12 месяцев (Год)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExtendSub(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleQuickExtend}
                disabled={extending}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {extending ? "Продление..." : "Подтвердить продление"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
