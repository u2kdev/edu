"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Shield,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  User,
  ChevronLeft,
  ChevronRight,
  Code,
  X,
  Copy,
  Check,
} from "lucide-react";

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  } | null;
  center: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function PlatformAuditInteractive() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [resource, setResource] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // JSON modal
  const [selectedDetails, setSelectedDetails] = useState<{ action: string; json: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(action && { action }),
        ...(resource && { resource }),
        ...(ipAddress && { ipAddress }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/audit?${q}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
        setDistinctActions(data.distinctActions || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalCount(data.pagination?.totalCount || 0);
      } else {
        setError(data.error || "Не удалось загрузить журнал аудита");
      }
    } catch {
      setError("Ошибка соединения с сервером");
    } finally {
      setLoading(false);
    }
  }, [page, search, action, resource, ipAddress, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleExportCSV = () => {
    const q = new URLSearchParams({
      ...(search && { search }),
      ...(action && { action }),
      ...(resource && { resource }),
      ...(ipAddress && { ipAddress }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
    });
    window.location.href = `/api/platform/audit/export?${q}`;
  };

  const handleCopyJSON = () => {
    if (!selectedDetails) return;
    navigator.clipboard.writeText(selectedDetails.json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Toolbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Поиск по действию, ID, IP или деталям..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <Download className="w-4 h-4 text-zinc-400" />
            Экспорт в CSV
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
          <div>
            <label className="block text-zinc-500 mb-1">Действие</label>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Все действия</option>
              {distinctActions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">Сущность / Ресурс</label>
            <input
              type="text"
              placeholder="Например: PlatformUser"
              value={resource}
              onChange={(e) => {
                setResource(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">С даты</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-zinc-500 mb-1">По дату</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* JSON Viewer Modal */}
      {selectedDetails && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Code className="w-5 h-5 text-indigo-600" />
                Детали события: {selectedDetails.action}
              </h3>
              <button
                onClick={() => setSelectedDetails(null)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative">
              <pre className="p-4 rounded-xl bg-zinc-950 text-zinc-100 text-xs font-mono overflow-x-auto max-h-96">
                {selectedDetails.json}
              </pre>
              <button
                onClick={handleCopyJSON}
                className="absolute top-3 right-3 p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-xs flex items-center gap-1.5 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedDetails(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
