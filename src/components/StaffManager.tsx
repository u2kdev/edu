"use client";

import { useState, useEffect } from "react";
import type { ComponentType } from "react";
import Link from "next/link";
import {
  Archive,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  HeadphonesIcon,
  Key,
  Loader2,
  Mail,
  Phone,
  Shield,
  Trash2,
  UserPlus,
  X,
  XCircle,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  ConfirmDialog,
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

interface StaffMember {
  id: string;
  role: string;
  status: string;
  joinedAt: string;
  user: {
    id: string;
    email: string;
    phone: string | null;
    fullName: string;
    avatarUrl: string | null;
    isActive: boolean;
    lastLoginAt: string | null;
    createdAt: string;
  };
}

interface StaffManagerProps {
  locale: string;
  currentRole: string;
}

const ROLE_CONFIG: Record<
  string,
  { label: string; labelUz: string; icon: ComponentType<{ className?: string }>; variant: BadgeVariant }
> = {
  DIRECTOR: {
    label: "Директор",
    labelUz: "Direktor",
    icon: Shield,
    variant: "warning",
  },
  CENTER_ADMIN: {
    label: "Админ центра",
    labelUz: "Markaz admini",
    icon: Shield,
    variant: "primary",
  },
  ACCOUNTANT: {
    label: "Бухгалтер",
    labelUz: "Hisobchi",
    icon: Shield,
    variant: "warning",
  },
  TEACHER: {
    label: "Преподаватель",
    labelUz: "Oʻqituvchi",
    icon: GraduationCap,
    variant: "success",
  },
  TEACHER_ASSISTANT: {
    label: "Помощник преподавателя",
    labelUz: "Oʻqituvchi yordamchisi",
    icon: GraduationCap,
    variant: "info",
  },
  CENTER_SUPPORT: {
    label: "Саппорт центра",
    labelUz: "Markaz qoʻllab-quvvatlashi",
    icon: HeadphonesIcon,
    variant: "neutral",
  },
  STUDENT: {
    label: "Ученик",
    labelUz: "Oʻquvchi",
    icon: GraduationCap,
    variant: "info",
  },
};

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export default function StaffManager({ locale, currentRole }: StaffManagerProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterNeverLoggedIn, setFilterNeverLoggedIn] = useState(false);

  const [credentials, setCredentials] = useState<CredentialsData | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRole, setNewRole] = useState("TEACHER");
  const [manualPassword, setManualPassword] = useState("");
  const [isManualPassword, setIsManualPassword] = useState(false);

  const isUz = locale === "uz-Latn";

  useEffect(() => {
    loadStaff();
  }, []);

  async function loadStaff() {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/staff");
      const data = await res.json();
      if (data.staff) setStaff(data.staff);
    } catch {
      setError("Failed to load staff");
    }
    setLoading(false);
  }

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFormError(null);
    setSuccess(null);

    if (!newEmail && !newPhone) {
      const msg = isUz ? "Email yoki telefon kiritilishi shart" : "Необходимо указать email или телефон";
      setFormError(msg);
      setSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/tenant/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newEmail || undefined,
          fullName: newName,
          phone: newPhone || undefined,
          staffRole: newRole,
          password: isManualPassword ? manualPassword : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Error adding staff member";
        setFormError(msg);
        setSaving(false);
        return;
      }

      if (data.credentials) {
        setCredentials(data.credentials);
      }

      setSuccess(isUz ? `${newName} muvaffaqiyatli qoʻshildi` : `${newName} успешно добавлен(а)`);
      setNewEmail("");
      setNewName("");
      setNewPhone("");
      setNewRole("TEACHER");
      setManualPassword("");
      setIsManualPassword(false);
      setShowAddForm(false);
      await loadStaff();
    } catch {
      setFormError("Network error");
    }
    setSaving(false);
  }

  async function toggleStatus(membershipId: string, currentStatus: string) {
    const newStatus = currentStatus === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      const res = await fetch("/api/tenant/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        return;
      }

      await loadStaff();
      setSuccess(isUz ? "Xodim holati oʻzgartirildi" : "Статус сотрудника изменён");
    } catch {
      setError("Network error");
    }
  }

  async function handleArchive(membershipId: string) {
    try {
      const res = await fetch("/api/tenant/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ membershipId, status: "ARCHIVED" }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Error archiving member");
        return;
      }

      await loadStaff();
      setSuccess(isUz ? "Aʼzo muvaffaqiyatli arxivlandi" : "Пользователь успешно архивирован");
    } catch {
      setError("Network error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const membershipId = deleteTarget.id;
    setDeleteTarget(null);
    try {
      const res = await fetch(`/api/tenant/staff?membershipId=${membershipId}`, {
        method: "DELETE",
      });

      const data = (await res.json()) as { error?: string; hint?: string };
      if (!res.ok) {
        if (res.status === 409 && data.hint) {
          setError(
            isUz
              ? `${data.error || "Oʻchirib boʻlmaydi"}. Maslahat: ${data.hint}`
              : `${data.error || "Невозможно удалить"}. Подсказка: ${data.hint}`
          );
        } else {
          setError(data.error || "Error deleting member");
        }
        return;
      }

      await loadStaff();
      setSuccess(isUz ? "Aʼzo muvaffaqiyatli oʻchirildi" : "Пользователь успешно удалён");
    } catch {
      setError("Network error");
    }
  }

  const assignableRoles =
    currentRole === "DIRECTOR"
      ? ["CENTER_ADMIN", "ACCOUNTANT", "TEACHER", "TEACHER_ASSISTANT", "CENTER_SUPPORT"]
      : ["TEACHER", "CENTER_SUPPORT"];

  const filteredStaff = staff.filter((m) => {
    const q = search.toLowerCase();
    const matchesSearch =
      m.user.fullName.toLowerCase().includes(q) ||
      (m.user.email && m.user.email.toLowerCase().includes(q)) ||
      (m.user.phone && m.user.phone.includes(q)) ||
      m.role.toLowerCase().includes(q);

    if (!matchesSearch) return false;
    if (filterNeverLoggedIn && m.user.lastLoginAt) return false;

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12" role="status" aria-label={isUz ? "Yuklanmoqda..." : "Загрузка..."}>
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      </div>
    );
  }

  const columns: DataTableColumn<StaffMember>[] = [
    {
      id: "member",
      header: isUz ? "Xodim" : "Сотрудник",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (m) => m.user.fullName,
      cell: (member) => {
        const isInactive = member.status !== "ACTIVE";
        return (
          <div className={`flex items-center gap-3 min-w-0 ${isInactive ? "opacity-60" : ""}`}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {member.user.fullName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <Link
                href={`/center/staff/${member.id}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-primary transition-colors truncate"
              >
                <span className="truncate">{member.user.fullName}</span>
                <ExternalLink className="h-3.5 w-3.5 opacity-60 shrink-0" aria-hidden="true" />
              </Link>
              {member.user.lastLoginAt ? (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>{new Date(member.user.lastLoginAt).toLocaleDateString()}</span>
                </div>
              ) : (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-warning">
                  <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span>Ни разу не входил</span>
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "contacts",
      header: isUz ? "Kontaktlar" : "Контакты",
      cell: (member) => {
        const isSynthetic = member.user.email.endsWith("@noemail.local");
        return (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            {!isSynthetic && (
              <div className="flex items-center gap-1.5">
                <Mail className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{member.user.email}</span>
              </div>
            )}
            {member.user.phone && (
              <div className="flex items-center gap-1.5 tabular-nums">
                <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                <span>{member.user.phone}</span>
              </div>
            )}
            {isSynthetic && !member.user.phone && <span>—</span>}
          </div>
        );
      },
    },
    {
      id: "role",
      header: isUz ? "Rol" : "Роль",
      sortable: true,
      sortValue: (m) => m.role,
      cell: (member) => {
        const roleConfig = ROLE_CONFIG[member.role] || {
          label: member.role,
          labelUz: member.role,
          icon: Shield,
          variant: "neutral" as BadgeVariant,
        };
        const RoleIcon = roleConfig.icon;
        return (
          <Badge variant={roleConfig.variant}>
            <RoleIcon className="h-3 w-3" aria-hidden="true" />
            <span>{isUz ? roleConfig.labelUz : roleConfig.label}</span>
          </Badge>
        );
      },
    },
    {
      id: "status",
      header: isUz ? "Holat" : "Статус",
      cell: (member) => {
        if (member.status === "ARCHIVED") {
          return <Badge variant="warning">{isUz ? "Arxivlangan" : "Архивирован"}</Badge>;
        }
        if (member.status !== "ACTIVE") {
          return <Badge variant="destructive">{isUz ? "Faolsiz" : "Неактивен"}</Badge>;
        }
        return <Badge variant="success">{isUz ? "Faol" : "Активен"}</Badge>;
      },
    },
    {
      id: "actions",
      header: isUz ? "Amallar" : "Действия",
      align: "right",
      cell: (member) => {
        if (member.role === "DIRECTOR") return null;
        return (
          <div className="inline-flex items-center gap-1" data-no-row-click="true">
            <Link
              href={`/center/staff/${member.id}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Профиль и доступ"
            >
              <Key className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => toggleStatus(member.id, member.status)}
              title={
                member.status === "ACTIVE"
                  ? isUz ? "Faolsizlantirish" : "Деактивировать"
                  : isUz ? "Faollashtirish" : "Активировать"
              }
            >
              {member.status === "ACTIVE" ? (
                <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" />
              )}
            </Button>
            {member.status !== "ARCHIVED" && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => handleArchive(member.id)}
                title={isUz ? "Arxivlash" : "Архивировать"}
              >
                <Archive className="h-4 w-4 text-warning" aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setDeleteTarget(member)}
              title={isUz ? "Oʻchirish" : "Удалить"}
            >
              <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
            </Button>
          </div>
        );
      },
    },
  ];

  const hasFilters = Boolean(search) || filterNeverLoggedIn;

  return (
    <div className="space-y-6">
      <PageHeader
        title={isUz ? "Markaz xodimlari" : "Сотрудники центра"}
        description={isUz ? `Jami ${staff.length} xodim` : `Всего ${staff.length} сотрудников`}
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setFormError(null);
              setShowAddForm(true);
            }}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            <span>{isUz ? "Xodim qoʻshish" : "Добавить сотрудника"}</span>
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Close"
              className="rounded p-1 text-destructive-subtle-foreground hover:opacity-75"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess(null)}
              aria-label="Close"
              className="rounded p-1 text-success-subtle-foreground hover:opacity-75"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск сотрудника по имени, email, телефону..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setFilterNeverLoggedIn(false);
        }}
      >
        <Button
          type="button"
          variant={filterNeverLoggedIn ? "primary" : "secondary"}
          size="sm"
          onClick={() => setFilterNeverLoggedIn(!filterNeverLoggedIn)}
        >
          Ни разу не входили
        </Button>
      </FilterBar>

      <DataTable
        data={filteredStaff}
        columns={columns}
        getRowId={(m) => m.id}
        getRowHref={(m) => `/center/staff/${m.id}`}
        locale={locale}
        emptyTitle={
          isUz
            ? "Hali xodimlar qoʻshilmagan"
            : staff.length === 0
            ? "Сотрудники ещё не добавлены"
            : "Сотрудники не найдены"
        }
        emptyDescription={
          isUz
            ? "Jamoaga oʻqituvchi yoki administrator qoʻshing."
            : "Добавьте преподавателя или администратора в команду центра."
        }
        mobileMode="cards"
      />

      <Dialog
        open={showAddForm}
        onOpenChange={(next) => {
          setShowAddForm(next);
          if (!next) setFormError(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {isUz ? "Yangi xodim qoʻshish" : "Добавить нового сотрудника"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddStaff} className="space-y-4">
            {formError && (
              <Alert variant="destructive">
                <AlertDescription>{formError}</AlertDescription>
              </Alert>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label={isUz ? "FISh" : "ФИО"} htmlFor="staff-fullname" required>
                <Input
                  id="staff-fullname"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                  placeholder={isUz ? "Ism Familiya" : "Иван Петров"}
                />
              </FormField>

              <FormField label="Email" htmlFor="staff-email">
                <Input
                  id="staff-email"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="staff@example.com"
                />
              </FormField>

              <FormField label={isUz ? "Telefon" : "Телефон"} htmlFor="staff-phone">
                <Input
                  id="staff-phone"
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+998 90 123 45 67"
                />
              </FormField>

              <FormField label={isUz ? "Rol" : "Роль"} htmlFor="staff-role" required>
                <select
                  id="staff-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className={selectClassName}
                >
                  {assignableRoles.map((r) => (
                    <option key={r} value={r}>
                      {isUz ? ROLE_CONFIG[r]?.labelUz || r : ROLE_CONFIG[r]?.label || r}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="space-y-3 border-t border-border pt-3">
              <div className="flex flex-wrap items-center gap-4 text-sm text-foreground">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="passwordMode"
                    checked={!isManualPassword}
                    onChange={() => setIsManualPassword(false)}
                    className="h-4 w-4 border-input text-primary focus:ring-ring"
                  />
                  <span>Сгенерировать безопасный пароль автоматически</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="passwordMode"
                    checked={isManualPassword}
                    onChange={() => setIsManualPassword(true)}
                    className="h-4 w-4 border-input text-primary focus:ring-ring"
                  />
                  <span>Задать пароль вручную</span>
                </label>
              </div>

              {isManualPassword && (
                <FormField label="Пароль" htmlFor="staff-password">
                  <Input
                    id="staff-password"
                    type="password"
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    placeholder="Минимум 6 символов"
                  />
                </FormField>
              )}
            </div>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setShowAddForm(false)}>
                {isUz ? "Bekor qilish" : "Отмена"}
              </Button>
              <Button type="submit" variant="primary" disabled={saving} loading={saving}>
                {isUz ? "Qoʻshish" : "Добавить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(next) => !next && setDeleteTarget(null)}
        title={isUz ? "Xodimni oʻchirish" : "Удалить сотрудника"}
        description={
          deleteTarget
            ? isUz
              ? `${deleteTarget.user.fullName} markazdan oʻchiriladi.`
              : `${deleteTarget.user.fullName} будет удалён(а) из центра.`
            : undefined
        }
        confirmLabel={isUz ? "Oʻchirish" : "Удалить"}
        cancelLabel={isUz ? "Bekor qilish" : "Отмена"}
        variant="destructive"
        locale={locale}
        onConfirm={confirmDelete}
      />

      {credentials && (
        <CredentialsModal
          isOpen={Boolean(credentials)}
          onClose={() => setCredentials(null)}
          credentials={credentials}
          locale={locale}
        />
      )}
    </div>
  );
}
