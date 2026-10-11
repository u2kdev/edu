"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Users,
  Plus,
  UserCheck,
  Edit2,
  UserMinus,
  ArrowRightLeft,
  X,
  AlertCircle,
} from "lucide-react";
import { t } from "@/i18n";

interface GroupStudent {
  id: string; // CenterMembership.id
  user: {
    fullName: string;
    phone?: string | null;
    email: string;
  };
}

interface GroupEnrollment {
  id: string;
  student: GroupStudent;
}

interface GroupTeacher {
  id: string;
  user: {
    fullName: string;
    email?: string;
  };
}

interface GroupItem {
  id: string;
  name: string;
  maxStudents: number;
  course: {
    id?: string;
    title: string;
  };
  teacher?: GroupTeacher | null;
  enrollments: GroupEnrollment[];
}

interface CourseOption {
  id: string;
  title: string;
}

interface TeacherOption {
  id: string;
  user: {
    fullName: string;
  };
}

interface GroupsManagerProps {
  initialGroups: GroupItem[];
  courses: CourseOption[];
  teachers: TeacherOption[];
  role?: string;
  locale?: string;
}

export default function GroupsManager({
  initialGroups,
  courses,
  teachers,
  role,
  locale = "ru",
}: GroupsManagerProps) {
  const router = useRouter();
  const [groups, setGroups] = useState(initialGroups);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [name, setName] = useState("");
  const [teacherMembershipId, setTeacherMembershipId] = useState("");
  const [maxStudents, setMaxStudents] = useState("30");
  const [loading, setLoading] = useState(false);

  // Edit Modal
  const [editingGroup, setEditingGroup] = useState<GroupItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [editMaxStudents, setEditMaxStudents] = useState("30");

  // Transfer Modal
  const [transferData, setTransferData] = useState<{
    sourceGroupId: string;
    studentMembershipId: string;
    studentName: string;
  } | null>(null);
  const [targetGroupId, setTargetGroupId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Drop Modal
  const [dropData, setDropData] = useState<{
    groupId: string;
    studentMembershipId: string;
    studentName: string;
  } | null>(null);
  const [dropReason, setDropReason] = useState("");

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
        alert(data.error || "Ошибка создания группы");
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingGroup) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${editingGroup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          teacherMembershipId: editTeacherId || null,
          maxStudents: editMaxStudents,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGroups((prev) =>
          prev.map((g) =>
            g.id === editingGroup.id
              ? {
                  ...g,
                  name: editName,
                  maxStudents: parseInt(editMaxStudents) || 30,
                  teacher: teachers.find((t) => t.id === editTeacherId) || null,
                }
              : g
          )
        );
        setEditingGroup(null);
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.saveError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferData || !targetGroupId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${transferData.sourceGroupId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: transferData.studentMembershipId,
          targetGroupId,
          reason: transferReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(t(locale, "groups.transferSuccess"));
        setTransferData(null);
        setTargetGroupId("");
        setTransferReason("");
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.transferError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
    } finally {
      setLoading(false);
    }
  };

  const handleDrop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dropData) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/groups/${dropData.groupId}/enrollments`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: dropData.studentMembershipId,
          reason: dropReason,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(t(locale, "groups.dropSuccess"));
        setDropData(null);
        setDropReason("");
        router.refresh();
      } else {
        alert(data.error || t(locale, "groups.dropError"));
      }
    } catch {
      alert(t(locale, "groups.networkError"));
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
            <span>{t(locale, "groups.createGroup")}</span>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groups.length === 0 ? (
          <div className="col-span-2 glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
            {t(locale, "common.noData")}
          </div>
        ) : (
          groups.map((group) => {
            const isFull = group.enrollments.length >= group.maxStudents;
            return (
              <div
                key={group.id}
                className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-brand-400 uppercase tracking-wider">
                      {group.course.title}
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">{group.name}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        isFull
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : "bg-slate-900 border border-slate-800 text-slate-300"
                      }`}
                    >
                      👥 {group.enrollments.length} / {group.maxStudents}
                    </span>
                    {canEdit && (
                      <button
                        onClick={() => {
                          setEditingGroup(group);
                          setEditName(group.name);
                          setEditTeacherId(group.teacher?.id || "");
                          setEditMaxStudents(group.maxStudents.toString());
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>
                    {group.teacher ? (
                      t(locale, "groups.teacherAssigned", {
                        name: group.teacher.user.fullName,
                      })
                    ) : (
                      <strong className="text-white">
                        {t(locale, "groups.teacherNotAssigned")}
                      </strong>
                    )}
                  </span>
                </div>

                {/* Student list preview */}
                <div>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t(locale, "groups.rosterTitle", {
                      count: String(group.enrollments.length),
                    })}
                  </h4>
                  {group.enrollments.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">
                      {t(locale, "groups.emptyRoster")}
                    </p>
                  ) : (
                    <ul className="space-y-1.5 text-xs text-slate-300 max-h-56 overflow-y-auto pr-1">
                      {group.enrollments.map((en) => (
                        <li
                          key={en.id}
                          className="flex items-center justify-between p-2 rounded bg-slate-950/60 border border-slate-800/60"
                        >
                          <div>
                            <span className="font-semibold text-white block">
                              {en.student.user.fullName}
                            </span>
                            <span className="text-slate-500 font-mono text-[11px]">
                              {en.student.user.phone || en.student.user.email}
                            </span>
                          </div>

                          {canEdit && (
                            <div className="flex items-center gap-1.5">
                              <button
                                title={t(locale, "groups.transferStudent")}
                                onClick={() => {
                                  setTransferData({
                                    sourceGroupId: group.id,
                                    studentMembershipId: en.student.id,
                                    studentName: en.student.user.fullName,
                                  });
                                  const other = groups.find((g) => g.id !== group.id);
                                  setTargetGroupId(other?.id || "");
                                }}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-brand-300 rounded"
                              >
                                <ArrowRightLeft className="w-3.5 h-3.5" />
                              </button>
                              <button
                                title={t(locale, "groups.removeStudent")}
                                onClick={() => {
                                  setDropData({
                                    groupId: group.id,
                                    studentMembershipId: en.student.id,
                                    studentName: en.student.user.fullName,
                                  });
                                }}
                                className="p-1 hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 rounded"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">
              {t(locale, "groups.createGroup")}
            </h3>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.selectCourse")}
                </label>
                <select
                  required
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.groupName")}
                </label>
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
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.assignTeacher")}
                </label>
                <select
                  value={teacherMembershipId}
                  onChange={(e) => setTeacherMembershipId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="">{t(locale, "groups.noTeacher")}</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.maxStudents")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? t(locale, "common.loading") : t(locale, "groups.createGroup")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingGroup && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">
              {t(locale, "groups.editGroup")}
            </h3>
            <form onSubmit={handleEditGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.groupName")}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.assignTeacher")}
                </label>
                <select
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="">{t(locale, "groups.noTeacher")}</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.user.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.maxStudents")}
                </label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  required
                  value={editMaxStudents}
                  onChange={(e) => setEditMaxStudents(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingGroup(null)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? t(locale, "common.loading") : t(locale, "common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Modal */}
      {transferData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-brand-400" />
              <span>{t(locale, "groups.transferStudent")}</span>
            </h3>

            <p className="text-xs text-slate-300">
              {t(locale, "groups.studentLabel", { name: transferData.studentName })}
            </p>

            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.transferTarget")}
                </label>
                <select
                  required
                  value={targetGroupId}
                  onChange={(e) => setTargetGroupId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                >
                  {groups
                    .filter((g) => g.id !== transferData.sourceGroupId)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} ({g.enrollments.length} / {g.maxStudents})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.transferReasonLabel")}
                </label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g. Переход на вечернее расписание"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferData(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-brand-600/30"
                >
                  {loading ? t(locale, "common.loading") : t(locale, "groups.transferStudent")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Drop Modal */}
      {dropData && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <UserMinus className="w-5 h-5 text-rose-400" />
              <span>{t(locale, "groups.removeStudent")}</span>
            </h3>

            <p className="text-xs text-slate-300">
              {t(locale, "groups.dropConfirm", { name: dropData.studentName })}
            </p>

            <form onSubmit={handleDrop} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  {t(locale, "groups.dropReasonPrompt")}
                </label>
                <input
                  type="text"
                  required
                  value={dropReason}
                  onChange={(e) => setDropReason(e.target.value)}
                  placeholder="e.g. Переезд в другой город / Личные обстоятельства"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setDropData(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs"
                >
                  {t(locale, "common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-rose-600/30"
                >
                  {loading ? t(locale, "common.loading") : t(locale, "groups.removeStudent")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
