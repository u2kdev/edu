"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DataTable,
  type DataTableColumn,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from "@/components/ui";
import { BarChart } from "@/components/charts";
import { formatUzs } from "@/lib/money";

interface FinanceStats {
  mrr: number;
  arr: number;
  arpu: number;
  activeSubscriptionsCount: number;
  forecast30Days: number;
  churnRate: number;
  periods: {
    month: { revenue: number; expenses: number; profit: number };
    quarter: { revenue: number; expenses: number; profit: number };
    year: { revenue: number; expenses: number; profit: number };
  };
  revenueByPlan: {
    planId: string;
    planName: string;
    priceMonthly: number;
    activeSubscriptions: number;
    totalRevenue: number;
  }[];
  revenueByCenter: {
    centerId: string;
    centerName: string;
    status: string;
    paymentsCount: number;
    totalRevenue: number;
  }[];
  debtors: {
    subscriptionId: string;
    centerId: string;
    centerName: string;
    centerPhone: string | null;
    centerEmail: string | null;
    centerStatus: string;
    planName: string;
    dueAmount: number;
    currentPeriodEndsAt: string;
    daysOverdue: number;
  }[];
  monthlyHistory: {
    month: string;
    revenue: number;
    expenses: number;
  }[];
}

export default function PlatformFinancePage() {
  const [stats, setStats] = useState<FinanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStats() {
      setLoading(true);
      try {
        const res = await fetch("/api/platform/finance/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.stats);
        } else {
          setError(data.error || "Не удалось загрузить финансовые данные");
        }
      } catch {
        setError("Ошибка связи с сервером");
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "Ошибка загрузки"}</AlertDescription>
      </Alert>
    );
  }

  const planColumns: DataTableColumn<FinanceStats["revenueByPlan"][number]>[] = [
    {
      id: "plan",
      header: "Тариф",
      isMobilePrimary: true,
      cell: (p) => <span className="font-medium text-foreground">{p.planName}</span>,
    },
    {
      id: "active",
      header: "Активных",
      align: "center",
      cell: (p) => <span className="tabular-nums text-muted-foreground">{p.activeSubscriptions}</span>,
    },
    {
      id: "revenue",
      header: "Выручка",
      align: "right",
      cell: (p) => (
        <span className="font-semibold tabular-nums text-foreground">
          {p.totalRevenue.toLocaleString()} UZS
        </span>
      ),
    },
  ];

  const centerColumns: DataTableColumn<FinanceStats["revenueByCenter"][number]>[] = [
    {
      id: "center",
      header: "Центр",
      isMobilePrimary: true,
      cell: (c) => (
        <Link
          href={`/platform-admin/centers/${c.centerId}`}
          className="font-medium text-foreground hover:text-primary"
        >
          {c.centerName}
        </Link>
      ),
    },
    {
      id: "payments",
      header: "Платежей",
      align: "center",
      cell: (c) => <span className="tabular-nums text-muted-foreground">{c.paymentsCount}</span>,
    },
    {
      id: "revenue",
      header: "Сумма",
      align: "right",
      cell: (c) => (
        <span className="font-semibold tabular-nums text-foreground">
          {c.totalRevenue.toLocaleString()} UZS
        </span>
      ),
    },
  ];

  const debtorColumns: DataTableColumn<FinanceStats["debtors"][number]>[] = [
    {
      id: "center",
      header: "Учебный центр",
      isMobilePrimary: true,
      cell: (d) => (
        <div>
          <Link
            href={`/platform-admin/centers/${d.centerId}`}
            className="font-medium text-foreground hover:text-primary"
          >
            {d.centerName}
          </Link>
          <div className="text-xs text-destructive">Статус: {d.centerStatus}</div>
        </div>
      ),
    },
    {
      id: "contacts",
      header: "Контакты",
      cell: (d) => (
        <div className="text-xs">
          <div className="text-foreground tabular-nums">{d.centerPhone || "—"}</div>
          {d.centerEmail && <div className="text-muted-foreground">{d.centerEmail}</div>}
        </div>
      ),
    },
    {
      id: "plan",
      header: "Тариф",
      cell: (d) => <span className="text-foreground">{d.planName}</span>,
    },
    {
      id: "overdue",
      header: "Просрочка",
      align: "center",
      cell: (d) => <Badge variant="destructive">{d.daysOverdue} дн.</Badge>,
    },
    {
      id: "dueAmount",
      header: "Сумма долга",
      align: "right",
      cell: (d) => (
        <span className="font-semibold tabular-nums text-foreground">
          {d.dueAmount.toLocaleString()} UZS
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (d) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/platform-admin/finance/payments?centerId=${d.centerId}`}>
            Записать оплату
          </Link>
        </Button>
      ),
    },
  ];

  const periodCards = [
    { title: "Текущий месяц", data: stats.periods.month },
    { title: "Текущий квартал", data: stats.periods.quarter },
    { title: "Текущий год", data: stats.periods.year },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Финансы платформы"
        description="Аналитика выручки, расходов, подписок и задолженностей"
        actions={
          <Button asChild variant="outline" size="sm">
            <a href="/api/platform/finance/stats/export" download>
              <Download className="h-4 w-4" aria-hidden="true" />
              <span>Экспорт отчёта (CSV)</span>
            </a>
          </Button>
        }
      />

      <div className="flex items-center gap-2 border-b border-border pb-2 text-sm">
        <Link
          href="/platform-admin/finance"
          className="border-b-2 border-primary px-3 py-1.5 font-medium text-primary"
        >
          Обзор и отчёты
        </Link>
        <Link
          href="/platform-admin/finance/payments"
          className="px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Платежи центров
        </Link>
        <Link
          href="/platform-admin/finance/expenses"
          className="px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Расходы платформы
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="MRR (Выручка/мес)"
          value={formatUzs(stats.mrr, { locale: "ru" })}
          hint={`ARR: ${stats.arr.toLocaleString()} UZS/год`}
        />
        <StatCard
          label="ARPU (Средний чек)"
          value={formatUzs(stats.arpu, { locale: "ru" })}
          hint={`Активных центров: ${stats.activeSubscriptionsCount}`}
        />
        <StatCard
          label="Прогноз на 30 дней"
          value={formatUzs(stats.forecast30Days, { locale: "ru" })}
          hint="Ожидаемые продления подписок"
        />
        <StatCard
          label="Churn Rate (Отток)"
          value={`${stats.churnRate}%`}
          hint="Отток за последние 30 дней"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {periodCards.map((p) => (
          <Card key={p.title}>
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base font-semibold">{p.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Выручка (нетто):</span>
                <span className="font-medium tabular-nums text-success">
                  +{p.data.revenue.toLocaleString()} UZS
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Расходы платформы:</span>
                <span className="font-medium tabular-nums text-destructive">
                  -{p.data.expenses.toLocaleString()} UZS
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span className="text-foreground">Чистая прибыль:</span>
                <span className={`tabular-nums ${p.data.profit >= 0 ? "text-success" : "text-destructive"}`}>
                  {p.data.profit.toLocaleString()} UZS
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BarChart
        title="Динамика за последние 6 месяцев"
        subtitle="Выручка и операционные расходы по месяцам"
        data={stats.monthlyHistory}
        xKey="month"
        series={[
          { key: "revenue", label: "Выручка", color: "var(--chart-1)" },
          { key: "expenses", label: "Расходы", color: "var(--chart-5)" },
        ]}
        valueType="uzs"
        locale="ru"
        height={240}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Выручка по тарифам</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              data={stats.revenueByPlan}
              columns={planColumns}
              getRowId={(p) => p.planId}
              showColumnToggle={false}
              showDensityToggle={false}
              emptyTitle="Нет данных по тарифам"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Топ-10 центров по платежам</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <DataTable
              data={stats.revenueByCenter}
              columns={centerColumns}
              getRowId={(c) => c.centerId}
              showColumnToggle={false}
              showDensityToggle={false}
              emptyTitle="Нет платежей от центров"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base font-semibold">
            Дебиторская задолженность ({stats.debtors.length})
          </CardTitle>
          <span className="text-xs text-muted-foreground">Центры с истекшим сроком оплаты</span>
        </CardHeader>
        <CardContent className="pt-0">
          {stats.debtors.length === 0 ? (
            <EmptyState
              title="Задолженностей по подпискам нет"
              description="Все активные учебные центры оплатили подписку своевременно."
            />
          ) : (
            <DataTable
              data={stats.debtors}
              columns={debtorColumns}
              getRowId={(d) => d.subscriptionId}
              showColumnToggle={false}
              showDensityToggle={false}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
