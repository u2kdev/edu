"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  Award,
  BarChart3,
  Calendar,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  CreditCard,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Heart,
  History,
  Key,
  Laptop,
  Lock,
  Mail,
  Phone,
  Plus,
  Printer,
  QrCode,
  Send,
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
  CardDescription,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  EntityDetailHeader,
  type EntityActionItem,
  FormActions,
  FormField,
  Input,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";
import { StudentPerformanceView } from "@/components/students/StudentPerformanceView";
import type { StudentPerformanceDTO } from "@/lib/dashboard-analytics";

interface SessionItem {
  id: string;
  createdAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditLogItem {
  id: string;
  action: string;
  createdAt: string;
  actorRole: string | null;
  details: Record<string, unknown> | null;
  summary?: string;
  reason?: string;
}

interface ParentItem {
  linkId: string;
  parentId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  relationship: string | null;
  status: string;
}

interface AttendanceItem {
  id: string;
  status: string;
  markedAt: string;
  lessonTitle: string;
}

interface GradeItem {
  id: string;
  value: number;
  maxValue?: number;
  scoreText?: string;
  weight: number;
  lessonTitle: string;
  teacherName: string;
  createdAt: string;
}

interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  method: string;
  createdAt: string;
}

interface StudentProfileClientProps {
  student?: unknown;
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
    preferredLanguage: string;
    lastLoginAt: string | null;
  };
  enrollments: Array<{
    id: string;
    groupName: string;
    courseTitle: string;
    teacherName: string;
    status?: string;
    paidUntil?: string | null;
    frozenAt?: string | null;
    frozenUntil?: string | null;
  }>;
  parents: ParentItem[];
  parentInviteCode?: {
    code: string;
    expiresAt: string | null;
    usesCount: number;
  } | null;
  attendances: AttendanceItem[];
  grades: GradeItem[];
  payments: PaymentItem[];
  activeSessions: SessionItem[];
  auditLogs: AuditLogItem[];
  manageability: {
    canManage: boolean;
    isShared: boolean;
    reason?: string;
  };
  statusLabel?: string;
  backLabel?: string;
  noGroups?: string;
  noParents?: string;
  noPayments?: string;
  noHistory?: string;
  confirmedLabel?: string;
  actorRole: string;
  locale: string;
  performanceData?: StudentPerformanceDTO | null;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function StudentProfileClient({
  membership: initialMembership,
  user: initialUser,
  enrollments,
  parents: initialParents,
  parentInviteCode: initialCode,
  attendances,
  grades,
  payments,
  activeSessions,
  auditLogs,
  manageability,
  actorRole,
  locale,
  performanceData,
}: StudentProfileClientProps) {
  const [activeTab, setActiveTab] = useState<
    | "profile"
    | "access"
    | "groups"
    | "parents"
    | "attendance"
    | "grades"
    | "performance"
    | "payments"
    | "history"
    | "transcript"
  >("profile");

  const [membership, setMembership] = useState(initialMembership);
  const [user, setUser] = useState(initialUser);
  const [parents, setParents] = useState(initialParents);
  const [parentCode, setParentCode] = useState(initialCode);
  const [enrollmentList, setEnrollmentList] = useState(enrollments);
  const [freezeTargetId, setFreezeTargetId] = useState<string | null>(null);
  const [freezeUntilDate, setFreezeUntilDate] = useState("");
  const [freezeReason, setFreezeReason] = useState("");
  const [freezeLoading, setFreezeLoading] = useState(false);

  const canFreezeBilling = ["DIRECTOR", "CENTER_ADMIN", "ACCOUNTANT"].includes(actorRole);

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [username, setUsername] = useState(user.username || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [confirmRevokeCodeOpen, setConfirmRevokeCodeOpen] = useState(false);
  const [reasonModalOpen, setReasonModalOpen] = useState<"BLOCK" | "UNBLOCK" | "ARCHIVE" | null>(null);

  const [addParentOpen, setAddParentOpen] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [relationship, setRelationship] = useState("MOTHER");
  const [parentFormError, setParentFormError] = useState<string | null>(null);
  const [parentModalCredentials, setParentModalCredentials] = useState<CredentialsData | null>(null);

  const [codeCopied, setCodeCopied] = useState(false);

  const handleFreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!freezeTargetId || !freezeUntilDate) return;
    setFreezeLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/enrollments/${freezeTargetId}/freeze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frozenUntil: new Date(`${freezeUntilDate}T23:59:59+05:00`).toISOString(),
          reason: freezeReason.trim() || "Заморозка абонемента",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollmentList((prev) =>
          prev.map((item) =>
            item.id === freezeTargetId
              ? {
                  ...item,
                  status: "FROZEN",
                  frozenUntil: data.frozenUntil || freezeUntilDate,
                  paidUntil: data.paidUntil ?? item.paidUntil,
                }
              : item
          )
        );
        setFreezeTargetId(null);
        setFreezeUntilDate("");
        setFreezeReason("");
        setActionNotice({ type: "success", text: "Абонемент заморожен" });
      } else {
        setActionNotice({ type: "error", text: data.error || "Ошибка заморозки" });
      }
    } catch {
      setActionNotice({ type: "error", text: "Ошибка сети" });
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleUnfreeze = async (enrollmentId: string) => {
    setFreezeLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch(`/api/enrollments/${enrollmentId}/freeze`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollmentList((prev) =>
          prev.map((item) =>
            item.id === enrollmentId
              ? {
                  ...item,
                  status: "ACTIVE",
                  frozenAt: null,
                  frozenUntil: null,
                  paidUntil: data.paidUntil ?? item.paidUntil,
                }
              : item
          )
        );
        setActionNotice({ type: "success", text: "Абонемент разморожен" });
      } else {
        setActionNotice({ type: "error", text: data.error || "Ошибка разморозки" });
      }
    } catch {
      setActionNotice({ type: "error", text: "Ошибка сети" });
    } finally {
      setFreezeLoading(false);
    }
  };

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
      }));
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
        setActionNotice({ type: "success", text: "Ученик архивирован" });
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
          text: newStatus === "BLOCKED" ? "Ученик заблокирован" : "Ученик разблокирован",
        });
      }

      setReasonModalOpen(null);
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateParentCode = async () => {
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/invites/parent-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "INITIATE_BY_ADMIN",
          studentId: membership.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания кода");

      setParentCode({
        code: data.parentInviteCode,
        expiresAt: data.expiresAt,
        usesCount: 0,
      });
      setActionNotice({ type: "success", text: "Родительский код создан" });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeParentCode = async () => {
    if (!parentCode) return;
    setConfirmRevokeCodeOpen(false);
    setActionLoading(true);
    setActionNotice(null);
    try {
      const res = await fetch("/api/invites/parent-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "REVOKE_PARENT_CODE",
          inviteCode: parentCode.code,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отзыва");

      setParentCode(null);
      setActionNotice({ type: "success", text: "Код успешно отозван" });
    } catch (err: unknown) {
      setActionNotice({ type: "error", text: err instanceof Error ? err.message : "Неизвестная ошибка" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    setParentFormError(null);
    if (!parentPhone && !parentEmail) {
      setParentFormError("Укажите телефон или email родителя");
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch("/api/tenant/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: parentName || "Родитель",
          phone: parentPhone || undefined,
          email: parentEmail || undefined,
          role: "PARENT",
          parent: {
            fullName: parentName,
            phone: parentPhone,
            email: parentEmail,
            relationship,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания родителя");

      await fetch("/api/invites/parent-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CLAIM_PARENT_LINK",
          studentId: membership.id,
          inviteCode: parentCode?.code,
        }),
      }).catch(() => null);

      if (data.credentials) {
        setParentModalCredentials(data.credentials);
      }

      setParents((prev) => [
        ...prev,
        {
          linkId: data.user?.membershipId || String(Date.now()),
          parentId: data.user?.id || "",
          fullName: parentName || "Родитель",
          phone: parentPhone || null,
          email: parentEmail || null,
          relationship,
          status: "CONFIRMED",
        },
      ]);

      setAddParentOpen(false);
      setParentName("");
      setParentPhone("");
      setParentEmail("");
      setActionNotice({ type: "success", text: "Родитель успешно привязан" });
    } catch (err: unknown) {
      setParentFormError(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const canViewPayments = performanceData
    ? performanceData.canViewPayments
    : actorRole !== "TEACHER" && actorRole !== "TEACHER_ASSISTANT";

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
            label: "Заблокировать ученика",
            destructive: true,
            onSelect: () => setReasonModalOpen("BLOCK"),
          },
        ]
      : [
          {
            id: "unblock",
            label: "Разблокировать ученика",
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

  const attendancePct =
    attendances.length > 0
      ? Math.round(
          (attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length /
            attendances.length) *
            100
        )
      : 100;

  const avgGrade =
    grades.length > 0
      ? (grades.reduce((sum, g) => sum + g.value, 0) / grades.length).toFixed(1)
      : "—";

  return (
    <div className="space-y-6">
      <EntityDetailHeader
        backHref="/center/students"
        backLabel={t(locale, "common.back")}
        icon={<GraduationCap className="h-5 w-5" />}
        title={user.fullName}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        locale={locale}
        badges={
          <>
            <Badge variant="primary">Ученик</Badge>
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
            <span>Доступ</span>
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users className="h-4 w-4" aria-hidden="true" />
            <span>Группы ({enrollments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="parents">
            <Heart className="h-4 w-4" aria-hidden="true" />
            <span>Родители ({parents.length})</span>
          </TabsTrigger>
          <TabsTrigger value="attendance">
            <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
            <span>Посещаемость ({attendances.length})</span>
          </TabsTrigger>
          <TabsTrigger value="grades">
            <Award className="h-4 w-4" aria-hidden="true" />
            <span>Оценки ({grades.length})</span>
          </TabsTrigger>
          {performanceData && (
            <TabsTrigger value="performance">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              <span>{t(locale, "ui3.performanceTitle")}</span>
            </TabsTrigger>
          )}
          {canViewPayments && (
            <TabsTrigger value="payments">
              <CreditCard className="h-4 w-4" aria-hidden="true" />
              <span>Платежи ({payments.length})</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="history">
            <History className="h-4 w-4" aria-hidden="true" />
            <span>История ({auditLogs.length})</span>
          </TabsTrigger>
          <TabsTrigger value="transcript">
            <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            <span>Табель успеваемости</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="max-w-2xl">
            <CardContent className="pt-6 space-y-5">
              {manageability.isShared && (
                <Alert variant="info">
                  <AlertDescription>
                    <strong className="block font-semibold">Ученик состоит в нескольких центрах</strong>
                    Смена контактных данных (телефон, email, логин) возможна только самим пользователем.
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
                <FormField label="ФИО ученика" htmlFor="st-fullname" required>
                  <Input
                    id="st-fullname"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Телефон" htmlFor="st-phone">
                    <Input
                      id="st-phone"
                      type="text"
                      value={phone}
                      disabled={manageability.isShared}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+998901234567"
                    />
                  </FormField>

                  <FormField label="Email" htmlFor="st-email">
                    <Input
                      id="st-email"
                      type="email"
                      value={email}
                      disabled={manageability.isShared}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="student@example.com"
                    />
                  </FormField>
                </div>

                <FormField label="Логин / Имя пользователя" htmlFor="st-username">
                  <Input
                    id="st-username"
                    type="text"
                    value={username}
                    disabled={manageability.isShared}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="username"
                  />
                </FormField>

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
                            Вы можете отправить ученику ссылку для самостоятельного сброса пароля.
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
                  <div className="text-sm font-medium text-foreground">Статус членства</div>
                  <div className="flex flex-wrap gap-3">
                    {membership.status === "ACTIVE" ? (
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setReasonModalOpen("BLOCK")}
                      >
                        <Lock className="h-4 w-4" aria-hidden="true" />
                        <span>Заблокировать ученика</span>
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setReasonModalOpen("UNBLOCK")}
                      >
                        <Unlock className="h-4 w-4" aria-hidden="true" />
                        <span>Разблокировать ученика</span>
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
                  <span>Активные сессии ({activeSessions.length})</span>
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
                          Создана: {new Date(session.createdAt).toLocaleDateString()}
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
                <span>Группы и курсы ученика</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {enrollmentList.length === 0 ? (
                <p className="text-sm text-muted-foreground">Ученик пока не записан ни в одну группу</p>
              ) : (
                <div className="divide-y divide-border">
                  {enrollmentList.map((enr) => (
                    <div key={enr.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{enr.groupName}</span>
                          {enr.status === "FROZEN" && (
                            <Badge variant="info">
                              Заморожен{" "}
                              {enr.frozenUntil ? `до ${new Date(enr.frozenUntil).toLocaleDateString("ru-RU")}` : ""}
                            </Badge>
                          )}
                          {enr.paidUntil && (
                            <Badge variant="success">
                              Оплачено до {new Date(enr.paidUntil).toLocaleDateString("ru-RU")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Курс: {enr.courseTitle} | {enr.teacherName}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {canFreezeBilling && enr.status === "ACTIVE" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={freezeLoading}
                            onClick={() => {
                              setFreezeTargetId(enr.id);
                              setFreezeUntilDate("");
                              setFreezeReason("");
                            }}
                          >
                            Заморозить
                          </Button>
                        )}
                        {canFreezeBilling && enr.status === "FROZEN" && (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={freezeLoading}
                            onClick={() => void handleUnfreeze(enr.id)}
                          >
                            Разморозить
                          </Button>
                        )}
                        <Link
                          href="/center/groups"
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          К группе
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="parents">
          <div className="max-w-3xl space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <QrCode className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Личный код родителя для ученика</span>
                </CardTitle>
                {parentCode ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmRevokeCodeOpen(true)}
                    disabled={actionLoading}
                  >
                    Отозвать код
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleGenerateParentCode}
                    disabled={actionLoading}
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Сгенерировать код</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {parentCode ? (
                  <div className="flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-muted p-4 sm:flex-row sm:items-center">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground">
                        Инвайт-код для привязки родителя
                      </span>
                      <div className="mt-1 font-mono text-xl font-semibold tracking-wider text-primary select-all">
                        {parentCode.code}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Родитель вводит этот код при регистрации или в личном кабинете.
                        {parentCode.expiresAt &&
                          ` Действителен до: ${new Date(parentCode.expiresAt).toLocaleDateString()}`}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => copyCode(parentCode.code)}
                      >
                        {codeCopied ? <Check className="h-4 w-4 text-success" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                        <span>{codeCopied ? t(locale, "ui4.copied") : t(locale, "ui4.copyCredentials")}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleGenerateParentCode}
                        disabled={actionLoading}
                      >
                        Перегенерировать
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Код ещё не сгенерирован. Вы можете создать личный код родителя для ученика или добавить родителя вручную.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Heart className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Привязанные родители ({parents.length})</span>
                </CardTitle>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    setParentFormError(null);
                    setAddParentOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Добавить родителя</span>
                </Button>
              </CardHeader>
              <CardContent>
                {parents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">У данного ученика пока нет привязанных родителей</p>
                ) : (
                  <div className="divide-y divide-border">
                    {parents.map((parent) => (
                      <div key={parent.linkId} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{parent.fullName}</span>
                            <Badge variant="primary">
                              {parent.relationship === "MOTHER"
                                ? "Мама"
                                : parent.relationship === "FATHER"
                                ? "Папа"
                                : "Опекун"}
                            </Badge>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
                            {parent.phone && <span>{parent.phone}</span>}
                            {parent.email && <span>{parent.email}</span>}
                          </div>
                        </div>
                        <Badge variant="success">Подтверждено</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="attendance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Журнал посещаемости</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attendances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет записей посещаемости</p>
              ) : (
                <div className="divide-y divide-border text-sm">
                  {attendances.map((att) => (
                    <div key={att.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="font-medium text-foreground">{att.lessonTitle}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {new Date(att.markedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <Badge
                        variant={
                          att.status === "PRESENT"
                            ? "success"
                            : att.status === "ABSENT"
                            ? "destructive"
                            : "warning"
                        }
                      >
                        {att.status === "PRESENT" ? "Был(а)" : att.status === "ABSENT" ? "Отсутствовал(а)" : "Опоздал(а)"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="grades">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Успеваемость и оценки</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {grades.length === 0 ? (
                <p className="text-sm text-muted-foreground">Оценок пока нет</p>
              ) : (
                <div className="divide-y divide-border text-sm">
                  {grades.map((grade) => (
                    <div key={grade.id} className="flex items-center justify-between py-2.5">
                      <div>
                        <div className="font-medium text-foreground">{grade.lessonTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          Преподаватель: {grade.teacherName} | {new Date(grade.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-semibold text-success tabular-nums">{grade.value}</span>
                        <span className="block text-xs text-muted-foreground">вес: {grade.weight}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {performanceData && (
          <TabsContent value="performance">
            <StudentPerformanceView
              initialData={performanceData}
              locale={locale}
              showPeriodControls
              paymentsHref="/center/payments"
            />
          </TabsContent>
        )}

        {canViewPayments && (
          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CreditCard className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>История оплат за обучение</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Записей об оплатах нет</p>
                ) : (
                  <div className="divide-y divide-border text-sm">
                    {payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="font-mono font-medium text-foreground tabular-nums">
                            {p.amount.toLocaleString()} {p.currency}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Способ: {p.method} | {new Date(p.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                        <Badge variant="success">Оплачено</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <History className="h-4 w-4 text-primary" aria-hidden="true" />
                <span>Журнал аудита по ученику</span>
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

        <TabsContent value="transcript">
          <Card>
            <CardHeader className="flex flex-col gap-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4 text-primary" aria-hidden="true" />
                  <span>Табель академической успеваемости</span>
                </CardTitle>
                <CardDescription>
                  Сводные показатели посещаемости, оценок и тестов ученика {user.fullName}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`/api/tenant/students/${membership.id}/transcript?format=csv`}
                  download
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Экспорт CSV</span>
                </a>
                <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
                  <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Печать</span>
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <StatCard
                  label="Посещаемость занятий"
                  value={`${attendancePct}%`}
                  hint={`${attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length} из ${attendances.length} отметок`}
                />
                <StatCard
                  label="Средний балл (GPA)"
                  value={avgGrade}
                  hint={`На основе ${grades.length} выставленных оценок`}
                />
                <StatCard
                  label="Активных курсов / групп"
                  value={enrollments.length}
                  hint="Текущие учебные потоки"
                />
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Учебные программы и группы</h4>
                <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
                  {enrollments.map((enr) => (
                    <div key={enr.id} className="flex items-center justify-between bg-muted px-3 py-2.5 text-sm">
                      <div>
                        <span className="font-medium text-foreground">{enr.courseTitle}</span>
                        <span className="ml-2 text-muted-foreground">({enr.groupName})</span>
                      </div>
                      <div className="text-xs text-muted-foreground">Преподаватель: {enr.teacherName}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium text-foreground">Журнал успеваемости</h4>
                {grades.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Оценок пока нет</p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-border">
                    <Table>
                      <TableHeader className="bg-muted">
                        <TableRow>
                          <TableHead>Дата</TableHead>
                          <TableHead>Урок</TableHead>
                          <TableHead>Преподаватель</TableHead>
                          <TableHead className="text-right">Оценка</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {grades.slice(0, 15).map((g) => (
                          <TableRow key={g.id}>
                            <TableCell className="text-muted-foreground tabular-nums">
                              {new Date(g.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell className="font-medium text-foreground">{g.lessonTitle}</TableCell>
                            <TableCell className="text-muted-foreground">{g.teacherName}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant="success">{g.value}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(freezeTargetId)} onOpenChange={(next) => !next && setFreezeTargetId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Заморозка абонемента</DialogTitle>
            <DialogDescription>Укажите дату окончания заморозки и причину.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleFreezeSubmit(e)} className="space-y-4">
            <FormField label="Заморозить до" htmlFor="freeze-until" required>
              <Input
                id="freeze-until"
                type="date"
                required
                value={freezeUntilDate}
                onChange={(e) => setFreezeUntilDate(e.target.value)}
              />
            </FormField>
            <FormField label="Причина" htmlFor="freeze-reason" required>
              <Input
                id="freeze-reason"
                type="text"
                required
                value={freezeReason}
                onChange={(e) => setFreezeReason(e.target.value)}
                placeholder="Причина (отпуск, болезнь...)"
              />
            </FormField>
            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setFreezeTargetId(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={freezeLoading} loading={freezeLoading}>
                Подтвердить заморозку
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={addParentOpen}
        onOpenChange={(next) => {
          setAddParentOpen(next);
          if (!next) setParentFormError(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Добавить родителя к ученику</DialogTitle>
            <DialogDescription>
              Если аккаунт родителя уже существует в системе, он будет привязан к ученику. Иначе будет создан новый аккаунт с паролем.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddParent} className="space-y-4">
            {parentFormError && (
              <Alert variant="destructive">
                <AlertDescription>{parentFormError}</AlertDescription>
              </Alert>
            )}

            <FormField label="ФИО родителя" htmlFor="add-parent-name" required>
              <Input
                id="add-parent-name"
                type="text"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                placeholder="ФИО"
                required
              />
            </FormField>

            <FormField label="Телефон родителя" htmlFor="add-parent-phone">
              <Input
                id="add-parent-phone"
                type="text"
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                placeholder="+998901234567"
              />
            </FormField>

            <FormField label="Email родителя (необязательно)" htmlFor="add-parent-email">
              <Input
                id="add-parent-email"
                type="email"
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                placeholder="parent@example.com"
              />
            </FormField>

            <FormField label="Кем приходится ученику" htmlFor="add-parent-rel">
              <select
                id="add-parent-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className={selectClassName}
              >
                <option value="MOTHER">Мама</option>
                <option value="FATHER">Папа</option>
                <option value="GUARDIAN">Опекун</option>
                <option value="OTHER">Другой родственник</option>
              </select>
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setAddParentOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={actionLoading} loading={actionLoading}>
                {actionLoading ? "Создание..." : "Привязать"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Сбросить пароль ученика"
        description="Все текущие сессии ученика будут завершены. Новый пароль будет показан один раз."
        confirmLabel="Сбросить пароль"
        variant="destructive"
        loading={actionLoading}
        locale={locale}
        onConfirm={handleResetPassword}
      />

      <ConfirmDialog
        open={confirmRevokeCodeOpen}
        onOpenChange={setConfirmRevokeCodeOpen}
        title="Отозвать код родителя"
        description="Родители больше не смогут использовать этот инвайт-код."
        confirmLabel="Отозвать"
        variant="destructive"
        loading={actionLoading}
        locale={locale}
        onConfirm={handleRevokeParentCode}
      />

      <ConfirmDialog
        open={Boolean(reasonModalOpen)}
        onOpenChange={(next) => !next && setReasonModalOpen(null)}
        title={
          reasonModalOpen === "BLOCK"
            ? "Блокировка ученика"
            : reasonModalOpen === "UNBLOCK"
            ? "Разблокировка ученика"
            : "Архивация ученика"
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

      {parentModalCredentials && (
        <CredentialsModal
          isOpen={Boolean(parentModalCredentials)}
          onClose={() => setParentModalCredentials(null)}
          credentials={parentModalCredentials}
          locale={locale}
        />
      )}
    </div>
  );
}
