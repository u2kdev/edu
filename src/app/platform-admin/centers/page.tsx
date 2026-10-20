"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Search,
  Plus,
  Filter,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import ImpersonateButton from "@/components/ImpersonateButton";

interface CenterListItem {
  id: string;
  name: string;
  slug: string;
  email?: string | null;
  phone?: string | null;
  status: string;
  owner?: { id: string; fullName: string; email: string } | null;
}

export default function PlatformCentersPage() {
  const [centers, setCenters] = useState<CenterListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchCenters = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(debouncedSearch && { q: debouncedSearch }),
        ...(status && { status }),
      });
      const res = await fetch(`/api/platform/centers?${query}`);
      if (!res.ok) throw new Error("Не удалось загрузить список центров");
      const json = await res.json();
      setCenters(json.items || json.data || []);
      setTotalPages(Math.ceil((json.total || 0) / (json.pageSize || 10)) || json.meta?.totalPages || 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    fetchCenters();
  }, [fetchCenters]);

  const statusBadges: Record<string, { bg: string; text: string; border: string }> = {
    ACTIVE: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    TRIAL: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    PAUSED: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    BLOCKED: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200" },
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Учебные центры
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Управление организациями, статусами доступа и техническая поддержка на платформе e-darischi
          </p>
        </div>
        <Link
          href="/platform-admin/centers/create"
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Добавить центр</span>
        </Link>
      </div>

      {/* Search & Status Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по названию, slug или email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-colors"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400 shrink-0" />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="w-full md:w-48 py-2.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 cursor-pointer"
          >
            <option value="">Все статусы</option>
            <option value="ACTIVE">ACTIVE (Активные)</option>
            <option value="TRIAL">TRIAL (Пробный)</option>
            <option value="PAUSED">PAUSED (Замороженные)</option>
            <option value="BLOCKED">BLOCKED (Заблокированные)</option>
          </select>
        </div>
      </div>

      {/* Centers Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка списка учебных центров...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : centers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Центры не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">
            По вашему запросу не найдено ни одной организации. Попробуйте изменить фильтры.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                  <th className="text-left px-6 py-3.5">Организация</th>
                  <th className="text-left px-6 py-3.5">Контакты</th>
                  <th className="text-left px-6 py-3.5">Статус</th>
                  <th className="text-right px-6 py-3.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {centers.map((center) => {
                  const badge = statusBadges[center.status] || {
                    bg: "bg-slate-100",
                    text: "text-slate-700",
                    border: "border-slate-200",
                  };
                  return (
                    <tr key={center.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <Link
                          href={`/platform-admin/centers/${center.id}`}
                          className="font-semibold text-slate-900 hover:text-blue-600 transition-colors block"
                        >
                          {center.name}
                        </Link>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">{center.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-slate-800">{center.email || "—"}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{center.phone || "—"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                        >
                          {center.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          {center.owner?.id && (
                            <ImpersonateButton targetUserId={center.owner.id} targetCenterId={center.id} />
                          )}
                          <Link
                            href={`/platform-admin/centers/${center.id}`}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            Карточка
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
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
