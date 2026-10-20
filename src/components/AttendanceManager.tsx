"use client";

import { useState, useEffect, useRef } from "react";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  AlertTriangle,
  Loader2,
  Users,
} from "lucide-react";
import { t } from "@/i18n";

interface GroupOption {
  id: string;
  name: string;
}

interface LessonOption {
  id: string;
  title: string;
  scheduledAt: string | null;
}

interface StudentItem {
  id: string;
  fullName: string;
  email: string;
}

interface RiskStudent {
  studentMembershipId: string;
  studentName: string;
  totalLessons: number;
  presentLessons: number;
  attendanceRate: number;
  isAtRisk: boolean;
}

interface AttendanceManagerProps {
  groups: GroupOption[];
  lessonsByGroup: Record<string, LessonOption[]>;
  studentsByGroup: Record<string, StudentItem[]>;
  locale?: string;
  userRole: string;
}

const STATUS_CONFIG: Record<
  string,
  { labelKey: string; color: string; activeColor: string }
> = {
  PRESENT: {
    labelKey: "attendance.present",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    activeColor: "bg-emerald-500 text-white border-emerald-400",
  },
  ABSENT: {
    labelKey: "attendance.absent",
    color: "text-red-400 bg-red-500/10 border-red-500/20",
    activeColor: "bg-red-500 text-white border-red-400",
  },
  EXCUSED: {
    labelKey: "attendance.excused",
    color: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    activeColor: "bg-blue-500 text-white border-blue-400",
  },
  LATE: {
    labelKey: "attendance.late",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    activeColor: "bg-amber-500 text-white border-amber-400",
  },
};

export default function AttendanceManager({
  groups,
  lessonsByGroup,
  studentsByGroup,
  locale = "ru",
  userRole,
}: AttendanceManagerProps) {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(
    groups[0]?.id || ""
  );
  const currentLessons = lessonsByGroup[selectedGroupId] || [];
  const [selectedLessonId, setSelectedLessonId] = useState<string>(
    currentLessons[0]?.id || ""
  );

  const [studentStatusMap, setStudentStatusMap] = useState<
    Record<string, string>
  >({});
  const [studentNoteMap, setStudentNoteMap] = useState<Record<string, string>>(
    {}
  );
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Risk list
  const [showRiskList, setShowRiskList] = useState(false);
  const [riskList, setRiskList] = useState<RiskStudent[]>([]);
  const [loadingRisk, setLoadingRisk] = useState(false);

  // Cleared on unmount so the success banner timer cannot fire on a dead component.
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // When group changes, update lesson
  useEffect(() => {
    const lessons = lessonsByGroup[selectedGroupId] || [];
    setSelectedLessonId(lessons[0]?.id || "");
  }, [selectedGroupId, lessonsByGroup]);

  // Load existing attendance for selected lesson
  useEffect(() => {
    if (!selectedLessonId) {
      setStudentStatusMap({});
      setStudentNoteMap({});
      return;
    }

    setStudentStatusMap({});
    setStudentNoteMap({});

    let isSubscribed = true;
    async function loadLessonAttendance() {
      try {
        const res = await fetch(`/api/attendance?lessonId=${selectedLessonId}`);
        if (!res.ok) return;
        const data = (await res.json()) as {
          attendance?: Array<{
            studentMembershipId: string;
            status: string;
            note: string | null;
          }>;
        };
        if (isSubscribed && data.attendance) {
          const statuses: Record<string, string> = {};
          const notes: Record<string, string> = {};
          for (const item of data.attendance) {
            statuses[item.studentMembershipId] = item.status;
            if (item.note) {
              notes[item.studentMembershipId] = item.note;
            }
          }
          setStudentStatusMap(statuses);
          setStudentNoteMap(notes);
        }
      } catch {
        // Ignored
      }
    }

    loadLessonAttendance();
    return () => {
      isSubscribed = false;
    };
  }, [selectedLessonId]);

  // Fetch risk list
  useEffect(() => {
    async function fetchRiskList() {
      setLoadingRisk(true);
      try {
        const res = await fetch("/api/attendance/analytics");
        if (res.ok) {
          const data = (await res.json()) as { riskList?: RiskStudent[] };
          setRiskList(data.riskList || []);
        }
      } catch {
        // Ignored
      } finally {
        setLoadingRisk(false);
      }
    }
    fetchRiskList();
  }, []);

  const currentStudents = studentsByGroup[selectedGroupId] || [];

  const handleStatusChange = (studentId: string, status: string) => {
    setStudentStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleNoteChange = (studentId: string, note: string) => {
    setStudentNoteMap((prev) => ({ ...prev, [studentId]: note }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, string> = {};
    for (const s of currentStudents) {
      updated[s.id] = "PRESENT";
    }
    setStudentStatusMap(updated);
  };

  const handleSave = async () => {
    if (!selectedLessonId) return;
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const records = currentStudents.map((s) => ({
        studentMembershipId: s.id,
        groupId: selectedGroupId,
        status: studentStatusMap[s.id] || "PRESENT",
        note: studentNoteMap[s.id] || null,
      }));

      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: selectedLessonId,
          records,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const errData = (await res.json()) as { error?: string };
        setSaveError(errData.error || "Failed to save attendance");
      }
    } catch {
      setSaveError("Network error while saving");
    } finally {
      setSaving(false);
    }
  };

  const canExport =
    userRole === "DIRECTOR" ||
    userRole === "CENTER_ADMIN" ||
    userRole === "TEACHER";

  return (
    <div className="space-y-6">
      {/* Controls Header */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full md:w-auto">
          {/* Group Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t(locale, "attendance.selectGroup")}
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

          {/* Lesson Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              {t(locale, "attendance.selectLesson")}
            </label>
            <select
              value={selectedLessonId}
              onChange={(e) => setSelectedLessonId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              disabled={currentLessons.length === 0}
            >
              {currentLessons.length === 0 ? (
                <option value="">{t(locale, "common.noData")}</option>
              ) : (
                currentLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Risk List Badge */}
          <button
            type="button"
            onClick={() => setShowRiskList(!showRiskList)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
              riskList.length > 0
                ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                : "bg-slate-800/80 border-slate-700 text-slate-400"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <span>{t(locale, "attendance.riskList")}</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 text-xs font-bold">
              {riskList.length}
            </span>
          </button>

          {/* Export CSV Button */}
          {canExport && (
            <a
              href={`/api/attendance/export?groupId=${selectedGroupId}`}
              download
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              <Download className="w-4 h-4 text-slate-400" />
              <span>{t(locale, "attendance.exportCsv")}</span>
            </a>
          )}
        </div>
      </div>

      {/* Risk List Panel */}
      {showRiskList && (
        <div className="glass-panel p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>{t(locale, "attendance.riskList")}</span>
            </h4>
            <span className="text-xs text-slate-400">
              {loadingRisk ? "..." : `${riskList.length} ${t(locale, "nav.students")}`}
            </span>
          </div>
          {riskList.length === 0 ? (
            <p className="text-xs text-slate-400">
              {t(locale, "attendance.riskListEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {riskList.map((r) => (
                <div
                  key={r.studentMembershipId}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between text-xs"
                >
                  <span className="font-medium text-white truncate mr-2">
                    {r.studentName}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-bold shrink-0">
                    {r.attendanceRate}% ({r.presentLessons}/{r.totalLessons})
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bulk Attendance Form */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        {/* Top Action Bar */}
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-400" />
            <span className="text-sm font-semibold text-white">
              {t(locale, "nav.students")}: {currentStudents.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleMarkAllPresent}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            >
              {t(locale, "attendance.markAllPresent")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || currentStudents.length === 0}
              className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-brand-500 hover:bg-brand-600 text-white transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>...</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{t(locale, "attendance.saveAttendance")}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {saveSuccess && (
          <div className="m-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t(locale, "attendance.savedSuccess")}</span>
          </div>
        )}

        {saveError && (
          <div className="m-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Responsive Content: Table for desktop, Cards for 360px mobile */}
        {currentStudents.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            {t(locale, "common.noData")}
          </div>
        ) : (
          <>
            {/* Desktop Table (hidden on small screens) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="p-4">{t(locale, "nav.students")}</th>
                    <th className="p-4">{t(locale, "common.status")}</th>
                    <th className="p-4">{t(locale, "attendance.note")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {currentStudents.map((s) => {
                    const currentStatus = studentStatusMap[s.id] || "PRESENT";
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-900/40 transition-colors"
                      >
                        <td className="p-4">
                          <div className="font-semibold text-white">
                            {s.fullName}
                          </div>
                          <div className="text-xs text-slate-400">{s.email}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
                              const active = currentStatus === stKey;
                              return (
                                <button
                                  key={stKey}
                                  type="button"
                                  onClick={() => handleStatusChange(s.id, stKey)}
                                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                                    active ? cfg.activeColor : cfg.color
                                  }`}
                                >
                                  {t(locale, cfg.labelKey)}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="p-4">
                          <input
                            type="text"
                            value={studentNoteMap[s.id] || ""}
                            onChange={(e) => handleNoteChange(s.id, e.target.value)}
                            placeholder="..."
                            className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-brand-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards for 360px (visible only on mobile) */}
            <div className="md:hidden divide-y divide-slate-800">
              {currentStudents.map((s) => {
                const currentStatus = studentStatusMap[s.id] || "PRESENT";
                return (
                  <div key={s.id} className="p-4 space-y-3">
                    <div>
                      <div className="font-semibold text-white text-sm">
                        {s.fullName}
                      </div>
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(STATUS_CONFIG).map(([stKey, cfg]) => {
                        const active = currentStatus === stKey;
                        return (
                          <button
                            key={stKey}
                            type="button"
                            onClick={() => handleStatusChange(s.id, stKey)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-semibold border text-center transition-all ${
                              active ? cfg.activeColor : cfg.color
                            }`}
                          >
                            {t(locale, cfg.labelKey)}
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <input
                        type="text"
                        value={studentNoteMap[s.id] || ""}
                        onChange={(e) => handleNoteChange(s.id, e.target.value)}
                        placeholder={t(locale, "attendance.note")}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
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
