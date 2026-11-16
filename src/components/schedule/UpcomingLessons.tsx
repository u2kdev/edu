"use client";

import { Clock, ExternalLink } from "lucide-react";
import { t } from "@/i18n";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatLessonDateTime, type UpcomingLessonItem } from "./schedule-utils";

interface UpcomingLessonsProps {
  lessons: UpcomingLessonItem[];
  locale: string;
}

export function UpcomingLessons({ lessons, locale }: UpcomingLessonsProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4 text-warning" aria-hidden="true" />
          <span>{t(locale, "schedule.upcomingLessons")}</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="divide-y divide-border pt-0">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="flex flex-col justify-between gap-2 py-3 transition-colors sm:flex-row sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{lesson.title}</span>
                <Badge variant={lesson.lessonType === "ONLINE" ? "primary" : "success"}>
                  {lesson.lessonType === "ONLINE"
                    ? t(locale, "schedule.online")
                    : t(locale, "schedule.offline")}
                </Badge>
                {lesson.substituteTeacher && (
                  <Badge variant="warning">
                    {t(locale, "schedule.substituteTeacher")}:{" "}
                    {lesson.substituteTeacher.user.fullName}
                  </Badge>
                )}
                {lesson.status === "CANCELLED" && (
                  <Badge variant="destructive">{t(locale, "schedule.cancelled")}</Badge>
                )}
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
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
                className="flex items-center gap-1 self-start text-xs text-primary hover:underline sm:self-center"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(locale, "schedule.meetingLink")}</span>
              </a>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
