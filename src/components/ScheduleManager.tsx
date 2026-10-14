"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  MapPin,
  UserCheck,
  Building2,
  BookOpen,
  Plus,
  Download,
  Search,
  Filter,
  Edit2,
  Trash2,
  AlertTriangle,
  X,
  ExternalLink,
} from "lucide-react";
import { t } from "@/i18n";

export interface ScheduleSlotItem {
  id: string;
  groupId: string;
  teacherMembershipId: string;
  branchId?: string | null;
  subjectId?: string | null;
  roomName?: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  status: string;
  cancelledReason?: string | null;
  group: {
    id: string;
    name: string;
    course: { title: string };
    subject?: { name: string; color?: string | null } | null;
  };
  teacher: {
    id: string;
    user: { fullName: string; email?: string | null };
  };
  branch?: { id: string; name: string } | null;
}

export interface UpcomingLessonItem {
  id: string;
  title: string;
  lessonType: string;
  status: string;
  scheduledAt?: string | Date | null;
  durationMinutes: number;
  onlineMeetingUrl?: string | null;
  location?: string | null;
  cancelledReason?: string | null;
  module: {
    course: { title: string };
  };
  substituteTeacher?: {
    id: string;
    user: { fullName: string };
  } | null;
}

interface ScheduleManagerProps {
  initialSlots: ScheduleSlotItem[];
  upcomingLessons: UpcomingLessonItem[];
  groups: { id: string; name: string }[];
  teachers: { id: string; user: { fullName: string } }[];
  userRole: string;
  locale: string;
}

export default function ScheduleManager({
  initialSlots,
  upcomingLessons,
  groups,
  teachers,
  userRole,
  locale,
}: ScheduleManagerProps) {
  const router = useRouter();

  const [slots, setSlots] = useState<ScheduleSlotItem[]>(initialSlots);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("week");
  const [selectedDay, setSelectedDay] = useState<number>(1);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingSlot, setEditingSlot] = useState<ScheduleSlotItem | null>(null);
  const [formData, setFormData] = useState({
    groupId: "",
    teacherMembershipId: "",
    dayOfWeek: 1,
    startTime: "09:00",
    endTime: "10:30",
    roomName: "",
    status: "ACTIVE",
    cancelledReason: "",
  });
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [conflictList, setConflictList] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const canManage = userRole === "DIRECTOR" || userRole === "CENTER_ADMIN";

  const dayNamesShort: Record<number, string> = {
    1: t(locale, "schedule.monShort"),
    2: t(locale, "schedule.tueShort"),
    3: t(locale, "schedule.wedShort"),
    4: t(locale, "schedule.thuShort"),
    5: t(locale, "schedule.friShort"),
    6: t(locale, "schedule.satShort"),
    7: t(locale, "schedule.sunShort"),
  };

  const dayNamesFull: Record<number, string> = {
    1: t(locale, "schedule.monday"),
    2: t(locale, "schedule.tuesday"),
    3: t(locale, "schedule.wednesday"),
    4: t(locale, "schedule.thursday"),
    5: t(locale, "schedule.friday"),
    6: t(locale, "schedule.saturday"),
    7: t(locale, "schedule.sunday"),
  };

  // Filter slots
  const filteredSlots = slots.filter((slot) => {
    if (selectedGroupId && slot.groupId !== selectedGroupId) return false;
    if (selectedTeacherId && slot.teacherMembershipId !== selectedTeacherId) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchGroup = slot.group.name.toLowerCase().includes(q);
      const matchCourse = slot.group.course.title.toLowerCase().includes(q);
      const matchRoom = slot.roomName?.toLowerCase().includes(q) || false;
      const matchTeacher = slot.teacher.user.fullName.toLowerCase().includes(q);
      if (!matchGroup && !matchCourse && !matchRoom && !matchTeacher) return false;
    }
    return true;
  });

  // Group by day of week
  const slotsByDay: Record<number, ScheduleSlotItem[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
  };
  filteredSlots.forEach((slot) => {
    if (slotsByDay[slot.dayOfWeek]) {
      slotsByDay[slot.dayOfWeek].push(slot);
    }
  });

  const openCreateModal = () => {
    setEditingSlot(null);
    setFormData({
      groupId: groups[0]?.id || "",
      teacherMembershipId: teachers[0]?.id || "",
      dayOfWeek: selectedDay,
      startTime: "09:00",
      endTime: "10:30",
      roomName: "",
      status: "ACTIVE",
      cancelledReason: "",
    });
    setErrorMsg("");
    setConflictList([]);
    setIsModalOpen(true);
  };

  const openEditModal = (slot: ScheduleSlotItem) => {
    setEditingSlot(slot);
    setFormData({
      groupId: slot.groupId,
      teacherMembershipId: slot.teacherMembershipId,
      dayOfWeek: slot.dayOfWeek,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: slot.roomName || "",
      status: slot.status,
      cancelledReason: slot.cancelledReason || "",
    });
    setErrorMsg("");
    setConflictList([]);
    setIsModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setConflictList([]);
    setSubmitting(true);

    try {
      if (editingSlot) {
        // Update slot
        const res = await fetch("/api/tenant/schedule", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingSlot.id,
            groupId: formData.groupId,
            teacherMembershipId: formData.teacherMembershipId,
            dayOfWeek: formData.dayOfWeek,
            startTime: formData.startTime,
            endTime: formData.endTime,
            roomName: formData.roomName || null,
            status: formData.status,
            cancelledReason: formData.cancelledReason || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to update slot");
          if (data.conflicts) setConflictList(data.conflicts);
          setSubmitting(false);
          return;
        }

        // Update local state
        setSlots((prev) =>
          prev.map((s) => (s.id === editingSlot.id ? { ...s, ...data.slot } : s))
        );
      } else {
        // Create slot
        const res = await fetch("/api/tenant/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: formData.groupId,
            teacherMembershipId: formData.teacherMembershipId,
            dayOfWeek: formData.dayOfWeek,
            startTime: formData.startTime,
            endTime: formData.endTime,
            roomName: formData.roomName || null,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.error || "Failed to create slot");
          if (data.conflicts) setConflictList(data.conflicts);
          setSubmitting(false);
          return;
        }

        // Reload data from server
        router.refresh();
      }

      setIsModalOpen(false);
    } catch (err: unknown) {
      const error = err as { message?: string };
      setErrorMsg(error.message || "Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (id: string) => {
    if (!window.confirm(t(locale, "schedule.confirmDelete"))) return;

    try {
      const res = await fetch("/api/tenant/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSlots((prev) => prev.filter((s) => s.id !== id));
      } else {
        const data = await res.json();
        alert(data.error || "Failed to delete slot");
      }
    } catch (err: unknown) {
      const error = err as { message?: string };
      alert(error.message || "Failed to delete slot");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-brand-400" />
            {t(locale, "schedule.title")}
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {t(locale, "schedule.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* iCal Export */}
          <a
            href={`/api/schedule/ical${selectedGroupId ? `?groupId=${selectedGroupId}` : ""}`}
            download="schedule.ics"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700"
          >
            <Download className="w-4 h-4 text-brand-400" />
            {t(locale, "schedule.exportIcal")}
          </a>

          {/* Add Slot (Admin/Director) */}
          {canManage && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-brand-500 text-white hover:bg-brand-600 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              {t(locale, "schedule.addSlot")}
            </button>
          )}
        </div>
      </div>

      {/* View Switcher & Filters */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-800 shrink-0">
          <button
            onClick={() => setViewMode("day")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "day"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.dayView")}
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "week"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.weekView")}
          </button>
          <button
            onClick={() => setViewMode("month")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              viewMode === "month"
                ? "bg-brand-500 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            {t(locale, "schedule.monthView")}
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t(locale, "schedule.searchPlaceholder")}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Group Filter */}
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">{t(locale, "schedule.allGroups")}</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>

          {/* Teacher Filter */}
          <select
            value={selectedTeacherId}
            onChange={(e) => setSelectedTeacherId(e.target.value)}
            className="px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="">{t(locale, "schedule.allTeachers")}</option>
            {teachers.map((teach) => (
              <option key={teach.id} value={teach.id}>
                {teach.user.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Calendar View Area */}
      {filteredSlots.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-300 mb-1">
            {t(locale, "schedule.emptyTitle")}
          </h3>
          <p className="text-sm text-slate-500">
            {t(locale, "schedule.emptySubtitle")}
          </p>
        </div>
      ) : (
        <>
          {/* DAY VIEW */}
          {viewMode === "day" && (
            <div className="space-y-4">
              {/* Day selection tabs */}
              <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-colors shrink-0 ${
                      selectedDay === day
                        ? "bg-brand-500 text-white shadow-md shadow-brand-500/20"
                        : "bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {dayNamesFull[day]} ({slotsByDay[day].length})
                  </button>
                ))}
              </div>

              {/* Slots for selected day */}
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden divide-y divide-slate-800/60">
                {slotsByDay[selectedDay].length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    {t(locale, "schedule.noClasses")}
                  </div>
                ) : (
                  slotsByDay[selectedDay].map((slot) => (
                    <div
                      key={slot.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-900/40 transition-colors gap-3"
                    >
                      <div className="flex items-start gap-4">
                        <div className="text-center w-16 shrink-0">
                          <div className="text-sm font-bold text-brand-400">
                            {slot.startTime}
                          </div>
                          <div className="text-xs text-slate-500">{slot.endTime}</div>
                        </div>

                        <div
                          className="w-1.5 h-12 rounded-full shrink-0"
                          style={{
                            backgroundColor: slot.group.subject?.color || "#4f6ef7",
                          }}
                        />

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">
                              {slot.group.name}
                            </span>
                            {slot.status === "CANCELLED" && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                {t(locale, "schedule.cancelled")}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                              {slot.group.course.title}
                            </span>
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                              {slot.teacher.user.fullName}
                            </span>
                            {slot.roomName && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                {slot.roomName}
                              </span>
                            )}
                          </div>
                          {slot.cancelledReason && (
                            <p className="text-xs text-rose-400 mt-1 italic">
                              {t(locale, "schedule.cancelledReason")}: {slot.cancelledReason}
                            </p>
                          )}
                        </div>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          <button
                            onClick={() => openEditModal(slot)}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSlot(slot.id)}
                            className="p-1.5 text-rose-400 hover:text-rose-300 rounded-lg hover:bg-rose-500/10 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* WEEK VIEW */}
          {viewMode === "week" && (
            <div className="glass-panel p-5 rounded-2xl border border-slate-800">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div
                    key={day}
                    className="min-h-[140px] bg-slate-900/30 p-2.5 rounded-xl border border-slate-800/80"
                  >
                    <div
                      className={`text-center text-xs font-bold uppercase tracking-wider mb-2.5 pb-1.5 border-b ${
                        day === 6 || day === 7
                          ? "text-amber-400 border-amber-500/30"
                          : "text-slate-400 border-slate-800"
                      }`}
                    >
                      {dayNamesShort[day]}
                    </div>

                    <div className="space-y-2">
                      {slotsByDay[day].length === 0 ? (
                        <div className="text-center text-[10px] text-slate-700 pt-6">
                          —
                        </div>
                      ) : (
                        slotsByDay[day].map((slot) => (
                          <div
                            key={slot.id}
                            className={`p-2.5 rounded-xl border text-xs relative group transition-all ${
                              slot.status === "CANCELLED"
                                ? "bg-rose-500/5 border-rose-500/20 opacity-75"
                                : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-[11px] truncate">
                                {slot.group.name}
                              </span>
                              {canManage && (
                                <button
                                  onClick={() => openEditModal(slot)}
                                  className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-400 hover:text-white transition-opacity"
                                >
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>

                            <div className="text-brand-400 font-semibold text-[10px] mt-1 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {slot.startTime}–{slot.endTime}
                            </div>

                            <div className="text-slate-400 text-[10px] truncate mt-0.5">
                              {slot.teacher.user.fullName}
                            </div>

                            {slot.roomName && (
                              <div className="text-slate-500 text-[9px] truncate mt-0.5">
                                {slot.roomName}
                              </div>
                            )}

                            {slot.status === "CANCELLED" && (
                              <div className="text-rose-400 text-[9px] font-semibold mt-1">
                                {t(locale, "schedule.cancelled")}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* MONTH VIEW */}
          {viewMode === "month" && (
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
              <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-bold text-slate-400 pb-2 border-b border-slate-800">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <div key={d}>{dayNamesShort[d]}</div>
                ))}
              </div>

              {/* 4-week calendar simulation based on active recurring slots */}
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 28 }).map((_, idx) => {
                  const dayOfWeek = (idx % 7) + 1;
                  const daySlots = slotsByDay[dayOfWeek];
                  const dayNumber = idx + 1;

                  return (
                    <div
                      key={idx}
                      className="min-h-[85px] p-1.5 bg-slate-900/40 rounded-xl border border-slate-800/60 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                        <span>{dayNumber}</span>
                        {daySlots.length > 0 && (
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                        )}
                      </div>

                      <div className="space-y-1">
                        {daySlots.slice(0, 2).map((slot) => (
                          <div
                            key={slot.id}
                            className="px-1.5 py-0.5 rounded text-[9px] font-semibold truncate bg-brand-500/10 text-brand-300 border border-brand-500/20"
                          >
                            {slot.startTime} {slot.group.name}
                          </div>
                        ))}
                        {daySlots.length > 2 && (
                          <div className="text-[8px] text-slate-500 text-center font-medium">
                            +{daySlots.length - 2}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* UPCOMING ONE-TIME LESSONS (if any) */}
      {upcomingLessons.length > 0 && (
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            {t(locale, "schedule.upcomingLessons")}
          </h3>

          <div className="divide-y divide-slate-800/60">
            {upcomingLessons.map((lesson) => (
              <div
                key={lesson.id}
                className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-900/30 px-2 rounded-xl transition-colors"
              >
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">
                      {lesson.title}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        lesson.lessonType === "ONLINE"
                          ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                          : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      }`}
                    >
                      {lesson.lessonType === "ONLINE"
                        ? t(locale, "schedule.online")
                        : t(locale, "schedule.offline")}
                    </span>
                    {lesson.substituteTeacher && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {t(locale, "schedule.substituteTeacher")}:{" "}
                        {lesson.substituteTeacher.user.fullName}
                      </span>
                    )}
                    {lesson.status === "CANCELLED" && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                        {t(locale, "schedule.cancelled")}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                    <span>{lesson.module.course.title}</span>
                    {lesson.scheduledAt && (
                      <span>
                        {new Date(lesson.scheduledAt).toLocaleString(
                          locale === "ru" ? "ru-RU" : "uz-UZ",
                          {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </span>
                    )}
                  </div>
                </div>

                {lesson.onlineMeetingUrl && (
                  <a
                    href={lesson.onlineMeetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-purple-400 hover:text-purple-300 self-start sm:self-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {t(locale, "schedule.meetingLink")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CREATE / EDIT SLOT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">
                {editingSlot
                  ? t(locale, "schedule.editSlot")
                  : t(locale, "schedule.addSlot")}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold">{errorMsg}</div>
                  {conflictList.length > 0 && (
                    <ul className="list-disc list-inside mt-1 space-y-0.5">
                      {conflictList.map((c, idx) => (
                        <li key={idx}>{c}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleSaveSlot} className="space-y-4 text-xs">
              {/* Group */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t(locale, "schedule.group")}
                </label>
                <select
                  value={formData.groupId}
                  onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Teacher */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t(locale, "schedule.teacher")}
                </label>
                <select
                  value={formData.teacherMembershipId}
                  onChange={(e) =>
                    setFormData({ ...formData, teacherMembershipId: e.target.value })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  {teachers.map((teach) => (
                    <option key={teach.id} value={teach.id}>
                      {teach.user.fullName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Day of Week */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t(locale, "schedule.dayOfWeek")}
                </label>
                <select
                  value={formData.dayOfWeek}
                  onChange={(e) =>
                    setFormData({ ...formData, dayOfWeek: parseInt(e.target.value) })
                  }
                  required
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                >
                  {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                    <option key={d} value={d}>
                      {dayNamesFull[d]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {t(locale, "schedule.startTime")}
                  </label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    {t(locale, "schedule.endTime")}
                  </label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Room */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {t(locale, "schedule.room")}
                </label>
                <input
                  type="text"
                  value={formData.roomName}
                  onChange={(e) => setFormData({ ...formData, roomName: e.target.value })}
                  placeholder={t(locale, "schedule.roomPlaceholder")}
                  className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Status and Cancellation Reason (when editing) */}
              {editingSlot && (
                <>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">
                      {t(locale, "schedule.status")}
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                    >
                      <option value="ACTIVE">{t(locale, "schedule.active")}</option>
                      <option value="CANCELLED">{t(locale, "schedule.cancelled")}</option>
                    </select>
                  </div>

                  {formData.status === "CANCELLED" && (
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1">
                        {t(locale, "schedule.cancelledReason")}
                      </label>
                      <input
                        type="text"
                        value={formData.cancelledReason}
                        onChange={(e) =>
                          setFormData({ ...formData, cancelledReason: e.target.value })
                        }
                        className="w-full px-3 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 font-semibold transition-colors"
                >
                  {t(locale, "schedule.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? t(locale, "schedule.loading") : t(locale, "schedule.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
