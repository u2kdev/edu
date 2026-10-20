"use client";

import { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  Award,
  Download,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Users,
} from "lucide-react";
import { t } from "@/i18n";

interface GroupOption {
  id: string;
  name: string;
}

interface GradeItem {
  id: string;
  gradeType: string;
  value: number;
  maxValue: number;
  lifecycle: string;
  comment: string | null;
  lessonId: string | null;
  createdAt: string;
}

interface StudentRow {
  studentMembershipId: string;
  studentName: string;
  studentEmail: string;
  grades: GradeItem[];
  weightedScore: number;
  letterGrade: string;
}

interface MatrixResponse {
  groupId: string;
  groupName: string;
  students: StudentRow[];
}

interface GradebookManagerProps {
  groups: GroupOption[];
  locale?: string;
  userRole: string;
}

function getGradeBadgeColor(letter: string): string {
  switch (letter) {
    case "A":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "B":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "C":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    case "D":
      return "bg-orange-500/10 text-orange-400 border-orange-500/30";
    default:
      return "bg-red-500/10 text-red-400 border-red-500/30";
  }
}

export default function GradebookManager({
  groups,
  locale = "ru",
  userRole,
}: GradebookManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id || ""
  );
  const [matrixData, setMatrixData] = useState<MatrixResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Finalize state
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);

  // Cleared on unmount so the success banner timer cannot fire on a dead component.
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const canFinalize = userRole === "DIRECTOR" || userRole === "CENTER_ADMIN";
  const canExport =
    userRole === "DIRECTOR" ||
    userRole === "CENTER_ADMIN" ||
    userRole === "TEACHER";

  useEffect(() => {
    if (!selectedGroupId) {
      setMatrixData(null);
      return;
    }

    let isSubscribed = true;
    // Drop the previous group's matrix immediately: the select switches instantly,
    // so keeping stale rows visible until the new response arrives mixes two groups.
    setMatrixData(null);
    async function loadMatrix() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/grades/matrix?groupId=${selectedGroupId}`);
        if (!res.ok) {
          const errData = (await res.json()) as { error?: string };
          if (isSubscribed) setError(errData.error || "Failed to load gradebook");
          return;
        }
        const data = (await res.json()) as MatrixResponse;
        if (isSubscribed) {
          setMatrixData(data);
        }
      } catch {
        if (isSubscribed) setError("Network error loading gradebook");
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadMatrix();
    return () => {
      isSubscribed = false;
    };
  }, [selectedGroupId]);

  const handleFinalize = async () => {
    if (!selectedGroupId) return;
    setFinalizing(true);
    setFinalizeSuccess(false);
    setFinalizeError(null);

    try {
      const res = await fetch("/api/grades/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: selectedGroupId }),
      });

      if (res.ok) {
        setFinalizeSuccess(true);
        // Refresh matrix
        const refreshRes = await fetch(
          `/api/grades/matrix?groupId=${selectedGroupId}`
        );
        if (refreshRes.ok) {
          const data = (await refreshRes.json()) as MatrixResponse;
          setMatrixData(data);
        }
        if (successTimerRef.current) clearTimeout(successTimerRef.current);
        successTimerRef.current = setTimeout(() => setFinalizeSuccess(false), 4000);
      } else {
        const errData = (await res.json()) as { error?: string };
        setFinalizeError(errData.error || "Failed to finalize period");
      }
    } catch {
      setFinalizeError("Network error while finalizing");
    } finally {
      setFinalizing(false);
    }
  };

  const students = matrixData?.students || [];

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        {/* Group Selector */}
        <div className="w-full sm:w-64">
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            {t(locale, "grades.selectGroup")}
          </label>
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
          >
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV Button */}
          {canExport && (
            <a
              href={`/api/grades/export?groupId=${selectedGroupId}`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>{t(locale, "grades.exportCsv")}</span>
            </a>
          )}

          {/* Finalize Button */}
          {canFinalize && (
            <button
              type="button"
              onClick={handleFinalize}
              disabled={finalizing || loading || !selectedGroupId}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
            >
              {finalizing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t(locale, "grades.finalizePeriod")}</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {finalizeSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{t(locale, "grades.finalizedSuccess")}</span>
        </div>
      )}

      {finalizeError && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{finalizeError}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Gradebook Matrix Content */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">
              {matrixData?.groupName || t(locale, "grades.gradebookMatrix")}
            </span>
          </div>
          <span className="text-xs text-slate-400">
            {students.length} {t(locale, "nav.students")}
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            <span>...</span>
          </div>
        ) : students.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {t(locale, "grades.noGrades")}
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">{t(locale, "nav.students")}</th>
                    <th className="p-4">{t(locale, "grades.title")}</th>
                    <th className="p-4 text-center">
                      {t(locale, "grades.weightedScore")}
                    </th>
                    <th className="p-4 text-center">
                      {t(locale, "grades.letterGrade")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {students.map((s) => {
                    const badgeColor = getGradeBadgeColor(s.letterGrade);
                    return (
                      <tr
                        key={s.studentMembershipId}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-semibold text-white">
                            {s.studentName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {s.studentEmail}
                          </div>
                        </td>
                        <td className="p-4">
                          {s.grades.length === 0 ? (
                            <span className="text-xs text-slate-500">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {s.grades.map((g) => (
                                <span
                                  key={g.id}
                                  title={`${g.gradeType}: ${g.value}/${g.maxValue}${
                                    g.comment ? ` (${g.comment})` : ""
                                  }${g.lifecycle === "FINAL" ? " [LOCKED]" : ""}`}
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${
                                    g.lifecycle === "FINAL"
                                      ? "bg-slate-800 text-slate-300 border-slate-700"
                                      : "bg-brand-500/10 text-brand-300 border-brand-500/20"
                                  }`}
                                >
                                  {g.lifecycle === "FINAL" && (
                                    <Lock className="w-2.5 h-2.5 text-slate-400" />
                                  )}
                                  <span>{g.value}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="p-4 text-center font-bold text-white">
                          {s.weightedScore}%
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`px-2.5 py-1 rounded-full text-xs font-bold border ${badgeColor}`}
                          >
                            {s.letterGrade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards (360px viewport friendly) */}
            <div className="md:hidden divide-y divide-slate-800">
              {students.map((s) => {
                const badgeColor = getGradeBadgeColor(s.letterGrade);
                return (
                  <div key={s.studentMembershipId} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white text-sm">
                          {s.studentName}
                        </div>
                        <div className="text-xs text-slate-400">
                          {s.studentEmail}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          {s.weightedScore}%
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-bold border ${badgeColor}`}
                        >
                          {s.letterGrade}
                        </span>
                      </div>
                    </div>

                    {s.grades.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {s.grades.map((g) => (
                          <span
                            key={g.id}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${
                              g.lifecycle === "FINAL"
                                ? "bg-slate-800 text-slate-300 border-slate-700"
                                : "bg-brand-500/10 text-brand-300 border-brand-500/20"
                            }`}
                          >
                            {g.lifecycle === "FINAL" && (
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                            )}
                            <span>
                              {g.gradeType.slice(0, 3)}: {g.value}
                            </span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
