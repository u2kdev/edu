"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ArrowLeft,
  Mail,
  Phone,
  Clock,
  Shield,
  Users,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Unlock,
  History,
  Copy,
  Check,
  CreditCard,
  Calendar,
  Printer,
  Receipt,
  Download,
  Archive,
  RotateCcw,
  Trash2,
  LifeBuoy,
  KeyRound,
  ExternalLink,
} from "lucide-react";
import ImpersonateButton from "@/components/ImpersonateButton";

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

export default function PlatformCenterDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [data, setData] = useState<CenterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "users" | "billing" | "tickets" | "history" | "edit" | "director" | "suspend"
  >("overview");

  // Forms state
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
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Lifecycle modals
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [userResetModal, setUserResetModal] = useState<{ url: string; userName: string } | null>(null);
  const [userResetCopied, setUserResetCopied] = useState(false);

  // Billing state
  const [plans, setPlans] = useState<Array<{ id: string; name: string; maxStudents: number; maxTeachers: number; priceMonthly: number }>>([]);
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [extendMonths, setExtendMonths] = useState(1);
  const [changingPlan, setChangingPlan] = useState(false);
  const [extendingSub, setExtendingSub] = useState(false);

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
      if (json.resetUrl) {
        setDirectorResetUrl(json.resetUrl);
      } else {
        setDirectorResetUrl(null);
      }
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

  const handleArchive = async () => {
    if (archiveReason.trim().length < 5) {
      showMessage("error", "Причина архивации должна быть не менее 5 символов");
      return;
    }
    try {
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ARCHIVE", reason: archiveReason.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Не удалось архивировать центр");
      showMessage("success", "Организация успешно перемещена в архив");
      setArchiveModalOpen(false);
      setArchiveReason("");
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
      showMessage("success", "Организация успешно восстановлена из архива");
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
        showMessage("success", "Подписка успешно продлена");
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
        if (json.requiresOverride) {
          if (confirm(`${json.error}\n\nВы уверены, что хотите принудительно перевести центр на этот тариф?`)) {
            handleChangePlan(subId, true);
            return;
          }
        }
        showMessage("error", json.error || "Ошибка смены тарифа");
      } else {
        showMessage("success", "Тарифный план успешно обновлен");
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
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm animate-pulse">
        Загрузка карточки центра...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center shadow-sm">
        {error || "Центр не найден"}
      </div>
    );
  }

  const effectiveDirector = data.director || data.owner;
  const isArchived = data.status === "CANCELLED";
  const cancelledDate = data.cancelledAt ? new Date(data.cancelledAt) : null;
  const daysSinceCancelled = cancelledDate
    ? Math.floor((Date.now() - cancelledDate.getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const canDelete = isArchived && daysSinceCancelled >= 30;

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Link & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/centers"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">{data.name}</h1>
              <span
                className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${
                  isArchived
                    ? "bg-slate-100 text-slate-700 border-slate-300"
                    : data.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : data.status === "TRIAL"
                    ? "bg-blue-50 text-blue-700 border-blue-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {isArchived ? "В АРХИВЕ (CANCELLED)" : data.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Slug: {data.slug}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/platform/centers/${data.id}/export`}
            download
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Экспорт JSON</span>
          </a>

          {!isArchived ? (
            <button
              type="button"
              onClick={() => setArchiveModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>В архив</span>
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRestore}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-semibold transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Восстановить</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!canDelete) {
                    alert(
                      `Удаление центра возможно только через 30 дней после архивации. С момента архивации прошло ${daysSinceCancelled} дн. (осталось ${Math.max(
                        0,
                        30 - daysSinceCancelled
                      )} дн.).`
                    );
                    return;
                  }
                  setDeleteModalOpen(true);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  canDelete
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Удалить центр</span>
              </button>
            </>
          )}

          {effectiveDirector?.id && (
            <ImpersonateButton targetUserId={effectiveDirector.id} targetCenterId={data.id} />
          )}
        </div>
      </div>

      {/* Archive Warning Banner */}
      {isArchived && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Организация находится в архиве с {cancelledDate?.toLocaleDateString() || "—"}</span>
          </div>
          <p>
            Причина архивации: <span className="font-medium">{data.cancelledReason || "Не указана"}</span>. Доступ для
            пользователей заблокирован.
          </p>
        </div>
      )}

      {actionMessage && (
        <div
          className={`p-4 rounded-xl text-sm font-medium border ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      {/* Tabs Bar */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Обзор и параметры" },
          { id: "users", label: `Пользователи (${data.memberships?.length || 0})` },
          { id: "billing", label: "Биллинг" },
          { id: "tickets", label: `Тикеты (${data.tickets?.length || 0})` },
          { id: "history", label: `История (${data.auditLogs?.length || 0})` },
          { id: "edit", label: "Редактировать" },
          { id: "director", label: "Директор" },
          { id: "suspend", label: "Управление доступом" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview (Metrics & Requisites) */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Активные студенты</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {data.metrics?.activeStudents ?? 0}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Активные учителя</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {data.metrics?.activeTeachers ?? 0}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Курсов создано</span>
              <span className="text-2xl font-bold text-slate-900 mt-1 block">
                {data.metrics?.activeCoursesCount ?? 0}
              </span>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-medium block">Посл. активность</span>
              <span className="text-xs font-semibold text-slate-800 mt-2 block truncate">
                {data.metrics?.lastActivityAt
                  ? new Date(data.metrics.lastActivityAt).toLocaleDateString() +
                    " " +
                    new Date(data.metrics.lastActivityAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                  : "—"}
              </span>
            </div>
          </div>

          {/* Student Limits Progress Bar */}
          {data.metrics?.limits && data.metrics.limits.maxStudents > 0 && (
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-slate-600">
                  Лимит активных студентов:{" "}
                  <strong>
                    {data.metrics.limits.currentStudents} из {data.metrics.limits.maxStudents}
                  </strong>
                </span>
                <span
                  className={`font-bold ${
                    data.metrics.limits.percentUsed >= 100
                      ? "text-rose-600"
                      : data.metrics.limits.percentUsed >= 80
                      ? "text-amber-600"
                      : "text-emerald-600"
                  }`}
                >
                  {data.metrics.limits.percentUsed}%
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-2.5 rounded-full transition-all duration-500 ${
                    data.metrics.limits.percentUsed >= 100
                      ? "bg-rose-500"
                      : data.metrics.limits.percentUsed >= 80
                      ? "bg-amber-500"
                      : "bg-emerald-500"
                  }`}
                  style={{ width: `${Math.min(100, data.metrics.limits.percentUsed)}%` }}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* General & Legal Info Card */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-600" />
                  Реквизиты организации
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">Тип организации</span>
                    <span className="font-semibold text-slate-900">
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
                    <span className="text-xs text-slate-500 block">Юридическое наименование</span>
                    <span className="font-medium text-slate-900">{data.legalName || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">ИНН</span>
                    <span className="font-medium text-slate-900">{data.inn || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Контактное лицо</span>
                    <span className="font-medium text-slate-900">{data.contactPerson || "—"}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-xs text-slate-500 block">Фактический адрес</span>
                    <span className="font-medium text-slate-900">{data.address || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Email</span>
                    <span className="font-medium text-slate-900">{data.email || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Телефон</span>
                    <span className="font-medium text-slate-900">{data.phone || "—"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Часовой пояс</span>
                    <span className="font-medium text-slate-900">{data.timeZone || "Asia/Tashkent"}</span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Дата регистрации</span>
                    <span className="font-medium text-slate-900">
                      {new Date(data.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Audit Logs */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-600" />
                  Журнал действий центра (последние записи)
                </h3>
                {data.auditLogs && data.auditLogs.length > 0 ? (
                  <div className="space-y-3">
                    {data.auditLogs.map((log, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700"
                      >
                        <div className="flex items-center justify-between font-semibold text-slate-900">
                          <span>{log.action}</span>
                          <span className="text-slate-400 font-normal">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        {log.details && <p className="mt-1 text-slate-600">{log.details}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">Записей в аудит-логе пока нет.</p>
                )}
              </div>
            </div>

            {/* Right Column: Director & Quick summary */}
            <div className="space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-indigo-600" />
                  Директор центра
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-slate-500 block">ФИО</span>
                    <span className="font-semibold text-slate-900">
                      {effectiveDirector?.fullName || "Не назначен"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Email</span>
                    <span className="font-medium text-slate-900">
                      {effectiveDirector?.email || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 block">Телефон</span>
                    <span className="font-medium text-slate-900">
                      {effectiveDirector?.phone || "—"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                  <Users className="w-5 h-5 text-emerald-600" />
                  Распределение ролей
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Студентов</span>
                    <span className="font-bold text-slate-900">
                      {data.metrics?.usersByRole?.STUDENT || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500">Преподавателей</span>
                    <span className="font-bold text-slate-900">
                      {data.metrics?.usersByRole?.TEACHER || 0}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Администраторов</span>
                    <span className="font-bold text-slate-900">
                      {data.metrics?.usersByRole?.CENTER_ADMIN || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Center Users */}
      {activeTab === "users" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Пользователи центра ({data.memberships?.length || 0})
            </h3>
            <span className="text-xs text-slate-500">
              Члены организации, привязанные через memberships
            </span>
          </div>

          {data.memberships && data.memberships.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                    <th className="text-left px-6 py-3.5">ФИО / Email</th>
                    <th className="text-left px-6 py-3.5">Телефон</th>
                    <th className="text-left px-6 py-3.5">Роль</th>
                    <th className="text-left px-6 py-3.5">Статус</th>
                    <th className="text-left px-6 py-3.5">Добавлен</th>
                    <th className="text-right px-6 py-3.5">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.memberships.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-900">{m.user.fullName}</div>
                        <div className="text-xs text-slate-500">{m.user.email}</div>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        {m.user.phone || "—"}
                      </td>
                      <td className="px-6 py-3.5">
                        <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-800">
                          {m.role}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            m.status === "ACTIVE"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <div className="inline-flex items-center gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => handleUserResetPassword(m.user.id, m.user.fullName)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                          >
                            <KeyRound className="w-3 h-3 text-slate-500" />
                            <span>Сбросить пароль</span>
                          </button>
                          <Link
                            href={`/platform-admin/users?q=${encodeURIComponent(m.user.email)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Профиль</span>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              В данном центре пока нет зарегистрированных участников.
            </div>
          )}
        </div>
      )}

      {/* Tab: Support Tickets */}
      {activeTab === "tickets" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Тикеты технической поддержки ({data.tickets?.length || 0})
            </h3>
            <span className="text-xs text-slate-500">
              Обращения сотрудников данного центра
            </span>
          </div>

          {data.tickets && data.tickets.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200/70">
                    <th className="text-left px-6 py-3.5">Номер / Тема</th>
                    <th className="text-left px-6 py-3.5">Приоритет</th>
                    <th className="text-left px-6 py-3.5">Статус</th>
                    <th className="text-left px-6 py-3.5">Создатель</th>
                    <th className="text-left px-6 py-3.5">Дата</th>
                    <th className="text-right px-6 py-3.5">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.tickets.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-3.5">
                        <div className="font-semibold text-slate-900">{t.subject}</div>
                        <div className="text-xs font-mono text-slate-400">
                          {t.ticketNumber || t.id.slice(0, 8)}
                        </div>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            t.priority === "URGENT"
                              ? "bg-rose-50 text-rose-700"
                              : t.priority === "HIGH"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-6 py-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            t.status === "OPEN"
                              ? "bg-blue-50 text-blue-700"
                              : t.status === "IN_PROGRESS"
                              ? "bg-purple-50 text-purple-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-600">
                        {t.creator?.fullName || "—"}
                      </td>
                      <td className="px-6 py-3.5 text-xs text-slate-500">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <Link
                          href={`/platform-admin/support/${t.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-block"
                        >
                          Открыть тикет &rarr;
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Тикетов от этого центра пока не поступало.
            </div>
          )}
        </div>
      )}

      {/* Tab: History / AuditLog */}
      {activeTab === "history" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Журнал событий аудита ({data.auditLogs?.length || 0})
            </h3>
            <span className="text-xs text-slate-500">
              История изменений и критических операций центра
            </span>
          </div>

          {data.auditLogs && data.auditLogs.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {data.auditLogs.map((log, idx) => (
                <div key={idx} className="p-4 hover:bg-slate-50/60 transition-colors text-xs text-slate-700">
                  <div className="flex items-center justify-between font-semibold text-slate-900 mb-1">
                    <span className="text-indigo-600 font-mono">{log.action}</span>
                    <span className="text-slate-400 font-normal">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-slate-500 text-[11px] mb-1">
                    <span>Автор: <strong className="text-slate-700">{log.actor?.fullName || log.actor?.email || "Система"}</strong></span>
                    {log.ipAddress && <span>IP: <strong className="text-slate-700 font-mono">{log.ipAddress}</strong></span>}
                  </div>
                  {log.details && (
                    <p className="mt-1 text-slate-600 bg-slate-50 p-2 rounded-lg font-mono text-[11px]">
                      {log.details}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Записей аудита для этого центра пока нет.
            </div>
          )}
        </div>
      )}

      {/* Tab: Edit */}
      {activeTab === "edit" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
          <h3 className="text-base font-bold text-slate-900 mb-4">Редактирование параметров центра</h3>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Тип организации</label>
              <select
                value={editForm.organizationKind}
                onChange={(e) => setEditForm({ ...editForm, organizationKind: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              >
                <option value="LEARNING_CENTER">Учебный центр</option>
                <option value="SCHOOL">Школа</option>
                <option value="KINDERGARTEN">Детский сад</option>
                <option value="OTHER">Другое</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Название центра</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                required
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Юр. наименование</label>
                <input
                  type="text"
                  value={editForm.legalName}
                  onChange={(e) => setEditForm({ ...editForm, legalName: e.target.value })}
                  placeholder="OOO..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">ИНН</label>
                <input
                  type="text"
                  value={editForm.inn}
                  onChange={(e) => setEditForm({ ...editForm, inn: e.target.value })}
                  placeholder="123456789"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Контактное лицо</label>
                <input
                  type="text"
                  value={editForm.contactPerson}
                  onChange={(e) => setEditForm({ ...editForm, contactPerson: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Фактический адрес</label>
                <input
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Телефон</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Часовой пояс</label>
              <input
                type="text"
                value={editForm.timeZone}
                onChange={(e) => setEditForm({ ...editForm, timeZone: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              Сохранить изменения
            </button>
          </form>
        </div>
      )}

      {/* Tab: Director */}
      {activeTab === "director" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
          <h3 className="text-base font-bold text-slate-900 mb-2">Назначение нового директора</h3>
          <p className="text-xs text-slate-500 mb-4">
            Пользователь с указанным email получит роль DIRECTOR в этом центре.
          </p>
          <form onSubmit={handleDirectorSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Email пользователя
              </label>
              <input
                type="email"
                value={directorEmail}
                onChange={(e) => setDirectorEmail(e.target.value)}
                placeholder="director@example.com"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                required
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              Назначить директором
            </button>
          </form>

          {directorResetUrl && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-left">
              <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Ссылка для первичного входа директора (показывается один раз!)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={directorResetUrl}
                  className="flex-1 p-2 bg-white border border-amber-300 rounded-lg text-xs font-mono text-slate-800 select-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(directorResetUrl);
                    setCopiedDirectorUrl(true);
                    setTimeout(() => setCopiedDirectorUrl(false), 3000);
                  }}
                  className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  {copiedDirectorUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedDirectorUrl ? "Скопировано!" : "Копировать"}</span>
                </button>
              </div>
              <p className="text-[11px] text-amber-700">
                Передайте эту ссылку новому директору. Ссылка действительна 72 часа для установки собственного пароля.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab: Suspend / Status */}
      {activeTab === "suspend" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
          <h3 className="text-base font-bold text-slate-900 mb-2">Управление статусом центра</h3>
          <p className="text-xs text-slate-500 mb-4">
            Изменение статуса моментально влияет на доступ сотрудников и студентов.
          </p>
          <form onSubmit={handleSuspendSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Выберите действие
              </label>
              <select
                value={suspendForm.action}
                onChange={(e) => setSuspendForm({ ...suspendForm, action: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
              >
                <option value="pause">Приостановить (PAUSED)</option>
                <option value="block">Заблокировать (BLOCKED)</option>
                <option value="resume">Возобновить доступ (ACTIVE)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Причина (для аудита, от 5 символов)
              </label>
              <textarea
                value={suspendForm.reason}
                onChange={(e) => setSuspendForm({ ...suspendForm, reason: e.target.value })}
                placeholder="Укажите подробную причину изменения статуса..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 h-24"
                required
                minLength={5}
                maxLength={500}
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
            >
              Применить изменение статуса
            </button>
          </form>
        </div>
      )}

      {/* Tab: Billing */}
      {activeTab === "billing" && (
        <div className="space-y-6">
          {data.subscriptions && data.subscriptions.length > 0 ? (
            (() => {
              const currentSub = data.subscriptions[0];
              const isPastDue = new Date(currentSub.currentPeriodEndsAt) < new Date();
              return (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Subscription card */}
                  <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-indigo-600" />
                        <h3 className="text-base font-bold text-slate-900">Текущая подписка</h3>
                      </div>
                      <span
                        className={`px-3 py-1 text-xs font-bold rounded-full ${
                          currentSub.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : currentSub.status === "PAST_DUE"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {currentSub.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-xs text-slate-400">Тарифный план</div>
                        <div className="text-base font-bold text-slate-900">{currentSub.plan.name}</div>
                        <div className="text-xs text-slate-500">
                          {currentSub.plan.priceMonthly.toLocaleString()} UZS/мес
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Период действия</div>
                        <div className={`font-semibold ${isPastDue ? "text-rose-600" : "text-slate-900"}`}>
                          до {new Date(currentSub.currentPeriodEndsAt).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-400">
                          с {new Date(currentSub.currentPeriodStartsAt).toLocaleDateString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-400">Автопродление</div>
                        <button
                          type="button"
                          onClick={() => handleToggleAutoRenew(currentSub.id, currentSub.autoRenew)}
                          className={`mt-1 px-3 py-1 text-xs font-semibold rounded-lg border transition-all ${
                            currentSub.autoRenew
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                              : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                          }`}
                        >
                          {currentSub.autoRenew ? "Включено" : "Отключено"}
                        </button>
                      </div>
                    </div>

                    {/* Limits Info */}
                    <div className="pt-2 border-t text-xs text-slate-600 grid grid-cols-3 gap-2">
                      <div>Лимит студентов: <strong>{currentSub.plan.maxStudents}</strong></div>
                      <div>Лимит учителей: <strong>{currentSub.plan.maxTeachers}</strong></div>
                      <div>Лимит филиалов: <strong>{currentSub.plan.maxBranches}</strong></div>
                    </div>

                    {/* Quick Extend Bar */}
                    <div className="pt-4 border-t flex flex-wrap items-center gap-3">
                      <span className="text-xs font-semibold text-slate-700">Продлить на:</span>
                      <select
                        value={extendMonths}
                        onChange={(e) => setExtendMonths(parseInt(e.target.value, 10))}
                        className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      >
                        <option value={1}>1 месяц</option>
                        <option value={3}>3 месяца</option>
                        <option value={6}>6 месяцев</option>
                        <option value={12}>12 месяцев</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleExtendSubscription(currentSub.id)}
                        disabled={extendingSub}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                      >
                        {extendingSub ? "Продление..." : "Продлить подписку"}
                      </button>
                      <Link
                        href={`/platform-admin/finance/payments?centerId=${data.id}&planId=${currentSub.plan.id}`}
                        className="ml-auto inline-flex items-center gap-1.5 px-3 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold transition-all"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        Записать платёж
                      </Link>
                    </div>
                  </div>

                  {/* Plan change card */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                    <h3 className="text-base font-bold text-slate-900 border-b pb-3">Смена тарифа</h3>
                    <p className="text-xs text-slate-500">
                      При смене тарифа проверяются лимиты активных студентов и учителей.
                    </p>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        Новый тариф
                      </label>
                      <select
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      >
                        <option value="">Выберите тариф...</option>
                        {plans.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.priceMonthly.toLocaleString()} UZS)
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleChangePlan(currentSub.id)}
                      disabled={changingPlan || !selectedPlanId}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      {changingPlan ? "Применение..." : "Перевести на новый тариф"}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
              <CreditCard className="w-10 h-10 text-slate-300 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Подписка не оформлена</h3>
              <p className="text-xs text-slate-500">У данного центра отсутствует активная подписка.</p>
              <Link
                href={`/platform-admin/finance/payments?centerId=${data.id}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
              >
                Оформить подписку и записать платёж
              </Link>
            </div>
          )}

          {/* Payment History for this Center */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">История платежей центра</h3>
              <Link
                href={`/platform-admin/finance/payments?centerId=${data.id}`}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Все платежи центра &rarr;
              </Link>
            </div>

            {data.platformPayments && data.platformPayments.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs font-semibold text-slate-500 uppercase">
                      <th className="text-left pb-2">Номер счёта</th>
                      <th className="text-left pb-2">Дата</th>
                      <th className="text-left pb-2">Способ</th>
                      <th className="text-right pb-2">Сумма (UZS)</th>
                      <th className="text-center pb-2">Статус</th>
                      <th className="text-right pb-2">Квитанция</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.platformPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-mono font-bold text-slate-900">
                          {p.invoiceNumber || `INV-${p.id.slice(0, 8)}`}
                        </td>
                        <td className="py-2.5 text-xs text-slate-500">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-2.5 text-xs text-slate-600">{p.paymentMethod}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900">
                          {p.amount.toLocaleString()} UZS
                        </td>
                        <td className="py-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                              p.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link
                            href={`/platform-admin/finance/payments/${p.id}/invoice`}
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Чек
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-xs text-slate-400 py-4">Платежи ещё не регистрировались.</div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Archive Center */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Архивировать учебный центр</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Центр будет переведён в статус <strong>CANCELLED</strong>. Доступ для пользователей центра будет закрыт,
              но данные сохранятся в режиме «только чтение».
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Причина архивации (минимум 5 символов)
              </label>
              <textarea
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Укажите причину архивации..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs h-24"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleArchive}
                disabled={archiveReason.trim().length < 5}
                className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white rounded-xl transition"
              >
                Архивировать
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Delete Center Permanently */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900">Полное удаление центра</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Это действие необратимо. Центр, все связанные курсы, уроки и платежи будут безвозвратно удалены. Перед
              удалением обязательно выгрузите резервную копию через кнопку «Экспорт JSON».
            </p>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <span className="text-slate-500 block mb-1">Для подтверждения введите точное имя центра:</span>
              <span className="font-bold text-slate-900 font-mono">{data.name}</span>
            </div>
            <div>
              <input
                type="text"
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder="Введите точное имя центра"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Обязательная причина удаления (от 5 символов)
              </label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="Причина удаления..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs h-20"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleDeleteCenter}
                disabled={deleteConfirmName !== data.name || deleteReason.trim().length < 5}
                className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-xl transition"
              >
                Удалить навсегда
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: User Reset Password Link */}
      {userResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Ссылка для сброса пароля</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Ссылка для пользователя <strong>{userResetModal.userName}</strong> успешно создана. Передайте её
              пользователю (действует 72 часа):
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={userResetModal.url}
                className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 select-all"
              />
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(userResetModal.url);
                  setUserResetCopied(true);
                  setTimeout(() => setUserResetCopied(false), 3000);
                }}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
              >
                {userResetCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{userResetCopied ? "Скопировано!" : "Копировать"}</span>
              </button>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setUserResetModal(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
