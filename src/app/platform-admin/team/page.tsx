"use client";

import { useEffect, useState } from "react";
import {
  UserCheck,
  Plus,
  Shield,
  ShieldAlert,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  Copy,
  RefreshCw,
  X,
  Sparkles,
} from "lucide-react";

interface TeamMember {
  id: string;
  email: string;
  fullName: string;
  username: string | null;
  phone: string | null;
  platformRole: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function PlatformTeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // Add modal state
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | "SEO_ADMIN">("PLATFORM_ADMIN");
  const [addPassword, setAddPassword] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ email: string; password?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/team");
      const json = await res.json();
      if (res.ok && json.success) {
        setMembers(json.members);
      } else {
        setErrorBanner(json.error || "Не удалось загрузить сотрудников платформы");
      }
    } catch {
      setErrorBanner("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingMember(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/platform/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: addFullName,
          email: addEmail,
          role: addRole,
          password: addPassword || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Ошибка при добавлении сотрудника");
        return;
      }

      setNewCredentials({
        email: json.member.email,
        password: json.initialPassword,
      });
      fetchMembers();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setAddingMember(false);
    }
  };

  const handleToggleActive = async (member: TeamMember) => {
    const newState = !member.isActive;
    if (!confirm(`${newState ? "Разблокировать" : "Заблокировать"} сотрудника ${member.fullName}?`)) return;

    try {
      const res = await fetch("/api/platform/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, isActive: newState }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось изменить статус сотрудника");
        return;
      }
      setSuccessBanner(newState ? "Сотрудник разблокирован" : "Сотрудник заблокирован");
      fetchMembers();
    } catch {
      setErrorBanner("Ошибка сети");
    }
  };

  const handleChangeRole = async (member: TeamMember, newRole: string) => {
    if (!confirm(`Изменить платформенную роль для ${member.fullName} на ${newRole}?`)) return;

    try {
      const res = await fetch("/api/platform/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: member.id, role: newRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось изменить роль сотрудника");
        return;
      }
      setSuccessBanner("Роль успешно изменена");
      fetchMembers();
    } catch {
      setErrorBanner("Ошибка сети");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <UserCheck className="w-7 h-7 text-blue-600" />
            Команда платформы
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Управление системными администраторами и сотрудниками поддержки платформы
          </p>
        </div>

        <button
          onClick={() => {
            setNewCredentials(null);
            setAddFullName("");
            setAddEmail("");
            setAddPassword("");
            setIsAddOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Добавить сотрудника
        </button>
      </div>

      {errorBanner && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Сотрудник</th>
                <th className="py-3 px-4">Платформенная роль</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4">Последний вход</th>
                <th className="py-3 px-4">Добавлен</th>
                <th className="py-3 px-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Загрузка команды...
                  </td>
                </tr>
              ) : members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Сотрудники не найдены
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900">{member.fullName}</div>
                      <div className="text-xs text-slate-400">{member.email}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {member.platformRole === "SUPERADMIN" ? (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                          SUPERADMIN (Владелец)
                        </span>
                      ) : (
                        <select
                          value={member.platformRole}
                          onChange={(e) => handleChangeRole(member, e.target.value)}
                          className="px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none font-semibold text-slate-700"
                        >
                          <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                          <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
                          <option value="SEO_ADMIN">SEO_ADMIN</option>
                        </select>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {member.isActive ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <Check className="w-3.5 h-3.5" /> Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600">
                          <ShieldAlert className="w-3.5 h-3.5" /> Заблокирован
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {member.lastLoginAt
                        ? new Date(member.lastLoginAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Никогда"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {new Date(member.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {member.platformRole !== "SUPERADMIN" && (
                        <button
                          onClick={() => handleToggleActive(member)}
                          className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                            member.isActive
                              ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                              : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          }`}
                        >
                          {member.isActive ? "Заблокировать" : "Разблокировать"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Member Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            {newCredentials ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Сотрудник добавлен</h2>
                    <p className="text-xs text-slate-500">Временные учетные данные</p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  <p className="font-semibold">Показывается один раз!</p>
                  <p className="mt-0.5">
                    Скопируйте пароль сейчас. При первом входе сотрудник будет обязан сменить его.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs space-y-1">
                  <div>
                    <span className="text-slate-400">Email: </span>
                    <span className="font-bold text-slate-900">{newCredentials.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Пароль: </span>
                    <span className="font-bold text-blue-600">{newCredentials.password}</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!newCredentials) return;
                    navigator.clipboard.writeText(
                      `Email: ${newCredentials.email}\nПароль: ${newCredentials.password}`
                    );
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 shadow-sm"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Скопировано!" : "Копировать данные"}
                </button>

                <button
                  onClick={() => {
                    setIsAddOpen(false);
                    setNewCredentials(null);
                  }}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900">Добавить сотрудника платформы</h2>
                  <button onClick={() => setIsAddOpen(false)} className="text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    ФИО *
                  </label>
                  <input
                    type="text"
                    required
                    value={addFullName}
                    onChange={(e) => setAddFullName(e.target.value)}
                    placeholder="Рустам Каримов"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="staff@platform.uz"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Роль сотрудника *
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | "SEO_ADMIN")}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Администратор платформы)</option>
                    <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT (Служба поддержки)</option>
                    <option value="SEO_ADMIN">SEO_ADMIN (SEO-администратор)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Пароль (пусто для автогенерации)
                  </label>
                  <input
                    type="text"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Автогенерация 16 символов"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={addingMember}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
                  >
                    {addingMember ? "Создание..." : "Создать сотрудника"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
