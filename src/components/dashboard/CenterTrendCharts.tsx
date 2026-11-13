"use client";

import React, { useState } from "react";
import { BarChart3, TrendingUp, Calendar } from "lucide-react";
import { formatCurrencyLocalized } from "@/i18n";

export interface DailyTrendPoint {
  date: string; // YYYY-MM-DD
  label: string; // "12 ноя"
  totalAttendance: number;
  presentAttendance: number;
  revenue: number;
}

interface CenterTrendChartsProps {
  data: DailyTrendPoint[];
  locale?: string;
}

export function CenterTrendCharts({ data, locale = "ru" }: CenterTrendChartsProps) {
  const [periodDays, setPeriodDays] = useState<7 | 30 | 90>(30);

  // Filter data according to selected period
  const filteredData = data.slice(-periodDays);

  const totalRevenue = filteredData.reduce((sum, d) => sum + d.revenue, 0);
  const totalAtt = filteredData.reduce((sum, d) => sum + d.totalAttendance, 0);
  const presentAtt = filteredData.reduce((sum, d) => sum + d.presentAttendance, 0);
  const avgAttendanceRate = totalAtt > 0 ? Math.round((presentAtt / totalAtt) * 100) : 0;

  const maxRevenue = Math.max(...filteredData.map((d) => d.revenue), 1);

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-brand-400" />
            {locale === "uz" ? "Davomat va tushum dinamikasi" : "Динамика посещаемости и выручки"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {locale === "uz"
              ? "Tanlangan davr bo'yicha markazning asosiy ko'rsatkichlari"
              : "Ключевые показатели центра за выбранный период"}
          </p>
        </div>

        {/* Period Selector Filter */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
          <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <button
            onClick={() => setPeriodDays(7)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              periodDays === 7
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            7 {locale === "uz" ? "kun" : "дней"}
          </button>
          <button
            onClick={() => setPeriodDays(30)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              periodDays === 30
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            30 {locale === "uz" ? "kun" : "дней"}
          </button>
          <button
            onClick={() => setPeriodDays(90)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
              periodDays === 90
                ? "bg-brand-500 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            90 {locale === "uz" ? "kun" : "дней"}
          </button>
        </div>
      </div>

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              {locale === "uz" ? "Davr uchun tushum" : "Выручка за период"}
            </span>
            <div className="text-xl font-black text-emerald-400 mt-1">
              {formatCurrencyLocalized(totalRevenue, locale, "UZS")}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-400 font-medium">
              {locale === "uz" ? "O'rtacha davomat" : "Средняя посещаемость"}
            </span>
            <div className="text-xl font-black text-brand-400 mt-1">
              {avgAttendanceRate}%
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Dynamic Visual Bars */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400 font-semibold px-1">
          <span>{locale === "uz" ? "Kunlik grafik" : "Дневной график"}</span>
          <span>{locale === "uz" ? "Tushum (UZS) / Davomat (%)" : "Выручка (UZS) / Посещаемость (%)"}</span>
        </div>

        <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-6 pb-2 px-2 bg-slate-950/40 rounded-xl border border-slate-800/60 overflow-x-auto">
          {filteredData.map((pt) => {
            const attRate =
              pt.totalAttendance > 0
                ? Math.round((pt.presentAttendance / pt.totalAttendance) * 100)
                : 0;
            const revHeightPct = Math.max(8, Math.round((pt.revenue / maxRevenue) * 100));

            return (
              <div
                key={pt.date}
                className="flex-1 min-w-[20px] flex flex-col items-center gap-1.5 group relative h-full justify-end"
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-20 pointer-events-none">
                  <div className="bg-slate-900 text-white text-[11px] font-medium py-1.5 px-2.5 rounded-lg border border-slate-700 shadow-xl whitespace-nowrap">
                    <p className="font-bold text-slate-300">{pt.label}</p>
                    <p className="text-emerald-400">
                      {formatCurrencyLocalized(pt.revenue, locale, "UZS")}
                    </p>
                    <p className="text-brand-300">
                      {locale === "uz" ? "Davomat" : "Посещаемость"}: {attRate}% ({pt.presentAttendance}/{pt.totalAttendance})
                    </p>
                  </div>
                  <div className="w-2 h-2 bg-slate-900 border-r border-b border-slate-700 transform rotate-45 -mt-1" />
                </div>

                {/* Revenue & Attendance Double Bar */}
                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                  {/* Revenue Bar */}
                  <div
                    className="w-full max-w-[14px] bg-emerald-500/80 group-hover:bg-emerald-400 rounded-t transition-all"
                    style={{ height: `${revHeightPct}%` }}
                  />
                  {/* Attendance Bar */}
                  <div
                    className={`w-full max-w-[14px] rounded-t transition-all ${
                      attRate >= 80
                        ? "bg-brand-500/80 group-hover:bg-brand-400"
                        : attRate > 0
                        ? "bg-amber-500/80 group-hover:bg-amber-400"
                        : "bg-slate-800/60"
                    }`}
                    style={{ height: `${Math.max(8, attRate)}%` }}
                  />
                </div>

                {/* Date Label */}
                <span className="text-[10px] text-slate-500 font-medium truncate max-w-full">
                  {pt.label.split(" ")[0]}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
