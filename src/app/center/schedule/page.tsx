import { getAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, MapPin, Video, UserCheck, Building2, BookOpen } from "lucide-react";
import { t } from "@/i18n";

const DAY_NAMES_RU = ["", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const DAY_NAMES_FULL = ["", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

export default async function CenterSchedulePage() {
  const session = await getAuthSession();
  if (!session) redirect("/login");

  const centerId = session.activeCenterId;
  if (!centerId) redirect("/center");

  const locale = session.user.preferredLanguage;
  const activeRole = session.activeCenterRole || "";
  const currentMembership = session.memberships.find((m) => m.centerId === centerId);

  // Build role-scoped schedule query
  let whereCondition: any = { centerId, status: "ACTIVE" };

  if (activeRole === "TEACHER" && currentMembership) {
    whereCondition.teacherMembershipId = currentMembership.id;
  } else if (activeRole === "TEACHER_ASSISTANT" && currentMembership) {
    const assistedGroups = await db.group.findMany({
      where: { assistantMembershipId: currentMembership.id, course: { centerId } },
      select: { id: true },
    });
    whereCondition.groupId = { in: assistedGroups.map((g) => g.id) };
  } else if (activeRole === "STUDENT" && currentMembership) {
    const enrollments = await db.enrollment.findMany({
      where: { studentMembershipId: currentMembership.id },
      select: { groupId: true },
    });
    whereCondition.groupId = { in: enrollments.map((e) => e.groupId) };
  } else if (activeRole === "PARENT" && currentMembership) {
    const childLinks = await db.parentLink.findMany({
      where: { parentMembershipId: currentMembership.id, status: "CONFIRMED" },
      select: { studentMembershipId: true },
    });
    const childEnrollments = await db.enrollment.findMany({
      where: { studentMembershipId: { in: childLinks.map((l) => l.studentMembershipId) } },
      select: { groupId: true },
    });
    whereCondition.groupId = { in: childEnrollments.map((e) => e.groupId) };
  }

  const slots = await db.scheduleSlot.findMany({
    where: whereCondition,
    include: {
      group: {
        include: {
          course: { select: { title: true } },
          subject: { select: { name: true, color: true } },
        },
      },
      teacher: { include: { user: { select: { fullName: true } } } },
      branch: { select: { id: true, name: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
  });

  // Also fetch one-time scheduled lessons for the next 7 days
  const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcomingLessons = await db.lesson.findMany({
    where: {
      module: { course: { centerId } },
      status: "ACTIVE",
      scheduledAt: { gte: new Date(), lte: nextWeek },
    },
    include: {
      module: { include: { course: { select: { title: true } } } },
      substituteTeacher: { include: { user: { select: { fullName: true } } } },
    },
    orderBy: { scheduledAt: "asc" },
    take: 20,
  });

  // Group slots by day of week
  const slotsByDay: Record<number, typeof slots> = {};
  for (let i = 1; i <= 7; i++) slotsByDay[i] = [];
  slots.forEach((slot) => {
    if (!slotsByDay[slot.dayOfWeek]) slotsByDay[slot.dayOfWeek] = [];
    slotsByDay[slot.dayOfWeek].push(slot);
  });

  const hasSchedule = slots.length > 0 || upcomingLessons.length > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">{t(locale, "nav.schedule")}</h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeRole === "STUDENT"
              ? "Расписание ваших занятий"
              : activeRole === "PARENT"
              ? "Расписание ваших детей"
              : activeRole === "TEACHER"
              ? "Ваше расписание занятий"
              : "Расписание учебного центра"}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <CalendarDays className="w-4 h-4 text-brand-400" />
          <span>{slots.length} регулярных занятий</span>
        </div>
      </div>

      {!hasSchedule ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">{t(locale, "common.noData")}</h3>
          <p className="text-sm text-slate-500">Расписание ещё не составлено</p>
        </div>
      ) : (
        <>
          {/* Weekly Timetable */}
          {slots.length > 0 && (
            <div className="glass-panel p-6 rounded-2xl border border-slate-800">
              <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-brand-400" />
                Еженедельное расписание
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => (
                  <div key={day} className="min-h-[120px]">
                    <div className={`text-center text-xs font-bold uppercase tracking-wider mb-2 pb-1.5 border-b ${
                      day === 6 || day === 7 ? "text-amber-400 border-amber-500/30" : "text-slate-400 border-slate-800"
                    }`}>
                      {DAY_NAMES_RU[day]}
                    </div>
                    <div className="space-y-1.5">
                      {slotsByDay[day].length === 0 ? (
                        <div className="text-center text-[10px] text-slate-700 pt-4">—</div>
                      ) : (
                        slotsByDay[day].map((slot) => (
                          <div
                            key={slot.id}
                            className="p-2 rounded-lg border text-xs"
                            style={{
                              backgroundColor: slot.group.subject?.color
                                ? `${slot.group.subject.color}15`
                                : "rgba(79, 110, 247, 0.08)",
                              borderColor: slot.group.subject?.color
                                ? `${slot.group.subject.color}40`
                                : "rgba(79, 110, 247, 0.2)",
                            }}
                          >
                            <div className="font-bold text-white text-[11px] leading-tight truncate">
                              {slot.group.name}
                            </div>
                            <div className="text-slate-400 text-[10px] mt-0.5 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" />
                              {slot.startTime}–{slot.endTime}
                            </div>
                            {slot.roomName && (
                              <div className="text-slate-500 text-[10px] truncate">{slot.roomName}</div>
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

          {/* Detailed Schedule Cards */}
          {slots.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-4">Подробное расписание</h3>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5, 6, 7].map((day) => {
                  const daySlots = slotsByDay[day];
                  if (daySlots.length === 0) return null;
                  return (
                    <div key={day} className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                      <div className={`px-5 py-3 border-b border-slate-800 ${day === 6 || day === 7 ? "bg-amber-500/5" : ""}`}>
                        <span className="text-sm font-bold text-white">{DAY_NAMES_FULL[day]}</span>
                        <span className="text-xs text-slate-500 ml-2">{daySlots.length} занятий</span>
                      </div>
                      <div className="divide-y divide-slate-800/60">
                        {daySlots.map((slot) => (
                          <div key={slot.id} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-900/30 transition-colors">
                            {/* Time */}
                            <div className="text-center shrink-0 w-16">
                              <div className="text-sm font-bold text-brand-400">{slot.startTime}</div>
                              <div className="text-xs text-slate-500">{slot.endTime}</div>
                            </div>

                            {/* Color indicator */}
                            <div
                              className="w-1 h-12 rounded-full shrink-0"
                              style={{ backgroundColor: slot.group.subject?.color || "#4f6ef7" }}
                            />

                            {/* Main info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold text-white">{slot.group.name}</span>
                                {slot.group.subject && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                                    style={{
                                      color: slot.group.subject.color || "#4f6ef7",
                                      borderColor: `${slot.group.subject.color || "#4f6ef7"}40`,
                                      backgroundColor: `${slot.group.subject.color || "#4f6ef7"}10`,
                                    }}>
                                    {slot.group.subject.name}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-slate-400">
                                <span className="flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  {slot.group.course.title}
                                </span>
                                {(activeRole === "DIRECTOR" || activeRole === "CENTER_ADMIN" || activeRole === "STUDENT" || activeRole === "PARENT") && (
                                  <span className="flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    {slot.teacher.user.fullName}
                                  </span>
                                )}
                                {slot.branch && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {slot.branch.name}
                                  </span>
                                )}
                                {slot.roomName && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {slot.roomName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upcoming One-off Lessons */}
          {upcomingLessons.length > 0 && (
            <div>
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                Ближайшие занятия (на неделю)
              </h3>
              <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-4 text-left">Занятие</th>
                      <th className="p-4 text-left">Курс</th>
                      <th className="p-4 text-left">Дата и время</th>
                      <th className="p-4 text-left">Тип</th>
                      <th className="p-4 text-left">Место</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {upcomingLessons.map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-slate-900/30 transition-colors">
                        <td className="p-4 font-semibold text-white">{lesson.title}</td>
                        <td className="p-4 text-slate-300">{lesson.module.course.title}</td>
                        <td className="p-4 text-slate-300">
                          {lesson.scheduledAt
                            ? new Date(lesson.scheduledAt).toLocaleDateString(locale === "ru" ? "ru-RU" : "uz-UZ", {
                                weekday: "short",
                                day: "numeric",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${
                            lesson.lessonType === "ONLINE"
                              ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          }`}>
                            {lesson.lessonType === "ONLINE" ? "🖥 Онлайн" : "🏫 Офлайн"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400 text-xs">
                          {lesson.onlineMeetingUrl ? (
                            <a href={lesson.onlineMeetingUrl} target="_blank" rel="noopener noreferrer"
                               className="text-purple-400 underline hover:text-purple-300">
                              Ссылка
                            </a>
                          ) : lesson.location || "—"}
                          {lesson.substituteTeacher && (
                            <span className="ml-2 text-amber-400 text-[10px]">
                              🔄 Замена: {lesson.substituteTeacher.user.fullName}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
