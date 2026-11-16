"use client";

import * as React from "react";
import Link from "next/link";
import { t } from "@/i18n";
import type { StudentPerformanceDTO } from "@/lib/dashboard-analytics";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentPerformanceView } from "@/components/students/StudentPerformanceView";

export interface StudentDashboardViewProps {
  performance: StudentPerformanceDTO | null;
  enrollmentsCount: number;
  scheduleSlots: Array<{
    id: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    roomName: string | null;
    groupName: string;
    courseTitle: string;
    teacherName: string;
  }>;
  centerSlug: string;
  locale: string;
}

export function StudentDashboardView({
  performance,
  enrollmentsCount,
  scheduleSlots,
  centerSlug,
  locale,
}: StudentDashboardViewProps) {
  const dayNames: Record<number, string> = {
    1: t(locale, "schedule.monShort"),
    2: t(locale, "schedule.tueShort"),
    3: t(locale, "schedule.wedShort"),
    4: t(locale, "schedule.thuShort"),
    5: t(locale, "schedule.friShort"),
    6: t(locale, "schedule.satShort"),
    7: t(locale, "schedule.sunShort"),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "ui3.performanceTitle")}
        description={`${t(locale, "ui3.performanceSubtitle")} (${centerSlug})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/center/grades">{t(locale, "nav.grades")}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/payments">{t(locale, "nav.payment")}</Link>
            </Button>
          </div>
        }
      />

      {!performance || enrollmentsCount === 0 ? (
        <EmptyState
          title={t(locale, "student.noCourses")}
          description={t(locale, "student.useInviteCode")}
          locale={locale}
        />
      ) : (
        <StudentPerformanceView initialData={performance} locale={locale} />
      )}

      {/* Weekly Timetable Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>{t(locale, "dashboard.mySchedule")}</CardTitle>
          <Button asChild variant="outline" size="sm">
            <Link href="/center/schedule">{t(locale, "dashboard.viewSchedule")}</Link>
          </Button>
        </CardHeader>
        <CardContent className="pt-0">
          {scheduleSlots.length === 0 ? (
            <EmptyState title={t(locale, "dashboard.noUpcomingClasses")} locale={locale} className="py-6" />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scheduleSlots.map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-col justify-between gap-2 rounded-lg border border-border bg-card p-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="neutral" className="tabular-nums">
                      {dayNames[slot.dayOfWeek] || ""} {slot.startTime}–{slot.endTime}
                    </Badge>
                    {slot.roomName && (
                      <span className="text-xs text-muted-foreground">{slot.roomName}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">{slot.courseTitle}</div>
                    <div className="text-xs text-muted-foreground">
                      {slot.groupName} · {slot.teacherName}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
