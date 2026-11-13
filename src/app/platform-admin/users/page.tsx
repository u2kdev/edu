"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Eye,
  Lock,
  Copy,
  Check,
  AlertCircle,
  X,
  Sparkles,
  FileText,
  Calendar,
  Building,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface UserItem {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  username: string | null;
  platformRole: string;
  preferredLanguage: string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  deletedAt: string | null;
  deletedReason: string | null;
  memberships: {
    id: string;
    role: string;
    status: string;
    center: {
      id: string;
      name: string;
      slug: string;
    };
  }[];
}

interface CenterOption {
  id: string;
  name: string;
}

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [platformRole, setPlatformRole] = useState("ALL");
  const [centerRole, setCenterRole] = useState("ALL");
  const [centerId, setCenterId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Centers list for filter dropdown
  const [centers, setCenters] = useState<CenterOption[]>([]);

  // Create User Modal
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [newCredentials, setNewCredentials] = useState<{
    login: string;
    email: string;
    password?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [formFullName, setFormFullName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formUsername, setFormUsername] = useState("");
  const [formLang, setFormLang] = useState<"ru" | "uz-Latn">("ru");
  const [formPlatformRole, setFormPlatformRole] = useState<string>("NONE");
  const [formCenterId, setFormCenterId] = useState("");
  const [formCenterRole, setFormCenterRole] = useState("STUDENT");
  const [formPassword, setFormPassword] = useState("");
  const [formMustChange, setFormMustChange] = useState(true);

  // Fetch users
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });
      if (search) params.set("search", search);
      if (platformRole !== "ALL") params.set("platformRole", platformRole);
      if (centerRole !== "ALL") params.set("centerRole", centerRole);
      if (centerId) params.set("centerId", centerId);
      if (status !== "ALL") params.set("status", status);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/platform/users?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setUsers(json.users);
        setTotal(json.total);
        setTotalPages(json.totalPages);
      }
    } catch (err) {
      console.error("Failed to fetch users", err);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, platformRole, centerRole, centerId, status, dateFrom, dateTo, sortBy, sortOrder]);

  // Load centers for selection
  useEffect(() => {
    fetch("/api/platform/centers?pageSize=100")
      .then((res) => res.json())
      .then((json) => {
        if (json.centers) {
          setCenters(json.centers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Generate random 16-character password
  const generatePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!#%*@";
    let pass = "";
    for (let i = 0; i < 16; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormPassword(pass);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreateLoading(true);

    try {
      const payload: {
        fullName: string;
        email: string;
        phone?: string;
        username?: string;
        preferredLanguage: "ru" | "uz-Latn";
        platformRole: string;
        password?: string;
        mustChangePassword: boolean;
        centerId?: string;
        centerRole?: string;
      } = {
        fullName: formFullName,
        email: formEmail,
        phone: formPhone || undefined,
        username: formUsername || undefined,
        preferredLanguage: formLang,
        platformRole: formPlatformRole,
        password: formPassword || undefined,
        mustChangePassword: formMustChange,
      };

      if (formCenterId) {
        payload.centerId = formCenterId;
        payload.centerRole = formCenterRole;
      }

      const res = await fetch("/api/platform/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setCreateError(json.error || "Ошибка при создании пользователя");
        return;
      }

      setNewCredentials(json.initialCredentials);
      fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setCreateLoading(false);
    }
  };

  const copyCredentials = () => {
    if (!newCredentials) return;
    const text = `Логин: ${newCredentials.login}\nEmail: ${newCredentials.email}\nПароль: ${newCredentials.password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadCredentialCard = () => {
    if (!newCredentials) return;
    const content = `====================================
E-DARISCHI - УЧЕТНЫЕ ДАННЫЕ
====================================
ФИО: ${formFullName}
Логин: ${newCredentials.login}
Email: ${newCredentials.email}
Пароль: ${newCredentials.password}
====================================
Внимание: пароль показывается один раз!
При первом входе потребуется сменить пароль.
====================================`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `credentials_${newCredentials.login}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (platformRole !== "ALL") params.set("platformRole", platformRole);
    if (centerRole !== "ALL") params.set("centerRole", centerRole);
    if (centerId) params.set("centerId", centerId);
    if (status !== "ALL") params.set("status", status);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);

    window.open(`/api/platform/users/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-blue-600" />
            Пользователи платформы
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Всего пользователей: <span className="font-semibold text-slate-700">{total}</span>
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors shadow-sm"
          >
            <Download className="w-4 h-4 text-slate-500" />
            Экспорт CSV
          </button>
          <button
            onClick={() => {
              setNewCredentials(null);
              setFormFullName("");
              setFormEmail("");
              setFormPhone("");
              setFormUsername("");
              setFormPassword("");
              setFormPlatformRole("NONE");
              setFormCenterId("");
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-md shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            Создать пользователя
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Поиск по ФИО, email, телефону, username..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Platform Role */}
          <div>
            <select
              value={platformRole}
              onChange={(e) => {
                setPlatformRole(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Платформенная роль: Все</option>
              <option value="SUPERADMIN">SUPERADMIN</option>
              <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
              <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
              <option value="SEO_ADMIN">SEO_ADMIN</option>
              <option value="NONE">Обычный (NONE)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">Статус: Все</option>
              <option value="ACTIVE">Только активные</option>
              <option value="BLOCKED">Заблокированные</option>
              <option value="DELETED">Удаленные</option>
            </select>
          </div>
        </div>

        {/* Second row of filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <select
              value={centerId}
              onChange={(e) => {
                setCenterId(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="">Учебный центр: Все</option>
              {centers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={centerRole}
              onChange={(e) => {
                setCenterRole(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            >
              <option value="ALL">Роль в центре: Все</option>
              <option value="DIRECTOR">Директор (DIRECTOR)</option>
              <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
              <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
              <option value="TEACHER">Преподаватель (TEACHER)</option>
              <option value="STUDENT">Студент (STUDENT)</option>
              <option value="PARENT">Родитель (PARENT)</option>
            </select>
          </div>

          <div>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              title="Дата регистрации от"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>

          <div>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              title="Дата регистрации до"
              className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Пользователь</th>
                <th className="py-3 px-4">Контакты</th>
                <th className="py-3 px-4">Платформа</th>
                <th className="py-3 px-4">Центры и роли</th>
                <th className="py-3 px-4">Статус</th>
                <th className="py-3 px-4">Последний вход</th>
                <th className="py-3 px-4 text-right">Действие</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Загрузка пользователей...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Пользователи не найдены
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <Link
                        href={`/platform-admin/users/${user.id}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 transition-colors"
                      >
                        {user.fullName}
                      </Link>
                      <div className="text-xs text-slate-400">
                        ID: {user.id.slice(0, 8)}... &bull; Рег:{" "}
                        {new Date(user.createdAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="font-medium text-slate-700">{user.email}</div>
                      {user.phone && <div className="text-slate-500">{user.phone}</div>}
                      {user.username && (
                        <div className="text-blue-600 font-mono">@{user.username}</div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                          user.platformRole === "DEVELOPER"
                            ? "bg-purple-100 text-purple-700"
                            : user.platformRole === "SUPERADMIN"
                            ? "bg-rose-100 text-rose-700"
                            : user.platformRole === "PLATFORM_ADMIN"
                            ? "bg-blue-100 text-blue-700"
                            : user.platformRole === "PLATFORM_SUPPORT"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {user.platformRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {user.memberships.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          user.memberships.map((m) => (
                            <span
                              key={m.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs"
                              title={m.center.name}
                            >
                              <span className="font-medium truncate max-w-[100px]">
                                {m.center.name}
                              </span>
                              <span className="text-[10px] text-blue-600 font-semibold uppercase">
                                ({m.role})
                              </span>
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {user.deletedAt ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 text-xs font-medium">
                          Удален
                        </span>
                      ) : user.isActive ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
                          Активен
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
                          Заблокирован
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-500">
                      {user.lastLoginAt
                        ? new Date(user.lastLoginAt).toLocaleString("ru-RU", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Никогда"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/platform-admin/users/${user.id}`}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:text-blue-600 hover:border-blue-300 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Открыть
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Страница <span className="font-semibold text-slate-700">{page}</span> из{" "}
            <span className="font-semibold text-slate-700">{totalPages || 1}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Create User Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            {/* If user was created, show single-display credential card */}
            {newCredentials ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Пользователь создан</h2>
                    <p className="text-xs text-slate-500">
                      Карточка учетной записи с временным паролем
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold">Показывается один раз!</span>
                    <p className="mt-0.5 text-amber-700">
                      Пароль захеширован в базе данных и больше не будет доступен для просмотра.
                      Скопируйте или скачайте карточку сейчас.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 font-mono text-xs">
                  <div>
                    <span className="text-slate-400">Логин: </span>
                    <span className="font-bold text-slate-900">{newCredentials.login}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Email: </span>
                    <span className="font-bold text-slate-900">{newCredentials.email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">Пароль: </span>
                    <span className="font-bold text-blue-600">{newCredentials.password}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    onClick={copyCredentials}
                    className="flex-1 py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Скопировано!" : "Копировать"}
                  </button>
                  <button
                    onClick={downloadCredentialCard}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Скачать карточку
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      setIsCreateModalOpen(false);
                      setNewCredentials(null);
                    }}
                    className="w-full py-2.5 text-center text-xs text-slate-500 hover:text-slate-800 font-medium"
                  >
                    Закрыть окно
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSubmit} className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h2 className="text-lg font-bold text-slate-900">Создать пользователя</h2>
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{createError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    ФИО *
                  </label>
                  <input
                    type="text"
                    required
                    value={formFullName}
                    onChange={(e) => setFormFullName(e.target.value)}
                    placeholder="Азиз Рахимов"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="user@example.com"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Телефон (+998...)
                    </label>
                    <input
                      type="text"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
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
                      value={formUsername}
                      onChange={(e) => setFormUsername(e.target.value)}
                      placeholder="aziz_rakhimov"
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Язык интерфейса
                    </label>
                    <select
                      value={formLang}
                      onChange={(e) => setFormLang(e.target.value as "ru" | "uz-Latn")}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ru">Русский</option>
                      <option value="uz-Latn">Oʻzbekcha (Lotin)</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Роль платформы
                  </label>
                  <select
                    value={formPlatformRole}
                    onChange={(e) => setFormPlatformRole(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NONE">Без платформенной роли (Обычный пользователь)</option>
                    <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                    <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
                    <option value="SEO_ADMIN">SEO_ADMIN</option>
                  </select>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Роли SUPERADMIN и DEVELOPER через веб-интерфейс не назначаются.
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Привязать к центру
                    </label>
                    <select
                      value={formCenterId}
                      onChange={(e) => setFormCenterId(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Без привязки</option>
                      {centers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {formCenterId && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                        Роль в центре
                      </label>
                      <select
                        value={formCenterRole}
                        onChange={(e) => setFormCenterRole(e.target.value)}
                        className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="DIRECTOR">Директор (DIRECTOR)</option>
                        <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
                        <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
                        <option value="TEACHER">Преподаватель (TEACHER)</option>
                        <option value="STUDENT">Студент (STUDENT)</option>
                        <option value="PARENT">Родитель (PARENT)</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Пароль
                    </label>
                    <button
                      type="button"
                      onClick={generatePassword}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                    >
                      Сгенерировать (16 знаков)
                    </button>
                  </div>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder="Оставьте пустым для автогенерации"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="pt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="mustChange"
                    checked={formMustChange}
                    onChange={(e) => setFormMustChange(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="mustChange" className="text-xs text-slate-700 font-medium">
                    Требовать смену пароля при первом входе
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    {createLoading ? "Создание..." : "Создать и показать карточку"}
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
