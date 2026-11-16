"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Download, Eye, Plus } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormActions,
  FormField,
  Input,
  PageHeader,
} from "@/components/ui";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";
import { t } from "@/i18n";

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

const ROLE_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  DEVELOPER: "info",
  SUPERADMIN: "destructive",
  PLATFORM_ADMIN: "primary",
  PLATFORM_SUPPORT: "warning",
};

export default function PlatformUsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [platformRole, setPlatformRole] = useState("ALL");
  const [centerRole, setCenterRole] = useState("ALL");
  const [centerId, setCenterId] = useState("");
  const [status, setStatus] = useState("ALL");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [centers, setCenters] = useState<CenterOption[]>([]);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createdCredentials, setCreatedCredentials] = useState<CredentialsData | null>(null);

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

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: "createdAt",
        sortOrder: "desc",
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
      } else {
        setError(json.error || "Не удалось загрузить пользователей");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, platformRole, centerRole, centerId, status, dateFrom, dateTo]);

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

      setIsCreateModalOpen(false);
      if (json.initialCredentials) {
        setCreatedCredentials({
          fullName: formFullName,
          login: json.initialCredentials.login || json.initialCredentials.email,
          password: json.initialCredentials.password,
          loginUrl: "/login",
          mustChangePassword: formMustChange,
        });
      }
      fetchUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setCreateLoading(false);
    }
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

  const columns: DataTableColumn<UserItem>[] = [
    {
      id: "user",
      header: "Пользователь",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (u) => u.fullName,
      cell: (user) => (
        <div>
          <Link
            href={`/platform-admin/users/${user.id}`}
            className="font-medium text-foreground hover:text-primary transition-colors"
          >
            {user.fullName}
          </Link>
          <div className="text-xs text-muted-foreground tabular-nums">
            ID: {user.id.slice(0, 8)} • Рег: {new Date(user.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      id: "contacts",
      header: "Контакты",
      cell: (user) => (
        <div className="text-xs">
          <div className="font-medium text-foreground">{user.email}</div>
          {user.phone && <div className="text-muted-foreground tabular-nums">{user.phone}</div>}
          {user.username && <div className="font-mono text-primary">@{user.username}</div>}
        </div>
      ),
    },
    {
      id: "platformRole",
      header: "Платформа",
      sortable: true,
      sortValue: (u) => u.platformRole,
      cell: (user) => (
        <Badge variant={ROLE_BADGE_VARIANTS[user.platformRole] || "neutral"}>
          {user.platformRole}
        </Badge>
      ),
    },
    {
      id: "memberships",
      header: "Центры и роли",
      cell: (user) =>
        user.memberships.length === 0 ? (
          <span className="text-xs text-muted-foreground">—</span>
        ) : (
          <div className="flex max-w-xs flex-wrap gap-1">
            {user.memberships.map((m) => (
              <Badge key={m.id} variant="neutral" title={m.center.name}>
                <span className="max-w-[100px] truncate">{m.center.name}</span>
                <span className="text-primary">({m.role})</span>
              </Badge>
            ))}
          </div>
        ),
    },
    {
      id: "status",
      header: "Статус",
      cell: (user) =>
        user.deletedAt ? (
          <Badge variant="destructive">Удалён</Badge>
        ) : user.isActive ? (
          <Badge variant="success">Активен</Badge>
        ) : (
          <Badge variant="neutral">Заблокирован</Badge>
        ),
    },
    {
      id: "lastLoginAt",
      header: "Последний вход",
      hideOnMobile: true,
      cell: (user) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {user.lastLoginAt
            ? new Date(user.lastLoginAt).toLocaleString("ru-RU", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "Никогда"}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действие",
      align: "right",
      hideable: false,
      cell: (user) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/platform-admin/users/${user.id}`}>
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Открыть</span>
          </Link>
        </Button>
      ),
    },
  ];

  const hasFilters = Boolean(
    search ||
      platformRole !== "ALL" ||
      centerRole !== "ALL" ||
      centerId ||
      status !== "ALL" ||
      dateFrom ||
      dateTo
  );

  const resetFilters = () => {
    setSearch("");
    setPlatformRole("ALL");
    setCenterRole("ALL");
    setCenterId("");
    setStatus("ALL");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пользователи платформы"
        description={`Всего пользователей: ${total}`}
        actions={
          <>
            <Button type="button" variant="outline" size="sm" onClick={exportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Экспорт CSV</span>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setCreateError("");
                setFormFullName("");
                setFormEmail("");
                setFormPhone("");
                setFormUsername("");
                setFormPassword("");
                setFormPlatformRole("NONE");
                setFormCenterId("");
                setIsCreateModalOpen(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Создать пользователя</span>
            </Button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Поиск по ФИО, email, телефону, username..."
        hasActiveFilters={hasFilters}
        onReset={resetFilters}
      >
        <select
          aria-label="Платформенная роль"
          value={platformRole}
          onChange={(e) => {
            setPlatformRole(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="ALL">Платформенная роль: все</option>
          <option value="SUPERADMIN">SUPERADMIN</option>
          <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
          <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
          <option value="SEO_ADMIN">SEO_ADMIN</option>
          <option value="NONE">Обычный (NONE)</option>
        </select>

        <select
          aria-label="Статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="ALL">Статус: все</option>
          <option value="ACTIVE">Только активные</option>
          <option value="BLOCKED">Заблокированные</option>
          <option value="DELETED">Удалённые</option>
        </select>

        <select
          aria-label="Учебный центр"
          value={centerId}
          onChange={(e) => {
            setCenterId(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="">Учебный центр: все</option>
          {centers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Роль в центре"
          value={centerRole}
          onChange={(e) => {
            setCenterRole(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-xs text-foreground"
        >
          <option value="ALL">Роль в центре: все</option>
          <option value="DIRECTOR">Директор (DIRECTOR)</option>
          <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
          <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
          <option value="TEACHER">Преподаватель (TEACHER)</option>
          <option value="STUDENT">Ученик (STUDENT)</option>
          <option value="PARENT">Родитель (PARENT)</option>
        </select>

        <Input
          aria-label="Дата регистрации от"
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="h-9 w-36 text-xs"
        />

        <Input
          aria-label="Дата регистрации до"
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="h-9 w-36 text-xs"
        />
      </FilterBar>

      <DataTable
        data={users}
        columns={columns}
        getRowId={(u) => u.id}
        loading={loading}
        loadingLabel="Загрузка пользователей..."
        error={error}
        onRetry={fetchUsers}
        page={page}
        totalPages={totalPages || 1}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        getRowHref={(u) => `/platform-admin/users/${u.id}`}
        emptyTitle="Пользователи не найдены"
        emptyDescription={t("ru", "ui4.emptyUsersDesc")}
        emptyAction={
          hasFilters ? (
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              {t("ru", "ui4.resetFilters")}
            </Button>
          ) : undefined
        }
      />

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Создать пользователя</DialogTitle>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <FormField label="ФИО" htmlFor="u-full-name" required>
              <Input
                id="u-full-name"
                type="text"
                required
                value={formFullName}
                onChange={(e) => setFormFullName(e.target.value)}
                placeholder="Азиз Рахимов"
              />
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Email" htmlFor="u-email" required>
                <Input
                  id="u-email"
                  type="email"
                  required
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </FormField>

              <FormField label="Телефон (+998...)" htmlFor="u-phone">
                <Input
                  id="u-phone"
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  placeholder="+998901234567"
                />
              </FormField>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Username (логин)" htmlFor="u-username">
                <Input
                  id="u-username"
                  type="text"
                  value={formUsername}
                  onChange={(e) => setFormUsername(e.target.value)}
                  placeholder="aziz_rakhimov"
                />
              </FormField>

              <FormField label="Язык интерфейса" htmlFor="u-lang">
                <select
                  id="u-lang"
                  value={formLang}
                  onChange={(e) => setFormLang(e.target.value as "ru" | "uz-Latn")}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="ru">Русский</option>
                  <option value="uz-Latn">Oʻzbekcha (Lotin)</option>
                </select>
              </FormField>
            </div>

            <FormField
              label="Роль платформы"
              htmlFor="u-plat-role"
              hint="Роли SUPERADMIN и DEVELOPER через веб-интерфейс не назначаются."
            >
              <select
                id="u-plat-role"
                value={formPlatformRole}
                onChange={(e) => setFormPlatformRole(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="NONE">Без платформенной роли (обычный пользователь)</option>
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
                <option value="SEO_ADMIN">SEO_ADMIN</option>
              </select>
            </FormField>

            <div className="grid grid-cols-1 gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <FormField label="Привязать к центру" htmlFor="u-center-id">
                <select
                  id="u-center-id"
                  value={formCenterId}
                  onChange={(e) => setFormCenterId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Без привязки</option>
                  {centers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </FormField>

              {formCenterId && (
                <FormField label="Роль в центре" htmlFor="u-center-role">
                  <select
                    id="u-center-role"
                    value={formCenterRole}
                    onChange={(e) => setFormCenterRole(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="DIRECTOR">Директор (DIRECTOR)</option>
                    <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
                    <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
                    <option value="TEACHER">Преподаватель (TEACHER)</option>
                    <option value="STUDENT">Ученик (STUDENT)</option>
                    <option value="PARENT">Родитель (PARENT)</option>
                  </select>
                </FormField>
              )}
            </div>

            <div className="space-y-1.5 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-foreground">Пароль</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={generatePassword}
                  className="h-auto px-1.5 py-0.5 text-xs text-primary"
                >
                  Сгенерировать (16 знаков)
                </Button>
              </div>
              <Input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Оставьте пустым для автогенерации"
                className="font-mono"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground">
              <input
                type="checkbox"
                checked={formMustChange}
                onChange={(e) => setFormMustChange(e.target.checked)}
                className="rounded border-input accent-primary"
              />
              <span>Требовать смену пароля при первом входе</span>
            </label>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={createLoading}>
                {createLoading ? "Создание..." : "Создать и показать карточку"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      {createdCredentials && (
        <CredentialsModal
          isOpen={Boolean(createdCredentials)}
          onClose={() => setCreatedCredentials(null)}
          credentials={createdCredentials}
          locale="ru"
        />
      )}
    </div>
  );
}
