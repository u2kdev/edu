"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Archive,
  Building2,
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  History,
  KeyRound,
  Printer,
  Receipt,
  RotateCcw,
  Shield,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import ImpersonateButton from "@/components/ImpersonateButton";
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
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EntityDetailHeader,
  FormActions,
  FormField,
  Input,
  Skeleton,
  StatCard,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from "@/components/ui";
import { t } from "@/i18n";

interface CenterDetails {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  email?: string | null;
  timeZone?: string | null;
  status: string;
  organizationKind?: string | null;
  legalName?: string | null;
  inn?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  suspensionReason?: string | null;
  cancelledAt?: string | null;
  cancelledReason?: string | null;
  createdAt: string;
  trialEndsAt?: string | null;
  director?: { id?: string; fullName?: string | null; email?: string | null; phone?: string | null } | null;
  owner?: { id?: string; fullName?: string | null; email?: string | null; phone?: string | null } | null;
  metrics?: {
    usersByRole?: Record<string, number>;
    activeStudents?: number;
    activeTeachers?: number;
    activeCoursesCount?: number;
    lastActivityAt?: string;
    limits?: {
      maxStudents: number;
      currentStudents: number;
      percentUsed: number;
    };
  } | null;
  auditLogs?: Array<{
    action: string;
    createdAt: string;
    details?: string | null;
    ipAddress?: string | null;
    actor?: { fullName?: string; email?: string } | null;
  }>;
  memberships?: Array<{
    id: string;
    role: string;
    status: string;
    createdAt: string;
    user: {
      id: string;
      fullName: string;
      email: string;
      phone?: string | null;
      lastLoginAt?: string | null;
    };
  }>;
  tickets?: Array<{
    id: string;
    ticketNumber?: string;
    subject: string;
    status: string;
    priority: string;
    createdAt: string;
    creator?: { fullName: string; email: string } | null;
  }>;
  subscriptions?: Array<{
    id: string;
    status: string;
    currentPeriodStartsAt: string;
    currentPeriodEndsAt: string;
    autoRenew: boolean;
    plan: {
      id: string;
      name: string;
      priceMonthly: number;
      maxStudents: number;
      maxTeachers: number;
      maxBranches: number;
    };
  }>;
  platformPayments?: Array<{
    id: string;
    invoiceNumber: string | null;
    amount: number;
    status: string;
    paidAt: string | null;
    paymentMethod: string;
    plan?: { name: string } | null;
  }>;
}

const CENTER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  TRIAL: "info",
  PAUSED: "warning",
  BLOCKED: "destructive",
  CANCELLED: "neutral",
};

export default function PlatformCenterDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [data, setData] = useState<CenterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "billing" | "tickets" | "history" | "edit" | "director" | "suspend"
  >("overview");

  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    email: "",
    timeZone: "",
    organizationKind: "LEARNING_CENTER",
    legalName: "",
    inn: "",
    contactPerson: "",
    address: "",
  });
  const [directorEmail, setDirectorEmail] = useState("");
  const [directorResetUrl, setDirectorResetUrl] = useState<string | null>(null);
  const [copiedDirectorUrl, setCopiedDirectorUrl] = useState(false);
  const [suspendForm, setSuspendForm] = useState({ action: "pause", reason: "" });
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(
    null
  );

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [userResetModal, setUserResetModal] = useState<{ url: string; userName: string } | null>(null);
  const [userResetCopied, setUserResetCopied] = useState(false);

  const [plans, setPlans] = useState<
    Array<{ id: string; name: string; maxStudents: number; maxTeachers: number; priceMonthly: number }>
  >([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [extendMonths, setExtendMonths] = useState(1);
  const [changingPlan, setChangingPlan] = useState(false);
  const [extendingSub, setExtendingSub] = useState(false);
  const [forcePlanConfirm, setForcePlanConfirm] = useState<{ subId: string; message: string } | null>(
    null
  );

  useEffect(() => {
    if (activeTab === "billing") {
      fetch("/api/platform/plans")
        .then((res) => res.json())
        .then((json) => {
          if (json.plans) setPlans(json.plans);
        })
        .catch(() => {});
    }
  }, [activeTab]);

  const fetchCenter = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/platform/centers/${id}`);
      if (!res.ok) throw new Error("Не удалось загрузить данные центра");
      const json = await res.json();
      const center = json.data || json.center || json;
      setData({
        ...center,
        director: json.director || center.owner,
        metrics: json.metrics,
        auditLogs: json.auditLogs || [],
        memberships: json.memberships || center.memberships || [],
        tickets: json.tickets || center.supportTickets || [],
      });
      setEditForm({
        name: center.name || "",
        phone: center.phone || "",
        email: center.email || "",
        timeZone: center.timeZone || "",
        organizationKind: center.organizationKind || "LEARNING_CENTER",
        legalName: center.legalName || "",
        inn: center.inn || "",
        contactPerson: center.contactPerson || "",
        address: center.address || "",
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка при получении данных");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCenter();
  }, [fetchCenter]);

  const showMessage = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 5000);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: Record<string, string> = {
        name: editForm.name,
        email: editForm.email,
        phone: editForm.phone,
        timeZone: editForm.timeZone,
      };
      if (editForm.organizationKind && editForm.organizationKind !== "LEARNING_CENTER") {
        payload.organizationKind = editForm.organizationKind;
      }
      if (editForm.legalName) payload.legalName = editForm.legalName;
      if (editForm.inn) payload.inn = editForm.inn;
      if (editForm.contactPerson) payload.contactPerson = editForm.contactPerson;
      if (editForm.address) payload.address = editForm.address;

      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Не удалось сохранить изменения");
      showMessage("success", "Параметры центра успешно обновлены");
      fetchCenter();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка обновления");
    }
  };

  const handleDirectorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch(`/api/platform/centers/${id}/director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: directorEmail }),
      });
      if (!res.ok) throw new Error("Не удалось сменить директора");
      const json = await res.json();
      setDirectorResetUrl(json.resetUrl || null);
      showMessage("success", "Новый директор успешно назначен");
      setDirectorEmail("");
      fetchCenter();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка назначения директора");
    }
  };

  const handleSuspendSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suspendForm.reason.length < 5 || suspendForm.reason.length > 500) {
      showMessage("error", "Причина должна быть длиной от 5 до 500 символов");
      return;
    }
    try {
      const res = await fetch(`/api/platform/centers/${id}/suspend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(suspendForm),
      });
      if (!res.ok) throw new Error("Не удалось изменить статус");
      showMessage("success", `Статус организации изменен на ${suspendForm.action}`);
      setSuspendForm({ action: "pause", reason: "" });
      fetchCenter();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка изменения статуса");
    }
  };

  const handleArchive = async (reason?: string) => {
    if (!reason || reason.trim().length < 5) {
      showMessage("error", "Причина архивации должна быть не менее 5 символов");
      return;
    }
    try {
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ARCHIVE", reason: reason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось архивировать центр");
      showMessage("success", "Организация перемещена в архив");
      setArchiveModalOpen(false);
      fetchCenter();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка архивации");
    }
  };

  const handleRestore = async () => {
    try {
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "RESTORE" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось восстановить центр");
      showMessage("success", "Организация восстановлена из архива");
      fetchCenter();
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка восстановления");
    }
  };

  const handleDeleteCenter = async () => {
    if (deleteConfirmName !== data?.name) {
      showMessage("error", "Введённое имя не совпадает с точным названием центра");
      return;
    }
    if (deleteReason.trim().length < 5) {
      showMessage("error", "Причина удаления должна быть не менее 5 символов");
      return;
    }
    try {
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmName: deleteConfirmName, reason: deleteReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось удалить центр");
      router.push("/platform-admin/centers");
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка удаления");
    }
  };

  const handleUserResetPassword = async (userId: string, userName: string) => {
    try {
      const res = await fetch(`/api/platform/users/${userId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Запрос администратора платформы из карточки центра" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось сгенерировать ссылку сброса пароля");
      setUserResetModal({ url: json.resetUrl, userName });
    } catch (err: unknown) {
      showMessage("error", err instanceof Error ? err.message : "Ошибка сброса пароля");
    }
  };

  const handleExtendSubscription = async (subId: string) => {
    setExtendingSub(true);
    try {
      const res = await fetch(`/api/platform/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendMonths, status: "ACTIVE" }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showMessage("error", json.error || "Ошибка продления");
      } else {
        showMessage("success", "Подписка продлена");
        fetchCenter();
      }
    } catch {
      showMessage("error", "Ошибка соединения при продлении");
    } finally {
      setExtendingSub(false);
    }
  };

  const handleChangePlan = async (subId: string, force = false) => {
    if (!selectedPlanId) return;
    setChangingPlan(true);
    try {
      const res = await fetch(`/api/platform/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: selectedPlanId, force }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.requiresOverride && !force) {
          setForcePlanConfirm({ subId, message: json.error || "Превышен лимит нового тарифа" });
          return;
        }
        showMessage("error", json.error || "Ошибка смены тарифа");
      } else {
        showMessage("success", "Тарифный план обновлен");
        fetchCenter();
      }
    } catch {
      showMessage("error", "Ошибка соединения при смене тарифа");
    } finally {
      setChangingPlan(false);
    }
  };

  const handleToggleAutoRenew = async (subId: string, currentVal: boolean) => {
    try {
      const res = await fetch(`/api/platform/subscriptions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoRenew: !currentVal }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        showMessage("error", json.error || "Ошибка обновления автопродления");
      } else {
        showMessage("success", !currentVal ? "Автопродление включено" : "Автопродление отключено");
        fetchCenter();
      }
    } catch {
      showMessage("error", "Ошибка сети");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Загрузка карточки центра...</p>
        <Skeleton className="h-14 w-96" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "Центр не найден"}</AlertDescription>
      </Alert>
    );
  }

  const effectiveDirector = data.director || data.owner;
  const isArchived = data.status === "CANCELLED";
  const cancelledDate = data.cancelledAt ? new Date(data.cancelledAt) : null;
  const daysSinceCancelled = cancelledDate
    ? Math.floor((Date.now() - cancelledDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const canDelete = isArchived && daysSinceCancelled >= 30;

  type MembershipRow = NonNullable<CenterDetails["memberships"]>[number];
  const membershipColumns: DataTableColumn<MembershipRow>[] = [
    {
      id: "user",
      header: "ФИО / Email",
      isMobilePrimary: true,
      cell: (m) => (
        <div>
          <div className="font-medium text-foreground">{m.user.fullName}</div>
          <div className="text-xs text-muted-foreground">{m.user.email}</div>
        </div>
      ),
    },
    {
      id: "phone",
      header: "Телефон",
      cell: (m) => (
        <span className="text-xs text-muted-foreground tabular-nums">{m.user.phone || "—"}</span>
      ),
    },
    {
      id: "role",
      header: "Роль",
      cell: (m) => <Badge variant="neutral">{m.role}</Badge>,
    },
    {
      id: "status",
      header: "Статус",
      cell: (m) => (
        <Badge variant={m.status === "ACTIVE" ? "success" : "neutral"}>{m.status}</Badge>
      ),
    },
    {
      id: "createdAt",
      header: "Добавлен",
      hideOnMobile: true,
      cell: (m) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(m.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (m) => (
        <div className="inline-flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleUserResetPassword(m.user.id, m.user.fullName)}
          >
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Сбросить пароль</span>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/platform-admin/users?q=${encodeURIComponent(m.user.email)}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Профиль</span>
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  type TicketRow = NonNullable<CenterDetails["tickets"]>[number];
  const ticketColumns: DataTableColumn<TicketRow>[] = [
    {
      id: "subject",
      header: "Номер / Тема",
      isMobilePrimary: true,
      cell: (tk) => (
        <div>
          <div className="font-medium text-foreground">{tk.subject}</div>
          <div className="font-mono text-xs text-muted-foreground">
            {tk.ticketNumber || tk.id.slice(0, 8)}
          </div>
        </div>
      ),
    },
    {
      id: "priority",
      header: "Приоритет",
      cell: (tk) => (
        <Badge
          variant={
            tk.priority === "URGENT"
              ? "destructive"
              : tk.priority === "HIGH"
              ? "warning"
              : "neutral"
          }
        >
          {tk.priority}
        </Badge>
      ),
    },
    {
      id: "status",
      header: "Статус",
      cell: (tk) => (
        <Badge
          variant={
            tk.status === "OPEN" ? "info" : tk.status === "IN_PROGRESS" ? "warning" : "success"
          }
        >
          {tk.status}
        </Badge>
      ),
    },
    {
      id: "creator",
      header: "Создатель",
      cell: (tk) => (
        <span className="text-xs text-muted-foreground">{tk.creator?.fullName || "—"}</span>
      ),
    },
    {
      id: "createdAt",
      header: "Дата",
      hideOnMobile: true,
      cell: (tk) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(tk.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действие",
      align: "right",
      hideable: false,
      cell: (tk) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/platform-admin/support/${tk.id}`}>Открыть тикет</Link>
        </Button>
      ),
    },
  ];

  type PaymentRow = NonNullable<CenterDetails["platformPayments"]>[number];
  const paymentColumns: DataTableColumn<PaymentRow>[] = [
    {
      id: "invoice",
      header: "Номер счёта",
      isMobilePrimary: true,
      cell: (p) => (
        <span className="font-mono font-semibold text-foreground">
          {p.invoiceNumber || `INV-${p.id.slice(0, 8)}`}
        </span>
      ),
    },
    {
      id: "paidAt",
      header: "Дата",
      cell: (p) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      id: "method",
      header: "Способ",
      cell: (p) => <span className="text-xs text-muted-foreground">{p.paymentMethod}</span>,
    },
    {
      id: "amount",
      header: "Сумма (UZS)",
      align: "right",
      cell: (p) => (
        <span className="font-semibold text-foreground tabular-nums">
          {p.amount.toLocaleString()} UZS
        </span>
      ),
    },
    {
      id: "status",
      header: "Статус",
      align: "center",
      cell: (p) => (
        <Badge variant={p.status === "PAID" ? "success" : "neutral"}>{p.status}</Badge>
      ),
    },
    {
      id: "invoiceLink",
      header: "Квитанция",
      align: "right",
      hideable: false,
      cell: (p) => (
        <Button asChild variant="ghost" size="sm">
          <Link href={`/platform-admin/finance/payments/${p.id}/invoice`}>
            <Printer className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Чек</span>
          </Link>
        </Button>
      ),
    },
  ];

  const menuActions = [
    {
      id: "export-json",
      label: "Экспорт JSON",
      icon: <Download className="h-3.5 w-3.5" aria-hidden="true" />,
      href: `/api/platform/centers/${data.id}/export`,
    },
    ...(!isArchived
      ? [
          {
            id: "archive",
            label: "В архив",
            icon: <Archive className="h-3.5 w-3.5" aria-hidden="true" />,
            separatorBefore: true,
            onSelect: () => setArchiveModalOpen(true),
          },
        ]
      : [
          {
            id: "restore",
            label: "Восстановить",
            icon: <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />,
            separatorBefore: true,
            onSelect: handleRestore,
          },
          {
            id: "delete",
            label: "Удалить центр",
            icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
            destructive: true,
            onSelect: () => {
              if (!canDelete) {
                showMessage(
                  "error",
                  `Удаление центра возможно только через 30 дней после архивации. Прошло ${daysSinceCancelled} дн. (осталось ${Math.max(0, 30 - daysSinceCancelled)} дн.).`
                );
                return;
              }
              setDeleteModalOpen(true);
            },
          },
        ]),
  ];

  const tabsList: Array<{ id: typeof activeTab; label: string }> = [
    { id: "overview", label: "Обзор и параметры" },
    { id: "users", label: `Пользователи (${data.memberships?.length || 0})` },
    { id: "billing", label: "Биллинг" },
    { id: "tickets", label: `Тикеты (${data.tickets?.length || 0})` },
    { id: "history", label: `История (${data.auditLogs?.length || 0})` },
    { id: "edit", label: "Редактировать" },
    { id: "director", label: "Директор" },
    { id: "suspend", label: "Управление доступом" },
  ];

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        backHref="/platform-admin/centers"
        title={data.name}
        subtitle={`Slug: ${data.slug}`}
        statusLabel={isArchived ? "В АРХИВЕ (CANCELLED)" : data.status}
        statusVariant={CENTER_STATUS_VARIANTS[data.status] || "neutral"}
        primaryAction={
          effectiveDirector?.id ? (
            <ImpersonateButton targetUserId={effectiveDirector.id} targetCenterId={data.id} />
          ) : undefined
        }
        menuActions={menuActions}
      />

      {isArchived && (
        <Alert variant="warning">
          <AlertDescription className="space-y-1 text-xs">
            <div className="font-semibold">
              Организация находится в архиве с {cancelledDate?.toLocaleDateString() || "—"}
            </div>
            <p>
              Причина архивации:{" "}
              <span className="font-medium">{data.cancelledReason || "Не указана"}</span>. Доступ
              для пользователей закрыт.
            </p>
          </AlertDescription>
        </Alert>
      )}

      {actionMessage && (
        <Alert variant={actionMessage.type === "success" ? "success" : "destructive"}>
          <AlertDescription>{actionMessage.text}</AlertDescription>
        </Alert>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="w-full justify-start overflow-x-auto">
          {tabsList.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

      <TabsContent value={activeTab} className="space-y-6">
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Активные ученики" value={data.metrics?.activeStudents ?? 0} />
            <StatCard label="Активные учителя" value={data.metrics?.activeTeachers ?? 0} />
            <StatCard label="Курсов создано" value={data.metrics?.activeCoursesCount ?? 0} />
            <StatCard
              label="Посл. активность"
              value={
                data.metrics?.lastActivityAt
                  ? `${new Date(data.metrics.lastActivityAt).toLocaleDateString()} ${new Date(
                      data.metrics.lastActivityAt
                    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                  : "—"
              }
            />
          </div>

          {data.metrics?.limits && data.metrics.limits.maxStudents > 0 && (
            <Card>
              <CardContent className="space-y-2 p-5">
                <div className="flex items-center justify-between text-xs font-medium">
                  <span className="text-muted-foreground">
                    Лимит активных учеников:{" "}
                    <strong className="text-foreground tabular-nums">
                      {data.metrics.limits.currentStudents} из {data.metrics.limits.maxStudents}
                    </strong>
                  </span>
                  <span
                    className={`font-semibold tabular-nums ${
                      data.metrics.limits.percentUsed >= 100
                        ? "text-destructive"
                        : data.metrics.limits.percentUsed >= 80
                        ? "text-warning"
                        : "text-success"
                    }`}
                  >
                    {data.metrics.limits.percentUsed}%
                  </span>
                </div>
                <progress
                  value={Math.min(100, data.metrics.limits.percentUsed)}
                  max={100}
                  className="h-2 w-full overflow-hidden rounded-full accent-primary"
                />
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Реквизиты организации</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 pt-4 text-sm sm:grid-cols-2">
                  <div>
                    <span className="block text-xs text-muted-foreground">Тип организации</span>
                    <span className="font-medium text-foreground">
                      {data.organizationKind === "SCHOOL"
                        ? "Школа"
                        : data.organizationKind === "KINDERGARTEN"
                        ? "Детский сад"
                        : data.organizationKind === "OTHER"
                        ? "Другое"
                        : "Учебный центр"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">
                      Юридическое наименование
                    </span>
                    <span className="font-medium text-foreground">{data.legalName || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">ИНН</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {data.inn || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Контактное лицо</span>
                    <span className="font-medium text-foreground">{data.contactPerson || "—"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="block text-xs text-muted-foreground">Фактический адрес</span>
                    <span className="font-medium text-foreground">{data.address || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">{data.email || "—"}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Телефон</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {data.phone || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Часовой пояс</span>
                    <span className="font-medium text-foreground">
                      {data.timeZone || "Asia/Tashkent"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Дата регистрации</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {new Date(data.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <span>Журнал действий центра (последние записи)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {data.auditLogs && data.auditLogs.length > 0 ? (
                    <div className="space-y-3">
                      {data.auditLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-border bg-muted/40 p-3 text-xs"
                        >
                          <div className="flex items-center justify-between font-medium text-foreground">
                            <span>{log.action}</span>
                            <span className="font-normal text-muted-foreground tabular-nums">
                              {new Date(log.createdAt).toLocaleString()}
                            </span>
                          </div>
                          {log.details && <p className="mt-1 text-muted-foreground">{log.details}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Записей в аудит-логе пока нет.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Shield className="h-4 w-4 text-primary" aria-hidden="true" />
                    <span>Директор центра</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5 pt-4 text-sm">
                  <div>
                    <span className="block text-xs text-muted-foreground">ФИО</span>
                    <span className="font-medium text-foreground">
                      {effectiveDirector?.fullName || "Не назначен"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Email</span>
                    <span className="font-medium text-foreground">
                      {effectiveDirector?.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Телефон</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {effectiveDirector?.phone || "—"}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="flex items-center gap-2 text-base font-semibold">
                    <Users className="h-4 w-4 text-success" aria-hidden="true" />
                    <span>Распределение ролей</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-4 text-sm">
                  <div className="flex justify-between border-b border-border py-1.5">
                    <span className="text-muted-foreground">Учеников</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {data.metrics?.usersByRole?.STUDENT || 0}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-border py-1.5">
                    <span className="text-muted-foreground">Преподавателей</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {data.metrics?.usersByRole?.TEACHER || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span className="text-muted-foreground">Администраторов</span>
                    <span className="font-semibold text-foreground tabular-nums">
                      {data.metrics?.usersByRole?.CENTER_ADMIN || 0}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-foreground">
              Пользователи центра ({data.memberships?.length || 0})
            </h3>
            <span className="text-xs text-muted-foreground">
              Участники, привязанные через членства центра
            </span>
          </div>
          <DataTable
            data={data.memberships || []}
            columns={membershipColumns}
            getRowId={(m) => m.id}
            showColumnToggle={false}
            showDensityToggle={false}
            emptyTitle="Нет участников"
            emptyDescription="В данном центре пока нет зарегистрированных участников."
          />
        </div>
      )}

      {activeTab === "tickets" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-foreground">
              Тикеты технической поддержки ({data.tickets?.length || 0})
            </h3>
            <span className="text-xs text-muted-foreground">Обращения сотрудников центра</span>
          </div>
          <DataTable
            data={data.tickets || []}
            columns={ticketColumns}
            getRowId={(tk) => tk.id}
            showColumnToggle={false}
            showDensityToggle={false}
            emptyTitle="Тикетов нет"
            emptyDescription="Тикетов от этого центра пока не поступало."
          />
        </div>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">
              Журнал событий аудита ({data.auditLogs?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {data.auditLogs && data.auditLogs.length > 0 ? (
              <div className="divide-y divide-border">
                {data.auditLogs.map((log, idx) => (
                  <div key={idx} className="py-3 text-xs">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span className="font-mono text-primary">{log.action}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {log.details && (
                      <p className="mt-1 rounded-md border border-border bg-muted/40 p-2 font-mono text-xs text-muted-foreground">
                        {log.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-xs text-muted-foreground">
                Записей аудита для этого центра пока нет.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "edit" && (
        <Card className="max-w-2xl">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Редактирование параметров центра</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <form onSubmit={handleEditSubmit} className="space-y-4">
              <FormField label="Тип организации" htmlFor="c-edit-kind">
                <select
                  id="c-edit-kind"
                  value={editForm.organizationKind}
                  onChange={(e) => setEditForm({ ...editForm, organizationKind: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="LEARNING_CENTER">Учебный центр</option>
                  <option value="SCHOOL">Школа</option>
                  <option value="KINDERGARTEN">Детский сад</option>
                  <option value="OTHER">Другое</option>
                </select>
              </FormField>

              <FormField label="Название центра" htmlFor="c-edit-name" required>
                <Input
                  id="c-edit-name"
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                />
              </FormField>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Юр. наименование" htmlFor="c-edit-legal">
                  <Input
                    id="c-edit-legal"
                    type="text"
                    value={editForm.legalName}
                    onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })}
                    placeholder="OOO..."
                  />
                </FormField>
                <FormField label="ИНН" htmlFor="c-edit-inn">
                  <Input
                    id="c-edit-inn"
                    type="text"
                    value={editForm.inn}
                    onChange={(e) => setEditForm({ ...editForm, inn: e.target.value })}
                    placeholder="123456789"
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Контактное лицо" htmlFor="c-edit-contact">
                  <Input
                    id="c-edit-contact"
                    type="text"
                    value={editForm.contactPerson}
                    onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  />
                </FormField>
                <FormField label="Фактический адрес" htmlFor="c-edit-address">
                  <Input
                    id="c-edit-address"
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField label="Email" htmlFor="c-edit-email">
                  <Input
                    id="c-edit-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </FormField>
                <FormField label="Телефон" htmlFor="c-edit-phone">
                  <Input
                    id="c-edit-phone"
                    type="text"
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  />
                </FormField>
              </div>

              <FormField label="Часовой пояс" htmlFor="c-edit-tz">
                <Input
                  id="c-edit-tz"
                  type="text"
                  value={editForm.timeZone}
                  onChange={(e) => setEditForm({ ...editForm, timeZone: e.target.value })}
                />
              </FormField>

              <FormActions>
                <Button type="submit" variant="primary">
                  Сохранить изменения
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "director" && (
        <Card className="max-w-xl">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Назначение нового директора</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Пользователь с указанным email получит роль DIRECTOR в этом центре.
            </p>
            <form onSubmit={handleDirectorSubmit} className="space-y-4">
              <FormField label="Email пользователя" htmlFor="c-dir-email" required>
                <Input
                  id="c-dir-email"
                  type="email"
                  value={directorEmail}
                  onChange={(e) => setDirectorEmail(e.target.value)}
                  placeholder="director@example.com"
                  required
                />
              </FormField>
              <FormActions>
                <Button type="submit" variant="primary">
                  Назначить директором
                </Button>
              </FormActions>
            </form>

            {directorResetUrl && (
              <Alert variant="warning">
                <AlertDescription className="space-y-2 text-xs">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>{t("ru", "ui4.oneTimeSecretWarn")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="text"
                      readOnly
                      value={directorResetUrl}
                      className="flex-1 font-mono text-xs select-all"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(directorResetUrl);
                        setCopiedDirectorUrl(true);
                        setTimeout(() => setCopiedDirectorUrl(false), 3000);
                      }}
                    >
                      {copiedDirectorUrl ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                      <span>{copiedDirectorUrl ? t("ru", "ui4.copied") : t("ru", "ui4.copyCredentials")}</span>
                    </Button>
                  </div>
                  <p className="text-muted-foreground">
                    Передайте ссылку новому директору. Ссылка действует 72 часа для установки пароля.
                  </p>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "suspend" && (
        <Card className="max-w-xl">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Управление статусом центра</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-xs text-muted-foreground">
              Изменение статуса моментально влияет на доступ сотрудников и учеников.
            </p>
            <form onSubmit={handleSuspendSubmit} className="space-y-4">
              <FormField label="Выберите действие" htmlFor="c-suspend-action">
                <select
                  id="c-suspend-action"
                  value={suspendForm.action}
                  onChange={(e) => setSuspendForm({ ...suspendForm, action: e.target.value })}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="pause">Приостановить (PAUSED)</option>
                  <option value="block">Заблокировать (BLOCKED)</option>
                  <option value="resume">Возобновить доступ (ACTIVE)</option>
                </select>
              </FormField>

              <FormField label="Причина (для аудита, от 5 символов)" htmlFor="c-suspend-reason" required>
                <Textarea
                  id="c-suspend-reason"
                  value={suspendForm.reason}
                  onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
                  placeholder="Укажите подробную причину изменения статуса..."
                  rows={4}
                  required
                  minLength={5}
                  maxLength={500}
                />
              </FormField>

              <FormActions>
                <Button type="submit" variant="destructive">
                  Применить изменение статуса
                </Button>
              </FormActions>
            </form>
          </CardContent>
        </Card>
      )}

      {activeTab === "billing" && (
        <div className="space-y-6">
          {data.subscriptions && data.subscriptions.length > 0 ? (
            (() => {
              const currentSub = data.subscriptions[0];
              const isPastDue = new Date(currentSub.currentPeriodEndsAt) < new Date();
              return (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
                      <CardTitle className="flex items-center gap-2 text-base font-semibold">
                        <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
                        <span>Текущая подписка</span>
                      </CardTitle>
                      <Badge
                        variant={
                          currentSub.status === "ACTIVE"
                            ? "success"
                            : currentSub.status === "PAST_DUE"
                            ? "destructive"
                            : "info"
                        }
                      >
                        {currentSub.status}
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                        <div>
                          <div className="text-xs text-muted-foreground">Тарифный план</div>
                          <div className="font-semibold text-foreground">{currentSub.plan.name}</div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            {currentSub.plan.priceMonthly.toLocaleString()} UZS/мес
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Период действия</div>
                          <div className={`font-semibold tabular-nums ${isPastDue ? "text-destructive" : "text-foreground"}`}>
                            до {new Date(currentSub.currentPeriodEndsAt).toLocaleDateString()}
                          </div>
                          <div className="text-xs text-muted-foreground tabular-nums">
                            с {new Date(currentSub.currentPeriodStartsAt).toLocaleDateString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Автопродление</div>
                          <Button
                            type="button"
                            variant={currentSub.autoRenew ? "outline" : "outline"}
                            size="sm"
                            onClick={() => handleToggleAutoRenew(currentSub.id, currentSub.autoRenew)}
                            className="mt-1"
                          >
                            {currentSub.autoRenew ? "Включено" : "Отключено"}
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
                        <div>
                          Лимит учеников: <strong className="text-foreground">{currentSub.plan.maxStudents}</strong>
                        </div>
                        <div>
                          Лимит учителей: <strong className="text-foreground">{currentSub.plan.maxTeachers}</strong>
                        </div>
                        <div>
                          Лимит филиалов: <strong className="text-foreground">{currentSub.plan.maxBranches}</strong>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
                        <span className="text-xs font-medium text-foreground">Продлить на:</span>
                        <select
                          aria-label="Срок продления"
                          value={extendMonths}
                          onChange={(e) => setExtendMonths(parseInt(e.target.value, 10))}
                          className="h-8 rounded-md border border-input bg-background px-2.5 text-xs text-foreground"
                        >
                          <option value={1}>1 месяц</option>
                          <option value={3}>3 месяца</option>
                          <option value={6}>6 месяцев</option>
                          <option value={12}>12 месяцев</option>
                        </select>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => handleExtendSubscription(currentSub.id)}
                          disabled={extendingSub}
                        >
                          {extendingSub ? "Продление..." : "Продлить подписку"}
                        </Button>
                        <Button asChild variant="outline" size="sm" className="ml-auto">
                          <Link href={`/platform-admin/finance/payments?centerId=${data.id}&planId=${currentSub.plan.id}`}>
                            <Receipt className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Записать платёж</span>
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="border-b border-border pb-3">
                      <CardTitle className="text-base font-semibold">Смена тарифа</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <p className="text-xs text-muted-foreground">
                        При смене тарифа проверяются лимиты активных учеников и учителей.
                      </p>
                      <FormField label="Новый тариф" htmlFor="c-new-plan">
                        <select
                          id="c-new-plan"
                          value={selectedPlanId}
                          onChange={(e) => setSelectedPlanId(e.target.value)}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                        >
                          <option value="">Выберите тариф...</option>
                          {plans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.priceMonthly.toLocaleString()} UZS)
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <Button
                        type="button"
                        variant="primary"
                        className="w-full"
                        onClick={() => handleChangePlan(currentSub.id)}
                        disabled={changingPlan || !selectedPlanId}
                      >
                        {changingPlan ? "Применение..." : "Перевести на новый тариф"}
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              );
            })()
          ) : (
            <EmptyState
              icon={<CreditCard className="h-5 w-5" aria-hidden="true" />}
              title="Подписка не оформлена"
              description="У данного центра отсутствует активная подписка."
              action={
                <Button asChild variant="primary" size="sm">
                  <Link href={`/platform-admin/finance/payments?centerId=${data.id}`}>
                    Оформить подписку и записать платёж
                  </Link>
                </Button>
              }
            />
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base font-semibold">История платежей центра</CardTitle>
              <Link
                href={`/platform-admin/finance/payments?centerId=${data.id}`}
                className="text-xs font-medium text-primary hover:underline"
              >
                Все платежи центра
              </Link>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={data.platformPayments || []}
                columns={paymentColumns}
                getRowId={(p) => p.id}
                showColumnToggle={false}
                showDensityToggle={false}
                emptyTitle="Платежей пока нет"
                emptyDescription="Платежи для данного центра ещё не регистрировались."
              />
            </CardContent>
          </Card>
        </div>
      )}
      </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title="Архивировать учебный центр"
        description="Центр будет переведён в статус CANCELLED. Доступ для пользователей закроется, данные сохранятся в режиме «только чтение»."
        variant="destructive"
        reasonLabel="Причина архивации (минимум 5 символов)"
        reasonPlaceholder="Укажите причину архивации..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        confirmLabel="Архивировать"
        onConfirm={handleArchive}
      />

      <ConfirmDialog
        open={Boolean(forcePlanConfirm)}
        onOpenChange={(next) => !next && setForcePlanConfirm(null)}
        title="Подтвердите принудительную смену тарифа"
        description={
          forcePlanConfirm
            ? `${forcePlanConfirm.message}. Перевести центр на этот тариф принудительно?`
            : undefined
        }
        variant="destructive"
        confirmLabel="Перевести"
        onConfirm={() => {
          if (!forcePlanConfirm) return;
          const targetId = forcePlanConfirm.subId;
          setForcePlanConfirm(null);
          return handleChangePlan(targetId, true);
        }}
      />

      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">Полное удаление центра</DialogTitle>
            <DialogDescription>
              Это действие необратимо. Центр и все связанные данные будут удалены навсегда. Перед
              удалением выгрузите резервную копию через «Экспорт JSON».
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs">
              <span className="block text-muted-foreground">Точное название центра:</span>
              <span className="font-mono font-semibold text-foreground">{data.name}</span>
            </div>

            <FormField label="Подтверждение названия" htmlFor="del-center-name" required>
              <Input
                id="del-center-name"
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Введите точное имя центра"
              />
            </FormField>

            <FormField label="Обязательная причина удаления (от 5 символов)" htmlFor="del-center-reason" required>
              <Textarea
                id="del-center-reason"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Причина удаления..."
                rows={3}
              />
            </FormField>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDeleteModalOpen(false)}>
                Отмена
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeleteCenter}
                disabled={deleteConfirmName !== data.name || deleteReason.trim().length < 5}
              >
                Удалить навсегда
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(userResetModal)} onOpenChange={(next) => !next && setUserResetModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ссылка для сброса пароля</DialogTitle>
            <DialogDescription>
              Ссылка для пользователя <strong>{userResetModal?.userName}</strong> создана и действует
              72 часа.
            </DialogDescription>
          </DialogHeader>

          {userResetModal && (
            <div className="space-y-4">
              <Alert variant="warning">
                <AlertDescription className="text-xs">
                  {t("ru", "ui4.oneTimeSecretWarn")}
                </AlertDescription>
              </Alert>
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  readOnly
                  value={userResetModal.url}
                  className="flex-1 font-mono text-xs select-all"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(userResetModal.url);
                    setUserResetCopied(true);
                    setTimeout(() => setUserResetCopied(false), 3000);
                  }}
                >
                  {userResetCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{userResetCopied ? t("ru", "ui4.copied") : t("ru", "ui4.copyCredentials")}</span>
                </Button>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setUserResetModal(null)}>
                  Закрыть
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
