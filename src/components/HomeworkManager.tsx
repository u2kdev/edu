"use client";

import { useState } from "react";
import {
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  Plus,
  Send,
  Loader2,
  ChevronRight,
  User,
  RotateCcw,
} from "lucide-react";
import { t } from "@/i18n";

export interface HomeworkItem {
  id: string;
  lessonId: string;
  lessonTitle: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  materials: Array<{
    id: string;
    title: string;
    materialType: string;
  }>;
  submissions: Array<{
    id: string;
    studentMembershipId: string;
    studentName: string;
    studentEmail: string;
    submissionText: string | null;
    filesJson: string | null;
    status: string;
    grade: number | null;
    feedback: string | null;
    submittedAt: string;
  }>;
}

interface HomeworkManagerProps {
  homeworks: HomeworkItem[];
  userRole: string;
  userMembershipId?: string;
  locale?: string;
}

const STATUS_BADGES: Record<string, { labelKey: string; color: string }> = {
  NOT_SUBMITTED: {
    labelKey: "homework.notStarted",
    color: "bg-slate-800 text-slate-400 border-slate-700",
  },
  SUBMITTED: {
    labelKey: "homework.submitted",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  },
  ACCEPTED: {
    labelKey: "homework.accepted",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  },
  REVISION_REQUESTED: {
    labelKey: "homework.revisionRequested",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  },
  OVERDUE: {
    labelKey: "homework.overdue",
    color: "bg-red-500/10 text-red-400 border-red-500/30",
  },
};

export default function HomeworkManager({
  homeworks: initialHomeworks,
  userRole,
  userMembershipId,
  locale = "ru",
}: HomeworkManagerProps) {
  const [homeworkList, setHomeworkList] = useState<HomeworkItem[]>(initialHomeworks);
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  // Student submission form state
  const [submittingHwId, setSubmittingHwId] = useState<string | null>(null);
  const [submissionText, setSubmissionText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Teacher grading form state
  const [gradingSubmission, setGradingSubmission] = useState<{
    hwId: string;
    studentMembershipId: string;
    studentName: string;
    submissionText: string | null;
    filesJson: string | null;
    currentGrade: number | null;
    currentStatus: string;
    feedback: string | null;
  } | null>(null);

  const [gradeValue, setGradeValue] = useState<string>("");
  const [gradeStatus, setGradeStatus] = useState<string>("ACCEPTED");
  const [feedbackText, setFeedbackText] = useState<string>("");
  const [isGrading, setIsGrading] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);

  const isStudent = userRole === "STUDENT";
  const isTeacher = userRole === "TEACHER" || userRole === "DIRECTOR" || userRole === "CENTER_ADMIN";

  const handleOpenSubmit = (hw: HomeworkItem) => {
    setSubmittingHwId(hw.id);
    const existing = hw.submissions.find((s) => s.studentMembershipId === userMembershipId);
    setSubmissionText(existing?.submissionText || "");
    setLinkUrl("");
    setLinkTitle("");
    setSubmitSuccess(null);
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submittingHwId) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const filesPayload = linkUrl
      ? { links: [{ title: linkTitle || "Link", url: linkUrl }] }
      : null;

    try {
      const res = await fetch("/api/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "SUBMIT",
          homeworkId: submittingHwId,
          submissionText,
          filesJson: filesPayload,
        }),
      });

      if (res.ok) {
        setSubmitSuccess(t(locale, "homework.submitSuccess"));
        // Update local state
        setHomeworkList((prev) =>
          prev.map((hw) => {
            if (hw.id !== submittingHwId) return hw;
            const updatedSubs = hw.submissions.filter((s) => s.studentMembershipId !== userMembershipId);
            updatedSubs.push({
              id: "temp-sub",
              studentMembershipId: userMembershipId || "",
              studentName: "Me",
              studentEmail: "",
              submissionText,
              filesJson: filesPayload ? JSON.stringify(filesPayload) : null,
              status: "SUBMITTED",
              grade: null,
              feedback: null,
              submittedAt: new Date().toISOString(),
            });
            return { ...hw, submissions: updatedSubs };
          })
        );
        setTimeout(() => setSubmittingHwId(null), 1500);
      } else {
        const errData = (await res.json()) as { error?: string };
        setSubmitError(errData.error || "Failed to submit");
      }
    } catch {
      setSubmitError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenGrade = (
    hwId: string,
    sub: HomeworkItem["submissions"][0]
  ) => {
    setGradingSubmission({
      hwId,
      studentMembershipId: sub.studentMembershipId,
      studentName: sub.studentName,
      submissionText: sub.submissionText,
      filesJson: sub.filesJson,
      currentGrade: sub.grade,
      currentStatus: sub.status,
      feedback: sub.feedback,
    });
    setGradeValue(sub.grade !== null ? String(sub.grade) : "100");
    setGradeStatus(sub.status === "REVISION_REQUESTED" ? "REVISION_REQUESTED" : "ACCEPTED");
    setFeedbackText(sub.feedback || "");
    setGradeError(null);
  };

  const handleGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;

    setIsGrading(true);
    setGradeError(null);

    try {
      const res = await fetch("/api/homework", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "GRADE",
          homeworkId: gradingSubmission.hwId,
          studentMembershipId: gradingSubmission.studentMembershipId,
          grade: parseInt(gradeValue),
          status: gradeStatus,
          feedback: feedbackText,
        }),
      });

      if (res.ok) {
        // Update local state
        setHomeworkList((prev) =>
          prev.map((hw) => {
            if (hw.id !== gradingSubmission.hwId) return hw;
            const updatedSubs = hw.submissions.map((s) => {
              if (s.studentMembershipId !== gradingSubmission.studentMembershipId) return s;
              return {
                ...s,
                grade: parseInt(gradeValue),
                status: gradeStatus,
                feedback: feedbackText,
              };
            });
            return { ...hw, submissions: updatedSubs };
          })
        );
        setGradingSubmission(null);
      } else {
        const errData = (await res.json()) as { error?: string };
        setGradeError(errData.error || "Failed to grade");
      }
    } catch {
      setGradeError("Network error");
    } finally {
      setIsGrading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {["ALL", "SUBMITTED", "ACCEPTED", "REVISION_REQUESTED", "OVERDUE"].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
              filterStatus === st
                ? "bg-brand-500 text-white border-brand-400"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
            }`}
          >
            {st === "ALL" ? t(locale, "common.all") || "Все" : t(locale, `homework.${st === "REVISION_REQUESTED" ? "revisionRequested" : st.toLowerCase()}`) || st}
          </button>
        ))}
      </div>

      {/* Homework List */}
      <div className="space-y-4">
        {homeworkList.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center">
            <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">{t(locale, "common.noData")}</p>
          </div>
        ) : (
          homeworkList.map((hw) => {
            const mySubmission = hw.submissions.find((s) => s.studentMembershipId === userMembershipId);
            const myStatus = mySubmission ? mySubmission.status : "NOT_SUBMITTED";
            const badgeCfg = STATUS_BADGES[myStatus] || STATUS_BADGES.NOT_SUBMITTED;

            return (
              <div
                key={hw.id}
                className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 space-y-4 hover:border-slate-700 transition-all"
              >
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      {hw.lessonTitle}
                    </span>
                    <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                      {hw.title}
                    </h3>
                    {hw.description && (
                      <p className="text-sm text-slate-400 mt-1">{hw.description}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {hw.dueDate && (
                      <span className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold rounded-full">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(hw.dueDate).toLocaleDateString()}</span>
                      </span>
                    )}

                    {isStudent && (
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${badgeCfg.color}`}>
                        {t(locale, badgeCfg.labelKey)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Student Action Bar */}
                {isStudent && (
                  <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-400">
                      {mySubmission?.grade !== null && mySubmission?.grade !== undefined ? (
                        <span className="font-bold text-emerald-400 mr-2">
                          {t(locale, "performance.title")}: {mySubmission.grade}/100
                        </span>
                      ) : null}
                      {mySubmission?.feedback && (
                        <span className="italic text-slate-400">
                          &quot;{mySubmission.feedback}&quot;
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenSubmit(hw)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors flex items-center justify-center gap-1.5"
                    >
                      {mySubmission ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{t(locale, "homework.submitHomework")}</span>
                        </>
                      ) : (
                        <>
                          <Send className="w-3.5 h-3.5" />
                          <span>{t(locale, "homework.submitHomework")}</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Teacher Submissions View */}
                {isTeacher && hw.submissions.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-2">
                    <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      {t(locale, "homework.submitted")}: {hw.submissions.length}
                    </h4>
                    <div className="divide-y divide-slate-800/80">
                      {hw.submissions.map((sub) => {
                        const subBadge = STATUS_BADGES[sub.status] || STATUS_BADGES.SUBMITTED;
                        return (
                          <div
                            key={sub.id}
                            className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-slate-500" />
                              <span className="font-medium text-white">
                                {sub.studentName}
                              </span>
                              <span className={`px-2 py-0.5 rounded-full text-2xs font-semibold border ${subBadge.color}`}>
                                {t(locale, subBadge.labelKey)}
                              </span>
                              {sub.grade !== null && (
                                <span className="font-bold text-brand-400">
                                  {sub.grade}/100
                                </span>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenGrade(hw.id, sub)}
                              className="px-3 py-1 rounded-lg text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors self-start sm:self-auto"
                            >
                              {t(locale, "homework.gradeHomework")}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Student Submit Modal */}
      {submittingHwId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-400" />
              <span>{t(locale, "homework.submitHomework")}</span>
            </h3>

            {submitSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{submitSuccess}</span>
              </div>
            )}

            {submitError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {t(locale, "homework.submitHomework")}
                </label>
                <textarea
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  rows={4}
                  required
                  placeholder="..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {t(locale, "homework.links")} (GitHub, Google Drive, Figma)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={(e) => setLinkTitle(e.target.value)}
                    placeholder="Название (например, Репозиторий)"
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubmittingHwId(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <span>{t(locale, "homework.submitHomework")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Grade Modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 w-full max-w-lg space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-brand-400" />
              <span>{t(locale, "homework.gradeHomework")} — {gradingSubmission.studentName}</span>
            </h3>

            {gradingSubmission.submissionText && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-slate-400 block mb-1">Решение:</span>
                {gradingSubmission.submissionText}
              </div>
            )}

            {gradingSubmission.filesJson && (
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 space-y-1">
                <span className="font-semibold text-slate-400 block mb-1">Ссылки:</span>
                {(() => {
                  try {
                    const parsed = JSON.parse(gradingSubmission.filesJson) as { links?: Array<{ url: string; title: string }> };
                    return (
                      <div className="flex flex-wrap gap-2">
                        {parsed.links?.map((l, i) => (
                          <a
                            key={i}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-brand-400 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>{l.title || l.url}</span>
                          </a>
                        ))}
                      </div>
                    );
                  } catch {
                    return <span>{gradingSubmission.filesJson}</span>;
                  }
                })()}
              </div>
            )}

            {gradeError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{gradeError}</span>
              </div>
            )}

            <form onSubmit={handleGrade} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Балл (0 - 100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={gradeValue}
                    onChange={(e) => setGradeValue(e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">
                    Статус
                  </label>
                  <select
                    value={gradeStatus}
                    onChange={(e) => setGradeStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                  >
                    <option value="ACCEPTED">{t(locale, "homework.accepted")}</option>
                    <option value="REVISION_REQUESTED">{t(locale, "homework.revisionRequested")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">
                  {t(locale, "homework.feedback")}
                </label>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  rows={3}
                  placeholder="..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-slate-800 hover:bg-slate-800 text-slate-400 transition-colors"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={isGrading}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {isGrading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>...</span>
                    </>
                  ) : (
                    <span>{t(locale, "homework.gradeHomework")}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
