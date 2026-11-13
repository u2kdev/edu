"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  UserPlus,
  Search,
  Filter,
  Download,
  Building2,
  User,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface RegistrationItem {
  id: string;
  kind: "USER" | "CENTER";
  name: string;
  email: string | null;
  phone: string | null;
  role?: string;
  centerName?: string;
  centerSlug?: string;
  emailVerified: boolean;
  createdAt: string;
}

export default function PlatformRegistrationsPage() {
  const [items, setItems] = useState<RegistrationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [type, setType] = useState("ALL");
  const [emailVerified, setEmailVerified] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRegistrations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "25",
        ...(search && { search }),
        ...(type !== "ALL" && { type }),
        ...(emailVerified !== "ALL" && { emailVerified }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/registrations?${q}`);
      const data = await res.json();
      if (data.success) {
        setItems(data.registrations || []);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Не удалось загрузить данные регистраций");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [page, search, type, emailVerified, dateFrom, dateTo]);

  useEffect(() => {
    fetchRegistrations();
  }, [fetchRegistrations]);

  const exportUrl = `/api/platform/registrations/export?${new URLSearchParams({
    ...(search && { search }),
    ...(type !== "ALL" && { type }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }).toString()}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Регистрации на платформе
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Хронология создания новых аккаунтов пользователей и регистрации учебных центров
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Экспорт CSV</span>
          </a>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="ФИО, название центра, email, телефон..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Type Filter */}
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="ALL">Все объекты (Пользователи и Центры)</option>
          <option value="USERS">Только пользователи</option>
          <option value="CENTERS">Только учебные центры</option>
        </select>

        {/* Email verification status */}
        <select
          value={emailVerified}
          onChange={(e) => {
            setEmailVerified(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="ALL">Email: Все</option>
          <option value="VERIFIED">Email подтверждён</option>
          <option value="UNVERIFIED">Email не подтверждён</option>
        </select>

        {/* Date From & To */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
        />
        <span className="text-slate-400 text-xs">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка регистраций...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Регистраций не найдено</h3>
          <p className="text-sm text-slate-500 mt-1">По заданным фильтрам событий не обнаружено.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left px-6 py-3.5">Тип</th>
                  <th className="text-left px-6 py-3.5">Имя / Название</th>
                  <th className="text-left px-6 py-3.5">Контакты</th>
                  <th className="text-left px-6 py-3.5">Роль / Привязка</th>
                  <th className="text-center px-6 py-3.5">Email подтверждён</th>
                  <th className="text-right px-6 py-3.5">Дата регистрации</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => (
                  <tr key={`${it.kind}-${it.id}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4">
                      {it.kind === "CENTER" ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Building2 className="w-3.5 h-3.5" />
                          Центр
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          <User className="w-3.5 h-3.5" />
                          Пользователь
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {it.kind === "CENTER" ? (
                        <Link
                          href={`/platform-admin/centers/${it.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 block"
                        >
                          {it.name}
                        </Link>
                      ) : (
                        <Link
                          href={`/platform-admin/users/${it.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 block"
                        >
                          {it.name}
                        </Link>
                      )}
                      {it.centerSlug && (
                        <div className="text-xs text-slate-400 font-mono mt-0.5">{it.centerSlug}</div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      <div>{it.email || "—"}</div>
                      <div className="text-slate-400 mt-0.5">{it.phone || ""}</div>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      <div className="font-semibold text-slate-800">{it.role || "—"}</div>
                      {it.centerName && <div className="text-slate-500 mt-0.5">{it.centerName}</div>}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {it.emailVerified ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          Да
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <XCircle className="w-4 h-4 text-slate-300" />
                          Нет
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right text-xs text-slate-600">
                      <div className="font-medium text-slate-900">
                        {new Date(it.createdAt).toLocaleDateString()}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                  </tr>
                ))}
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
    </div>
  );
}
