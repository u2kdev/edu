"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Check,
  Copy,
  Eye,
  Key,
  Laptop,
  Lock,
  LogOut,
  Plus,
  Trash2,
  Unlock,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EntityDetailHeader,
  FormActions,
  FormField,
  Input,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { t } from "@/i18n";

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

  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editLang, setEditLang] = useState<"ru" | "uz-Latn">("ru");
  const [editRole, setEditRole] = useState("NONE");
  const [editReason, setEditReason] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [isResetPassModalOpen, setIsResetPassModalOpen] = useState(false);
  const [newGeneratedPassword, setNewGeneratedPassword] = useState<string | null>(null);
  const [copiedPass, setCopiedPass] = useState(false);
  const [resettingPass, setResettingPass] = useState(false);

  const [isBlockModalOpen, setIsBlockModalOpen] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const [revokeSessionsConfirmOpen, setRevokeSessionsConfirmOpen] = useState(false);
  const [pendingDeleteMembershipId, setPendingDeleteMembershipId] = useState<string | null>(null);
  const [mutatingMembershipOrSessions, setMutatingMembershipOrSessions] = useState(false);

  const [isAddMembershipOpen, setIsAddMembershipOpen] = useState(false);
  const [centers, setCenters] = useState<CenterOption[]>([]);
  const [newMemCenterId, setNewMemCenterId] = useState("");
  const [newMemRole, setNewMemRole] = useState("STUDENT");
  const [savingMembership, setSavingMembership] = useState(false);

  const [impersonating, setImpersonating] = useState(false);
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
      setEditLang(
        json.user.preferredLanguage === "uz_Latn" || json.user.preferredLanguage === "uz-Latn"
          ? "uz-Latn"
          : "ru"
      );
      setEditRole(json.user.platformRole);
    } catch {
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
        if (json.centers)
          setCenters(json.centers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [fetchUser]);

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

      setSuccessBanner("Данные профиля обновлены");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSavingProfile(false);
    }
  };

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

  const handleToggleBlock = async (reason?: string) => {
    if (!user || !reason) return;
    setBlockingUser(true);
    setErrorBanner("");
    try {
      const targetState = !user.isActive;
      const res = await fetch(`/api/platform/users/${id}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: targetState,
          reason,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось изменить статус блокировки");
        return;
      }

      setIsBlockModalOpen(false);
      setSuccessBanner(targetState ? "Пользователь разблокирован" : "Пользователь заблокирован");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка изменения блокировки");
    } finally {
      setBlockingUser(false);
    }
  };

  const handleDeleteUser = async (reason?: string) => {
    if (!reason) return;
    setDeletingUser(true);
    setErrorBanner("");
    try {
      const res = await fetch(`/api/platform/users/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось удалить пользователя");
        return;
      }

      setIsDeleteModalOpen(false);
      setSuccessBanner("Пользователь удалён");
      fetchUser();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка при удалении");
    } finally {
      setDeletingUser(false);
    }
  };

  const confirmRevokeSessions = async () => {
    setMutatingMembershipOrSessions(true);
    setErrorBanner("");
    try {
      const res = await fetch(`/api/platform/users/${id}/sessions`, { method: "DELETE" });
      const json = await res.json();
      if (res.ok && json.success) {
        setSuccessBanner(json.message || "Сессии завершены");
        fetchUser();
      } else {
        setErrorBanner(json.error || "Не удалось завершить сессии");
      }
    } catch {
      setErrorBanner("Ошибка сети");
    } finally {
      setMutatingMembershipOrSessions(false);
      setRevokeSessionsConfirmOpen(false);
    }
  };

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

      router.push("/center");
      router.refresh();
    } catch {
      setErrorBanner("Ошибка при запуске имперсонации");
      setImpersonating(false);
    }
  };

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
    } catch {
      setErrorBanner("Ошибка сети");
    } finally {
      setSavingMembership(false);
    }
  };

  const confirmDeleteMembership = async () => {
    if (!pendingDeleteMembershipId) return;
    setMutatingMembershipOrSessions(true);
    setErrorBanner("");
    try {
      const res = await fetch(`/api/platform/users/${id}/memberships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId: pendingDeleteMembershipId }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось удалить членство");
        return;
      }
      setSuccessBanner("Членство удалено");
      fetchUser();
    } catch {
      setErrorBanner("Ошибка сети");
    } finally {
      setMutatingMembershipOrSessions(false);
      setPendingDeleteMembershipId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4 py-8">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!user) {
    return (
      <EmptyState
        title="Пользователь не найден"
        description="Проверьте идентификатор пользователя или вернитесь к общему списку."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/platform-admin/users">Вернуться к списку</Link>
          </Button>
        }
      />
    );
  }

  const membershipColumns: DataTableColumn<CenterMembershipItem>[] = [
    {
      id: "center",
      header: "Учебный центр",
      isMobilePrimary: true,
      cell: (m) => (
        <div>
          <Link
            href={`/platform-admin/centers/${m.centerId}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {m.center.name}
          </Link>
          <div className="text-xs text-muted-foreground tabular-nums">
            Статус: {m.center.status} • Добавлен: {new Date(m.createdAt).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Роль",
      cell: (m) => <Badge variant="primary">{m.role}</Badge>,
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (m) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setPendingDeleteMembershipId(m.id)}
        >
          Исключить
        </Button>
      ),
    },
  ];

  const sessionColumns: DataTableColumn<UserSessionItem>[] = [
    {
      id: "agent",
      header: "Устройство / Браузер",
      isMobilePrimary: true,
      cell: (s) => (
        <div className="flex items-center gap-2 text-xs">
          <Laptop className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="font-medium text-foreground">{s.userAgent || "Неизвестный браузер"}</span>
        </div>
      ),
    },
    {
      id: "ip",
      header: "IP / Создана",
      cell: (s) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {s.ipAddress || "Неизвестен"} • {new Date(s.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "expiresAt",
      header: "Истекает",
      align: "right",
      cell: (s) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(s.expiresAt).toLocaleDateString()}
        </span>
      ),
    },
  ];

  const auditColumns: DataTableColumn<AuditLogItem>[] = [
    {
      id: "action",
      header: "Действие",
      isMobilePrimary: true,
      cell: (log) => (
        <div>
          <span className="font-medium text-foreground">{log.action}</span>
          <span className="ml-2 text-xs text-muted-foreground">[{log.resource}]</span>
          {log.ipAddress && (
            <span className="ml-2 font-mono text-xs text-muted-foreground">IP: {log.ipAddress}</span>
          )}
        </div>
      ),
    },
    {
      id: "createdAt",
      header: "Дата",
      align: "right",
      cell: (log) => (
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {new Date(log.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  const statusLabel = user.deletedAt
    ? "Удалён"
    : user.isActive
    ? "Активен"
    : "Заблокирован";
  const statusVariant = user.deletedAt ? "destructive" : user.isActive ? "success" : "neutral";

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        backHref="/platform-admin/users"
        title={user.fullName}
        subtitle={`ID: ${user.id} • Регистрация: ${new Date(user.createdAt).toLocaleDateString()}`}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        primaryAction={
          !user.deletedAt ? (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleImpersonate}
              disabled={impersonating}
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{impersonating ? "Вход..." : "Войти как"}</span>
            </Button>
          ) : undefined
        }
        menuActions={[
          {
            id: "reset-password",
            label: "Сбросить пароль",
            icon: <Key className="h-3.5 w-3.5" aria-hidden="true" />,
            onSelect: () => {
              setNewGeneratedPassword(null);
              setIsResetPassModalOpen(true);
            },
          },
          ...(!user.deletedAt
            ? [
                {
                  id: "toggle-block",
                  label: user.isActive ? "Заблокировать" : "Разблокировать",
                  icon: user.isActive ? (
                    <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
                  ),
                  onSelect: () => setIsBlockModalOpen(true),
                },
                {
                  id: "delete-user",
                  label: "Удалить учётную запись",
                  icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
                  destructive: true,
                  separatorBefore: true,
                  onSelect: () => setIsDeleteModalOpen(true),
                },
              ]
            : []),
        ]}
      />

      {errorBanner && (
        <Alert variant="destructive">
          <AlertDescription>{errorBanner}</AlertDescription>
        </Alert>
      )}

      {successBanner && (
        <Alert variant="success">
          <AlertDescription>{successBanner}</AlertDescription>
        </Alert>
      )}

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as "profile" | "memberships" | "sessions" | "audit")}
      >
        <TabsList>
          <TabsTrigger value="profile">Профиль</TabsTrigger>
          <TabsTrigger value="memberships">
            Членства в центрах ({user.memberships.length})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            Активные сессии ({user.userSessions.length})
          </TabsTrigger>
          <TabsTrigger value="audit">
            Журнал действий ({user.auditLogs.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "profile" && (
        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSaveProfile} className="max-w-2xl space-y-4">
              <h3 className="font-display text-base font-semibold text-foreground">
                Основные данные профиля
              </h3>

              <FormField label="ФИО" htmlFor="u-edit-name" required>
                <Input
                  id="u-edit-name"
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                />
              </FormField>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Email" htmlFor="u-edit-email" required>
                  <Input
                    id="u-edit-email"
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                  />
                </FormField>

                <FormField label="Телефон (+998...)" htmlFor="u-edit-phone">
                  <Input
                    id="u-edit-phone"
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="+998901234567"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField label="Username (логин)" htmlFor="u-edit-username">
                  <Input
                    id="u-edit-username"
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="username"
                  />
                </FormField>

                <FormField label="Язык интерфейса" htmlFor="u-edit-lang">
                  <select
                    id="u-edit-lang"
                    value={editLang}
                    onChange={(e) => setEditLang(e.target.value as "ru" | "uz-Latn")}
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="ru">Русский</option>
                    <option value="uz-Latn">Oʻzbekcha (Lotin)</option>
                  </select>
                </FormField>
              </div>

              <FormField label="Платформенная роль" htmlFor="u-edit-role">
                <select
                  id="u-edit-role"
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="NONE">Без платформенной роли (NONE)</option>
                  <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
                  <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
                  <option value="SEO_ADMIN">SEO_ADMIN</option>
                </select>
              </FormField>

              <FormField label="Причина изменения (для аудита)" htmlFor="u-edit-reason">
                <Input
                  id="u-edit-reason"
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Например: Обновление контактных данных по запросу пользователя"
                />
              </FormField>

              <FormActions>
                <Button type="submit" variant="primary" disabled={savingProfile}>
                  {savingProfile ? "Сохранение..." : "Сохранить изменения"}
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "memberships" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-foreground">
              Учебные центры пользователя
            </h3>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setIsAddMembershipOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Добавить в центр</span>
            </Button>
          </div>

          <DataTable
            data={user.memberships}
            columns={membershipColumns}
            getRowId={(m) => m.id}
            showColumnToggle={false}
            showDensityToggle={false}
            emptyTitle="Нет привязок к учебным центрам"
            emptyDescription="Пользователь пока не привязан ни к одному центру."
          />
        </div>
      )}

      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-base font-semibold text-foreground">
                Активные сессии пользователя
              </h3>
              <p className="text-xs text-muted-foreground">
                Устройства и браузеры, авторизованные в системе
              </p>
            </div>
            {user.userSessions.length > 0 && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setRevokeSessionsConfirmOpen(true)}
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Завершить все сессии</span>
              </Button>
            )}
          </div>

          <DataTable
            data={user.userSessions}
            columns={sessionColumns}
            getRowId={(s) => s.id}
            showColumnToggle={false}
            showDensityToggle={false}
            emptyTitle="Нет активных сессий"
          />
        </div>
      )}

      {activeTab === "audit" && (
        <DataTable
          data={user.auditLogs}
          columns={auditColumns}
          getRowId={(l) => l.id}
          showColumnToggle={false}
          showDensityToggle={false}
          emptyTitle="Записей в журнале не найдено"
        />
      )}

      <Dialog open={isResetPassModalOpen} onOpenChange={setIsResetPassModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{newGeneratedPassword ? "Пароль сброшен" : "Сброс пароля"}</DialogTitle>
          </DialogHeader>

          {newGeneratedPassword ? (
            <div className="space-y-4">
              <Alert variant="warning">
                <AlertDescription className="text-xs">
                  <strong>{t("ru", "ui4.oneTimeSecretWarn")}</strong> Все активные сессии отозваны. При следующем входе потребуется сменить пароль.
                </AlertDescription>
              </Alert>

              <div className="rounded-lg border border-border bg-muted/40 p-4 text-center font-mono text-sm font-semibold text-primary select-all">
                {newGeneratedPassword}
              </div>

              <FormActions>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(newGeneratedPassword);
                    setCopiedPass(true);
                    setTimeout(() => setCopiedPass(false), 2000);
                  }}
                >
                  {copiedPass ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedPass ? "Скопировано" : "Копировать пароль"}</span>
                </Button>
                <Button type="button" variant="primary" onClick={() => setIsResetPassModalOpen(false)}>
                  Закрыть
                </Button>
              </FormActions>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Будет сгенерирован новый пароль из 16 символов, старый пароль аннулирован, все
                активные сессии завершены и включена обязательная смена пароля при входе.
              </p>
              <FormActions>
                <Button type="button" variant="outline" onClick={() => setIsResetPassModalOpen(false)}>
                  Отмена
                </Button>
                <Button type="button" variant="primary" onClick={handleResetPassword} disabled={resettingPass}>
                  {resettingPass ? "Сброс..." : "Подтвердить сброс"}
                </Button>
              </FormActions>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={isBlockModalOpen}
        onOpenChange={setIsBlockModalOpen}
        title={user.isActive ? "Блокировка пользователя" : "Разблокировка пользователя"}
        description={
          user.isActive
            ? "При блокировке пользователь не сможет войти в систему, а все текущие сессии будут сброшены."
            : "Пользователь снова получит возможность авторизоваться в системе."
        }
        variant={user.isActive ? "destructive" : "primary"}
        loading={blockingUser}
        reasonLabel="Причина (минимум 5 символов)"
        reasonPlaceholder="Укажите причину действия для аудита..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        onConfirm={handleToggleBlock}
      />

      <ConfirmDialog
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        title="Мягкое удаление пользователя"
        description="Учётная запись будет деактивирована, email и телефон освобождены, все активные сессии завершены."
        variant="destructive"
        loading={deletingUser}
        reasonLabel="Обязательная причина удаления (минимум 5 символов)"
        reasonPlaceholder="Укажите причину удаления..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        confirmLabel="Удалить учётную запись"
        onConfirm={handleDeleteUser}
      />

      <ConfirmDialog
        open={revokeSessionsConfirmOpen}
        onOpenChange={setRevokeSessionsConfirmOpen}
        title="Завершить все сессии"
        description="Завершить все активные сессии пользователя?"
        variant="destructive"
        loading={mutatingMembershipOrSessions}
        onConfirm={confirmRevokeSessions}
      />

      <ConfirmDialog
        open={Boolean(pendingDeleteMembershipId)}
        onOpenChange={(next) => !next && setPendingDeleteMembershipId(null)}
        title="Удалить членство"
        description="Удалить членство пользователя в этом учебном центре?"
        variant="destructive"
        loading={mutatingMembershipOrSessions}
        onConfirm={confirmDeleteMembership}
      />

      <Dialog open={isAddMembershipOpen} onOpenChange={setIsAddMembershipOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить в учебный центр</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddMembership} className="space-y-4">
            <FormField label="Учебный центр" htmlFor="mem-center" required>
              <select
                id="mem-center"
                required
                value={newMemCenterId}
                onChange={(e) => setNewMemCenterId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Выберите учебный центр</option>
                {centers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Роль в центре" htmlFor="mem-role" required>
              <select
                id="mem-role"
                value={newMemRole}
                onChange={(e) => setNewMemRole(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="DIRECTOR">Директор (DIRECTOR)</option>
                <option value="CENTER_ADMIN">Администратор (CENTER_ADMIN)</option>
                <option value="ACCOUNTANT">Бухгалтер (ACCOUNTANT)</option>
                <option value="TEACHER">Преподаватель (TEACHER)</option>
                <option value="TEACHER_ASSISTANT">Ассистент (TEACHER_ASSISTANT)</option>
                <option value="STUDENT">Ученик (STUDENT)</option>
                <option value="PARENT">Родитель (PARENT)</option>
              </select>
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsAddMembershipOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={savingMembership || !newMemCenterId}>
                {savingMembership ? "Добавление..." : "Добавить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
