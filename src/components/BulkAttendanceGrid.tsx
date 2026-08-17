"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Clock, AlertCircle, UserCheck, Loader2 } from "lucide-react";

interface Student {
  id: string; // studentMembershipId
  user: {
    fullName: string;
    email: string;
  };
}

interface BulkAttendanceGridProps {
  lessonId: string;
  groupId: string;
  students: Student[];
  initialAttendances?: Record<string, string>;
  locale?: string;
  onSaveSuccess?: () => void;
}

export default function BulkAttendanceGrid({
  lessonId,
  groupId,
  students,
  initialAttendances = {},
  locale = "ru",
  onSaveSuccess,
}: BulkAttendanceGridProps) {
  const [attendanceMap, setAttendanceMap] = useState<Record<string, string>>(initialAttendances);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const isUz = locale === "uz-Latn";

  // 1-Click: Mark All Present
  const handleMarkAllPresent = () => {
    const updated: Record<string, string> = {};
    students.forEach((s) => {
      updated[s.id] = "PRESENT";
    });
    setAttendanceMap(updated);
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: status,
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess(false);
    try {
      const res = await fetch("/api/attendance/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          groupId,
          defaultStatus: "PRESENT",
          studentStatusMap: attendanceMap,
        }),
      });

      if (res.ok) {
        setSuccess(true);
        onSaveSuccess?.();
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const data = await res.json();
        alert(data.error || "Error saving attendance");
      }
    } catch (err) {
      alert("Network error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-6">
      {/* Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-brand-400" />
            <span>{isUz ? "Guruh davomatini belgilash" : "Отметка посещаемости группы"}</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {isUz
              ? "Bitta bosish bilan barchani 'Qatnashdi' deb belgilang va kelmaganlarni o'zgartiring"
              : "Отметьте всех одной кнопкой и скорректируйте только отсутствующих"}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleMarkAllPresent}
            className="px-3.5 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-xl border border-emerald-500/20 transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isUz ? "Barcha qatnashdi (1-Click)" : "Все присутствуют (1-Click)"}</span>
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isUz ? "Saqlash" : "Сохранить журнал"}</span>
          </button>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{isUz ? "Davomat muvaffaqiyatli saqlandi!" : "Посещаемость успешно сохранена!"}</span>
        </div>
      )}

      {/* Attendance Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-3">#</th>
              <th className="p-3">{isUz ? "Oʻquvchi FIShi" : "ФИО Ученика"}</th>
              <th className="p-3 text-center">{isUz ? "Holati" : "Статус Посещаемости"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {students.map((student, idx) => {
              const currentStatus = attendanceMap[student.id] || "PRESENT";
              return (
                <tr key={student.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-3 text-xs text-slate-500 font-mono">{idx + 1}</td>
                  <td className="p-3">
                    <div className="font-semibold text-white">{student.user.fullName}</div>
                    <div className="text-[11px] text-slate-500">{student.user.email}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "PRESENT")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          currentStatus === "PRESENT"
                            ? "bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {isUz ? "Qatnashdi" : "Присутствовал"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "ABSENT")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          currentStatus === "ABSENT"
                            ? "bg-red-500 text-white border-red-400 shadow-md shadow-red-500/20"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {isUz ? "Qatnashmadi" : "Отсутствовал"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "LATE")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          currentStatus === "LATE"
                            ? "bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {isUz ? "Kechikdi" : "Опоздал"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStatusChange(student.id, "EXCUSED")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          currentStatus === "EXCUSED"
                            ? "bg-blue-500 text-white border-blue-400 shadow-md shadow-blue-500/20"
                            : "bg-slate-900 text-slate-400 border-slate-700 hover:text-white"
                        }`}
                      >
                        {isUz ? "Sababli" : "По уважит."}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
