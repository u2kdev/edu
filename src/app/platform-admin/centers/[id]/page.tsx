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
  suspensionReason?: string | null;
  createdAt: string;
  trialEndsAt?: string | null;
  director?: { id?: string; fullName?: string | null; email?: string | null; phone?: string | null } | null;
  owner?: { id?: string; fullName?: string | null; email?: string | null; phone?: string | null } | null;
  metrics?: { usersByRole?: Record<string, number> } | null;
  auditLogs?: Array<{ action: string; createdAt: string; details?: string | null; actor?: { fullName?: string } | null }>;
}

export default function PlatformCenterDetailsPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [data, setData] = useState<CenterDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "edit" | "director" | "suspend">("overview");

  // Forms state
  const [editForm, setEditForm] = useState({ name: "", phone: "", email: "", timeZone: "" });
  const [directorEmail, setDirectorEmail] = useState("");
  const [suspendForm, setSuspendForm] = useState({ action: "pause", reason: "" });
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      });
      setEditForm({
        name: center.name || "",
        phone: center.phone || "",
        email: center.email || "",
        timeZone: center.timeZone || "",
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
      const res = await fetch(`/api/platform/centers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
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

  return (
    <div className="space-y-6">
      {/* Top Bar with Back Link */}
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
              <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {data.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Slug: {data.slug}</p>
          </div>
        </div>

        {effectiveDirector?.id && (
          <ImpersonateButton targetUserId={effectiveDirector.id} targetCenterId={data.id} />
        )}
      </div>

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

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: "overview", label: "Обзор и параметры" },
          { id: "edit", label: "Редактировать" },
          { id: "director", label: "Директор" },
          { id: "suspend", label: "Управление доступом" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all cursor-pointer ${
              activeTab === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* General Info Card */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                Основная информация
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block">Email организации</span>
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

          {/* Right Column: Director & Metrics */}
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
                Пользователи центра
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
      )}

      {/* Tab: Edit */}
      {activeTab === "edit" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm max-w-xl">
          <h3 className="text-base font-bold text-slate-900 mb-4">Редактирование параметров центра</h3>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Название</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                required
              />
            </div>
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
                <option value="pause">Приостановить (FROZEN)</option>
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
    </div>
  );
}
