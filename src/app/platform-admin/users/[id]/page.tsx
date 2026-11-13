"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  Mail,
  Phone,
  Shield,
  Key,
  Lock,
  Unlock,
  Trash2,
  Eye,
  Building,
  Activity,
  Clock,
  Laptop,
  AlertCircle,
  CheckCircle2,
  Check,
  Copy,
  ArrowLeft,
  X,
  Plus,
  RefreshCw,
  LogOut,
  Sparkles,
} from "lucide-react";

interface CenterMembershipItem {
  id: string;
  centerId: string;
  role: string;
  status: string;
  createdAt: string;
  center: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
}

interface UserSessionItem {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
}

interface AuditLogItem {
  id: string;
  action: string;
  resource: string;
  detailsJson: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface UserDetails {
  id: string;
  email: string;
  phone: string | null;
  username: string | null;
  fullName: string;
  platformRole: string;
  preferredLanguage: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  deletedReason: string | null;
  memberships: CenterMembershipItem[];
  userSessions: UserSessionItem[];
  auditLogs: AuditLogItem[];
  ownedCenters: { id: string; name: string; slug: string; status: string }[];
}

interface CenterOption {
  id: string;
  name: string;
}

export default function UserDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [user, setUser] = useState<UserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");
  const [successBanner, setSuccessBanner] = useState("");

  // Edit profile state
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editLang, setEditLang] = useState<"ru" | "uz-Latn">("ru");
  const [editRole, setEditRole] = useState("NONE");
  const [editReason, setEditReason] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Modals
  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [newGeneratedPassword, setNewGeneratedPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [blockingUser, setBlockingUser] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deletingUser, setDeletingUser] = useState(false);

  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [newMemCenterId, setNewMemCenterId] = useState("");
  const [newMemRole, setNewMemRole] = useState("STUDENT");
  const [savingMembership, setSavingMembership] = useState(false);

  const [impersonating, setImpersonating] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<"profile" | "memberships" | "sessions" | "audit">("profile");

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/users/${id}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось загрузить пользователя");
        return;
      }
      setUser(json.user);
      setEditFullName(json.user.fullName);
      setEditEmail(json.user.email);
      setEditPhone(json.user.phone || "");
      setEditUsername(json.user.username || "");
      setEditLang(json.user.preferredLanguage === "uz_Latn" || json.user.preferredLanguage === "uz-Latn" ? "uz-Latn" : "ru");
      setEditRole(json.user.platformRole);
    } catch (err) {
      setErrorBanner("Ошибка сети при загрузке данных");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchUser();
    fetch("/api/platform/centers?pageSize=100")
      .then((res) => res.json())
      .then((json) => {
        if (json.centers) setCenters(json.centers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [fetchUser]);

  // Handle Save Profile
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setErrorBanner("");
    setSuccessBanner("");

    try {
      const res = await fetch(`/api/platform/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editFullName,
          email: editEmail,
          phone: editPhone || null,
          username: editUsername || null,
          preferredLanguage: editLang,
          platformRole: editRole,
          reason: editReason || "Обновление данных профиля через панель платформы",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось сохранить изменения");
        return;
      }

      setSuccessBanner("Данные профиля успешно обновлены");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async () => {
    setResettingPass(true);
    setErrorBanner("");
    try {
      const res = await fetch(`/api/platform/users/${id}/reset-password`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось сбросить пароль");
        return;
      }
      setNewGeneratedPassword(json.newPassword);
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка при сбросе пароля");
    } finally {
      setResettingPass(false);
    }
  };

  // Handle Block / Unblock
  const handleToggleBlock = async () => {
    if (!user) return;
    if (blockReason.trim().length < 5) {
      setErrorBanner("Причина должна содержать не менее 5 символов");
      return;
    }

    setBlockingUser(true);
    setErrorBanner("");
    try {
      const targetState = !user.isActive;
      const res = await fetch(`/api/platform/users/${id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: targetState,
          reason: blockReason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось изменить статус блокировки");
        return;
      }

      setIsBlockModalOpen(false);
      setBlockReason("");
      setSuccessBanner(targetState ? "Пользователь разблокирован" : "Пользователь заблокирован");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка изменения блокировки");
    } finally {
      setBlockingUser(false);
    }
  };

  // Handle Soft Delete
  const handleDeleteUser = async () => {
    if (deleteReason.trim().length < 5) {
      setErrorBanner("Причина удаления должна содержать не менее 5 символов");
      return;
    }

    setDeletingUser(true);
    setErrorBanner("");
    try {
      const res = await fetch(`/api/platform/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: deleteReason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось удалить пользователя");
        return;
      }

      setIsDeleteModalOpen(false);
      setSuccessBanner("Пользователь успешно удален");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка при удалении");
    } finally {
      setDeletingUser(false);
    }
  };

  // Handle Revoke All Sessions
  const handleRevokeSessions = async () => {
    if (!confirm("Завершить все активные сессии пользователя?")) return;
    try {
      const res = await fetch(`/api/platform/users/${id}/sessions`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessBanner(json.message || "Сессии завершены");
        fetchUser();
      } else {
        setErrorBanner(json.error || "Не удалось завершить сессии");
      }
    } catch (err) {
      setErrorBanner("Ошибка сети");
    }
  };

  // Handle Impersonate
  const handleImpersonate = async () => {
    if (!user) return;
    setImpersonating(true);
    try {
      const res = await fetch("/api/platform/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          reason: "Вход суперадмина из карточки пользователя",
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось войти от имени пользователя");
        setImpersonating(false);
        return;
      }

      // Redirect to center dashboard
      router.push("/center");
      router.refresh();
    } catch (err) {
      setErrorBanner("Ошибка при запуске имперсонации");
      setImpersonating(false);
    }
  };

  // Handle Add Membership
  const handleAddMembership = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemCenterId) return;

    setSavingMembership(true);
    try {
      const res = await fetch(`/api/platform/users/${id}/memberships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: newMemCenterId,
          role: newMemRole,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось добавить членство");
        return;
      }
      setIsAddMembershipOpen(false);
      setSuccessBanner("Членство добавлено");
      fetchUser();
    } catch (err) {
      setErrorBanner("Ошибка сети");
    } finally {
      setSavingMembership(false);
    }
  };

  // Handle Delete Membership
  const handleDeleteMembership = async (membershipId: string) => {
    if (!confirm("Удалить членство пользователя в этом учебном центре?")) return;
    try {
      const res = await fetch(`/api/platform/users/${id}/memberships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось удалить членство");
        return;
      }
      setSuccessBanner("Членство удалено");
      fetchUser();
    } catch (err) {
      setErrorBanner("Ошибка сети");
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-500" />
        Загрузка карточки пользователя...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <AlertCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
        <h2 className="text-lg font-bold text-slate-800">Пользователь не найден</h2>
        <Link
          href="/platform-admin/users"
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-blue-600 font-semibold"
        >
          <ArrowLeft className="w-4 h-4" /> Вернуться к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top breadcrumb & quick actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/users"
            className="p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {user.fullName}
              </h1>
              {user.deletedAt ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-700">
                  Удален
                </span>
              ) : user.isActive ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                  Активен
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                  Заблокирован
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              ID: {user.id} &bull; Регистрация: {new Date(user.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!user.deletedAt && (
            <button
              onClick={handleImpersonate}
              disabled={impersonating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              {impersonating ? "Вход..." : "Войти как"}
            </button>
          )}

          <button
            onClick={() => {
              setNewGeneratedPassword(null);
              setIsResetPassModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-colors"
          >
            <Key className="w-3.5 h-3.5 text-amber-500" />
            Сбросить пароль
          </button>

          {!user.deletedAt && (
            <button
              onClick={() => {
                setBlockReason("");
                setIsBlockModalOpen(true);
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-xs font-medium shadow-sm transition-colors ${
                user.isActive
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
              }`}
            >
              {user.isActive ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              {user.isActive ? "Заблокировать" : "Разблокировать"}
            </button>
          )}

          {!user.deletedAt && (
            <button
              onClick={() => {
                setDeleteReason("");
                setIsDeleteModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-medium shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Удалить
            </button>
          )}
        </div>
      </div>

      {/* Notifications banner */}
      {errorBanner && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorBanner}</span>
        </div>
      )}

      {successBanner && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successBanner}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 space-x-6 text-sm font-medium">
        <button
          onClick={() => setActiveTab("profile")}
          className={`pb-3 transition-colors ${
            activeTab === "profile"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Профиль
        </button>
        <button
          onClick={() => setActiveTab("memberships")}
          className={`pb-3 transition-colors flex items-center gap-1.5 ${
            activeTab === "memberships"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Членства в центрах ({user.memberships.length})
        </button>
        <button
          onClick={() => setActiveTab("sessions")}
          className={`pb-3 transition-colors flex items-center gap-1.5 ${
            activeTab === "sessions"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Активные сессии ({user.userSessions.length})
        </button>
        <button
          onClick={() => setActiveTab("audit")}
          className={`pb-3 transition-colors ${
            activeTab === "audit"
              ? "border-b-2 border-blue-600 text-blue-600 font-semibold"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Журнал действий ({user.auditLogs.length})
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <form onSubmit={handleSaveProfile} className="space-y-4 max-w-2xl">
            <h3 className="text-base font-bold text-slate-900 mb-2">Основные данные профиля</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                ФИО
              </label>
              <input
                type="text"
                required
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Телефон (+998...)
                </label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Username (логин)
                </label>
                <input
                  type="text"
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Язык интерфейса
                </label>
                <select
                  value={editLang}
                  onChange={(e) => setEditLang(e.target.value as "ru" | "uz-Latn")}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="ru">Русский</option>
                  <option value="uz-Latn">Oʻzbekcha (Lotin)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Платформенная роль
              </label>
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="NONE">Без платформенной роли (NONE)</option>
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
                <option value="SEO_ADMIN">SEO_ADMIN</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Причина изменения (для аудита)
              </label>
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Например: Обновление контактных данных по запросу пользователя"
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50 transition-colors"
              >
                {savingProfile ? "Сохранение..." : "Сохранить изменения"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tab 2: Memberships */}
      {activeTab === "memberships" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Учебные центры пользователя</h3>
            <button
              onClick={() => setIsAddMembershipOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 hover:bg-blue-100 text-xs font-semibold transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Добавить в центр
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {user.memberships.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Пользователь не привязан ни к одному учебному центру
              </p>
            ) : (
              user.memberships.map((m) => (
                <div key={m.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-slate-800 text-sm">{m.center.name}</div>
                    <div className="text-xs text-slate-400">
                      Статус центра: {m.center.status} &bull; Добавлен:{" "}
                      {new Date(m.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700">
                      {m.role}
                    </span>
                    <button
                      onClick={() => handleDeleteMembership(m.id)}
                      className="text-xs text-rose-500 hover:text-rose-700 font-medium"
                    >
                      Исключить
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Sessions */}
      {activeTab === "sessions" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Активные сессии пользователя</h3>
              <p className="text-xs text-slate-500">Устройства и браузеры, авторизованные в системе</p>
            </div>
            {user.userSessions.length > 0 && (
              <button
                onClick={handleRevokeSessions}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Завершить все сессии
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {user.userSessions.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">
                Нет активных авторизованных сессий
              </p>
            ) : (
              user.userSessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-medium text-slate-800 flex items-center gap-2">
                      <Laptop className="w-4 h-4 text-slate-400" />
                      <span>{s.userAgent || "Неизвестный браузер"}</span>
                    </div>
                    <div className="text-slate-400 mt-0.5">
                      IP: {s.ipAddress || "Неизвестен"} &bull; Создана:{" "}
                      {new Date(s.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="text-right text-slate-500">
                    Истекает: {new Date(s.expiresAt).toLocaleDateString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Audit */}
      {activeTab === "audit" && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-slate-900">Последние действия (AuditLog)</h3>
          <div className="divide-y divide-slate-100 text-xs">
            {user.auditLogs.length === 0 ? (
              <p className="text-slate-400 py-6 text-center">Записей в журнале не найдено</p>
            ) : (
              user.auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-slate-800">{log.action}</span>
                    <span className="text-slate-400 ml-2">[{log.resource}]</span>
                    {log.ipAddress && (
                      <span className="text-slate-400 ml-2">IP: {log.ipAddress}</span>
                    )}
                  </div>
                  <div className="text-slate-400 font-mono">
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Reset Password */}
      {isResetPassModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6">
            {newGeneratedPassword ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold">
                    <Key className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Пароль сброшен</h2>
                    <p className="text-xs text-slate-500">Новый временный пароль</p>
                  </div>
                </div>

                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                  <p className="font-semibold">Показывается один раз!</p>
                  <p className="mt-0.5">
                    Все активные сессии пользователя отозваны. При следующем входе система
                    потребует сменить этот пароль.
                  </p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-center text-sm font-bold text-blue-600">
                  {newGeneratedPassword}
                </div>

                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newGeneratedPassword);
                    setCopiedPass(true);
                    setTimeout(() => setCopiedPass(false), 2000);
                  }}
                  className="w-full py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-2 shadow-sm"
                >
                  {copiedPass ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedPass ? "Скопировано!" : "Копировать пароль"}
                </button>

                <button
                  onClick={() => setIsResetPassModalOpen(false)}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-800"
                >
                  Закрыть
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900">Сброс пароля</h2>
                  <button onClick={() => setIsResetPassModalOpen(false)} className="text-slate-400">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Будет сгенерирован новый случайный пароль из 16 символов, старый пароль будет
                  аннулирован, все существующие сессии пользователя будут немедленно завершены, и
                  будет установлен флаг обязательной смены пароля при входе.
                </p>
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    onClick={() => setIsResetPassModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={handleResetPassword}
                    disabled={resettingPass}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-sm"
                  >
                    {resettingPass ? "Сброс..." : "Подтвердить сброс"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Block */}
      {isBlockModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">
                {user.isActive ? "Блокировка пользователя" : "Разблокировка пользователя"}
              </h2>
              <button onClick={() => setIsBlockModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {user.isActive
                ? "При блокировке пользователь не сможет войти в систему, а все текущие сессии будут сброшены."
                : "Пользователь снова получит возможность авторизоваться в системе."}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Причина (обязательно, мин. 5 символов)
              </label>
              <textarea
                rows={3}
                required
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="Укажите причину действия для аудита..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsBlockModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleToggleBlock}
                disabled={blockingUser || blockReason.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {blockingUser ? "Обработка..." : "Подтвердить"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-rose-600 flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Мягкое удаление пользователя
              </h2>
              <button onClick={() => setIsDeleteModalOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Учетная запись будет деактивирована, email и номер телефона освобождены для
              возможной повторной регистрации, все активные сессии завершены.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Обязательная причина удаления (мин. 5 символов)
              </label>
              <textarea
                rows={3}
                required
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Укажите причину удаления..."
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
              >
                Отмена
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deletingUser || deleteReason.trim().length < 5}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {deletingUser ? "Удаление..." : "Удалить учетную запись"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Membership */}
      {isAddMembershipOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleAddMembership}
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-900">Добавить в учебный центр</h2>
              <button onClick={() => setIsAddMembershipOpen(false)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Учебный центр
              </label>
              <select
                required
                value={newMemCenterId}
                onChange={(e) => setNewMemCenterId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Выберите учебный центр</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Роль в центре
              </label>
              <select
                value={newMemRole}
                onChange={(e) => setNewMemRole(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="DIRECTOR">Директор (DIRECTOR)</option>
                <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
                <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
                <option value="TEACHER">Преподаватель (TEACHER)</option>
                <option value="TEACHER_ASSISTANT">Ассистент (TEACHER_ASSISTANT)</option>
                <option value="STUDENT">Студент (STUDENT)</option>
                <option value="PARENT">Родитель (PARENT)</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsAddMembershipOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={savingMembership || !newMemCenterId}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm disabled:opacity-50"
              >
                {savingMembership ? "Добавление..." : "Добавить"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
