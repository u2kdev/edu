"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  XCircle,
  Plus,
  AlertCircle,
  Loader2,
  Ban,
  ArrowRight,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

export interface SubstitutionItem {
  id: string;
  status: "REQUESTED" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason: string;
  resolverComment?: string | null;
  createdAt: string;
  lesson: {
    id: string;
    title: string;
    scheduledAt?: string | null;
    durationMinutes?: number | null;
    status: string;
    module?: {
      title: string;
      course: { id: string; title: string };
    };
    scheduleSlot?: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      group: { id: string; name: string };
    };
  };
  requester: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  };
  proposedSubstitute?: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  } | null;
  substituteTeacher?: {
    id: string;
    role: string;
    user: { fullName: string; email: string };
  } | null;
  resolvedBy?: {
    id: string;
    user: { fullName: string };
  } | null;
}

export interface TeacherOption {
  id: string;
  role: string;
  fullName: string;
  email: string;
}

export interface LessonOption {
  id: string;
  title: string;
  scheduledAt?: string | null;
  durationMinutes?: number | null;
}

interface SubstitutionsManagerProps {
  initialRequests: SubstitutionItem[];
  teachers: TeacherOption[];
  myLessons: LessonOption[];
  role: string;
  currentMembershipId: string;
  locale?: string;
}

export default function SubstitutionsManager({
  initialRequests,
  teachers,
  myLessons,
  role,
  currentMembershipId,
  locale = "ru",
}: SubstitutionsManagerProps) {
  const router = useRouter();
  const [requests, setRequests] = useState<SubstitutionItem[]>(initialRequests);
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState(myLessons[0]?.id || "");
  const [reason, setReason] = useState("");
  const [proposedSubstituteId, setProposedSubstituteId] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Approval modal state
  const [resolveTarget, setResolveTarget] = useState<{
    request: SubstitutionItem;
    action: "APPROVE" | "REJECT";
  } | null>(null);
  const [assignSubstituteId, setAssignSubstituteId] = useState("");
  const [resolverComment, setResolverComment] = useState("");

  const isPrivileged = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const activeRequests = requests.filter((r) => r.status === "REQUESTED");
  const historyRequests = requests.filter((r) => r.status !== "REQUESTED");
  const displayedRequests = activeTab === "ACTIVE" ? activeRequests : historyRequests;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId || !reason.trim()) {
      setErrorMsg(locale === "uz-Latn" ? "Dars va sabab ko'rsatilishi shart" : "Укажите урок и причину");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/substitutions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          reason: reason.trim(),
          proposedSubstituteMembershipId: proposedSubstituteId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ошибка создания заявки");
        return;
      }

      setShowCreateModal(false);
      setReason("");
      setProposedSubstituteId("");
      router.refresh();
      // Optimistic update
      setRequests([data.substitutionRequest, ...requests]);
    } catch {
      setErrorMsg(locale === "uz-Latn" ? "Tarmoq xatosi" : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;

    if (resolveTarget.action === "APPROVE" && !assignSubstituteId) {
      setErrorMsg(locale === "uz-Latn" ? "O'rinbosar o'qituvchini tanlang" : "Выберите заменяющего учителя");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/substitutions/${resolveTarget.request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: resolveTarget.action,
          substituteTeacherMembershipId: assignSubstituteId || undefined,
          resolverComment: resolverComment.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "Ошибка обработки заявки");
        return;
      }

      setResolveTarget(null);
      setAssignSubstituteId("");
      setResolverComment("");
      router.refresh();
      // Update state
      setRequests(requests.map((r) => (r.id === data.substitutionRequest.id ? data.substitutionRequest : r)));
    } catch {
      setErrorMsg(locale === "uz-Latn" ? "Tarmoq xatosi" : "Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (reqId: string) => {
    if (!confirm(locale === "uz-Latn" ? "Arizani bekor qilasizmi?" : "Отменить заявку на замену?")) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/substitutions/${reqId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "CANCEL" }),
      });
      const data = await res.json();
      if (res.ok) {
        setRequests(requests.map((r) => (r.id === reqId ? data.substitutionRequest : r)));
        router.refresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const statusBadge = (st: SubstitutionItem["status"]) => {
    switch (st) {
      case "REQUESTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {locale === "uz-Latn" ? "Kutilmoqda" : "Ожидает"}
          </span>
        );
      case "APPROVED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            {locale === "uz-Latn" ? "Tasdiqlangan" : "Одобрена"}
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center gap-1">
            <XCircle className="w-3 h-3" />
            {locale === "uz-Latn" ? "Rad etilgan" : "Отклонена"}
          </span>
        );
      case "CANCELLED":
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 border border-slate-700 flex items-center gap-1">
            <Ban className="w-3 h-3" />
            {locale === "uz-Latn" ? "Bekor qilingan" : "Отменена"}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Calendar className="w-6 h-6 text-brand-400" />
            <span>{locale === "uz-Latn" ? "Dars almashish va almashtirishlar" : "Замены преподавателей"}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {locale === "uz-Latn"
              ? "Darslarni o'zaro almashtirish va o'rinbosarlarni tasdiqlash"
              : "Заявки на замену уроков, согласование и назначение замещающих"}
          </p>
        </div>

        {(role === "TEACHER" || role === "TEACHER_ASSISTANT" || isPrivileged) && (
          <button
            onClick={() => {
              setErrorMsg("");
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-medium rounded-xl text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>{locale === "uz-Latn" ? "Almashtirish so'rovi" : "Запросить замену"}</span>
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("ACTIVE")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${
            activeTab === "ACTIVE"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>{locale === "uz-Latn" ? "Faol so'rovlar" : "Активные заявки"}</span>
          {activeRequests.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs bg-amber-500/20 text-amber-400 font-bold">
              {activeRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("HISTORY")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === "HISTORY"
              ? "bg-slate-800 text-white border border-slate-700"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <span>{locale === "uz-Latn" ? "Tarix" : "История замен"}</span>
        </button>
      </div>

      {/* Requests List */}
      {displayedRequests.length === 0 ? (
        <div className="glass-panel p-12 rounded-2xl border border-slate-800 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-white">
            {activeTab === "ACTIVE"
              ? locale === "uz-Latn"
                ? "Hozirda faol so'rovlar yo'q"
                : "Нет активных заявок на замену"
              : locale === "uz-Latn"
              ? "Tarix bo'sh"
              : "История замен пуста"}
          </h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {locale === "uz-Latn"
              ? "O'qituvchilar darsni o'zgartirish yoki almashtirish uchun ariza yuborishi mumkin."
              : "Преподаватели могут запрашивать замену уроков при болезни или невозможности провести занятие."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {displayedRequests.map((req) => {
            const isMine = req.requester.id === currentMembershipId;
            return (
              <div
                key={req.id}
                className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider block">
                        {req.lesson.module?.course.title || "Курс"}
                      </span>
                      <h4 className="text-base font-bold text-white mt-0.5">{req.lesson.title}</h4>
                      {req.lesson.scheduledAt && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {formatDateLocalized(new Date(req.lesson.scheduledAt), locale)} •{" "}
                          {req.lesson.durationMinutes || 60} мин
                        </p>
                      )}
                    </div>
                    <div>{statusBadge(req.status)}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-500">{locale === "uz-Latn" ? "O'qituvchi:" : "Преподаватель:"}</span>
                      <span className="font-semibold text-white">{req.requester.user.fullName}</span>
                    </div>

                    {req.proposedSubstitute && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">{locale === "uz-Latn" ? "Taklif etilgan:" : "Предложен:"}</span>
                        <span className="text-amber-300">{req.proposedSubstitute.user.fullName}</span>
                      </div>
                    )}

                    {req.substituteTeacher && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-500">{locale === "uz-Latn" ? "O'rinbosar:" : "Заменяет:"}</span>
                        <span className="font-bold text-emerald-400">{req.substituteTeacher.user.fullName}</span>
                      </div>
                    )}

                    <div className="pt-1.5 border-t border-slate-800/80 text-slate-300">
                      <span className="text-slate-500 block mb-0.5">{locale === "uz-Latn" ? "Sabab:" : "Причина:"}</span>
                      <p className="text-slate-300 italic">«{req.reason}»</p>
                    </div>

                    {req.resolverComment && (
                      <div className="pt-1 text-slate-300">
                        <span className="text-slate-500 block mb-0.5">{locale === "uz-Latn" ? "Izoh:" : "Комментарий:"}</span>
                        <p className="text-slate-400">{req.resolverComment}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {formatDateLocalized(new Date(req.createdAt), locale)}
                  </span>

                  <div className="flex items-center gap-2">
                    {req.status === "REQUESTED" && isMine && !isPrivileged && (
                      <button
                        onClick={() => handleCancel(req.id)}
                        disabled={loading}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
                      >
                        {locale === "uz-Latn" ? "Bekor qilish" : "Отменить"}
                      </button>
                    )}

                    {req.status === "REQUESTED" && isPrivileged && (
                      <>
                        <button
                          onClick={() => {
                            setErrorMsg("");
                            setAssignSubstituteId(req.proposedSubstitute?.id || teachers[0]?.id || "");
                            setResolverComment("");
                            setResolveTarget({ request: req, action: "APPROVE" });
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
                        >
                          {locale === "uz-Latn" ? "Tasdiqlash" : "Одобрить"}
                        </button>
                        <button
                          onClick={() => {
                            setErrorMsg("");
                            setResolverComment("");
                            setResolveTarget({ request: req, action: "REJECT" });
                          }}
                          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-xs font-semibold transition-colors"
                        >
                          {locale === "uz-Latn" ? "Rad etish" : "Отклонить"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-400" />
              <span>{locale === "uz-Latn" ? "Dars almashish so'rovi" : "Запрос на замену урока"}</span>
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {locale === "uz-Latn" ? "Darsni tanlang" : "Выберите урок"}
                </label>
                {myLessons.length === 0 ? (
                  <p className="text-xs text-amber-400 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    {locale === "uz-Latn"
                      ? "Sizda almashtirish uchun darslar topilmadi"
                      : "У вас нет доступных запланированных уроков"}
                  </p>
                ) : (
                  <select
                    required
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    {myLessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.title}{" "}
                        {l.scheduledAt ? `(${formatDateLocalized(new Date(l.scheduledAt), locale)})` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {locale === "uz-Latn" ? "Almashtirish sababi" : "Причина замены"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={
                    locale === "uz-Latn"
                      ? "Masalan: Kasallik tufayli yoki shoshilinch safar..."
                      : "Например: Больничный лист, семейные обстоятельства..."
                  }
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {locale === "uz-Latn" ? "Taklif etilayotgan o'qituvchi (ixtiyoriy)" : "Предпочтительный заменяющий (опционально)"}
                </label>
                <select
                  value={proposedSubstituteId}
                  onChange={(e) => setProposedSubstituteId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="">{locale === "uz-Latn" ? "Ma'muriyat o'zi tanlasin" : "На усмотрение директора"}</option>
                  {teachers
                    .filter((t) => t.id !== currentMembershipId)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} ({t.role})
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  {locale === "uz-Latn" ? "Bekor qilish" : "Отмена"}
                </button>
                <button
                  type="submit"
                  disabled={loading || myLessons.length === 0}
                  className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm flex items-center gap-2 shadow-lg shadow-brand-500/20"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{locale === "uz-Latn" ? "Yuborish" : "Отправить заявку"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Resolve (Approve / Reject) Modal */}
      {resolveTarget && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              {resolveTarget.action === "APPROVE" ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span>{locale === "uz-Latn" ? "Almashtirishni tasdiqlash" : "Одобрение заявки на замену"}</span>
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-rose-400" />
                  <span>{locale === "uz-Latn" ? "Almashtirishni rad etish" : "Отклонение заявки на замену"}</span>
                </>
              )}
            </h3>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-xs space-y-1">
              <span className="text-slate-400">{locale === "uz-Latn" ? "Dars:" : "Урок:"}</span>
              <p className="text-white font-bold">{resolveTarget.request.lesson.title}</p>
              <p className="text-slate-400 italic">«{resolveTarget.request.reason}»</p>
            </div>

            <div className="space-y-4">
              {resolveTarget.action === "APPROVE" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    {locale === "uz-Latn" ? "O'rinbosar o'qituvchini tayinlang" : "Назначить заменяющего преподавателя"}
                  </label>
                  <select
                    value={assignSubstituteId}
                    onChange={(e) => setAssignSubstituteId(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">{locale === "uz-Latn" ? "Tanlang..." : "Выберите..."}</option>
                    {teachers
                      .filter((t) => t.id !== resolveTarget.request.requester.id)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName} ({t.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {locale === "uz-Latn" ? "Izoh (ixtiyoriy)" : "Комментарий для преподавателя (опционально)"}
                </label>
                <textarea
                  rows={2}
                  value={resolverComment}
                  onChange={(e) => setResolverComment(e.target.value)}
                  placeholder={locale === "uz-Latn" ? "Izoh yozing..." : "Например: Согласовано с директором..."}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setResolveTarget(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  {locale === "uz-Latn" ? "Bekor qilish" : "Отмена"}
                </button>
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={loading}
                  className={`px-5 py-2.5 font-semibold rounded-xl text-sm flex items-center gap-2 text-white ${
                    resolveTarget.action === "APPROVE"
                      ? "bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20"
                      : "bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-500/20"
                  }`}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {resolveTarget.action === "APPROVE"
                      ? locale === "uz-Latn"
                        ? "Tasdiqlash"
                        : "Одобрить замену"
                      : locale === "uz-Latn"
                      ? "Rad etish"
                      : "Отклонить замену"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
