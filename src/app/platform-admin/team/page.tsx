"use client";

import { useEffect, useState } from "react";
import { Check, Plus, ShieldAlert } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  FormActions,
  FormField,
  Input,
  PageHeader,
} from "@/components/ui";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";

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

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addFullName, setAddFullName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | "SEO_ADMIN">("PLATFORM_ADMIN");
  const [addPassword, setAddPassword] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<CredentialsData | null>(null);

  const [pendingToggle, setPendingToggle] = useState<TeamMember | null>(null);
  const [pendingRole, setPendingRole] = useState<{ member: TeamMember; newRole: string } | null>(null);
  const [mutating, setMutating] = useState(false);

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

      setIsAddOpen(false);
      setCreatedCredentials({
        fullName: addFullName,
        login: json.member.email,
        password: json.initialPassword,
        loginUrl: "/login",
        mustChangePassword: true,
      });
      fetchMembers();
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка сети");
    } finally {
      setAddingMember(false);
    }
  };

  const confirmToggleActive = async () => {
    if (!pendingToggle) return;
    const newState = !pendingToggle.isActive;
    setMutating(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/platform/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingToggle.id, isActive: newState }),
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
    } finally {
      setMutating(false);
      setPendingToggle(null);
    }
  };

  const confirmChangeRole = async () => {
    if (!pendingRole) return;
    setMutating(true);
    setErrorBanner("");
    try {
      const res = await fetch("/api/platform/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: pendingRole.member.id, role: pendingRole.newRole }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setErrorBanner(json.error || "Не удалось изменить роль сотрудника");
        return;
      }
      setSuccessBanner("Роль изменена");
      fetchMembers();
    } catch {
      setErrorBanner("Ошибка сети");
    } finally {
      setMutating(false);
      setPendingRole(null);
    }
  };

  const columns: DataTableColumn<TeamMember>[] = [
    {
      id: "member",
      header: "Сотрудник",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (m) => m.fullName,
      cell: (member) => (
        <div>
          <div className="font-medium text-foreground">{member.fullName}</div>
          <div className="text-xs text-muted-foreground">{member.email}</div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Платформенная роль",
      cell: (member) =>
        member.platformRole === "SUPERADMIN" ? (
          <Badge variant="destructive">SUPERADMIN (Владелец)</Badge>
        ) : (
          <select
            aria-label={`Роль ${member.fullName}`}
            value={member.platformRole}
            onChange={(e) => setPendingRole({ member, newRole: e.target.value })}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium text-foreground"
          >
            <option value="PLATFORM_ADMIN">PLATFORM_ADMIN</option>
            <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT</option>
            <option value="SEO_ADMIN">SEO_ADMIN</option>
          </select>
        ),
    },
    {
      id: "status",
      header: "Статус",
      cell: (member) =>
        member.isActive ? (
          <Badge variant="success">
            <Check className="h-3 w-3" aria-hidden="true" />
            <span>Активен</span>
          </Badge>
        ) : (
          <Badge variant="destructive">
            <ShieldAlert className="h-3 w-3" aria-hidden="true" />
            <span>Заблокирован</span>
          </Badge>
        ),
    },
    {
      id: "lastLogin",
      header: "Последний вход",
      hideOnMobile: true,
      cell: (member) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {member.lastLoginAt
            ? new Date(member.lastLoginAt).toLocaleString("ru-RU", {
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
      id: "createdAt",
      header: "Добавлен",
      hideOnMobile: true,
      cell: (member) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(member.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (member) =>
        member.platformRole !== "SUPERADMIN" ? (
          <Button
            type="button"
            variant={member.isActive ? "outline" : "primary"}
            size="sm"
            onClick={() => setPendingToggle(member)}
          >
            {member.isActive ? "Заблокировать" : "Разблокировать"}
          </Button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Команда платформы"
        description="Управление системными администраторами и сотрудниками поддержки"
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setAddFullName("");
              setAddEmail("");
              setAddPassword("");
              setErrorBanner("");
              setIsAddOpen(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Добавить сотрудника</span>
          </Button>
        }
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

      <DataTable
        data={members}
        columns={columns}
        getRowId={(m) => m.id}
        loading={loading}
        emptyTitle="Сотрудники не найдены"
        emptyDescription="Добавьте первого администратора или сотрудника поддержки платформы."
        emptyAction={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setIsAddOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Добавить сотрудника</span>
          </Button>
        }
      />

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить сотрудника платформы</DialogTitle>
            <DialogDescription>
              Укажите имя, email и роль для нового участника команды платформы.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddSubmit} className="space-y-4">
            <FormField label="ФИО" htmlFor="team-full-name" required>
              <Input
                id="team-full-name"
                type="text"
                required
                value={addFullName}
                onChange={(e) => setAddFullName(e.target.value)}
                placeholder="Рустам Каримов"
              />
            </FormField>

            <FormField label="Email" htmlFor="team-email" required>
              <Input
                id="team-email"
                type="email"
                required
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="staff@platform.uz"
              />
            </FormField>

            <FormField label="Роль сотрудника" htmlFor="team-role" required>
              <select
                id="team-role"
                value={addRole}
                onChange={(e) =>
                  setAddRole(
                    e.target.value as "PLATFORM_ADMIN" | "PLATFORM_SUPPORT" | "SEO_ADMIN"
                  )
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="PLATFORM_ADMIN">PLATFORM_ADMIN (Администратор платформы)</option>
                <option value="PLATFORM_SUPPORT">PLATFORM_SUPPORT (Служба поддержки)</option>
                <option value="SEO_ADMIN">SEO_ADMIN (SEO-администратор)</option>
              </select>
            </FormField>

            <FormField label="Пароль (пусто для автогенерации)" htmlFor="team-password">
              <Input
                id="team-password"
                type="text"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                placeholder="Автогенерация 16 символов"
                className="font-mono"
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={addingMember}>
                {addingMember ? "Создание..." : "Создать сотрудника"}
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

      <ConfirmDialog
        open={Boolean(pendingToggle)}
        onOpenChange={(next) => !next && setPendingToggle(null)}
        title={
          pendingToggle?.isActive ? "Заблокировать сотрудника" : "Разблокировать сотрудника"
        }
        description={
          pendingToggle
            ? `${pendingToggle.isActive ? "Заблокировать" : "Разблокировать"} сотрудника ${pendingToggle.fullName}?`
            : undefined
        }
        variant={pendingToggle?.isActive ? "destructive" : "primary"}
        loading={mutating}
        onConfirm={confirmToggleActive}
      />

      <ConfirmDialog
        open={Boolean(pendingRole)}
        onOpenChange={(next) => !next && setPendingRole(null)}
        title="Изменить роль сотрудника"
        description={
          pendingRole
            ? `Изменить платформенную роль для ${pendingRole.member.fullName} на ${pendingRole.newRole}?`
            : undefined
        }
        variant="primary"
        loading={mutating}
        onConfirm={confirmChangeRole}
      />
    </div>
  );
}
