"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, CreditCard, ExternalLink } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormField,
  PageHeader,
} from "@/components/ui";
import { t } from "@/i18n";

interface SubscriptionItem {
  id: string;
  status: string;
  trialEndsAt?: string | null;
  currentPeriodStartsAt: string;
  currentPeriodEndsAt: string;
  autoRenew: boolean;
  center: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
  };
}

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  ACTIVE: "success",
  TRIAL: "info",
  PAST_DUE: "destructive",
  FROZEN: "warning",
  CANCELLED: "neutral",
};

export default function PlatformSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [expiringInDays, setExpiringInDays] = useState("");
  const [debtorsOnly, setDebtorsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [extendSub, setExtendSub] = useState<SubscriptionItem | null>(null);
  const [extendMonths, setExtendMonths] = useState(1);
  const [extending, setExtending] = useState(false);
  const [extendError, setExtendError] = useState<string | null>(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        ...(search && { search }),
        ...(status && { status }),
        ...(expiringInDays && { expiringInDays }),
        ...(debtorsOnly && { debtors: "true" }),
      });
      const res = await fetch(`/api/platform/subscriptions?${query}`);
      if (!res.ok) throw new Error("Не удалось загрузить подписки");
      const json = await res.json();
      setSubscriptions(json.subscriptions || []);
      setTotalPages(json.pagination?.totalPages || json.meta?.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки подписок");
    } finally {
      setLoading(false);
    }
  }, [page, search, status, expiringInDays, debtorsOnly]);

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleQuickExtend = async () => {
    if (!extendSub) return;
    setExtending(true);
    setExtendError(null);
    try {
      const res = await fetch(`/api/platform/subscriptions/${extendSub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ extendMonths, status: "ACTIVE" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setExtendError(data.error || "Ошибка продления");
      } else {
        setExtendSub(null);
        fetchSubscriptions();
      }
    } catch {
      setExtendError("Ошибка сети при продлении");
    } finally {
      setExtending(false);
    }
  };

  const columns: DataTableColumn<SubscriptionItem>[] = [
    {
      id: "center",
      header: "Учебный центр",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (s) => s.center.name,
      cell: (sub) => (
        <div>
          <Link
            href={`/platform-admin/centers/${sub.center.id}`}
            className="font-medium text-foreground hover:text-primary transition-colors block"
          >
            {sub.center.name}
          </Link>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{sub.center.slug}</div>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Тариф",
      sortable: true,
      sortValue: (s) => s.plan.priceMonthly,
      cell: (sub) => (
        <div>
          <div className="font-medium text-foreground">{sub.plan.name}</div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {sub.plan.priceMonthly.toLocaleString()} UZS/мес
          </div>
        </div>
      ),
    },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      sortValue: (s) => s.status,
      cell: (sub) => (
        <Badge variant={STATUS_VARIANTS[sub.status] || "neutral"}>{sub.status}</Badge>
      ),
    },
    {
      id: "period",
      header: "Период действия",
      sortable: true,
      sortValue: (s) => s.currentPeriodEndsAt,
      cell: (sub) => {
        const isExpired = new Date(sub.currentPeriodEndsAt) < new Date();
        return (
          <div className="text-xs tabular-nums">
            <div className={isExpired ? "font-semibold text-destructive" : "text-foreground"}>
              До: {new Date(sub.currentPeriodEndsAt).toLocaleDateString()}
              {isExpired && " (Истекла)"}
            </div>
            <div className="mt-0.5 text-muted-foreground">
              С: {new Date(sub.currentPeriodStartsAt).toLocaleDateString()}
            </div>
          </div>
        );
      },
    },
    {
      id: "autoRenew",
      header: "Автопродление",
      hideOnMobile: true,
      cell: (sub) =>
        sub.autoRenew ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            Включено
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Отключено</span>
        ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (sub) => (
        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setExtendSub(sub);
              setExtendMonths(1);
              setExtendError(null);
            }}
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Продлить</span>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={`/platform-admin/finance/payments?centerId=${sub.center.id}&planId=${sub.plan.id}`}>
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Записать оплату</span>
            </Link>
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label={sub.center.name}>
            <Link href={`/platform-admin/centers/${sub.center.id}`}>
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || status || expiringInDays || debtorsOnly);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Подписки учебных центров"
        description="Контроль действующих тарифных планов, сроков оплаты и задолженностей"
        actions={
          <>
            <Button asChild variant="primary" size="sm">
              <Link href="/platform-admin/finance/payments">
                <CreditCard className="h-4 w-4" aria-hidden="true" />
                <span>Платежи центров</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform-admin/plans">Тарифы</Link>
            </Button>
          </>
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Поиск по центру..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setStatus("");
          setExpiringInDays("");
          setDebtorsOnly(false);
          setPage(1);
        }}
      >
        <select
          aria-label="Статус подписки"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все статусы</option>
          <option value="ACTIVE">ACTIVE (Активные)</option>
          <option value="TRIAL">TRIAL (Пробный)</option>
          <option value="PAST_DUE">PAST_DUE (Просрочена)</option>
          <option value="FROZEN">FROZEN (Заморожена)</option>
          <option value="CANCELLED">CANCELLED (Отменена)</option>
        </select>

        <select
          aria-label="Срок окончания"
          value={expiringInDays}
          onChange={(e) => {
            setExpiringInDays(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Срок окончания: любой</option>
          <option value="3">Истекают через 3 дня</option>
          <option value="7">Истекают через 7 дней</option>
          <option value="14">Истекают через 14 дней</option>
          <option value="30">Истекают через 30 дней</option>
        </select>

        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-xs font-medium text-foreground">
          <input
            type="checkbox"
            checked={debtorsOnly}
            onChange={(e) => {
              setDebtorsOnly(e.target.checked);
              setPage(1);
            }}
            className="rounded border-input accent-primary"
          />
          <span>Только должники</span>
        </label>
      </FilterBar>

      <DataTable
        data={subscriptions}
        columns={columns}
        getRowId={(s) => s.id}
        loading={loading}
        loadingLabel="Загрузка подписок..."
        error={error}
        onRetry={fetchSubscriptions}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyTitle="Подписки не найдены"
        emptyDescription={t("ru", "ui4.emptySubscriptionsDesc")}
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatus("");
                setExpiringInDays("");
                setDebtorsOnly(false);
                setPage(1);
              }}
            >
              {t("ru", "ui4.resetFilters")}
            </Button>
          ) : undefined
        }
      />

      <Dialog open={Boolean(extendSub)} onOpenChange={(next) => !next && setExtendSub(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Продлить подписку: {extendSub?.center.name}</DialogTitle>
            {extendSub && (
              <DialogDescription>
                Текущий тариф: <strong>{extendSub.plan.name}</strong>. Действует до{" "}
                <strong>{new Date(extendSub.currentPeriodEndsAt).toLocaleDateString()}</strong>.
              </DialogDescription>
            )}
          </DialogHeader>

          {extendError && (
            <Alert variant="destructive">
              <AlertDescription>{extendError}</AlertDescription>
            </Alert>
          )}

          <FormField label="Количество месяцев для продления" htmlFor="extend-months">
            <select
              id="extend-months"
              value={extendMonths}
              onChange={(e) => setExtendMonths(parseInt(e.target.value, 10))}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value={1}>1 месяц</option>
              <option value={3}>3 месяца (квартал)</option>
              <option value={6}>6 месяцев (полгода)</option>
              <option value={12}>12 месяцев (год)</option>
            </select>
          </FormField>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setExtendSub(null)}>
              Отмена
            </Button>
            <Button type="button" variant="primary" onClick={handleQuickExtend} disabled={extending}>
              {extending ? "Продление..." : "Подтвердить продление"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
