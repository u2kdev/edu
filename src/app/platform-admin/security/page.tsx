"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ShieldAlert,
  Users,
  Activity,
  Lock,
  Unlock,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Laptop,
  CheckCircle2,
} from "lucide-react";

interface SecurityStats {
  activeSessionsCount: number;
  failedAttemptsCount: number;
  lockedIpsCount: number;
  blockedUsersCount: number;
}

interface ActiveSessionItem {
  id: string;
  userId: string;
  deviceId: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
  user: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  };
}

interface FailedLoginItem {
  id: string;
  email: string;
  ip: string;
  attempts: number;
  lockoutUntil: string | null;
  updatedAt: string;
}

interface BlockedAccountItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  platformRole: string;
  isActive: boolean;
  deletedAt: string | null;
  deletedReason: string | null;
  updatedAt: string;
}

export default function PlatformSecurityPage() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [failedLogins, setFailedLogins] = useState<FailedLoginItem[]>([]);
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccountItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "attempts" | "blocked">("sessions");

  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);

  const fetchSecurityData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/security");
      const data = await res.json();
      if (data.success) {
        setStats(data.stats);
        setActiveSessions(data.activeSessions || []);
        setFailedLogins(data.failedLogins || []);
        setBlockedAccounts(data.blockedAccounts || []);
      } else {
        setError(data.error || "Не удалось загрузить данные безопасности");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSecurityData();
  }, [fetchSecurityData]);

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm("Принудительно завершить эту сессию пользователя?")) return;
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/platform/security/sessions/${sessionId}/revoke`, {
        method: "POST",
      });
      if (res.ok) {
        fetchSecurityData();
      } else {
        const d = await res.json();
        alert(d.error || "Ошибка завершения сессии");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setRevokingId(null);
    }
  };

  const handleResetLockout = async (id: string) => {
    setResettingId(id);
    try {
      const res = await fetch("/api/platform/security/reset-lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        fetchSecurityData();
      } else {
        const d = await res.json();
        alert(d.error || "Ошибка сброса блокировки");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setResettingId(null);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg text-rose-600 dark:text-rose-400">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Мониторинг безопасности и сессий
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Контроль активных авторизаций, неудачных попыток входа и блокировок
            </p>
          </div>
        </div>

        <button
          onClick={fetchSecurityData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Активных сессий
              </span>
              <Activity className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
              {stats.activeSessionsCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Авторизованные браузеры и приложения</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Неудачных логинов
              </span>
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold text-amber-600 mt-2">
              {stats.failedAttemptsCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Зафиксировано в журнале попыток</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Временных блокировок IP
              </span>
              <Lock className="w-5 h-5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold text-rose-600 mt-2">
              {stats.lockedIpsCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Превышен лимит 5 ошибок за 15 мин</div>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Заблокировано аккаунтов
              </span>
              <Users className="w-5 h-5 text-zinc-500" />
            </div>
            <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-2">
              {stats.blockedUsersCount}
            </div>
            <div className="text-xs text-zinc-400 mt-1">Деактивировано или удалено</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setActiveTab("sessions")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "sessions"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Активные сессии ({activeSessions.length})
        </button>
        <button
          onClick={() => setActiveTab("attempts")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "attempts"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Попытки входа и блокировки ({failedLogins.length})
        </button>
        <button
          onClick={() => setActiveTab("blocked")}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition ${
            activeTab === "blocked"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          }`}
        >
          Заблокированные аккаунты ({blockedAccounts.length})
        </button>
      </div>

      {/* TAB 1: SESSIONS */}
      {activeTab === "sessions" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 uppercase font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">IP-адрес</th>
                  <th className="px-4 py-3">Устройство / Браузер</th>
                  <th className="px-4 py-3">Последняя активность</th>
                  <th className="px-4 py-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {activeSessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                      Нет активных сессий
                    </td>
                  </tr>
                ) : (
                  activeSessions.map((s) => (
                    <tr key={s.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {s.user.fullName}
                        </div>
                        <div className="text-zinc-400 text-[11px]">{s.user.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {s.ipAddress || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 max-w-xs truncate">
                        <span className="inline-flex items-center gap-1.5">
                          <Laptop className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          {s.userAgent || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-500 font-mono">
                        {new Date(s.lastSeenAt).toLocaleString("ru-RU")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          disabled={revokingId === s.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:text-rose-400 rounded-lg transition disabled:opacity-50"
                        >
                          <LogOut className="w-3 h-3" />
                          {revokingId === s.id ? "Выход..." : "Завершить"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FAILED ATTEMPTS & LOCKOUTS */}
      {activeTab === "attempts" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 uppercase font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">IP-адрес</th>
                  <th className="px-4 py-3">Число ошибок</th>
                  <th className="px-4 py-3">Статус блокировки</th>
                  <th className="px-4 py-3">Время последней попытки</th>
                  <th className="px-4 py-3 text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {failedLogins.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                      Неудачных попыток входа не зафиксировано
                    </td>
                  </tr>
                ) : (
                  failedLogins.map((item) => {
                    const isLocked = item.lockoutUntil && new Date(item.lockoutUntil) > new Date();
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                        <td className="px-4 py-3 font-semibold text-zinc-900 dark:text-zinc-100">
                          {item.email}
                        </td>
                        <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                          {item.ip}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded font-semibold ${
                              item.attempts >= 5
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}
                          >
                            {item.attempts}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {isLocked ? (
                            <span className="inline-flex items-center gap-1 text-rose-600 font-semibold">
                              <Lock className="w-3 h-3" /> Заблокирован до{" "}
                              {new Date(item.lockoutUntil!).toLocaleTimeString("ru-RU")}
                            </span>
                          ) : (
                            <span className="text-zinc-400">Активен</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-zinc-500 font-mono">
                          {new Date(item.updatedAt).toLocaleString("ru-RU")}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleResetLockout(item.id)}
                            disabled={resettingId === item.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:text-indigo-400 rounded-lg transition disabled:opacity-50"
                          >
                            <Unlock className="w-3 h-3" />
                            {resettingId === item.id ? "Сброс..." : "Сбросить"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: BLOCKED ACCOUNTS */}
      {activeTab === "blocked" && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 uppercase font-semibold text-zinc-500 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Роль платформы</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Причина блокировки / удаления</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {blockedAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-400">
                      Заблокированных аккаунтов нет
                    </td>
                  </tr>
                ) : (
                  blockedAccounts.map((acc) => (
                    <tr key={acc.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {acc.fullName}
                        </div>
                        <div className="text-zinc-400 text-[11px]">{acc.email}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">
                        {acc.phone || "—"}
                      </td>
                      <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                        {acc.platformRole}
                      </td>
                      <td className="px-4 py-3">
                        {acc.deletedAt ? (
                          <span className="px-2 py-0.5 rounded bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 font-semibold text-[10px]">
                            УДАЛЁН
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400 font-semibold text-[10px]">
                            ЗАБЛОКИРОВАН
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">
                        {acc.deletedReason || "Не указана"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
