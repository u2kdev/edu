"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { t, formatDateLocalized } from "@/i18n";
import { formatUzs } from "@/lib/money";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AreaLineChart } from "@/components/charts/area-line-chart";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { getChartColor } from "@/components/charts/chart-theme";
import { PeriodSwitcher } from "@/components/dashboard/PeriodSwitcher";

interface DashboardData {
  period: string;
  finance: {
    mrr: number;
    arr: number;
    arpu: number;
    currentMonthNetRevenue: number;
    prevMonthNetRevenue: number;
    deltaPercent: number;
    monthExpenses: number;
    monthProfit: number;
    dueNext7Days: {
      amount: number;
      centersCount: number;
      items: Array<{
        centerId: string;
        centerName: string;
        slug: string;
        planName: string;
        amount: number;
        endsAt: string;
      }>;
    };
    overdueDebtors: {
      amount: number;
      centersCount: number;
      items: Array<{
        id: string;
        centerId: string;
        centerName: string;
        amount: number;
        periodEndsAt: string | null;
      }>;
    };
  };
  growth: {
    timeline: Array<{
      date: string;
      users: number;
      centers: number;
    }>;
    funnel: {
      centersCreated: number;
      trials: number;
      paid: number;
      conversionPercent: number;
    };
    churnRate: number;
  };
  numbers: {
    centers: {
      total: number;
      active: number;
      trial: number;
      paused: number;
      blocked: number;
    };
    users: {
      total: number;
      students: number;
      teachers: number;
      parents: number;
      directors: number;
      activeLast7Days: number;
      activeLast30Days: number;
    };
    topCenters: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      studentsCount: number;
    }>;
  };
  revenueMrr12Months?: Array<{
    month: string;
    label: string;
    revenue: number;
    mrr: number;
  }>;
  centersByPlan?: Array<{
    planId: string;
    planName: string;
    count: number;
    monthlyValue: number;
  }>;
  centersByStatus?: Array<{
    status: string;
    count: number;
  }>;
  deltas?: {
    revenueDeltaPercent: number;
    prevPeriodRevenue: number;
    currentPeriodRevenue: number;
    centersDeltaPercent: number;
    prevPeriodCenters: number;
    currentPeriodCenters: number;
    usersDeltaPercent: number;
    prevPeriodUsers: number;
    currentPeriodUsers: number;
  };
  attentionItems: Array<{
    id: string;
    level: "CRITICAL" | "WARNING" | "INFO";
    title: string;
    description: string;
    actionUrl: string;
    actionLabel: string;
  }>;
  events: Array<{
    id: string;
    action: string;
    resource: string;
    resourceId: string | null;
    actorName: string;
    centerName: string | null;
    ipAddress: string | null;
    createdAt: string;
  }>;
  health: {
    dbStatus: string;
    dbPingMs: number;
    uptimeSeconds: number;
    memoryMb: number;
    environment: string;
    isEmailConfigured: boolean;
    emailProvider: string;
    queue: {
      pending: number;
      failed: number;
      sent: number;
    };
  };
}

const STATUS_BADGE_VARIANT: Record<string, "success" | "info" | "warning" | "destructive" | "neutral"> = {
  ACTIVE: "success",
  TRIAL: "info",
  PAUSED: "warning",
  OVERDUE: "warning",
  BLOCKED: "destructive",
  CANCELLED: "neutral",
};

export default function PlatformDashboardInteractive({
  locale = "ru",
}: {
  locale?: string;
}) {
  const [period, setPeriod] = useState<"7d" | "30d" | "90d" | "12m">("30d");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const apiPeriod = period === "12m" ? "year" : period;
      const res = await fetch(`/api/platform/dashboard?period=${apiPeriod}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.error || t(locale, "ui3.emptyPeriod"));
      }
    } catch {
      setError(t(locale, "common.error"));
    } finally {
      setLoading(false);
    }
  }, [locale, period]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const statusLabel = (st: string) => {
    const keyMap: Record<string, string> = {
      ACTIVE: "platform.active",
      TRIAL: "platform.trial",
      PAUSED: "platform.paused",
      OVERDUE: "platform.overdue",
      BLOCKED: "platform.blocked",
      CANCELLED: "platform.cancelled",
    };
    return keyMap[st] ? t(locale, keyMap[st]) : st;
  };

  const revMrrData =
    data?.revenueMrr12Months?.map((m) => ({
      month: m.label,
      revenue: m.revenue,
      mrr: m.mrr,
    })) ?? [];

  const plansDonut =
    data?.centersByPlan?.map((p, idx) => ({
      name: p.planName,
      value: p.count,
      color: getChartColor(idx),
    })) ?? [];

  const regTimelineData =
    data?.growth.timeline.slice(-31).map((d) => ({
      date: d.date.slice(5),
      users: d.users,
      centers: d.centers,
    })) ?? [];

  const funnelData = data
    ? [
        { stage: t(locale, "ui3.platformFunnelRegistered"), count: data.growth.funnel.centersCreated },
        { stage: t(locale, "ui3.platformFunnelTrial"), count: data.growth.funnel.trials },
        { stage: t(locale, "ui3.platformFunnelPaid"), count: data.growth.funnel.paid },
      ]
    : [];

  const statusDonut =
    data?.centersByStatus?.map((s, idx) => ({
      name: statusLabel(s.status),
      value: s.count,
      color: getChartColor(idx),
    })) ?? [];

  const deltaTone = (pct: number): "positive" | "negative" | "neutral" =>
    pct > 0 ? "positive" : pct < 0 ? "negative" : "neutral";

  const revDelta = data?.deltas?.revenueDeltaPercent ?? data?.finance.deltaPercent ?? 0;
  const usersDelta = data?.deltas?.usersDeltaPercent ?? 0;
  const centersDelta = data?.deltas?.centersDeltaPercent ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "ui3.platformOverviewTitle")}
        description={t(locale, "ui3.platformOverviewSubtitle")}
        bordered
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodSwitcher value={period} onChange={setPeriod} locale={locale} disabled={loading} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchDashboard()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              <span>{t(locale, "ui3.refresh")}</span>
            </Button>
          </div>
        }
      />

      {error && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive-subtle px-4 py-3 text-sm text-destructive-subtle-foreground"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Row of 5 KPI StatCards */}
      {loading && !data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-7 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label={t(locale, "ui3.platformRevenuePeriod")}
            value={formatUzs(data.deltas?.currentPeriodRevenue ?? data.finance.currentMonthNetRevenue, { locale })}
            delta={{
              value: `${revDelta >= 0 ? "+" : ""}${revDelta}% ${t(locale, "ui3.vsPrevPeriod")}`,
              tone: deltaTone(revDelta),
            }}
            hint={`${t(locale, "ui3.kpiNetProfit")}: ${formatUzs(data.finance.monthProfit, { locale })}`}
          />
          <StatCard
            label={t(locale, "ui3.platformMrr")}
            value={formatUzs(data.finance.mrr, { locale })}
            hint={t(locale, "ui3.platformArrHint", { arr: formatUzs(data.finance.arr, { locale }) })}
            delta={{
              value: `${data.finance.deltaPercent >= 0 ? "+" : ""}${data.finance.deltaPercent}%`,
              tone: deltaTone(data.finance.deltaPercent),
            }}
          />
          <StatCard
            label={t(locale, "ui3.platformActiveCenters")}
            value={data.numbers.centers.active}
            hint={t(locale, "ui3.platformTotalCentersHint", {
              total: data.numbers.centers.total,
              trial: data.numbers.centers.trial,
            })}
            delta={{
              value: `${centersDelta >= 0 ? "+" : ""}${centersDelta}%`,
              tone: deltaTone(centersDelta),
            }}
          />
          <StatCard
            label={t(locale, "ui3.platformRegistrations")}
            value={data.deltas?.currentPeriodUsers ?? data.numbers.users.total}
            hint={t(locale, "ui3.platformNewCentersHint", {
              count: data.deltas?.currentPeriodCenters ?? data.growth.funnel.centersCreated,
            })}
            delta={{
              value: `${usersDelta >= 0 ? "+" : ""}${usersDelta}%`,
              tone: deltaTone(usersDelta),
            }}
          />
          <StatCard
            label={t(locale, "ui3.platformDue7Days")}
            value={formatUzs(data.finance.dueNext7Days.amount, { locale })}
            hint={t(locale, "ui3.platformDueCentersHint", {
              count: data.finance.dueNext7Days.centersCount,
              arpu: formatUzs(data.finance.arpu, { locale }),
            })}
          />
        </div>
      ) : null}

      {/* Attention Table (1 action per row) */}
      {data && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>{t(locale, "ui3.attentionTitle")}</CardTitle>
            <Badge variant={data.attentionItems.length > 0 ? "warning" : "success"}>
              {data.attentionItems.length}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0">
            {data.attentionItems.length === 0 ? (
              <EmptyState title={t(locale, "ui3.attentionEmpty")} locale={locale} className="py-6" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t(locale, "common.status")}</TableHead>
                    <TableHead>{t(locale, "ui3.attentionTitle")}</TableHead>
                    <TableHead className="text-right">{t(locale, "ui3.attentionAction")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.attentionItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <Badge
                          variant={
                            item.level === "CRITICAL"
                              ? "destructive"
                              : item.level === "WARNING"
                              ? "warning"
                              : "info"
                          }
                        >
                          {item.level}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{item.title}</div>
                        <div className="text-xs text-muted-foreground">{item.description}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={item.actionUrl}>{item.actionLabel}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Charts Grid Row 1: Revenue & MRR Line (12m) + Centers by Plan Donut */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <AreaLineChart
          title={t(locale, "ui3.platformRevMrrChartTitle")}
          data={revMrrData}
          xKey="month"
          variant="line"
          valueType="uzs"
          locale={locale}
          loading={loading}
          className="xl:col-span-2"
          series={[
            { key: "revenue", label: t(locale, "ui3.platformRevSeries"), color: "var(--chart-1)" },
            { key: "mrr", label: t(locale, "ui3.platformMrrSeries"), color: "var(--chart-2)" },
          ]}
        />
        <DonutChart
          title={t(locale, "ui3.platformPlansDonutTitle")}
          data={plansDonut}
          valueType="number"
          locale={locale}
          loading={loading}
          centerLabel={t(locale, "platform.plans")}
        />
      </div>

      {/* Charts Grid Row 2: Daily Registrations Bar + Conversion Funnel Horizontal Bar + Centers Status Donut */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <BarChart
          title={t(locale, "ui3.platformRegBarsTitle")}
          data={regTimelineData}
          xKey="date"
          valueType="number"
          locale={locale}
          loading={loading}
          series={[
            { key: "users", label: t(locale, "ui3.platformUsersSeries"), color: "var(--chart-1)" },
            { key: "centers", label: t(locale, "ui3.platformCentersSeries"), color: "var(--chart-2)" },
          ]}
        />
        <BarChart
          title={t(locale, "ui3.platformFunnelTitle")}
          subtitle={
            data
              ? `${data.growth.funnel.conversionPercent}% · Churn: ${data.growth.churnRate}%`
              : undefined
          }
          data={funnelData}
          xKey="stage"
          layout="horizontal"
          valueType="number"
          locale={locale}
          loading={loading}
          series={[{ key: "count", label: t(locale, "ui3.platformCentersSeries"), color: "var(--chart-1)" }]}
        />
        <DonutChart
          title={t(locale, "ui3.platformStatusChartTitle")}
          data={statusDonut}
          valueType="number"
          locale={locale}
          loading={loading}
        />
      </div>

      {/* Bottom: Audit Events Feed + System Health */}
      {data && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>{t(locale, "ui3.platformRecentEvents")}</CardTitle>
              <Button asChild variant="outline" size="sm">
                <Link href="/platform-admin/audit">{t(locale, "platform.auditLog")}</Link>
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {data.events.length === 0 ? (
                <EmptyState title={t(locale, "ui3.emptyPeriod")} locale={locale} className="py-6" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t(locale, "common.actions")}</TableHead>
                      <TableHead>{t(locale, "nav.platformCenters")}</TableHead>
                      <TableHead className="text-right">{t(locale, "common.date")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.events.slice(0, 8).map((ev) => (
                      <TableRow key={ev.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{ev.action}</div>
                          <div className="text-xs text-muted-foreground">
                            {ev.actorName} · {ev.resource}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {ev.centerName || "—"}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                          {formatDateLocalized(ev.createdAt, locale)}
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
              <CardTitle>{t(locale, "ui3.platformHealthTitle")}</CardTitle>
              <Badge variant={STATUS_BADGE_VARIANT[data.health.dbStatus === "HEALTHY" ? "ACTIVE" : "PAUSED"]}>
                {data.health.dbStatus}
              </Badge>
            </CardHeader>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">{t(locale, "ui3.platformHealthDb")}</span>
                <span className="font-medium text-foreground tabular-nums">{data.health.dbPingMs} ms</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-2 text-sm">
                <span className="text-muted-foreground">{t(locale, "ui3.platformHealthMail")}</span>
                <span className="font-medium text-foreground tabular-nums">
                  {data.health.queue.sent} / {data.health.queue.pending} / {data.health.queue.failed}
                </span>
              </div>
              <div className="flex items-center justify-between pb-1 text-sm">
                <span className="text-muted-foreground">RAM</span>
                <span className="font-medium text-foreground tabular-nums">{data.health.memoryMb} MB</span>
              </div>
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href="/platform-admin/system-health">{t(locale, "nav.systemHealth")}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
