"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardList, Search, Download, Filter, Eye, RefreshCw, X
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId?: string | null;
  detailsJson?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; email: string } | null;
}

interface FilterOptions {
  actions: string[];
  resources: string[];
  actors: Array<{ id: string; fullName: string; email: string }>;
}

export function CenterAuditManager({ locale = "ru" }: { locale?: string }) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [filters, setFilters] = useState<FilterOptions>({ actions: [], resources: [], actors: [] });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters state
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState("ALL");
  const [selectedResource, setSelectedResource] = useState("ALL");
  const [selectedActor, setSelectedActor] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Details modal
  const [activeLog, setActiveLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "25",
      });
      if (search) params.append("search", search);
      if (selectedAction !== "ALL") params.append("action", selectedAction);
      if (selectedResource !== "ALL") params.append("resource", selectedResource);
      if (selectedActor !== "ALL") params.append("actorUserId", selectedActor);
      if (dateFrom) params.append("dateFrom", dateFrom);
      if (dateTo) params.append("dateTo", dateTo);

      const res = await fetch(`/api/tenant/audit?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
      if (data.filters) {
        setFilters(data.filters);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedAction, selectedResource, selectedActor, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCsv = () => {
    const params = new URLSearchParams({ export: "csv" });
    if (search) params.append("search", search);
    if (selectedAction !== "ALL") params.append("action", selectedAction);
    if (selectedResource !== "ALL") params.append("resource", selectedResource);
    if (selectedActor !== "ALL") params.append("actorUserId", selectedActor);
    if (dateFrom) params.append("dateFrom", dateFrom);
    if (dateTo) params.append("dateTo", dateTo);

    window.open(`/api/tenant/audit?${params.toString()}`, "_blank");
  };

  const getActionBadge = (action: string) => {
    if (action.includes("CREATE") || action.includes("SUCCESS") || action.includes("FINALIZED")) {
      return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
    }
    if (action.includes("UPDATE") || action.includes("EDIT") || action.includes("REORDER")) {
      return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    }
    if (action.includes("DELETE") || action.includes("REVOKE") || action.includes("ARCHIVE") || action.includes("FAILED")) {
      return "bg-rose-500/10 text-rose-400 border border-rose-500/20";
    }
    return "bg-purple-500/10 text-purple-400 border border-purple-500/20";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <ClipboardList className="w-7 h-7 text-brand-400" />
            {locale === "uz" ? "Markaz harakatlar jurnali" : "Журнал действий центра"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {locale === "uz"
              ? "O'quv markazi xodimlari va foydalanuvchilarining barcha amallari auditi"
              : "Полная история операций и событий пользователей вашего учебного центра"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchLogs()}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-400" : ""}`} />
          </button>
          <button
            onClick={handleExportCsv}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-950/20"
          >
            <Download className="w-4 h-4" />
            {locale === "uz" ? "CSV yuklab olish" : "Экспорт в CSV"}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={locale === "uz" ? "Qidiruv (harakat, resurs, ism)..." : "Поиск по действию, ресурсу, имени..."}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{locale === "uz" ? "Barcha amallar" : "Все действия"}</option>
              {filters.actions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* Resource Filter */}
          <div>
            <select
              value={selectedResource}
              onChange={(e) => {
                setSelectedResource(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{locale === "uz" ? "Barcha resurslar" : "Все ресурсы"}</option>
              {filters.resources.map((res) => (
                <option key={res} value={res}>
                  {res}
                </option>
              ))}
            </select>
          </div>

          {/* Actor Filter */}
          <div>
            <select
              value={selectedActor}
              onChange={(e) => {
                setSelectedActor(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{locale === "uz" ? "Barcha xodimlar" : "Все пользователи"}</option>
              {filters.actors.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.fullName}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-slate-800/80 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 font-medium">{locale === "uz" ? "Sana oralig'i" : "Период"}:</span>
          </div>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
          />
          <span className="text-slate-500">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="px-2.5 py-1.5 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
          />

          {(search || selectedAction !== "ALL" || selectedResource !== "ALL" || selectedActor !== "ALL" || dateFrom || dateTo) && (
            <button
              onClick={() => {
                setSearch("");
                setSelectedAction("ALL");
                setSelectedResource("ALL");
                setSelectedActor("ALL");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="ml-auto text-xs text-brand-400 hover:text-brand-300 font-semibold"
            >
              {locale === "uz" ? "Filtrlarni tozalash" : "Сбросить фильтры"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">{locale === "uz" ? "Sana va vaqt" : "Время"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Foydalanuvchi" : "Пользователь"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Amal" : "Действие"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Resurs" : "Ресурс"}</th>
                <th className="px-4 py-3">IP</th>
                <th className="px-4 py-3 text-right">{locale === "uz" ? "Tafsilotlar" : "Детали"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    {locale === "uz" ? "Ma'lumotlar yuklanmoqda..." : "Загрузка записей журнала..."}
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    {locale === "uz" ? "Harakatlar jurnali bo'sh" : "Записей аудита не найдено"}
                  </td>
                </tr>
              ) : (
                logs.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {formatDateLocalized(item.createdAt, locale)}
                      <div className="text-[10px] text-slate-500">
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {item.actor ? (
                        <div>
                          <p className="font-semibold text-white">{item.actor.fullName}</p>
                          <p className="text-[11px] text-slate-500">{item.actor.email}</p>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">System / Cron</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold ${getActionBadge(item.action)}`}>
                        {item.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-slate-300">{item.resource}</span>
                      {item.resourceId && (
                        <span className="block text-[10px] text-slate-500 font-mono truncate max-w-[140px]">
                          {item.resourceId}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 whitespace-nowrap">
                      {item.ipAddress || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.detailsJson ? (
                        <button
                          onClick={() => setActiveLog(item)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium inline-flex items-center gap-1 border border-slate-800"
                        >
                          <Eye className="w-3.5 h-3.5 text-brand-400" />
                          <span>{locale === "uz" ? "Ko'rish" : "Инфо"}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="p-4 bg-slate-950/60 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div>
            {locale === "uz" ? "Jami yozuvlar" : "Всего записей"}: <span className="font-bold text-white">{totalCount}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              {locale === "uz" ? "Oldingi" : "Назад"}
            </button>
            <span className="font-semibold text-slate-300">
              {page} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-800"
            >
              {locale === "uz" ? "Keyingi" : "Вперед"}
            </button>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {activeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-brand-400" />
                  {locale === "uz" ? "Harakat tafsilotlari" : "Детали записи аудита"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{activeLog.action} • {activeLog.resource}</p>
              </div>
              <button
                onClick={() => setActiveLog(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/60 border border-slate-800/80">
                <div>
                  <span className="text-slate-500">{locale === "uz" ? "Foydalanuvchi" : "Пользователь"}:</span>
                  <p className="font-bold text-white">{activeLog.actor?.fullName || "System"}</p>
                </div>
                <div>
                  <span className="text-slate-500">IP:</span>
                  <p className="font-mono text-slate-300">{activeLog.ipAddress || "—"}</p>
                </div>
              </div>

              <div>
                <span className="text-slate-400 font-semibold mb-1 block">
                  {locale === "uz" ? "JSON parametrlar" : "Параметры события (JSON)"}:
                </span>
                <pre className="p-3 bg-slate-900 rounded-xl border border-slate-800 font-mono text-[11px] text-emerald-400 overflow-x-auto max-h-60">
                  {JSON.stringify(JSON.parse(activeLog.detailsJson || "{}"), null, 2)}
                </pre>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setActiveLog(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold text-xs border border-slate-800"
              >
                {locale === "uz" ? "Yopish" : "Закрыть"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
