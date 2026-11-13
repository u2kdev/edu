"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Activity, Users, ShieldAlert, LogOut, Search,
  RefreshCw, Laptop, Smartphone, Globe, Clock, CheckCircle2, AlertTriangle, X
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

interface SessionItem {
  id: string;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  lastSeenAt: string;
}

interface MemberActivityItem {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone?: string | null;
  avatarUrl?: string | null;
  role: string;
  memberStatus: string;
  lastLoginAt?: string | null;
  activeSessionsCount: number;
  isOnline: boolean;
  neverLoggedIn: boolean;
  inactiveOver7Days: boolean;
  sessions: SessionItem[];
}

interface ActivitySummary {
  totalMembers: number;
  onlineNow: number;
  hasActiveSessions: number;
  neverLoggedIn: number;
  inactiveOver7Days: number;
}

export function CenterActivityManager({ locale = "ru" }: { locale?: string }) {
  const [users, setUsers] = useState<MemberActivityItem[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    totalMembers: 0,
    onlineNow: 0,
    hasActiveSessions: 0,
    neverLoggedIn: 0,
    inactiveOver7Days: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Revocation modal state
  const [terminatingUser, setTerminatingUser] = useState<MemberActivityItem | null>(null);
  const [revokeReason, setRevokeReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (roleFilter !== "ALL") params.append("role", roleFilter);
      if (statusFilter !== "ALL") params.append("status", statusFilter);

      const res = await fetch(`/api/tenant/activity?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load activity");
      const data = await res.json();
      setUsers(data.users || []);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  const handleRevokeSessions = async () => {
    if (!terminatingUser) return;
    if (revokeReason.trim().length < 5) {
      setActionError(
        locale === "uz"
          ? "Sabab kamida 5 ta belgidan iborat bo'lishi kerak"
          : "Причина должна содержать минимум 5 символов"
      );
      return;
    }

    setSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/tenant/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVOKE_USER_SESSIONS",
          userId: terminatingUser.userId,
          reason: revokeReason,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to terminate sessions");

      setActionSuccess(data.message || "Sessions terminated");
      setTerminatingUser(null);
      setRevokeReason("");
      fetchActivity();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error terminating sessions";
      setActionError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getDeviceIcon = (userAgent?: string | null) => {
    const ua = (userAgent || "").toLowerCase();
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
      return <Smartphone className="w-3.5 h-3.5 text-blue-400" />;
    }
    return <Laptop className="w-3.5 h-3.5 text-purple-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Activity className="w-7 h-7 text-brand-400" />
            {locale === "uz" ? "Foydalanuvchilar faolligi va sessiyalar" : "Активность людей и сессии"}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {locale === "uz"
              ? "Tizimga kirish tarixi, faol qurilmalar va xavfsiz sessiyalarni boshqarish"
              : "История входов, мониторинг активных устройств и принудительное завершение сессий"}
          </p>
        </div>

        <button
          onClick={() => fetchActivity()}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors self-start sm:self-auto"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-brand-400" : ""}`} />
        </button>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-500 hover:text-emerald-400">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Summary KPI Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {locale === "uz" ? "Jami a'zolar" : "Всего пользователей"}
          </span>
          <div className="text-2xl font-bold text-white mt-1">{summary.totalMembers}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {locale === "uz" ? "Hozir tarmoqda" : "Сейчас онлайн"}
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-1 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            {summary.onlineNow}
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {locale === "uz" ? "Faol sessiyalar" : "Активные сессии"}
          </span>
          <div className="text-2xl font-bold text-brand-400 mt-1">{summary.hasActiveSessions}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {locale === "uz" ? "7 kundan beri kirmagan" : "Не заходили > 7 дн."}
          </span>
          <div className="text-2xl font-bold text-amber-400 mt-1">{summary.inactiveOver7Days}</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            {locale === "uz" ? "Hech kirmagan" : "Никогда не входили"}
          </span>
          <div className="text-2xl font-bold text-rose-400 mt-1">{summary.neverLoggedIn}</div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={locale === "uz" ? "Ism, email yoki telefon bo'yicha..." : "Поиск по имени, email, телефону..."}
              className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{locale === "uz" ? "Barcha rollar" : "Все роли"}</option>
              <option value="DIRECTOR">{locale === "uz" ? "Direktor" : "Директор"}</option>
              <option value="CENTER_ADMIN">{locale === "uz" ? "Administrator" : "Администратор"}</option>
              <option value="TEACHER">{locale === "uz" ? "O'qituvchi" : "Учитель"}</option>
              <option value="STUDENT">{locale === "uz" ? "O'quvchi" : "Ученик"}</option>
              <option value="PARENT">{locale === "uz" ? "Ota-ona" : "Родитель"}</option>
            </select>
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">{locale === "uz" ? "Barcha statuslar" : "Все статусы"}</option>
              <option value="ONLINE">{locale === "uz" ? "Faqat faol sessiyalar" : "Только с активными сессиями"}</option>
              <option value="INACTIVE_7D">{locale === "uz" ? "7 kundan ortiq nofaol" : "Не заходили более 7 дней"}</option>
              <option value="NEVER">{locale === "uz" ? "Hech qachon kirmagan" : "Никогда не входили"}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Users & Sessions List */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800 uppercase font-semibold">
              <tr>
                <th className="px-4 py-3">{locale === "uz" ? "Foydalanuvchi" : "Пользователь"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Rol" : "Роль"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Oxirgi kirish" : "Последний вход"}</th>
                <th className="px-4 py-3">{locale === "uz" ? "Faol qurilmalar" : "Сессии и устройства"}</th>
                <th className="px-4 py-3 text-right">{locale === "uz" ? "Amallar" : "Действия"}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-brand-500 mb-2" />
                    {locale === "uz" ? "Faollik yuklanmoqda..." : "Загрузка журнала активности..."}
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                    {locale === "uz" ? "Foydalanuvchilar topilmadi" : "Пользователи не найдены"}
                  </td>
                </tr>
              ) : (
                users.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-300">
                          {item.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-white">{item.fullName}</span>
                            {item.isOnline && (
                              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500">{item.email} {item.phone ? `• ${item.phone}` : ""}</p>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {item.role}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {item.lastLoginAt ? (
                        <div>
                          <span>{formatDateLocalized(item.lastLoginAt, locale)}</span>
                          <span className="block text-[10px] text-slate-500">
                            {new Date(item.lastLoginAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-600 italic">
                          {locale === "uz" ? "Hech kirmagan" : "Никогда"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {item.sessions.length > 0 ? (
                        <div className="space-y-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-brand-500/10 text-brand-400 border border-brand-500/20 inline-block mb-1">
                            {item.sessions.length} {locale === "uz" ? "ta qurilma" : "активных сессий"}
                          </span>
                          <div className="space-y-0.5">
                            {item.sessions.slice(0, 2).map((s) => (
                              <div key={s.id} className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                                {getDeviceIcon(s.userAgent)}
                                <span>{s.ipAddress || "local"}</span>
                                <span className="text-slate-600 text-[10px]">
                                  ({new Date(s.lastSeenAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {item.activeSessionsCount > 0 ? (
                        <button
                          onClick={() => {
                            setTerminatingUser(item);
                            setRevokeReason("Завершено директором центра в целях безопасности");
                          }}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-semibold text-xs border border-rose-500/20 transition-all flex items-center gap-1.5 ml-auto"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{locale === "uz" ? "Sessiyalarni yopish" : "Завершить сессии"}</span>
                        </button>
                      ) : (
                        <span className="text-slate-600 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revocation Confirmation Modal */}
      {terminatingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                {locale === "uz" ? "Sessiyalarni yakunlash" : "Завершение сессий пользователя"}
              </h3>
              <button
                onClick={() => setTerminatingUser(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              {locale === "uz"
                ? `Haqiqatan ham ${terminatingUser.fullName} foydalanuvchisining barcha faol qurilmalaridagi sessiyalarini yakunlamoqchimisiz? Foydalanuvchi tizimdan chiqarib yuboriladi.`
                : `Вы действительно хотите принудительно завершить все ${terminatingUser.activeSessionsCount} активных сессий пользователя ${terminatingUser.fullName}? Все открытые вкладки и приложения будут деавторизованы.`}
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">
                {locale === "uz" ? "Majburiy sabab (kamida 5 belgi)" : "Причина действия (мин. 5 символов)"}:
              </label>
              <textarea
                value={revokeReason}
                onChange={(e) => setRevokeReason(e.target.value)}
                rows={3}
                className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-500"
                placeholder={locale === "uz" ? "Sababni kiriting..." : "Укажите причину для журнала аудита..."}
              />
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setTerminatingUser(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl font-semibold text-xs border border-slate-800"
              >
                {locale === "uz" ? "Bekor qilish" : "Отмена"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleRevokeSessions}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold text-xs transition-all shadow-lg shadow-rose-950/20 disabled:opacity-50"
              >
                {submitting
                  ? (locale === "uz" ? "Bajarilmoqda..." : "Завершение...")
                  : (locale === "uz" ? "Sessiyalarni yopish" : "Завершить сессии")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
