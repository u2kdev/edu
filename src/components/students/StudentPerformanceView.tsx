"use client";

import * as React from "react";
import Link from "next/link";
import { t, formatDateLocalized } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import type { StudentPerformanceDTO } from "@/lib/dashboard-analytics";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/charts/progress-ring";
import { AreaLineChart } from "@/components/charts/area-line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { AttendanceHeatmap } from "@/components/charts/heatmap";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PeriodSwitcher } from "@/components/dashboard/PeriodSwitcher";

export interface StudentPerformanceViewProps {
  initialData: StudentPerformanceDTO;
  locale: string;
  showPeriodControls?: boolean;
  paymentsHref?: string;
}

const ATTENDANCE_STATUS_TONES: Record<string, "success" | "warning" | "info" | "destructive" | "neutral"> = {
  PRESENT: "success",
  LATE: "warning",
  EXCUSED: "info",
  ABSENT: "destructive",
};

export function StudentPerformanceView({
  initialData,
  locale,
  showPeriodControls = true,
  paymentsHref = "/center/payments",
}: StudentPerformanceViewProps) {
  const [data, setData] = React.useState<StudentPerformanceDTO>(initialData);
  const [period, setPeriod] = React.useState<AnalyticsPeriodPreset>(initialData.period);
  const [calendarMonth, setCalendarMonth] = React.useState<string>(initialData.calendarMonth);
  const [lessonTab, setLessonTab] = React.useState<"conducted" | "missed" | "upcoming">("conducted");
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    setData(initialData);
    setPeriod(initialData.period);
    setCalendarMonth(initialData.calendarMonth);
  }, [initialData]);

  const reload = React.useCallback(
    async (nextPeriod: AnalyticsPeriodPreset, nextMonth: string) => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/students/${encodeURIComponent(data.studentMembershipId)}/performance?detailed=1&period=${nextPeriod}&month=${encodeURIComponent(nextMonth)}`
        );
        if (res.ok) {
          const json = await res.json();
          if (json.detailedPerformance) {
            setData(json.detailedPerformance);
          }
        }
      } catch {
        // Keep current rendered snapshot on transient failure
      } finally {
        setLoading(false);
      }
    },
    [data.studentMembershipId]
  );

  const handlePeriodChange = (nextPeriod: AnalyticsPeriodPreset) => {
    setPeriod(nextPeriod);
    void reload(nextPeriod, calendarMonth);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (/^\d{4}-\d{2}$/.test(val)) {
      setCalendarMonth(val);
      void reload(period, val);
    }
  };

  const attendanceDonutData = React.useMemo(
    () => [
      {
        name: t(locale, "ui3.statusPresent"),
        value: data.summary.presentCount,
        color: "var(--success)",
      },
      {
        name: t(locale, "ui3.statusLate"),
        value: data.summary.lateCount,
        color: "var(--warning)",
      },
      {
        name: t(locale, "ui3.statusExcused"),
        value: data.summary.excusedCount,
        color: "var(--info)",
      },
      {
        name: t(locale, "ui3.statusAbsent"),
        value: data.summary.absentCount,
        color: "var(--destructive)",
      },
    ],
    [data.summary, locale]
  );

  const homeworkChartData = React.useMemo(
    () =>
      data.homeworkWeekly.map((w) => ({
        week: w.week,
        onTime: w.onTime,
        late: w.late,
        underReview: w.underReview,
        notSubmitted: w.notSubmitted,
      })),
    [data.homeworkWeekly]
  );

  const gradeChartData = React.useMemo(
    () =>
      data.gradesTrajectory.map((pt, idx) => ({
        point: `${pt.date} · ${idx + 1}`,
        studentPercent: pt.studentPercent,
        ...(pt.groupAverage !== undefined ? { groupAverage: pt.groupAverage } : {}),
      })),
    [data.gradesTrajectory]
  );

  const gradeSeries = React.useMemo(() => {
    const base = [
      {
        key: "studentPercent",
        label: t(locale, "ui3.studentScoreSeries"),
        color: "var(--chart-1)",
      },
    ];
    if (data.canViewGroupAverage && gradeChartData.some((d) => d.groupAverage !== undefined)) {
      base.push({
        key: "groupAverage",
        label: t(locale, "ui3.groupAvgSeries"),
        color: "var(--chart-3)",
      });
    }
    return base;
  }, [data.canViewGroupAverage, gradeChartData, locale]);

  const filteredLessons = React.useMemo(
    () => data.lessons.filter((l) => l.category === lessonTab),
    [data.lessons, lessonTab]
  );

  const statusText = (st: string | null) => {
    if (st === "PRESENT") return t(locale, "ui3.statusPresent");
    if (st === "LATE") return t(locale, "ui3.statusLate");
    if (st === "EXCUSED") return t(locale, "ui3.statusExcused");
    if (st === "ABSENT") return t(locale, "ui3.statusAbsent");
    return t(locale, "ui3.tabUpcoming");
  };

  return (
    <div className="space-y-6">
      {showPeriodControls && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PeriodSwitcher value={period} onChange={handlePeriodChange} locale={locale} disabled={loading} />
          <div className="flex items-center gap-2">
            <label htmlFor={`heatmap-month-${data.studentMembershipId}`} className="text-xs font-medium text-muted-foreground">
              {t(locale, "ui3.attendanceHeatmapTitle")}:
            </label>
            <input
              id={`heatmap-month-${data.studentMembershipId}`}
              type="month"
              value={calendarMonth}
              onChange={handleMonthChange}
              disabled={loading}
              className="h-8 rounded-md border border-input bg-card px-2.5 text-xs text-foreground tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}

      {/* 4-5 KPI StatCards */}
      <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 ${data.canViewPayments ? "xl:grid-cols-5" : "xl:grid-cols-4"}`}>
        <StatCard
          label={t(locale, "ui3.avgGradeKpi")}
          value={data.summary.avgGradePercent !== null ? `${data.summary.avgGradePercent}%` : "—"}
          delta={{
            value: data.gradesTrajectory.length > 0 ? `${data.gradesTrajectory.length}` : t(locale, "ui3.noPrevData"),
            tone: "neutral",
          }}
        />
        <StatCard
          label={t(locale, "ui3.attendanceKpi")}
          value={data.summary.attendanceRate !== null ? `${data.summary.attendanceRate}%` : "—"}
          hint={`${data.summary.presentCount + data.summary.lateCount} / ${data.summary.totalAttendances}`}
          delta={{
            value:
              data.summary.attendanceRate !== null && data.summary.attendanceRate < 80
                ? `< 80%`
                : `${data.summary.absentCount} ${t(locale, "ui3.statusAbsent").toLowerCase()}`,
            tone:
              data.summary.attendanceRate !== null && data.summary.attendanceRate < 80
                ? "negative"
                : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.homeworkKpi")}
          value={data.summary.homeworkCompletionRate !== null ? `${data.summary.homeworkCompletionRate}%` : "—"}
          hint={`${data.summary.completedHomeworks} / ${data.summary.totalHomeworks}`}
          delta={{
            value:
              data.summary.overdueHomeworksCount > 0
                ? `${data.summary.overdueHomeworksCount} ${t(locale, "ui3.overdueLabel").toLowerCase()}`
                : t(locale, "ui3.onTimeLabel"),
            tone: data.summary.overdueHomeworksCount > 0 ? "negative" : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.courseProgressKpi")}
          value={`${data.summary.courseProgressPercent}%`}
          hint={
            data.courseProgress.length > 0
              ? `${data.courseProgress.length} ${t(locale, "nav.courses").toLowerCase()}`
              : undefined
          }
        />
        {data.canViewPayments && data.payment && (
          <StatCard
            label={t(locale, "ui3.paidUntilKpi")}
            value={
              data.payment.earliestPaidUntil
                ? formatDateLocalized(data.payment.earliestPaidUntil, locale)
                : t(locale, "ui3.notPaidStatus")
            }
            hint={
              data.payment.debtAmount > 0
                ? `${t(locale, "ui3.kpiDebt")}: ${formatUzs(data.payment.debtAmount, { locale })}`
                : formatUzs(data.payment.totalPaid, { locale })
            }
            delta={{
              value:
                data.payment.debtAmount > 0
                  ? formatUzs(data.payment.debtAmount, { locale })
                  : t(locale, "payments.paid"),
              tone: data.payment.debtAmount > 0 ? "negative" : "positive",
            }}
          />
        )}
      </div>

      {/* Attendance Donut + Calendar Heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <DonutChart
          title={t(locale, "ui3.attendanceDonutTitle")}
          data={attendanceDonutData}
          valueType="number"
          locale={locale}
          loading={loading}
        />
        <AttendanceHeatmap
          title={`${t(locale, "ui3.attendanceHeatmapTitle")} (${calendarMonth})`}
          data={data.attendanceHeatmap}
          locale={locale}
          loading={loading}
        />
      </div>

      {/* Homework Stacked Bar + Grades Line Trajectory */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <BarChart
            title={t(locale, "ui3.homeworkStackedTitle")}
            subtitle={
              data.summary.homeworkCompletionRate !== null
                ? `${t(locale, "ui3.homeworkKpi")}: ${data.summary.homeworkCompletionRate}%`
                : undefined
            }
            data={homeworkChartData}
            xKey="week"
            stacked
            valueType="number"
            locale={locale}
            loading={loading}
            series={[
              { key: "onTime", label: t(locale, "ui3.hwOnTime"), color: "var(--success)" },
              { key: "late", label: t(locale, "ui3.hwLate"), color: "var(--warning)" },
              { key: "underReview", label: t(locale, "ui3.hwUnderReview"), color: "var(--info)" },
              { key: "notSubmitted", label: t(locale, "ui3.hwNotSubmitted"), color: "var(--destructive)" },
            ]}
          />
          {data.summary.homeworkCompletionRate !== null && (
            <Card>
              <CardContent className="pt-4">
                <ProgressBar
                  label={t(locale, "ui3.homeworkKpi")}
                  value={data.summary.homeworkCompletionRate}
                  valueLabel={`${data.summary.completedHomeworks} / ${data.summary.totalHomeworks} (${data.summary.homeworkCompletionRate}%)`}
                  tone={data.summary.homeworkCompletionRate >= 70 ? "success" : "warning"}
                />
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-3">
          <AreaLineChart
            title={t(locale, "ui3.gradesTrendTitle")}
            data={gradeChartData}
            xKey="point"
            variant="line"
            valueType="percent"
            locale={locale}
            loading={loading}
            series={gradeSeries}
          />
          {!data.canViewGroupAverage && (
            <p className="text-xs text-muted-foreground px-1">
              {t(locale, "ui3.groupAvgHiddenNotice")}
            </p>
          )}
        </div>
      </div>

      {/* Course Progress Bars + Payment Status Card */}
      <div className={`grid grid-cols-1 gap-4 ${data.canViewPayments && data.payment ? "lg:grid-cols-2" : ""}`}>
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "ui3.courseProgressTitle")}</CardTitle>
          </CardHeader>
          <CardContent>
            {data.courseProgress.length === 0 ? (
              <EmptyState title={t(locale, "ui3.emptyPeriod")} locale={locale} />
            ) : (
              <div className="space-y-4">
                {data.courseProgress.map((cp) => (
                  <ProgressBar
                    key={cp.enrollmentId}
                    label={`${cp.courseTitle} — ${cp.groupName}`}
                    value={cp.progressPercent}
                    valueLabel={`${t(locale, "ui3.lessonsProgressCount", { completed: cp.completedLessons, total: cp.totalLessons })} (${cp.progressPercent}%)`}
                    tone={cp.progressPercent >= 75 ? "success" : "primary"}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {data.canViewPayments && data.payment && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <div>
                <CardTitle>{t(locale, "ui3.paymentCardTitle")}</CardTitle>
                <CardDescription>
                  {data.payment.debtAmount > 0
                    ? `${t(locale, "ui3.kpiDebt")}: ${formatUzs(data.payment.debtAmount, { locale })}`
                    : t(locale, "ui3.noUpcomingCharge")}
                </CardDescription>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={paymentsHref}>{t(locale, "ui3.goToPayments")}</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {data.payment.nextPayment && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/50 px-3.5 py-2.5">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">{t(locale, "ui3.nextChargeLabel")}</div>
                    <div className="text-sm font-medium text-foreground truncate">
                      {data.payment.nextPayment.description}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatDateLocalized(data.payment.nextPayment.dueDate, locale)}
                    </div>
                  </div>
                  <Badge variant={data.payment.nextPayment.isOverdue ? "destructive" : "warning"}>
                    {formatUzs(data.payment.nextPayment.amount, { locale })}
                  </Badge>
                </div>
              )}
              {data.payment.enrollments.length === 0 ? (
                <div className="text-xs text-muted-foreground">{t(locale, "ui3.emptyPeriod")}</div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border">
                  {data.payment.enrollments.map((en) => (
                    <div
                      key={en.enrollmentId}
                      className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">
                          {en.courseTitle} — {en.groupName}
                        </div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {t(locale, "ui3.paidUntilKpi")}:{" "}
                          {en.paidUntil
                            ? formatDateLocalized(en.paidUntil, locale)
                            : t(locale, "ui3.notPaidStatus")}
                        </div>
                      </div>
                      {en.daysRemaining !== null && (
                        <Badge
                          variant={
                            en.isOverdue || en.daysRemaining <= 3
                              ? "destructive"
                              : en.daysRemaining <= 7
                              ? "warning"
                              : "success"
                          }
                        >
                          {t(locale, "ui3.daysLeftShort", { days: Math.max(0, en.daysRemaining) })}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lessons List (Conducted, Missed, Upcoming) */}
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>{t(locale, "ui3.lessonsSectionTitle")}</CardTitle>
          <div role="tablist" className="inline-flex rounded-lg border border-border bg-muted p-0.5">
            {(["conducted", "missed", "upcoming"] as const).map((tabKey) => {
              const count = data.lessons.filter((l) => l.category === tabKey).length;
              const label =
                tabKey === "conducted"
                  ? t(locale, "ui3.tabConducted")
                  : tabKey === "missed"
                  ? t(locale, "ui3.tabMissed")
                  : t(locale, "ui3.tabUpcoming");
              const active = lessonTab === tabKey;
              return (
                <button
                  key={tabKey}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setLessonTab(tabKey)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors tabular-nums ${
                    active ? "bg-card text-foreground border border-border" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {filteredLessons.length === 0 ? (
            <EmptyState title={t(locale, "ui3.noLessonsInCategory")} locale={locale} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "nav.courses")}</TableHead>
                  <TableHead>{t(locale, "common.date")}</TableHead>
                  <TableHead>{t(locale, "common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLessons.slice(0, 20).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>
                      <div className="font-medium text-foreground">{l.title}</div>
                      <div className="text-xs text-muted-foreground">{l.courseTitle}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {l.scheduledAt ? formatDateLocalized(l.scheduledAt, locale) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          l.attendanceStatus
                            ? ATTENDANCE_STATUS_TONES[l.attendanceStatus] ?? "neutral"
                            : "neutral"
                        }
                      >
                        {statusText(l.attendanceStatus)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
