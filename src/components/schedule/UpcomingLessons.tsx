"use client";

import { Clock, ExternalLink } from "lucide-react";
import { t } from "@/i18n";
import { formatLessonDateTime, type UpcomingLessonItem } from "./schedule-utils";

interface UpcomingLessonsProps {
  lessons: UpcomingLessonItem[];
  locale: string;
}

export function UpcomingLessons({ lessons, locale }: UpcomingLessonsProps) {
  return (
    <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-4">
      <h3 className="text-base font-bold text-white flex items-center gap-2">
        <Clock className="w-4 h-4 text-amber-400" />
        {t(locale, "schedule.upcomingLessons")}
      </h3>

      <div className="divide-y divide-slate-800/60">
        {lessons.map((lesson) => (
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
                  <span>{formatLessonDateTime(lesson.scheduledAt, locale)}</span>
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
  );
}
