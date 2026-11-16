"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { t, formatDateLocalized } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type { DirectorDashboardData } from "@/lib/dashboard-analytics";
import type { AnalyticsPeriodPreset } from "@/lib/finance-analytics";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/charts/progress-ring";
import { AreaLineChart } from "@/components/charts/area-line-chart";
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
import { AttentionListCard, type AttentionRowItem } from "./AttentionListCard";

export interface DirectorDashboardViewProps {
  data: DirectorDashboardData;
  roleLabel: string;
  centerSlug: string;
  locale: string;
}

export function DirectorDashboardView({
  data,
  roleLabel,
  centerSlug,
  locale,
}: DirectorDashboardViewProps) {
  const router = useRouter();
  const [period, setPeriod] = React.useState<AnalyticsPeriodPreset>(data.period);

  React.useEffect(() => {
    setPeriod(data.period);
  }, [data.period]);

  const handlePeriodChange = (next: AnalyticsPeriodPreset) => {
    setPeriod(next);
    router.push(`/center?period=${next}`);
  };

  const dayNames: Record<number, string> = {
    1: t(locale, "schedule.monShort"),
    2: t(locale, "schedule.tueShort"),
    3: t(locale, "schedule.wedShort"),
    4: t(locale, "schedule.thuShort"),
    5: t(locale, "schedule.friShort"),
    6: t(locale, "schedule.satShort"),
    7: t(locale, "schedule.sunShort"),
  };

  const deltaTone = (delta: number, invert = false): "positive" | "negative" | "neutral" => {
    if (delta === 0) return "neutral";
    const good = invert ? delta < 0 : delta > 0;
    return good ? "positive" : "negative";
  };

  const attentionItems: AttentionRowItem[] = [];
  if (data.attentionCounts.pendingManualRefunds > 0) {
    attentionItems.push({
      id: "manual-refunds",
      severity: "critical",
      title: `${t(locale, "ui3.manualRefundsTitle")} (${data.attentionCounts.pendingManualRefunds})`,
      description: t(locale, "ui3.kpiPendingRefundsHint"),
      actionLabel: t(locale, "ui3.manualRefundsAction"),
      actionHref: "/center/finance?tab=online",
    });
  }
  if (data.attentionCounts.debtorsCount > 0) {
    attentionItems.push({
      id: "debtors",
      severity: "warning",
      title: t(locale, "ui3.attentionDebts", { count: data.attentionCounts.debtorsCount }),
      description: t(locale, "ui3.attentionDebtsDesc", {
        amount: formatUzs(data.attentionCounts.totalDebtAmount, { locale }),
      }),
      actionLabel: t(locale, "ui3.attentionDebtsAction"),
      actionHref: "/center/finance?tab=debts",
    });
  }
  if (data.attentionCounts.atRiskStudentsCount > 0) {
    attentionItems.push({
      id: "at-risk",
      severity: "warning",
      title: t(locale, "ui3.attentionAtRisk"),
      description: t(locale, "ui3.attentionAtRiskDesc", {
        count: data.attentionCounts.atRiskStudentsCount,
      }),
      actionLabel: t(locale, "ui3.attentionAtRiskAction"),
      actionHref: "/center/attendance",
    });
  }
  if (data.attentionCounts.unmarkedLessonsCount > 0) {
    attentionItems.push({
      id: "unmarked-lessons",
      severity: "warning",
      title: t(locale, "ui3.attentionUnmarkedLessons", {
        count: data.attentionCounts.unmarkedLessonsCount,
      }),
      actionLabel: t(locale, "ui3.attentionUnmarkedAction"),
      actionHref: "/center/attendance",
    });
  }
  if (data.attentionCounts.groupsWithoutTeacherCount > 0) {
    attentionItems.push({
      id: "no-teacher",
      severity: "info",
      title: t(locale, "ui3.attentionNoTeacher", {
        count: data.attentionCounts.groupsWithoutTeacherCount,
      }),
      actionLabel: t(locale, "ui3.attentionNoTeacherAction"),
      actionHref: "/center/groups",
    });
  }
  if (data.attentionCounts.groupsWithoutScheduleCount > 0) {
    attentionItems.push({
      id: "no-schedule",
      severity: "info",
      title: t(locale, "ui3.attentionNoSchedule", {
        count: data.attentionCounts.groupsWithoutScheduleCount,
      }),
      actionLabel: t(locale, "ui3.attentionNoScheduleAction"),
      actionHref: "/center/schedule",
    });
  }
  if (data.attentionCounts.inactiveTeachersCount > 0) {
    attentionItems.push({
      id: "inactive-teachers",
      severity: "info",
      title: t(locale, "ui3.attentionInactiveTeachers", {
        count: data.attentionCounts.inactiveTeachersCount,
      }),
      actionLabel: t(locale, "ui3.attentionInactiveAction"),
      actionHref: "/center/staff",
    });
  }

  const revExpHasData = data.revenueExpenses12Months.some(
    (m) => m.revenue > 0 || m.expenses > 0
  );
  const revExpData = revExpHasData ? data.revenueExpenses12Months : [];

  const occupancyData = data.groupOccupancy.map((g) => ({
    group: `${g.groupName}`,
    fillPercent: g.fillPercent,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${t(locale, "ui3.directorOverviewTitle")} · ${roleLabel}`}
        description={`${t(locale, "ui3.directorOverviewSubtitle")} (${centerSlug})`}
        actions={<PeriodSwitcher value={period} onChange={handlePeriodChange} locale={locale} />}
      />

      {/* Row of 5 KPI StatCards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t(locale, "ui3.kpiRevenue")}
          value={formatUzs(data.kpis.revenue, { locale })}
          delta={{
            value: `${data.kpis.revenueDeltaPercent >= 0 ? "+" : ""}${data.kpis.revenueDeltaPercent}% ${t(locale, "ui3.vsPrevPeriod")}`,
            tone: deltaTone(data.kpis.revenueDeltaPercent),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiExpenses")}
          value={formatUzs(data.kpis.expenses, { locale })}
          delta={{
            value: `${data.kpis.expensesDeltaPercent >= 0 ? "+" : ""}${data.kpis.expensesDeltaPercent}% ${t(locale, "ui3.vsPrevPeriod")}`,
            tone: deltaTone(data.kpis.expensesDeltaPercent, true),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiDebt")}
          value={formatUzs(data.kpis.totalDebt, { locale })}
          hint={t(locale, "ui3.kpiDebtorsCount", { count: data.kpis.debtorsCount })}
          delta={{
            value: `${data.kpis.debtorsCount}`,
            tone: data.kpis.debtorsCount > 0 ? "negative" : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiActiveStudents")}
          value={data.kpis.activeStudents}
          hint={t(locale, "ui3.kpiTeachersHint", {
            teachers: data.kpis.activeTeachers,
            courses: data.kpis.coursesCount,
          })}
          delta={{
            value: `${data.kpis.activeStudentsDelta >= 0 ? "+" : ""}${data.kpis.activeStudentsDelta}`,
            tone: deltaTone(data.kpis.activeStudentsDelta),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiAttendanceRate")}
          value={data.kpis.attendanceRate !== null ? `${data.kpis.attendanceRate}%` : "—"}
          hint={t(locale, "ui3.kpiAtRiskHint", { count: data.kpis.atRiskStudentsCount })}
          delta={
            data.kpis.attendanceDeltaPoints !== null
              ? {
                  value: `${data.kpis.attendanceDeltaPoints >= 0 ? "+" : ""}${data.kpis.attendanceDeltaPoints} pp`,
                  tone: deltaTone(data.kpis.attendanceDeltaPoints),
                }
              : undefined
          }
        />
      </div>

      {/* Attention List (1 action per row) */}
      <AttentionListCard items={attentionItems} locale={locale} />

      {/* Charts Row 1: Revenue & Expenses Area (12m) + Debt Aging Stacked Bar */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <AreaLineChart
          title={t(locale, "ui3.revExp12mTitle")}
          data={revExpData}
          xKey="month"
          variant="area"
          valueType="uzs"
          locale={locale}
          className="xl:col-span-2"
          series={[
            { key: "revenue", label: t(locale, "finance.income"), color: "var(--success)" },
            { key: "expenses", label: t(locale, "finance.expense"), color: "var(--destructive)" },
          ]}
        />
        <BarChart
          title={t(locale, "ui3.debtAgingTitle")}
          data={data.debtAgingBuckets}
          xKey="label"
          stacked
          valueType="uzs"
          locale={locale}
          series={[
            { key: "aging0to30", label: t(locale, "finance.aging0to30"), color: "var(--chart-3)" },
            { key: "aging31to60", label: t(locale, "finance.aging31to60"), color: "var(--warning)" },
            { key: "aging61plus", label: t(locale, "finance.aging61plus"), color: "var(--destructive)" },
          ]}
        />
      </div>

      {/* Charts Row 2: Group Occupancy Horizontal Bars + Weekly Attendance Trend Line */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <BarChart
          title={t(locale, "ui3.groupOccupancyTitle")}
          data={occupancyData}
          xKey="group"
          layout="horizontal"
          valueType="percent"
          locale={locale}
          series={[
            { key: "fillPercent", label: t(locale, "ui3.groupOccupancyTitle"), color: "var(--chart-1)" },
          ]}
        />
        <AreaLineChart
          title={t(locale, "ui3.weeklyAttendanceTitle")}
          data={data.weeklyAttendanceTrend}
          xKey="week"
          variant="line"
          valueType="percent"
          locale={locale}
          series={[
            { key: "rate", label: t(locale, "ui3.kpiAttendanceRate"), color: "var(--chart-2)" },
          ]}
        />
      </div>

      {/* Row 3: At-Risk Students Table + Subscription Usage & Pending Manual Refunds */}
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
                    <TableHead className="text-right">{t(locale, "ui3.kpiAttendanceRate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.atRiskStudents.map((st) => (
                    <TableRow key={st.studentMembershipId}>
                      <TableCell>
                        <Link
                          href={`/center/students/${st.studentMembershipId}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {st.fullName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {st.groups.join(", ") || "—"}
                      </TableCell>
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
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t(locale, "ui3.subscriptionLimitsTitle")}</CardTitle>
              {data.subscriptionUsage.subscription && (
                <Badge variant={data.subscriptionUsage.subscription.isTrial ? "info" : "success"}>
                  {data.subscriptionUsage.subscription.planName}
                </Badge>
              )}
            </div>
            {data.subscriptionUsage.subscription?.expiresAt && (
              <CardDescription className="tabular-nums">
                {t(locale, "subscription.activeUntil")}:{" "}
                {formatDateLocalized(data.subscriptionUsage.subscription.expiresAt, locale)}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {data.subscriptionUsage.limits.map((lim) => (
              <ProgressBar
                key={lim.resource}
                label={lim.label}
                value={lim.current}
                max={Math.max(1, lim.max)}
                valueLabel={`${lim.current} / ${lim.max} (${lim.percent}%)`}
                tone={lim.isReached ? "destructive" : lim.isWarning ? "warning" : "primary"}
              />
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Upcoming Schedule + Pending Manual Online Refunds */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t(locale, "ui3.upcomingLessonsTitle")}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/schedule">{t(locale, "dashboard.viewSchedule")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {data.upcomingSchedule.length === 0 ? (
              <EmptyState title={t(locale, "dashboard.setupSchedulePrompt")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "schedule.day")}</TableHead>
                    <TableHead>{t(locale, "nav.groups")}</TableHead>
                    <TableHead>{t(locale, "schedule.teacher")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcomingSchedule.map((slot) => (
                    <TableRow key={slot.id}>
                      <TableCell className="text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
                        {dayNames[slot.dayOfWeek] || ""} {slot.startTime}–{slot.endTime}
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{slot.courseTitle}</div>
                        <div className="text-xs text-muted-foreground">
                          {slot.groupName}
                          {slot.roomName ? ` · ${slot.roomName}` : ""}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {slot.teacherName}
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
            <CardTitle>{t(locale, "ui3.manualRefundsTitle")}</CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link href="/center/finance?tab=online">{t(locale, "ui3.manualRefundsAction")}</Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {data.pendingManualRefunds.length === 0 ? (
              <EmptyState title={t(locale, "ui3.manualRefundsEmpty")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "nav.students")}</TableHead>
                    <TableHead className="text-right">{t(locale, "payments.amount")}</TableHead>
                    <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.pendingManualRefunds.map((rf) => (
                    <TableRow key={rf.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{rf.studentName}</div>
                        <div className="text-xs text-muted-foreground tabular-nums">
                          Click · {rf.receiptNumber ? `${rf.receiptNumber} · ` : ""}
                          {formatDateLocalized(rf.createdAt, locale)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-destructive tabular-nums">
                        {formatUzs(rf.refundedAmount || rf.amount, { locale })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href="/center/finance?tab=online">{t(locale, "ui3.manualRefundsAction")}</Link>
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
    </div>
  );
}
