"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  Calendar,
  Clock,
  History,
  Key,
  Laptop,
  Lock,
  Mail,
  Phone,
  Send,
  Shield,
  Unlock,
  User,
  Users,
} from "lucide-react";
import { t } from "@/i18n";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EntityDetailHeader,
  type EntityActionItem,
  FormActions,
  FormField,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
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

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

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
  const [activeTab, setActiveTab] = useState<"profile" | "access" | "groups" | "history">("profile");

  const [membership, setMembership] = useState(initialMembership);
  const [user, setUser] = useState(initialUser);

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [username, setUsername] = useState(user.username || "");
  const [preferredLanguage, setPreferredLanguage] = useState(user.preferredLanguage || "ru");
  const [role, setRole] = useState(membership.role);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState<"BLOCK" | "UNBLOCK" | "ARCHIVE" | null>(null);

  const canEditRole = actorRole === "DIRECTOR";

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
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");

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

  const handleResetPassword = async () => {
    setConfirmResetOpen(false);
    setActionLoading(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tenant/users/${membership.id}/reset-password`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось сбросить пароль");

      setNewCredentials(data.credentials);
      setCredentialsModalOpen(true);
      setActionNotice({ type: "success", text: "Пароль успешно сброшен" });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendResetLink = async () => {
    setActionLoading(true);
    setActionNotice(null);

    try {
      const res = await fetch(`/api/tenant/users/${membership.id}/send-reset-link`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Не удалось отправить ссылку");

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

  const handleStatusAction = async (reason?: string) => {
    if (!reasonModalOpen || !reason || reason.trim().length < 5) return;

    setActionLoading(true);
    setActionNotice(null);

    try {
      if (reasonModalOpen === "ARCHIVE") {
        const res = await fetch(
          `/api/tenant/users/${membership.id}?reason=${encodeURIComponent(reason)}`,
          { method: "DELETE" }
        );
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
            reason,
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
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  const statusLabel =
    membership.status === "ACTIVE"
      ? "Активен"
      : membership.status === "BLOCKED"
      ? "Заблокирован"
      : "В архиве";
  const statusVariant: BadgeVariant =
    membership.status === "ACTIVE"
      ? "success"
      : membership.status === "BLOCKED"
      ? "destructive"
      : "neutral";

  const menuActions: EntityActionItem[] = [
    ...(manageability.canManage
      ? [
          {
            id: "reset-password",
            label: "Сбросить пароль",
            onSelect: () => setConfirmResetOpen(true),
          },
        ]
      : []),
    {
      id: "send-reset-link",
      label: "Отправить ссылку сброса",
      onSelect: () => void handleSendResetLink(),
    },
    ...(membership.status === "ACTIVE"
      ? [
          {
            id: "block",
            label: "Заблокировать в центре",
            destructive: true,
            onSelect: () => setReasonModalOpen("BLOCK"),
          },
        ]
      : [
          {
            id: "unblock",
            label: "Разблокировать в центре",
            onSelect: () => setReasonModalOpen("UNBLOCK"),
          },
        ]),
    ...(membership.status !== "ARCHIVED"
      ? [
          {
            id: "archive",
            label: "Архивировать",
            destructive: true,
            onSelect: () => setReasonModalOpen("ARCHIVE"),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        backHref="/center/staff"
        backLabel={t(locale, "common.back")}
        icon={<User className="h-5 w-5" />}
        title={user.fullName}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        locale={locale}
        badges={
          <>
            <Badge variant="neutral">
              <Shield className="h-3 w-3" aria-hidden="true" />
              <span>{membership.role}</span>
            </Badge>
            {manageability.isShared && <Badge variant="info">Общий аккаунт</Badge>}
          </>
        }
        meta={
          <>
            {user.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{user.email}</span>
              </span>
            )}
            {user.phone && (
              <span className="inline-flex items-center gap-1 tabular-nums">
                <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{user.phone}</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{new Date(membership.joinedAt).toLocaleDateString()}</span>
            </span>
          </>
        }
        menuActions={menuActions}
      />

      {actionNotice && (
        <Alert variant={actionNotice.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{actionNotice.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4" aria-hidden="true" />
            <span>Профиль</span>
          </TabsTrigger>
          <TabsTrigger value="access">
            <Key className="h-4 w-4" aria-hidden="true" />
            <span>Доступ и безопасность</span>
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Группы ({groups.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4" aria-hidden="true" />
            <span>История ({auditLogs.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardContent className="pt-6 space-y-5">
              {manageability.isShared && (
                <Alert variant="info">
                  <AlertDescription>
                    <strong className="block font-semibold">Пользователь состоит в нескольких центрах</strong>
                    Смена контактных данных (email, телефон, логин) возможна только самим пользователем в настройках его аккаунта.
                  </AlertDescription>
                </Alert>
              )}

              {profileSuccess && (
                <Alert variant="success">
                  <AlertDescription>Профиль успешно сохранен</AlertDescription>
                </Alert>
              )}

              {profileError && (
                <Alert variant="destructive">
                  <AlertDescription>{profileError}</AlertDescription>
                </Alert>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4">
                <FormField label="ФИО" htmlFor="staff-profile-name" required>
                  <Input
                    id="staff-profile-name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Телефон" htmlFor="staff-profile-phone">
                    <Input
                      id="staff-profile-phone"
                      type="text"
                      value={phone}
                      disabled={manageability.isShared}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998901234567"
                    />
                  </FormField>

                  <FormField label="Email" htmlFor="staff-profile-email">
                    <Input
                      id="staff-profile-email"
                      type="email"
                      value={email}
                      disabled={manageability.isShared}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                    />
                  </FormField>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Имя пользователя (логин)" htmlFor="staff-profile-username">
                    <Input
                      id="staff-profile-username"
                      type="text"
                      value={username}
                      disabled={manageability.isShared}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="username"
                    />
                  </FormField>

                  <FormField label="Язык интерфейса" htmlFor="staff-profile-lang">
                    <select
                      id="staff-profile-lang"
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className={selectClassName}
                    >
                      <option value="ru">Русский</option>
                      <option value="uz-Latn">O&apos;zbekcha</option>
                    </select>
                  </FormField>
                </div>

                {canEditRole && (
                  <FormField label="Роль в центре" htmlFor="staff-profile-role">
                    <select
                      id="staff-profile-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className={selectClassName}
                    >
                      <option value="CENTER_ADMIN">Администратор центра</option>
                      <option value="ACCOUNTANT">Бухгалтер</option>
                      <option value="TEACHER">Преподаватель</option>
                      <option value="TEACHER_ASSISTANT">Помощник преподавателя</option>
                      <option value="CENTER_SUPPORT">Служба поддержки</option>
                    </select>
                  </FormField>
                )}

                <FormActions>
                  <Button type="submit" variant="primary" disabled={savingProfile} loading={savingProfile}>
                    {savingProfile ? "Сохранение..." : "Сохранить изменения"}
                  </Button>
                </FormActions>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <div className="max-w-3xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Key className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Статус учётной записи</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-lg border border-border bg-muted p-4">
                    <span className="text-xs text-muted-foreground">Последний вход</span>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {user.lastLoginAt ? (
                        <span className="tabular-nums">{new Date(user.lastLoginAt).toLocaleString()}</span>
                      ) : (
                        <Badge variant="warning">
                          <Clock className="h-3 w-3" aria-hidden="true" />
                          <span>Ни разу не входил</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border bg-muted p-4">
                    <span className="text-xs text-muted-foreground">Тип аккаунта</span>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {manageability.isShared ? "Общий аккаунт (несколько центров)" : "Локальный аккаунт центра"}
                    </div>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="text-sm font-medium text-foreground">Действия с паролем</div>
                  <div className="flex flex-wrap gap-3">
                    {manageability.canManage ? (
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setConfirmResetOpen(true)}
                        disabled={actionLoading}
                      >
                        <Key className="h-4 w-4" aria-hidden="true" />
                        <span>Сбросить пароль (показать новый)</span>
                      </Button>
                    ) : (
                      <Alert variant="warning">
                        <AlertDescription>
                          {manageability.reason}
                          <div className="mt-1">
                            Вы можете отправить пользователю ссылку для самостоятельного сброса пароля.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleSendResetLink}
                      disabled={actionLoading}
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      <span>Отправить ссылку сброса (Email/SMS)</span>
                    </Button>
                  </div>
                </div>

                <div className="space-y-3 border-t border-border pt-4">
                  <div className="text-sm font-medium text-foreground">Статус членства в центре</div>
                  <div className="flex flex-wrap gap-3">
                    {membership.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setReasonModalOpen("BLOCK")}
                      >
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        <span>Заблокировать в центре</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setReasonModalOpen("UNBLOCK")}
                      >
                        <Unlock className="h-4 w-4" aria-hidden="true" />
                        <span>Разблокировать в центре</span>
                      </Button>
                    )}

                    {membership.status !== "ARCHIVED" && (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setReasonModalOpen("ARCHIVE")}
                      >
                        <Archive className="h-4 w-4" aria-hidden="true" />
                        <span>Архивировать</span>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Laptop className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Активные сессии в этом центре ({activeSessions.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет активных сессий</p>
                ) : (
                  <div className="divide-y divide-border">
                    {activeSessions.map((session) => (
                      <div key={session.id} className="flex items-center justify-between py-2.5 text-sm">
                        <div className="min-w-0">
                          <div className="font-mono text-foreground">{session.ipAddress || "Неизвестный IP"}</div>
                          <div className="truncate max-w-sm text-xs text-muted-foreground">
                            {session.userAgent || "Браузер"}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground tabular-nums">
                          <div>Создана: {new Date(session.createdAt).toLocaleDateString()}</div>
                          <div>Истекает: {new Date(session.expiresAt).toLocaleDateString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="groups">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Назначенные группы</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">Преподаватель не назначен ни в одну группу</p>
              ) : (
                <div className="divide-y divide-border">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between py-3">
                      <span className="text-sm font-medium text-foreground">{group.name}</span>
                      <Link
                        href="/center/groups"
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        К группе
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>История действий</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {auditLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">Записей аудита пока нет</p>
              ) : (
                <div className="divide-y divide-border text-sm">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between gap-4 py-2.5">
                      <div>
                        <span className="font-mono font-medium text-primary">{log.action}</span>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {log.details ? JSON.stringify(log.details) : "—"}
                        </div>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Сбросить пароль сотрудника"
        description="Все текущие сессии сотрудника будут завершены. Новый пароль будет показан один раз."
        confirmLabel="Сбросить пароль"
        variant="destructive"
        loading={actionLoading}
        locale={locale}
        onConfirm={handleResetPassword}
      />

      <ConfirmDialog
        open={Boolean(reasonModalOpen)}
        onOpenChange={(next) => !next && setReasonModalOpen(null)}
        title={
          reasonModalOpen === "BLOCK"
            ? "Блокировка сотрудника"
            : reasonModalOpen === "UNBLOCK"
            ? "Разблокировка сотрудника"
            : "Архивация сотрудника"
        }
        description="Укажите причину действия (минимум 5 символов). Она будет записана в журнал аудита."
        reasonLabel="Причина"
        reasonPlaceholder="Причина действия..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        confirmLabel="Подтвердить"
        variant={reasonModalOpen === "UNBLOCK" ? "primary" : "destructive"}
        loading={actionLoading}
        locale={locale}
        onConfirm={handleStatusAction}
      />

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
