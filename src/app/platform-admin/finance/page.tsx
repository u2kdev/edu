"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  TrendingUp,
  CreditCard,
  Receipt,
  Download,
  AlertTriangle,
  Building2,
  Calendar,
  Layers,
  Percent,
} from "lucide-react";

interface FinanceStats {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscriptionsCount: number;
  forecast30Days: number;
  churnRate: number;
  periods: {
    month: { revenue: number; expenses: number; profit: number };
    quarter: { revenue: number; expenses: number; profit: number };
    year: { revenue: number; expenses: number; profit: number };
  };
  revenueByPlan: {
    planId: string;
    planName: string;
    priceMonthly: number;
    activeSubscriptions: number;
    totalRevenue: number;
  }[];
  revenueByCenter: {
    centerId: string;
    centerName: string;
    status: string;
    paymentsCount: number;
    totalRevenue: number;
  }[];
  debtors: {
    subscriptionId: string;
    centerId: string;
    centerName: string;
    centerPhone: string | null;
    centerEmail: string | null;
    centerStatus: string;
    planName: string;
    dueAmount: number;
    currentPeriodEndsAt: string;
    daysOverdue: number;
  }[];
  monthlyHistory: {
    month: string;
    revenue: number;
    expenses: number;
  }[];
}

export default function PlatformFinancePage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/platform/finance/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        } else {
          setError(data.error || "Не удалось загрузить финансовые данные");
        }
      } catch {
        setError("Ошибка связи с сервером");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Загрузка финансовой аналитики платформы...
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-center">
        {error || "Ошибка загрузки"}
      </div>
    );
  }

  const maxChartVal = Math.max(
    ...stats.monthlyHistory.map((m) => Math.max(m.revenue, m.expenses)),
    1000000
  );

  return (
    <div className="space-y-8">
      {/* Header and Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Финансы платформы
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Сквозная аналитика выручки, расходов, подписок и задолженностей
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/platform/finance/stats/export"
            download
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Экспорт отчёта (CSV)</span>
          </a>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/platform-admin/finance"
          className="px-4 py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600"
        >
          Обзор и отчёты
        </Link>
        <Link
          href="/platform-admin/finance/payments"
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Платежи центров
        </Link>
        <Link
          href="/platform-admin/finance/expenses"
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Расходы платформы
        </Link>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>MRR (Выручка/мес)</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.mrr.toLocaleString()} <span className="text-xs font-medium text-slate-500">UZS</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            ARR: {stats.arr.toLocaleString()} UZS/год
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>ARPU (Средний чек)</span>
            <Layers className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.arpu.toLocaleString()} <span className="text-xs font-medium text-slate-500">UZS</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Активных центров: {stats.activeSubscriptionsCount}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Прогноз на 30 дней</span>
            <Calendar className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.forecast30Days.toLocaleString()} <span className="text-xs font-medium text-slate-500">UZS</span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Ожидаемые продления подписок
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Churn Rate (Отток)</span>
            <Percent className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">
            {stats.churnRate}%
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Отток за последние 30 дней
          </div>
        </div>
      </div>

      {/* Performance Summary Cards (Month / Quarter / Year) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b pb-2">Текущий месяц</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Выручка (нетто):</span>
              <span className="font-semibold text-emerald-600">
                +{stats.periods.month.revenue.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Расходы платформы:</span>
              <span className="font-semibold text-rose-600">
                -{stats.periods.month.expenses.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span className="text-slate-900">Чистая прибыль:</span>
              <span className={stats.periods.month.profit >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {stats.periods.month.profit.toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b pb-2">Текущий квартал</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Выручка (нетто):</span>
              <span className="font-semibold text-emerald-600">
                +{stats.periods.quarter.revenue.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Расходы платформы:</span>
              <span className="font-semibold text-rose-600">
                -{stats.periods.quarter.expenses.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span className="text-slate-900">Чистая прибыль:</span>
              <span className={stats.periods.quarter.profit >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {stats.periods.quarter.profit.toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900 border-b pb-2">Текущий год</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Выручка (нетто):</span>
              <span className="font-semibold text-emerald-600">
                +{stats.periods.year.revenue.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Расходы платформы:</span>
              <span className="font-semibold text-rose-600">
                -{stats.periods.year.expenses.toLocaleString()} UZS
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold">
              <span className="text-slate-900">Чистая прибыль:</span>
              <span className={stats.periods.year.profit >= 0 ? "text-emerald-700" : "text-rose-700"}>
                {stats.periods.year.profit.toLocaleString()} UZS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Lightweight SVG Chart: 6-month Revenue vs Expenses */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">Динамика за последние 6 месяцев</h3>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />
              <span>Выручка</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-rose-400 inline-block" />
              <span>Расходы</span>
            </div>
          </div>
        </div>

        <div className="w-full h-48 flex items-end justify-between gap-4 pt-8 pb-4 px-4 border-b border-slate-100">
          {stats.monthlyHistory.map((item, idx) => {
            const revHeight = Math.max(6, Math.round((item.revenue / maxChartVal) * 140));
            const expHeight = Math.max(6, Math.round((item.expenses / maxChartVal) * 140));
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                <div className="flex items-end gap-1.5 h-36">
                  {/* Revenue Bar */}
                  <div
                    style={{ height: `${revHeight}px` }}
                    className="w-5 bg-indigo-500 rounded-t-sm transition-all hover:bg-indigo-600"
                    title={`Выручка: ${item.revenue.toLocaleString()} UZS`}
                  />
                  {/* Expenses Bar */}
                  <div
                    style={{ height: `${expHeight}px` }}
                    className="w-5 bg-rose-400 rounded-t-sm transition-all hover:bg-rose-500"
                    title={`Расходы: ${item.expenses.toLocaleString()} UZS`}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-600">{item.month}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Revenue Breakdown by Plans & Top Centers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Plan */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Выручка по тарифам</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left pb-2">Тариф</th>
                <th className="text-center pb-2">Активных</th>
                <th className="text-right pb-2">Выручка</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.revenueByPlan.map((p) => (
                <tr key={p.planId} className="hover:bg-slate-50">
                  <td className="py-2.5 font-medium text-slate-900">{p.planName}</td>
                  <td className="py-2.5 text-center text-slate-600">{p.activeSubscriptions}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {p.totalRevenue.toLocaleString()} UZS
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Revenue by Center */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Топ-10 центров по платежам</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-semibold text-slate-500 uppercase">
                <th className="text-left pb-2">Центр</th>
                <th className="text-center pb-2">Платежей</th>
                <th className="text-right pb-2">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.revenueByCenter.map((c) => (
                <tr key={c.centerId} className="hover:bg-slate-50">
                  <td className="py-2.5">
                    <Link
                      href={`/platform-admin/centers/${c.centerId}`}
                      className="font-medium text-slate-900 hover:text-indigo-600"
                    >
                      {c.centerName}
                    </Link>
                  </td>
                  <td className="py-2.5 text-center text-slate-600">{c.paymentsCount}</td>
                  <td className="py-2.5 text-right font-semibold text-slate-900">
                    {c.totalRevenue.toLocaleString()} UZS
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Debtors List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" />
            <h3 className="text-base font-bold text-slate-900">
              Дебиторская задолженность ({stats.debtors.length})
            </h3>
          </div>
          <span className="text-xs text-slate-500">Центры с истекшим сроком оплаты</span>
        </div>

        {stats.debtors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Задолженностей по подпискам нет. Все центры оплачены своевременно.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs font-semibold text-slate-500 uppercase">
                  <th className="text-left pb-2.5">Учебный центр</th>
                  <th className="text-left pb-2.5">Контакты</th>
                  <th className="text-left pb-2.5">Тариф</th>
                  <th className="text-center pb-2.5">Просрочка</th>
                  <th className="text-right pb-2.5">Сумма долга</th>
                  <th className="text-right pb-2.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.debtors.map((d) => (
                  <tr key={d.subscriptionId} className="hover:bg-rose-50/40">
                    <td className="py-3 font-semibold text-slate-900">
                      <Link
                        href={`/platform-admin/centers/${d.centerId}`}
                        className="hover:text-indigo-600"
                      >
                        {d.centerName}
                      </Link>
                      <div className="text-xs text-rose-600 font-normal">
                        Статус: {d.centerStatus}
                      </div>
                    </td>
                    <td className="py-3 text-xs text-slate-600">
                      <div>{d.centerPhone || "—"}</div>
                      <div className="text-slate-400">{d.centerEmail || ""}</div>
                    </td>
                    <td className="py-3 text-slate-700">{d.planName}</td>
                    <td className="py-3 text-center">
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                        {d.daysOverdue} дн.
                      </span>
                    </td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      {d.dueAmount.toLocaleString()} UZS
                    </td>
                    <td className="py-3 text-right">
                      <Link
                        href={`/platform-admin/finance/payments?centerId=${d.centerId}`}
                        className="px-3 py-1 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-semibold"
                      >
                        Записать оплату
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
