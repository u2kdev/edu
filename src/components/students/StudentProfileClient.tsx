"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  User,
  GraduationCap,
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
  Heart,
  QrCode,
  Check,
  Copy,
  Plus,
  CreditCard,
  ClipboardCheck,
  Award,
  FileSpreadsheet,
  Printer,
  Download,
} from "lucide-react";
import { t } from "@/i18n";
import { CredentialsModal, type CredentialsData } from "@/components/CredentialsModal";

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
  actorRole: string;
  locale: string;
}

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
}: StudentProfileClientProps) {
  const [activeTab, setActiveTab] = useState<
    "profile" | "access" | "groups" | "parents" | "attendance" | "grades" | "payments" | "history" | "transcript"
  >("profile");

  const [membership, setMembership] = useState(initialMembership);
  const [user, setUser] = useState(initialUser);
  const [parents, setParents] = useState(initialParents);
  const [parentCode, setParentCode] = useState(initialCode);

  // Profile Edit
  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone || "");
  const [email, setEmail] = useState(user.email || "");
  const [username, setUsername] = useState(user.username || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Access Actions
  const [actionLoading, setActionLoading] = useState(false);
  const [credentialsModalOpen, setCredentialsModalOpen] = useState(false);
  const [newCredentials, setNewCredentials] = useState<CredentialsData | null>(null);
  const [actionNotice, setActionNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reason Modal for Block / Archive
  const [reasonModalOpen, setReasonModalOpen] = useState<"BLOCK" | "UNBLOCK" | "ARCHIVE" | null>(null);
  const [reasonText, setReasonText] = useState("");

  // Add Parent Modal
  const [addParentOpen, setAddParentOpen] = useState(false);
  const [parentName, setParentName] = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [relationship, setRelationship] = useState("MOTHER");
  const [parentModalCredentials, setParentModalCredentials] = useState<CredentialsData | null>(null);

  // Copy code feedback
  const [codeCopied, setCodeCopied] = useState(false);

  const canManage = actorRole === "DIRECTOR" || actorRole === "CENTER_ADMIN";

  // Save student profile
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

  // Reset Password Action
  const handleResetPassword = async () => {
    if (!window.confirm("Сбросить пароль ученика? Все текущие сессии будут завершены.")) {
      return;
    }

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

  // Send Reset Link
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

  // Block / Unblock / Archive
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
        setActionNotice({ type: "success", text: "Ученик архивирован" });
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
          text: newStatus === "BLOCKED" ? "Ученик заблокирован" : "Ученик разблокирован",
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

  // Generate / Regenerate Parent Code
  const handleGenerateParentCode = async () => {
    setActionLoading(true);
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

  // Revoke Parent Code
  const handleRevokeParentCode = async () => {
    if (!parentCode) return;
    if (!window.confirm("Отозвать данный код? Родители больше не смогут использовать его.")) return;

    setActionLoading(true);
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

  // Add Parent Directly
  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!parentPhone && !parentEmail) {
      alert("Укажите телефон или email родителя");
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

      // Also ensure ParentLink is established
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
      alert(err instanceof Error ? err.message : "Неизвестная ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          href="/center/students"
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
            <GraduationCap className="w-7 h-7" />
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
                <GraduationCap className="w-3.5 h-3.5 text-brand-400" />
                Ученик
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
      <div className="flex border-b border-slate-800 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
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
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "access"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Key className="w-4 h-4" />
          <span>Доступ</span>
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "groups"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Группы ({enrollments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("parents")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "parents"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Heart className="w-4 h-4" />
          <span>Родители ({parents.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "attendance"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Посещаемость ({attendances.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("grades")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "grades"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Award className="w-4 h-4" />
          <span>Оценки ({grades.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("payments")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "payments"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Платежи ({payments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "history"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <History className="w-4 h-4" />
          <span>История ({auditLogs.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("transcript")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "transcript"
              ? "border-brand-500 text-white bg-slate-800/40"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Табель успеваемости</span>
        </button>
      </div>

      {/* Tab 1: Profile */}
      {activeTab === "profile" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6 max-w-2xl">
          {manageability.isShared && (
            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block font-semibold">Ученик состоит в нескольких центрах</strong>
                Смена контактных данных (телефон, email, логин) возможна только самим пользователем.
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">ФИО ученика</label>
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
                  placeholder="student@example.com"
                  className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-50 focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Логин / Имя пользователя</label>
              <input
                type="text"
                value={username}
                disabled={manageability.isShared}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                className="w-full px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white disabled:opacity-50 focus:outline-none focus:border-brand-500"
              />
            </div>

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
                        Вы можете отправить ученику ссылку для самостоятельного сброса пароля.
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
              <div className="text-xs font-semibold text-slate-300">Статус членства:</div>
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
                    <span>Заблокировать ученика</span>
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
                    <span>Разблокировать ученика</span>
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
              <span>Активные сессии ({activeSessions.length})</span>
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
            <span>Группы и курсы ученика</span>
          </h3>

          {enrollments.length === 0 ? (
            <p className="text-xs text-slate-400">Ученик пока не записан ни в одну группу</p>
          ) : (
            <div className="divide-y divide-slate-800">
              {enrollments.map((enr) => (
                <div key={enr.id} className="py-3 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white block">{enr.groupName}</span>
                    <span className="text-[11px] text-slate-400">
                      Курс: {enr.courseTitle} | Преподаватель: {enr.teacherName}
                    </span>
                  </div>
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

      {/* Tab 4: Parents & ParentLink */}
      {activeTab === "parents" && (
        <div className="space-y-6 max-w-3xl">
          {/* Parent Code Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <QrCode className="w-4 h-4 text-brand-400" />
                <span>Личный код родителя для ученика</span>
              </h3>
              {parentCode ? (
                <button
                  onClick={handleRevokeParentCode}
                  disabled={actionLoading}
                  className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                >
                  Отозвать код
                </button>
              ) : (
                <button
                  onClick={handleGenerateParentCode}
                  disabled={actionLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Сгенерировать код</span>
                </button>
              )}
            </div>

            {parentCode ? (
              <div className="bg-slate-900/80 border border-brand-500/30 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                    Инвайт-код для привязки родителя
                  </span>
                  <div className="text-xl font-mono font-bold text-brand-400 tracking-wider mt-1 select-all">
                    {parentCode.code}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Родитель вводит этот код при регистрации или в личном кабинете.
                    {parentCode.expiresAt && ` Действителен до: ${new Date(parentCode.expiresAt).toLocaleDateString()}`}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => copyCode(parentCode.code)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl border border-slate-700"
                  >
                    {codeCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{codeCopied ? "Скопировано!" : "Копировать"}</span>
                  </button>
                  <button
                    onClick={handleGenerateParentCode}
                    disabled={actionLoading}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl border border-slate-700"
                  >
                    Перегенерировать
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">
                Код еще не сгенерирован. Вы можете создать личный код родителя для ученика или добавить родителя вручную.
              </p>
            )}
          </div>

          {/* Linked Parents List */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Heart className="w-4 h-4 text-brand-400" />
                <span>Привязанные родители ({parents.length})</span>
              </h3>
              <button
                onClick={() => setAddParentOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить родителя</span>
              </button>
            </div>

            {parents.length === 0 ? (
              <p className="text-xs text-slate-400">У данного ученика пока нет привязанных родителей</p>
            ) : (
              <div className="divide-y divide-slate-800">
                {parents.map((parent) => (
                  <div key={parent.linkId} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">{parent.fullName}</span>
                        <span className="px-2 py-0.5 bg-brand-500/10 text-brand-400 border border-brand-500/20 rounded-full text-[10px] font-semibold">
                          {parent.relationship === "MOTHER"
                            ? "Мама"
                            : parent.relationship === "FATHER"
                            ? "Папа"
                            : "Опекун"}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-3 mt-1 font-mono">
                        {parent.phone && <span>{parent.phone}</span>}
                        {parent.email && <span>{parent.email}</span>}
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                      Подтверждено
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 5: Attendance */}
      {activeTab === "attendance" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-brand-400" />
            <span>Журнал посещаемости</span>
          </h3>

          {attendances.length === 0 ? (
            <p className="text-xs text-slate-400">Нет записей посещаемости</p>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {attendances.map((att) => (
                <div key={att.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">{att.lessonTitle}</span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(att.markedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                      att.status === "PRESENT"
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                        : att.status === "ABSENT"
                        ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                        : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                    }`}
                  >
                    {att.status === "PRESENT" ? "Был(а)" : att.status === "ABSENT" ? "Отсутствовал(а)" : "Опоздал(а)"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 6: Grades */}
      {activeTab === "grades" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Award className="w-4 h-4 text-brand-400" />
            <span>Успеваемость и оценки</span>
          </h3>

          {grades.length === 0 ? (
            <p className="text-xs text-slate-400">Оценок пока нет</p>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {grades.map((grade) => (
                <div key={grade.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block">{grade.lessonTitle}</span>
                    <span className="text-[11px] text-slate-400">
                      Преподаватель: {grade.teacherName} | {new Date(grade.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-emerald-400">{grade.value}</span>
                    <span className="text-[10px] text-slate-500 block">вес: {grade.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 7: Payments */}
      {activeTab === "payments" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-400" />
            <span>История оплат за обучение</span>
          </h3>

          {payments.length === 0 ? (
            <p className="text-xs text-slate-400">Записей об оплатах нет</p>
          ) : (
            <div className="divide-y divide-slate-800 text-xs">
              {payments.map((p) => (
                <div key={p.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block font-mono">
                      {p.amount.toLocaleString()} {p.currency}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Способ: {p.method} | {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Оплачено
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 8: History / Audit */}
      {activeTab === "history" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <History className="w-4 h-4 text-brand-400" />
            <span>Журнал аудита по ученику</span>
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

      {/* Tab 9: Transcript */}
      {activeTab === "transcript" && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-brand-400" />
                <span>Табель академической успеваемости</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Сводные показатели посещаемости, оценок и тестов ученика {user.fullName}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={`/api/tenant/students/${membership.id}/transcript?format=csv`}
                download
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-3.5 h-3.5" />
                Экспорт CSV
              </a>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold transition"
              >
                <Printer className="w-3.5 h-3.5" />
                Печать
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Посещаемость занятий</span>
              <div className="text-2xl font-bold text-white mt-1">
                {attendances.length > 0
                  ? Math.round(
                      (attendances.filter(
                        (a) => a.status === "PRESENT" || a.status === "LATE"
                      ).length /
                        attendances.length) *
                        100
                    )
                  : 100}
                %
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {attendances.filter((a) => a.status === "PRESENT" || a.status === "LATE").length} из {attendances.length} отметок
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Средний балл (GPA)</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {grades.length > 0
                  ? (
                      grades.reduce((sum, g) => sum + g.value, 0) / grades.length
                    ).toFixed(1)
                  : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                На основе {grades.length} выставленных оценок
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium">Активных курсов / групп</span>
              <div className="text-2xl font-bold text-brand-400 mt-1">
                {enrollments.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Текущие учебные потоки
              </div>
            </div>
          </div>

          {/* Courses & Teachers */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Учебные программы и группы
            </h4>
            <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden">
              {enrollments.map((enr) => (
                <div key={enr.id} className="p-3 bg-slate-950 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-white">{enr.courseTitle}</span>
                    <span className="text-slate-400 ml-2">({enr.groupName})</span>
                  </div>
                  <div className="text-slate-400">Преподаватель: {enr.teacherName}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Grades Table */}
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              Журнал успеваемости
            </h4>
            {grades.length === 0 ? (
              <p className="text-xs text-slate-500">Оценок пока нет</p>
            ) : (
              <div className="border border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-900/80 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Дата</th>
                      <th className="p-3">Урок</th>
                      <th className="p-3">Преподаватель</th>
                      <th className="p-3 text-right">Оценка</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {grades.slice(0, 15).map((g) => (
                      <tr key={g.id} className="hover:bg-slate-900/40">
                        <td className="p-3 text-slate-400">
                          {new Date(g.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-white font-medium">{g.lessonTitle}</td>
                        <td className="p-3 text-slate-400">{g.teacherName}</td>
                        <td className="p-3 text-right">
                          <span className="px-2 py-0.5 rounded font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {g.value}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Parent Modal */}
      {addParentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">Добавить родителя к ученику</h3>
            <p className="text-xs text-slate-400">
              Если аккаунт родителя уже существует в системе, он будет привязан к ученику. Иначе будет создан новый аккаунт с паролем.
            </p>

            <form onSubmit={handleAddParent} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">ФИО родителя</label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  placeholder="ФИО"
                  required
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Телефон родителя</label>
                <input
                  type="text"
                  value={parentPhone}
                  onChange={(e) => setParentPhone(e.target.value)}
                  placeholder="+998901234567"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Email родителя (необязательно)</label>
                <input
                  type="email"
                  value={parentEmail}
                  onChange={(e) => setParentEmail(e.target.value)}
                  placeholder="parent@example.com"
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Кем приходится ученику</label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="MOTHER">Мама</option>
                  <option value="FATHER">Папа</option>
                  <option value="GUARDIAN">Опекун</option>
                  <option value="OTHER">Другой родственник</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setAddParentOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl disabled:opacity-50"
                >
                  {actionLoading ? "Создание..." : "Привязать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reason Modal */}
      {reasonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-white">
              {reasonModalOpen === "BLOCK"
                ? "Блокировка ученика"
                : reasonModalOpen === "UNBLOCK"
                ? "Разблокировка ученика"
                : "Архивация ученика"}
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

      {/* Single-display Credentials Modals */}
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
