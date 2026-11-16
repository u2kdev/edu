"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { t } from "@/i18n";
import { formatUzs } from "@/lib/money";
import type {
  AnalyticsPeriodPreset,
  CenterFinanceAnalyticsDTO,
} from "@/lib/finance-analytics";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { CHART_COLORS, getChartColor } from "@/components/charts/chart-theme";
import { PeriodSwitcher } from "@/components/dashboard/PeriodSwitcher";

export interface CenterFinanceAnalyticsProps {
  initialData: CenterFinanceAnalyticsDTO;
  locale: string;
  canExport?: boolean;
}

interface BreakdownTableRow {
  label: string;
  secondary?: string;
  amount: number;
  percent?: number;
}

function BreakdownTable({
  rows,
  locale,
  amountLabel,
  showPercent = true,
  emptyTitle,
}: {
  rows: BreakdownTableRow[];
  locale: string;
  amountLabel?: string;
  showPercent?: boolean;
  emptyTitle: string;
}) {
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} locale={locale} className="py-6" />;
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t(locale, "charts.category")}</TableHead>
          <TableHead className="text-right">{amountLabel ?? t(locale, "payments.amount")}</TableHead>
          {showPercent && <TableHead className="text-right">{t(locale, "ui3.sharePercent")}</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, idx) => (
          <TableRow key={`${row.label}-${idx}`}>
            <TableCell>
              <div className="font-medium text-foreground">{row.label}</div>
              {row.secondary && (
                <div className="text-xs text-muted-foreground">{row.secondary}</div>
              )}
            </TableCell>
            <TableCell className="text-right font-medium text-foreground tabular-nums">
              {formatUzs(row.amount, { locale })}
            </TableCell>
            {showPercent && (
              <TableCell className="text-right text-muted-foreground tabular-nums">
                {row.percent !== undefined ? `${row.percent}%` : "—"}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function CenterFinanceAnalytics({
  initialData,
  locale,
  canExport = true,
}: CenterFinanceAnalyticsProps) {
  const [globalPeriod, setGlobalPeriod] = React.useState<AnalyticsPeriodPreset>(initialData.period);
  const [globalData, setGlobalData] = React.useState<CenterFinanceAnalyticsDTO>(initialData);
  const [chartPeriods, setChartPeriods] = React.useState<Record<string, AnalyticsPeriodPreset>>({});
  const [chartSnapshots, setChartSnapshots] = React.useState<Record<string, CenterFinanceAnalyticsDTO>>({});
  const [loadingMap, setLoadingMap] = React.useState<Record<string, boolean>>({});
  const [revenueDimension, setRevenueDimension] = React.useState<"courses" | "groups">("courses");

  React.useEffect(() => {
    setGlobalData(initialData);
    setGlobalPeriod(initialData.period);
    setChartPeriods({});
    setChartSnapshots({});
  }, [initialData]);

  const fetchSnapshot = async (targetPeriod: AnalyticsPeriodPreset): Promise<CenterFinanceAnalyticsDTO | null> => {
    const res = await fetch(`/api/finance/analytics?period=${targetPeriod}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.analytics ?? null;
  };

  const handleGlobalPeriodChange = async (nextPeriod: AnalyticsPeriodPreset) => {
    setGlobalPeriod(nextPeriod);
    setLoadingMap((m) => ({ ...m, global: true }));
    try {
      const snap = await fetchSnapshot(nextPeriod);
      if (snap) {
        setGlobalData(snap);
        setChartPeriods({});
        setChartSnapshots({});
      }
    } finally {
      setLoadingMap((m) => ({ ...m, global: false }));
    }
  };

  const handleChartPeriodChange = async (chartId: string, nextPeriod: AnalyticsPeriodPreset) => {
    setChartPeriods((prev) => ({ ...prev, [chartId]: nextPeriod }));
    setLoadingMap((m) => ({ ...m, [chartId]: true }));
    try {
      const snap = await fetchSnapshot(nextPeriod);
      if (snap) {
        setChartSnapshots((prev) => ({ ...prev, [chartId]: snap }));
      }
    } finally {
      setLoadingMap((m) => ({ ...m, [chartId]: false }));
    }
  };

  const snapFor = (chartId: string) => chartSnapshots[chartId] ?? globalData;
  const periodFor = (chartId: string) => chartPeriods[chartId] ?? globalPeriod;
  const isChartLoading = (chartId: string) => Boolean(loadingMap[chartId] || loadingMap.global);

  const exportCsvUrl = (snap: CenterFinanceAnalyticsDTO) =>
    `/api/finance/export?format=csv&startDate=${encodeURIComponent(snap.startDate)}&endDate=${encodeURIComponent(snap.endDate)}`;

  const renderChartActions = (chartId: string, snap: CenterFinanceAnalyticsDTO) => (
    <div className="flex flex-wrap items-center gap-1.5">
      <PeriodSwitcher
        value={periodFor(chartId)}
        onChange={(p) => void handleChartPeriodChange(chartId, p)}
        locale={locale}
        disabled={isChartLoading(chartId)}
      />
      {canExport && (
        <Button asChild variant="outline" size="sm" title={t(locale, "ui3.exportCsv")}>
          <a href={exportCsvUrl(snap)} download aria-label={t(locale, "ui3.exportCsv")}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>CSV</span>
          </a>
        </Button>
      )}
    </div>
  );

  // Payment methods dataset
  const pmSnap = snapFor("paymentMethods");
  const methodLabels: Record<string, string> = {
    CASH: t(locale, "ui3.methodCash"),
    TRANSFER: t(locale, "ui3.methodTransfer"),
    CLICK: t(locale, "ui3.methodClick"),
    TERMINAL: t(locale, "ui3.methodTerminal"),
  };
  const pmDonut = pmSnap.paymentMethods.map((m, idx) => ({
    name: methodLabels[m.method] ?? m.method,
    value: m.amount,
    color: getChartColor(idx),
  }));
  const pmTableRows: BreakdownTableRow[] = pmSnap.paymentMethods.map((m) => ({
    label: methodLabels[m.method] ?? m.method,
    secondary: `${m.count} ${t(locale, "payments.paid").toLowerCase()}`,
    amount: m.amount,
    percent: m.percent,
  }));

  // Expense categories dataset
  const expSnap = snapFor("expenseCategories");
  const expDonut = expSnap.expenseCategories.map((c, idx) => ({
    name: c.categoryName,
    value: c.amount,
    color: getChartColor(idx),
  }));
  const expTableRows: BreakdownTableRow[] = expSnap.expenseCategories.map((c) => ({
    label: c.categoryName,
    amount: c.amount,
    percent: c.percent,
  }));

  // Monthly cashflow dataset
  const moSnap = snapFor("monthly");
  const totalMoIncome = moSnap.monthlySeries.reduce((s, r) => s + r.income, 0);
  const monthlyNonEmpty = moSnap.monthlySeries.some((m) => m.income > 0 || m.expense > 0);
  const monthlyChartData = monthlyNonEmpty
    ? moSnap.monthlySeries.map((m) => ({
        month: m.month,
        income: m.income,
        expense: m.expense,
      }))
    : [];

  // Revenue by course or group
  const cgSnap = snapFor("courseGroup");
  const activeRevList =
    revenueDimension === "courses" ? cgSnap.revenueByCourse : cgSnap.revenueByGroup;
  const revBarData = activeRevList.slice(0, 10).map((item) => ({
    name: item.name,
    amount: item.amount,
  }));

  // Debt aging stacked dataset
  const debtSnap = snapFor("debtAging");
  const hasDebt = debtSnap.debtAging.some((d) => d.amount > 0);
  const debtStackedData = hasDebt
    ? [
        {
          bucket: t(locale, "ui3.kpiDebt"),
          b0: debtSnap.debtAging.find((d) => d.bucket === "0-30")?.amount ?? 0,
          b31: debtSnap.debtAging.find((d) => d.bucket === "31-60")?.amount ?? 0,
          b61: debtSnap.debtAging.find((d) => d.bucket === "61+")?.amount ?? 0,
        },
      ]
    : [];

  // Teacher salaries dataset
  const salSnap = snapFor("salaries");
  const salBarData = salSnap.salariesByTeacher.slice(0, 12).map((s) => ({
    teacher: s.teacherName,
    calculatedSalary: s.calculatedSalary,
    paidSalary: s.paidSalary,
  }));

  // Account balances trajectory dataset
  const balSnap = snapFor("balances");
  const balTotal = balSnap.accountBalanceSeries.accounts.reduce(
    (sum, a) => sum + Math.max(0, a.currentBalance),
    0
  );

  const deltaTone = (delta: number, invert = false): "positive" | "negative" | "neutral" => {
    if (delta === 0) return "neutral";
    const good = invert ? delta < 0 : delta > 0;
    return good ? "positive" : "negative";
  };

  return (
    <div className="space-y-6">
      {/* Global Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodSwitcher
          value={globalPeriod}
          onChange={(p) => void handleGlobalPeriodChange(p)}
          locale={locale}
          disabled={Boolean(loadingMap.global)}
        />
        {canExport && (
          <Button asChild variant="outline" size="sm">
            <a href={exportCsvUrl(globalData)} download>
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{t(locale, "ui3.exportCsv")}</span>
            </a>
          </Button>
        )}
      </div>

      {/* 5 Finance KPIs above charts */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label={t(locale, "ui3.kpiRevenue")}
          value={formatUzs(globalData.kpis.revenue, { locale })}
          delta={{
            value: `${globalData.kpis.revenueDeltaPercent >= 0 ? "+" : ""}${globalData.kpis.revenueDeltaPercent}% ${t(locale, "ui3.vsPrevPeriod")}`,
            tone: deltaTone(globalData.kpis.revenueDeltaPercent),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiExpenses")}
          value={formatUzs(globalData.kpis.expenses, { locale })}
          delta={{
            value: `${globalData.kpis.expensesDeltaPercent >= 0 ? "+" : ""}${globalData.kpis.expensesDeltaPercent}% ${t(locale, "ui3.vsPrevPeriod")}`,
            tone: deltaTone(globalData.kpis.expensesDeltaPercent, true),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiNetProfit")}
          value={formatUzs(globalData.kpis.netProfit, { locale })}
          delta={{
            value: `${globalData.kpis.profitDeltaPercent >= 0 ? "+" : ""}${globalData.kpis.profitDeltaPercent}% ${t(locale, "ui3.vsPrevPeriod")}`,
            tone: deltaTone(globalData.kpis.profitDeltaPercent),
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiDebt")}
          value={formatUzs(globalData.kpis.totalDebt, { locale })}
          hint={t(locale, "ui3.kpiDebtorsCount", { count: globalData.kpis.debtorsCount })}
          delta={{
            value: `${globalData.kpis.debtorsCount}`,
            tone: globalData.kpis.debtorsCount > 0 ? "negative" : "positive",
          }}
        />
        <StatCard
          label={t(locale, "ui3.kpiDiscounts")}
          value={formatUzs(globalData.kpis.totalDiscounts, { locale })}
          hint={`${t(locale, "finance.totalBalance")}: ${formatUzs(globalData.kpis.totalBalance, { locale })}`}
        />
      </div>

      {/* 1. Payment Methods Donut + 2. Expense Categories Donut with Breakdown Tables */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <DonutChart
            title={t(locale, "ui3.financePaymentMethodsTitle")}
            data={pmDonut}
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("paymentMethods")}
            headerActions={renderChartActions("paymentMethods", pmSnap)}
          />
          <Card>
            <CardContent className="pt-4">
              <BreakdownTable
                rows={pmTableRows}
                locale={locale}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <DonutChart
            title={t(locale, "ui3.expenseByCategoryTitle")}
            data={expDonut}
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("expenseCategories")}
            headerActions={renderChartActions("expenseCategories", expSnap)}
          />
          <Card>
            <CardContent className="pt-4">
              <BreakdownTable
                rows={expTableRows}
                locale={locale}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. Monthly Income & Expenses Area Chart + Table */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <AreaLineChart
            title={t(locale, "ui3.monthlyCashflowTitle")}
            data={monthlyChartData}
            xKey="month"
            variant="area"
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("monthly")}
            headerActions={renderChartActions("monthly", moSnap)}
            series={[
              { key: "income", label: t(locale, "finance.income"), color: "var(--success)" },
              { key: "expense", label: t(locale, "finance.expense"), color: "var(--destructive)" },
            ]}
          />
          {monthlyNonEmpty && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t(locale, "charts.period")}</TableHead>
                  <TableHead className="text-right">{t(locale, "finance.income")}</TableHead>
                  <TableHead className="text-right">{t(locale, "ui3.sharePercent")}</TableHead>
                  <TableHead className="text-right">{t(locale, "finance.expense")}</TableHead>
                  <TableHead className="text-right">{t(locale, "ui3.kpiNetProfit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moSnap.monthlySeries.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium text-foreground">{m.month}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUzs(m.income, { locale })}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground tabular-nums">
                      {totalMoIncome > 0 ? `${Math.round((m.income / totalMoIncome) * 1000) / 10}%` : "0%"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatUzs(m.expense, { locale })}
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatUzs(m.net, { locale })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 4. Revenue by Course / Group + 5. Debt Aging Stacked Bar */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <BarChart
            title={t(locale, "ui3.revenueByCourseGroupTitle")}
            data={revBarData}
            xKey="name"
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("courseGroup")}
            headerActions={
              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
                  <button
                    type="button"
                    aria-pressed={revenueDimension === "courses"}
                    onClick={() => setRevenueDimension("courses")}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      revenueDimension === "courses"
                        ? "bg-card text-foreground border border-border"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t(locale, "ui3.modeCourses")}
                  </button>
                  <button
                    type="button"
                    aria-pressed={revenueDimension === "groups"}
                    onClick={() => setRevenueDimension("groups")}
                    className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                      revenueDimension === "groups"
                        ? "bg-card text-foreground border border-border"
                        : "text-muted-foreground"
                    }`}
                  >
                    {t(locale, "ui3.modeGroups")}
                  </button>
                </div>
                {renderChartActions("courseGroup", cgSnap)}
              </div>
            }
            series={[{ key: "amount", label: t(locale, "ui3.kpiRevenue"), color: "var(--chart-1)" }]}
          />
          <Card>
            <CardContent className="pt-4">
              <BreakdownTable
                rows={activeRevList.map((r) => ({
                  label: r.name,
                  amount: r.amount,
                  percent: r.percent,
                }))}
                locale={locale}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <BarChart
            title={t(locale, "ui3.debtAgingTitle")}
            data={debtStackedData}
            xKey="bucket"
            stacked
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("debtAging")}
            headerActions={renderChartActions("debtAging", debtSnap)}
            series={[
              { key: "b0", label: t(locale, "finance.aging0to30"), color: "var(--chart-3)" },
              { key: "b31", label: t(locale, "finance.aging31to60"), color: "var(--warning)" },
              { key: "b61", label: t(locale, "finance.aging61plus"), color: "var(--destructive)" },
            ]}
          />
          <Card>
            <CardContent className="pt-4">
              <BreakdownTable
                rows={debtSnap.debtAging.map((d) => ({
                  label:
                    d.bucket === "0-30"
                      ? t(locale, "finance.aging0to30")
                      : d.bucket === "31-60"
                      ? t(locale, "finance.aging31to60")
                      : t(locale, "finance.aging61plus"),
                  secondary: `${d.count} ${t(locale, "payments.debtors").toLowerCase()}`,
                  amount: d.amount,
                  percent: d.percent,
                }))}
                locale={locale}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 6. Salaries by Teacher + 7. Account Balances Line Chart */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3">
          <BarChart
            title={t(locale, "ui3.salariesByTeacherTitle")}
            data={salBarData}
            xKey="teacher"
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("salaries")}
            headerActions={renderChartActions("salaries", salSnap)}
            series={[
              { key: "calculatedSalary", label: t(locale, "ui3.salaryAccrued"), color: "var(--chart-1)" },
              { key: "paidSalary", label: t(locale, "ui3.salaryPaid"), color: "var(--success)" },
            ]}
          />
          <Card>
            <CardContent className="pt-4">
              <BreakdownTable
                rows={salSnap.salariesByTeacher.map((s) => ({
                  label: s.teacherName,
                  secondary: `${s.conductedLessons} · ${formatUzs(s.unpaidSalary, { locale })} ${t(locale, "ui3.salaryUnpaid").toLowerCase()}`,
                  amount: s.calculatedSalary,
                  percent: s.percent,
                }))}
                locale={locale}
                amountLabel={t(locale, "ui3.salaryAccrued")}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <AreaLineChart
            title={t(locale, "ui3.accountBalancesLineTitle")}
            data={balSnap.accountBalanceSeries.points}
            xKey="period"
            variant="line"
            valueType="uzs"
            locale={locale}
            loading={isChartLoading("balances")}
            headerActions={renderChartActions("balances", balSnap)}
            series={balSnap.accountBalanceSeries.accounts.map((acc, idx) => ({
              key: acc.id,
              label: acc.name,
              color: CHART_COLORS[idx % CHART_COLORS.length],
            }))}
          />
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t(locale, "ui3.tableSummary")}</CardTitle>
            </CardHeader>
            <CardContent>
              <BreakdownTable
                rows={balSnap.accountBalanceSeries.accounts.map((acc) => ({
                  label: acc.name,
                  secondary: acc.type,
                  amount: acc.currentBalance,
                  percent:
                    balTotal > 0 && acc.currentBalance > 0
                      ? Math.round((acc.currentBalance / balTotal) * 1000) / 10
                      : 0,
                }))}
                locale={locale}
                amountLabel={t(locale, "finance.totalBalance")}
                emptyTitle={t(locale, "ui3.emptyPeriod")}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
