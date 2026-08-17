"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Plus, UserCheck, Calendar, BookOpen } from "lucide-react";

interface GroupsManagerProps {
  initialGroups: any[];
  courses: any[];
  teachers: any[];
  role?: string;
}

export default function GroupsManager({ initialGroups, courses, teachers, role }: GroupsManagerProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [name, setName] = useState("");
  const [teacherMembershipId, setTeacherMembershipId] = useState("");
  const [maxStudents, setMaxStudents] = useState("30");
  const [loading, setLoading] = useState(false);

  const canEdit = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseId, name, teacherMembershipId, maxStudents }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setName("");
        router.refresh();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Создать Группу / Поток</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.length === 0 ? (
          <div className="col-span-2 glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
            Группы пока не распределены.
          </div>
        ) : (
          groups.map((group) => (
            <div key={group.id} className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                    {group.course.title}
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">{group.name}</h3>
                </div>
                <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-semibold text-slate-300">
                  👥 {group.enrollments.length} / {group.maxStudents} учеников
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Преподаватель:{" "}
                  <strong className="text-white">
                    {group.teacher?.user.fullName || "Преподаватель не назначен"}
                  </strong>
                </span>
              </div>

              {/* Student list preview */}
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Зачисленные ученики
                </h4>
                {group.enrollments.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Ученики еще не вступили в группу.</p>
                ) : (
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {group.enrollments.map((en: any) => (
                      <li key={en.id} className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60">
                        <span className="font-semibold text-white">{en.student.user.fullName}</span>
                        <span className="text-slate-500 font-mono">{en.student.user.phone || en.student.user.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Создать Группу Учеников</h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Выберите Курс</label>
                <select
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Название Группы</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Поток JS-2026-A"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Назначить Преподавателя</label>
                <select
                  value={teacherMembershipId}
                  onChange={(e) => setTeacherMembershipId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="">-- Без преподавателя --</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.user.fullName}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Сохранение..." : "Создать Группу"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
