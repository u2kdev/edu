"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, formatDateLocalized } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type { TeacherDashboardData } from "@/lib/dashboard-analytics";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BarChart } from "@/components/charts/bar-chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodSwitcher } from "./PeriodSwitcher";

export interface TeacherDashboardViewProps {
  data: TeacherDashboardData;
  roleLabel: string;
  centerSlug: string;
  locale: string;
}

export function TeacherDashboardView({
  data,
  roleLabel,
  centerSlug,
  locale,
}: TeacherDashboardViewProps) {
  const router = useRouter();
  const [period, setPeriod] = React.useState<AnalyticsPeriodPreset>(data.period);

  React.useEffect(() => {
    setPeriod(data.period);
  }, [data.period]);

  const handlePeriodChange = (next: AnalyticsPeriodPreset) => {
    setPeriod(next);
    router.push(`/center?period=${next}`);
  };

  const attBarData = data.attendanceByGroup.map((g) => ({
    group: g.groupName,
    rate: g.rate,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(locale, "ui3.teacherOverviewTitle")} · ${roleLabel}`}
        description={`${t(locale, "ui3.teacherOverviewSubtitle")} (${centerSlug})`}
        actions={<PeriodSwitcher value={period} onChange={handlePeriodChange} locale={locale} />}
      />

      {/* Row of 5 Teacher KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t(locale, "ui3.teacherTodayLessonsKpi")}
          value={data.kpis.todayLessonsCount}
          hint={`${t(locale, "nav.groups")}: ${data.kpis.groupsCount}`}
        />
        <StatCard
          label={t(locale, "ui3.teacherQueueKpi")}
          value={data.kpis.pendingReviewsCount}
          hint={t(locale, "ui3.teacherUnmarkedHint", { count: data.kpis.unmarkedLessonsCount })}
          delta={{
            value: `${data.kpis.pendingReviewsCount}`,
            tone: data.kpis.pendingReviewsCount > 0 ? "neutral" : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.teacherAttendanceKpi")}
          value={data.kpis.avgAttendanceRate !== null ? `${data.kpis.avgAttendanceRate}%` : "—"}
        />
        <StatCard
          label={t(locale, "ui3.teacherAtRiskKpi")}
          value={data.kpis.atRiskCount}
          delta={{
            value: `${data.kpis.atRiskCount}`,
            tone: data.kpis.atRiskCount > 0 ? "negative" : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.teacherMonthlyHoursKpi")}
          value={formatUzs(data.salarySummary.calculatedSalary, { locale })}
          hint={t(locale, "ui3.teacherHoursSub", {
            hours: data.salarySummary.totalHours,
            lessons: data.salarySummary.conductedLessons,
          })}
        />
      </div>

      {/* Today's Lessons + Homework Queue */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t(locale, "ui3.teacherTodayLessonsList")}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/schedule">{t(locale, "dashboard.viewSchedule")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {data.todayLessons.length === 0 ? (
              <EmptyState title={t(locale, "ui3.teacherNoTodayLessons")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "schedule.startTime")}</TableHead>
                    <TableHead>{t(locale, "nav.groups")}</TableHead>
                    <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.todayLessons.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="text-xs font-medium text-foreground tabular-nums whitespace-nowrap">
                        {slot.startTime}–{slot.endTime}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{slot.groupName}</div>
                        <div className="text-xs text-muted-foreground">
                          {slot.courseTitle}
                          {slot.roomName ? ` · ${slot.roomName}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/center/attendance">{t(locale, "ui3.teacherMarkAction")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>
              {t(locale, "ui3.teacherHomeworkQueue")} ({data.kpis.pendingReviewsCount})
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/homework">{t(locale, "ui3.teacherReviewAction")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {data.pendingReviews.length === 0 ? (
              <EmptyState title={t(locale, "dashboard.noPendingReviews")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "nav.homework")}</TableHead>
                    <TableHead>{t(locale, "ui3.submittedAt")}</TableHead>
                    <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pendingReviews.map((rev) => (
                    <TableRow key={rev.submissionId}>
                      <TableCell>
                        <div className="font-medium text-foreground">{rev.homeworkTitle}</div>
                        <div className="text-xs text-muted-foreground">{rev.studentName}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        <div>{formatDateLocalized(rev.submittedAt, locale)}</div>
                        {rev.dueDate && (
                          <Badge variant={rev.isOverdue ? "destructive" : "neutral"} className="mt-1">
                            {t(locale, "ui3.dueDateLabel")}: {formatDateLocalized(rev.dueDate, locale)}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/center/homework">{t(locale, "ui3.teacherReviewAction")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Attendance by My Groups + Grade Distribution Histogram */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BarChart
          title={t(locale, "ui3.teacherAttendanceByGroup")}
          data={attBarData}
          xKey="group"
          valueType="percent"
          locale={locale}
          series={[
            { key: "rate", label: t(locale, "ui3.attendanceKpi"), color: "var(--chart-1)" },
          ]}
        />
        <BarChart
          title={t(locale, "ui3.teacherGradeHistogram")}
          data={data.gradeDistribution}
          xKey="band"
          valueType="number"
          locale={locale}
          series={[
            { key: "count", label: t(locale, "nav.students"), color: "var(--chart-2)" },
          ]}
        />
      </div>

      {/* At-Risk Students + Monthly Salary Summary */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t(locale, "ui3.atRiskStudentsTitle")}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/attendance">{t(locale, "ui3.attentionAtRiskAction")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {data.atRiskStudents.length === 0 ? (
              <EmptyState title={t(locale, "ui3.atRiskEmpty")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "nav.students")}</TableHead>
                    <TableHead>{t(locale, "nav.groups")}</TableHead>
                    <TableHead className="text-right">{t(locale, "ui3.attendanceKpi")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.atRiskStudents.map((st) => (
                    <TableRow key={`${st.studentMembershipId}-${st.groupName}`}>
                      <TableCell>
                        <Link
                          href={`/center/students/${st.studentMembershipId}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {st.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{st.groupName}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={st.rate < 60 ? "destructive" : "warning"}>
                          {st.rate}% ({st.absentCount})
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{t(locale, "ui3.teacherHoursAndSalaryTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span className="text-muted-foreground">{t(locale, "ui3.teacherTodayLessonsKpi")}</span>
              <span className="font-medium text-foreground tabular-nums">
                {data.salarySummary.conductedLessons} ({data.salarySummary.totalHours} h)
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span className="text-muted-foreground">{t(locale, "ui3.salaryAccrued")}</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatUzs(data.salarySummary.calculatedSalary, { locale })}
              </span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
              <span className="text-muted-foreground">{t(locale, "ui3.salaryPaid")}</span>
              <span className="font-medium text-success tabular-nums">
                {formatUzs(data.salarySummary.paidSalary, { locale })}
              </span>
            </div>
            <div className="flex items-center justify-between pb-1 text-sm">
              <span className="text-muted-foreground">{t(locale, "ui3.salaryUnpaid")}</span>
              <span className="font-medium text-foreground tabular-nums">
                {formatUzs(data.salarySummary.unpaidSalary, { locale })}
              </span>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/center/my-salary">{t(locale, "dashboard.moreDetails")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
