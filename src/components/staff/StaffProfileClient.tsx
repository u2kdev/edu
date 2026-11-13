"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Shield,
  Key,
  Users,
  History,
  Mail,
  Phone,
  Calendar,
  Lock,
  Unlock,
  Archive,
  Send,
  AlertTriangle,
  CheckCircle,
  Clock,
  Laptop,
} from "lucide-react";
import { t } from "@/i18n";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";

interface SessionItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  createdAt: string;
  actorRole: string | null;
  details: Record<string, unknown> | null;
}

interface StaffProfileClientProps {
  membership: {
    id: string;
    role: string;
    status: string;
    joinedAt: string;
  };
  user: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    avatarUrl: string | null;
    preferredLanguage: string;
    lastLoginAt: string | null;
    createdAt: string;
  };
  groups: Array<{ id: string; name: string }>;
  activeSessions: SessionItem[];
  auditLogs: AuditLogItem[];
  manageability: {
    canManage: boolean;
    isShared: boolean;
    reason?: string;
  };
  actorRole: string;
  locale: string;
}

export function StaffProfileClient({
  membership: initialMembership,
  user: initialUser,
  groups,
  activeSessions,
  auditLogs,
  manageability,
  actorRole,
  locale,
}: StaffProfileClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"profile" | "access" | "groups" | "history">("profile");

  const [membership, setMembership] = useState(initialMembership);
  const [user, setUser] = useState(initialUser);

  // Profile Edit State
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [username, setUsername] = useState(user.username || "");
  const [preferredLanguage, setPreferredLanguage] = useState(user.preferredLanguage || "ru");
  const [role, setRole] = useState(membership.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Access Actions State
  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reason Modal for Block / Archive
  const [reasonModalOpen, setReasonModalOpen] = useState<"BLOCK" | "UNBLOCK" | "ARCHIVE" | null>(null);
  const [reasonText, setReasonText] = useState("");

  const isDirector = actorRole === "DIRECTOR";
  const canEditRole = isDirector;

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const res = await fetch(`/api/tenant/users/${membership.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          phone: phone || null,
          email: email || null,
          username: username || null,
          preferredLanguage,
          ...(canEditRole ? { role } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Ошибка сохранения");
      }

      setProfileSuccess(true);
      setUser((prev) => ({
        ...prev,
        fullName,
        phone: phone || null,
        email: email || null,
        username: username || null,
        preferredLanguage,
      }));
      if (canEditRole) {
        setMembership((prev) => ({ ...prev, role }));
      }
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err: unknown) {
      setProfileError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setSavingProfile(false);
    }
  };

  // Reset Password Action
  const handleResetPassword = async () => {
    if (!window.confirm("Сбросить пароль сотрудника? Все текущие сессии будут завершены.")) {
      return;
    }

    setActionLoading(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tenant/users/${membership.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось сбросить пароль");
      }

      setNewCredentials(data.credentials);
      setCredentialsModalOpen(true);
      setActionNotice({ type: "success", text: "Пароль успешно сброшен" });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  // Send Reset Link
  const handleSendResetLink = async () => {
    setActionLoading(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tenant/users/${membership.id}/send-reset-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Не удалось отправить ссылку");
      }

      setActionNotice({
        type: "success",
        text: data.resetUrl
          ? `Ссылка создана: ${data.resetUrl}`
          : "Ссылка для сброса пароля успешно отправлена",
      });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  // Execute Block / Unblock / Archive
  const handleStatusAction = async () => {
    if (!reasonModalOpen) return;
    if (reasonText.trim().length < 5) {
      alert("Причина обязательна (минимум 5 символов)");
      return;
    }

    setActionLoading(true);
    setActionNotice(null);

    try {
      if (reasonModalOpen === "ARCHIVE") {
        const res = await fetch(`/api/tenant/users/${membership.id}?reason=${encodeURIComponent(reasonText)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка архивации");

        setMembership((prev) => ({ ...prev, status: "ARCHIVED" }));
        setActionNotice({ type: "success", text: "Сотрудник архивирован" });
      } else {
        const newStatus = reasonModalOpen === "BLOCK" ? "BLOCKED" : "ACTIVE";
        const res = await fetch(`/api/tenant/users/${membership.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: newStatus,
            reason: reasonText,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка изменения статуса");

        setMembership((prev) => ({ ...prev, status: newStatus }));
        setActionNotice({
          type: "success",
          text: newStatus === "BLOCKED" ? "Сотрудник заблокирован" : "Сотрудник разблокирован",
        });
      }

      setReasonModalOpen(null);
      setReasonText("");
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/center/staff"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t(locale, "common.back")}</span>
        </Link>
      </div>

      {/* Header Profile Card */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <User className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">{user.fullName}</h1>
              {manageability.isShared && (
                <span className="px-2 py-0.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-full text-[10px] font-semibold">
                  Общий аккаунт
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-brand-400" />
                {membership.role}
              </span>
              {user.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  {user.email}
                </span>
              )}
              {user.phone && (
                <span className="flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  {user.phone}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                {new Date(membership.joinedAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1 rounded-full text-xs font-semibold border ${
              membership.status === "ACTIVE"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                : membership.status === "BLOCKED"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                : "bg-slate-500/10 border-slate-500/20 text-slate-400"
            }`}
          >
            {membership.status === "ACTIVE"
              ? "Активен"
              : membership.status === "BLOCKED"
              ? "Заблокирован"
              : "В архиве"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-2">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "profile"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <User className="w-4 h-4" />
          <span>Профиль</span>
        </button>
        <button
          onClick={() => setActiveTab("access")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "access"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Доступ и безопасность</span>
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "groups"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Группы ({groups.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === "history"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          <span>История ({auditLogs.length})</span>
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 max-w-2xl">
          {manageability.isShared && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Пользователь состоит в нескольких центрах</strong>
                Смена контактных данных (email, телефон, логин) возможна только самим пользователем в настройках его аккаунта.
              </div>
            </div>
          )}

          {profileSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Профиль успешно сохранен</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">ФИО</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Телефон</label>
                <input
                  type="text"
                  value={phone}
                  disabled={manageability.isShared}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-50 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  disabled={manageability.isShared}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-50 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Имя пользователя (логин)</label>
                <input
                  type="text"
                  value={username}
                  disabled={manageability.isShared}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-50 focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Язык интерфейса</label>
                <select
                  value={preferredLanguage}
                  onChange={(e) => setPreferredLanguage(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="ru">Русский</option>
                  <option value="uz-Latn">O&apos;zbekcha</option>
                </select>
              </div>
            </div>

            {canEditRole && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Роль в центре</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="CENTER_ADMIN">Администратор центра</option>
                  <option value="ACCOUNTANT">Бухгалтер</option>
                  <option value="TEACHER">Преподаватель</option>
                  <option value="TEACHER_ASSISTANT">Помощник преподавателя</option>
                  <option value="CENTER_SUPPORT">Служба поддержки</option>
                </select>
              </div>
            )}

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg transition-colors disabled:opacity-50"
              >
                {savingProfile ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Access & Security */}
      {activeTab === "access" && (
        <div className="space-y-6 max-w-3xl">
          {actionNotice && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 border ${
                actionNotice.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-400"
              }`}
            >
              {actionNotice.type === "success" ? <CheckCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span>{actionNotice.text}</span>
            </div>
          )}

          {/* Login Status Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Key className="w-4 h-4 text-brand-400" />
              <span>Статус учетной записи</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Последний вход</span>
                <div className="text-sm font-bold text-white mt-1">
                  {user.lastLoginAt ? (
                    new Date(user.lastLoginAt).toLocaleString()
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs">
                      <Clock className="w-3 h-3" />
                      Ни разу не входил
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800/80">
                <span className="text-slate-400 block text-[11px] uppercase tracking-wider">Тип аккаунта</span>
                <div className="text-sm font-bold text-white mt-1">
                  {manageability.isShared ? "Общий аккаунт (несколько центров)" : "Локальный аккаунт центра"}
                </div>
              </div>
            </div>

            {/* Password Operations */}
            <div className="pt-2 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Действия с паролем:</div>
              <div className="flex flex-wrap gap-3">
                {manageability.canManage ? (
                  <button
                    onClick={handleResetPassword}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
                  >
                    <Key className="w-4 h-4" />
                    <span>Сбросить пароль (показать новый)</span>
                  </button>
                ) : (
                  <div className="text-xs text-amber-400/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div>
                      {manageability.reason}
                      <div className="mt-1">
                        Вы можете отправить пользователю ссылку для самостоятельного сброса пароля.
                      </div>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSendResetLink}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700 transition-colors disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>Отправить ссылку сброса (Email/SMS)</span>
                </button>
              </div>
            </div>

            {/* Block / Unblock / Archive */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <div className="text-xs font-semibold text-slate-300">Статус членства в центре:</div>
              <div className="flex flex-wrap gap-3">
                {membership.status === "ACTIVE" ? (
                  <button
                    onClick={() => {
                      setReasonModalOpen("BLOCK");
                      setReasonText("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-bold rounded-xl border border-rose-500/30 transition-colors"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Заблокировать в центре</span>
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setReasonModalOpen("UNBLOCK");
                      setReasonText("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl border border-emerald-500/30 transition-colors"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Разблокировать в центре</span>
                  </button>
                )}

                {membership.status !== "ARCHIVED" && (
                  <button
                    onClick={() => {
                      setReasonModalOpen("ARCHIVE");
                      setReasonText("");
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700 transition-colors"
                  >
                    <Archive className="w-4 h-4" />
                    <span>Архивировать</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Laptop className="w-4 h-4 text-brand-400" />
              <span>Активные сессии в этом центре ({activeSessions.length})</span>
            </h3>

            {activeSessions.length === 0 ? (
              <p className="text-xs text-slate-400">Нет активных сессий</p>
            ) : (
              <div className="divide-y divide-slate-800/60">
                {activeSessions.map((session) => (
                  <div key={session.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <div className="font-mono text-slate-300">{session.ipAddress || "Неизвестный IP"}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-sm">
                        {session.userAgent || "Браузер"}
                      </div>
                    </div>
                    <div className="text-right text-[11px] text-slate-400">
                      <div>Создана: {new Date(session.createdAt).toLocaleDateString()}</div>
                      <div>Истекает: {new Date(session.expiresAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Groups */}
      {activeTab === "groups" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4 max-w-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            <span>Назначенные группы</span>
          </h3>

          {groups.length === 0 ? (
            <p className="text-xs text-slate-400">Преподаватель не назначен ни в одну группу</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {groups.map((group) => (
                <div key={group.id} className="py-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">{group.name}</span>
                  <Link
                    href={`/center/groups`}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium"
                  >
                    К группе
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: History / Audit */}
      {activeTab === "history" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-brand-400" />
            <span>История действий (AuditLog)</span>
          </h3>

          {auditLogs.length === 0 ? (
            <p className="text-xs text-slate-400">Записей аудита пока нет</p>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono font-bold text-brand-300">{log.action}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {log.details ? JSON.stringify(log.details) : "—"}
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reason Modal for Block / Unblock / Archive */}
      {reasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {reasonModalOpen === "BLOCK"
                ? "Блокировка сотрудника"
                : reasonModalOpen === "UNBLOCK"
                ? "Разблокировка сотрудника"
                : "Архивация сотрудника"}
            </h3>
            <p className="text-xs text-slate-400">
              Укажите причину действия (минимум 5 символов). Она будет записана в журнал аудита.
            </p>

            <textarea
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Причина действия..."
              rows={3}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
            />

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setReasonModalOpen(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
              >
                Отмена
              </button>
              <button
                onClick={handleStatusAction}
                disabled={actionLoading || reasonText.trim().length < 5}
                className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
              >
                {actionLoading ? "Выполнение..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single-display Credentials Modal */}
      {newCredentials && (
        <CredentialsModal
          isOpen={credentialsModalOpen}
          onClose={() => {
            setCredentialsModalOpen(false);
            setNewCredentials(null);
          }}
          credentials={newCredentials}
          locale={locale}
        />
      )}
    </div>
  );
}
