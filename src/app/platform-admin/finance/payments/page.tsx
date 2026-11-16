"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Download, PlusCircle, Printer, RotateCcw } from "lucide-react";
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
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormActions,
  FormField,
  Input,
  PageHeader,
  StatCard,
  Textarea,
} from "@/components/ui";
import { t } from "@/i18n";

interface PaymentItem {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  status: string;
  paymentMethod: string;
  paymentType: string;
  paidAt: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  refundedAt: string | null;
  notes: string | null;
  receiptUrl: string | null;
  center: {
    id: string;
    name: string;
    slug: string;
    status: string;
  };
  plan: {
    id: string;
    name: string;
  } | null;
  recorder: {
    id: string;
    name: string | null;
    email: string;
  } | null;
}

interface SummaryStats {
  totalAmount: number;
  totalRefunded: number;
  netAmount: number;
  count: number;
}

const PAYMENT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  PAID: "success",
  REFUNDED: "destructive",
  PENDING: "warning",
};

export default function PlatformPaymentsPage() {
  const searchParams = useSearchParams();
  const prefillCenterId = searchParams.get("centerId") || "";
  const prefillPlanId = searchParams.get("planId") || "";

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [summary, setSummary] = useState<SummaryStats>({
    totalAmount: 0,
    totalRefunded: 0,
    netAmount: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [centerId, setCenterId] = useState(prefillCenterId);
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [centersList, setCentersList] = useState<{ id: string; name: string }[]>([]);
  const [plansList, setPlansList] = useState<{ id: string; name: string; priceMonthly: number }[]>([]);

  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordCenterId, setRecordCenterId] = useState(prefillCenterId);
  const [recordPlanId, setRecordPlanId] = useState(prefillPlanId);
  const [recordAmount, setRecordAmount] = useState<number>(0);
  const [recordMethod, setRecordMethod] = useState<"BANK_TRANSFER" | "CASH" | "ONLINE">("BANK_TRANSFER");
  const [recordNotes, setRecordNotes] = useState("");
  const [recordReceiptUrl, setRecordReceiptUrl] = useState("");
  const [recording, setRecording] = useState(false);
  const [recordError, setRecordError] = useState<string | null>(null);

  const [refundPayment, setRefundPayment] = useState<PaymentItem | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  useEffect(() => {
    async function loadMeta() {
      try {
        const [cRes, pRes] = await Promise.all([
          fetch("/api/platform/centers?limit=100"),
          fetch("/api/platform/plans"),
        ]);
        const cData = await cRes.json();
        const pData = await pRes.json();
        if (cData.centers) {
          setCentersList(cData.centers.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
        }
        if (pData.plans) {
          setPlansList(pData.plans);
        }
      } catch {}
    }
    loadMeta();
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(centerId && { centerId }),
        ...(status && { status }),
        ...(paymentMethod && { paymentMethod }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/finance/payments?${q}`);
      const data = await res.json();
      if (data.success) {
        setPayments(data.payments || []);
        setSummary(data.summary || { totalAmount: 0, totalRefunded: 0, netAmount: 0, count: 0 });
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Не удалось загрузить платежи");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [page, search, centerId, status, paymentMethod, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  useEffect(() => {
    if (prefillCenterId) {
      setIsRecordModalOpen(true);
      setRecordCenterId(prefillCenterId);
    }
  }, [prefillCenterId]);

  const handlePlanChange = (pId: string) => {
    setRecordPlanId(pId);
    const selected = plansList.find((p) => p.id === pId);
    if (selected) {
      setRecordAmount(Math.round(selected.priceMonthly));
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecordError(null);
    if (!recordCenterId) {
      setRecordError("Выберите учебный центр");
      return;
    }
    if (recordAmount <= 0) {
      setRecordError("Сумма должна быть больше 0");
      return;
    }

    setRecording(true);
    try {
      const res = await fetch("/api/platform/finance/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          centerId: recordCenterId,
          planId: recordPlanId || undefined,
          amount: Number(recordAmount),
          paymentMethod: recordMethod,
          paymentType: "SUBSCRIPTION",
          status: "PAID",
          notes: recordNotes || undefined,
          receiptUrl: recordReceiptUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRecordError(data.error || "Ошибка при записи оплаты");
      } else {
        setIsRecordModalOpen(false);
        setRecordNotes("");
        setRecordReceiptUrl("");
        fetchPayments();
      }
    } catch {
      setRecordError("Ошибка сети при отправке формы");
    } finally {
      setRecording(false);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPayment) return;
    setRefundError(null);
    if (refundAmount <= 0) {
      setRefundError("Сумма возврата должна быть больше 0");
      return;
    }
    if (refundReason.trim().length < 5) {
      setRefundError("Причина возврата обязательна (минимум 5 символов)");
      return;
    }

    setRefunding(true);
    try {
      const res = await fetch(`/api/platform/finance/payments/${refundPayment.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refundAmount: Number(refundAmount),
          reason: refundReason.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setRefundError(data.error || "Ошибка выполнения возврата");
      } else {
        setRefundPayment(null);
        setRefundReason("");
        fetchPayments();
      }
    } catch {
      setRefundError("Ошибка сети при возврате");
    } finally {
      setRefunding(false);
    }
  };

  const exportUrl = `/api/platform/finance/payments/export?${new URLSearchParams({
    ...(search && { search }),
    ...(centerId && { centerId }),
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  }).toString()}`;

  const columns: DataTableColumn<PaymentItem>[] = [
    {
      id: "invoice",
      header: "Счёт / Дата",
      sortable: true,
      sortValue: (p) => p.paidAt ?? "",
      cell: (p) => (
        <div>
          <div className="font-mono font-semibold text-foreground">
            {p.invoiceNumber || `INV-${p.id.slice(0, 8)}`}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
            {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "Не оплачен"}
          </div>
        </div>
      ),
    },
    {
      id: "center",
      header: "Учебный центр",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (p) => p.center.name,
      cell: (p) => (
        <div>
          <Link
            href={`/platform-admin/centers/${p.center.id}`}
            className="font-medium text-foreground hover:text-primary block"
          >
            {p.center.name}
          </Link>
          <div className="font-mono text-xs text-muted-foreground">{p.center.slug}</div>
        </div>
      ),
    },
    {
      id: "plan",
      header: "Тариф / Способ",
      cell: (p) => (
        <div>
          <div className="font-medium text-foreground">{p.plan?.name || "LMS Тариф"}</div>
          <div className="text-xs text-muted-foreground">{p.paymentMethod}</div>
        </div>
      ),
    },
    {
      id: "amount",
      header: "Сумма (UZS)",
      align: "right",
      sortable: true,
      sortValue: (p) => p.amount,
      cell: (p) => (
        <div className="tabular-nums">
          <div className="font-semibold text-foreground">{p.amount.toLocaleString()} UZS</div>
          {p.refundAmount ? (
            <div className="text-xs font-medium text-destructive">
              Возврат: -{p.refundAmount.toLocaleString()} UZS
            </div>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Статус",
      align: "center",
      sortable: true,
      sortValue: (p) => p.status,
      cell: (p) => (
        <Badge variant={PAYMENT_STATUS_VARIANTS[p.status] || "neutral"}>{p.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (p) => (
        <div className="inline-flex items-center justify-end gap-1.5">
          <Button asChild variant="outline" size="sm">
            <Link href={`/platform-admin/finance/payments/${p.id}/invoice`}>
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Чек</span>
            </Link>
          </Button>
          {p.status === "PAID" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setRefundPayment(p);
                setRefundAmount(p.amount - (p.refundAmount || 0));
                setRefundReason("");
                setRefundError(null);
              }}
              className="border-destructive/30 text-destructive hover:bg-destructive-subtle"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Возврат</span>
            </Button>
          )}
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || centerId || status || paymentMethod || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Платежи центров"
        description="Реестр поступивших платежей, выставление счетов и оформление возвратов"
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <a href={exportUrl} download>
                <Download className="h-4 w-4" aria-hidden="true" />
                <span>Экспорт CSV</span>
              </a>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setRecordError(null);
                setIsRecordModalOpen(true);
              }}
            >
              <PlusCircle className="h-4 w-4" aria-hidden="true" />
              <span>Записать оплату</span>
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2 border-b border-border pb-2 text-sm">
        <Link
          href="/platform-admin/finance"
          className="px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Обзор и отчёты
        </Link>
        <Link
          href="/platform-admin/finance/payments"
          className="border-b-2 border-primary px-3 py-1.5 font-medium text-primary"
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Всего платежей" value={summary.count} />
        <StatCard label="Начислено" value={`${summary.totalAmount.toLocaleString()} UZS`} />
        <StatCard
          label="Возвращено"
          value={`-${summary.totalRefunded.toLocaleString()} UZS`}
        />
        <StatCard
          label="Чистая выручка"
          value={`${summary.netAmount.toLocaleString()} UZS`}
        />
      </div>

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Номер счёта, центр, чек..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setCenterId("");
          setStatus("");
          setPaymentMethod("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
      >
        <select
          aria-label="Учебный центр"
          value={centerId}
          onChange={(e) => {
            setCenterId(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Все центры</option>
          {centersList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Статус"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Все статусы</option>
          <option value="PAID">PAID (Оплачено)</option>
          <option value="REFUNDED">REFUNDED (Возвращено)</option>
          <option value="PENDING">PENDING (Ожидает)</option>
        </select>

        <select
          aria-label="Способ оплаты"
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Все способы</option>
          <option value="BANK_TRANSFER">Банковский перевод</option>
          <option value="CASH">Наличные</option>
          <option value="ONLINE">Онлайн (Click/Payme/Uzum)</option>
        </select>

        <div className="flex items-center gap-1.5">
          <Input
            aria-label="С даты"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-xs"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            aria-label="По дату"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="h-9 w-36 text-xs"
          />
        </div>
      </FilterBar>

      <DataTable
        data={payments}
        columns={columns}
        getRowId={(p) => p.id}
        loading={loading}
        error={error}
        onRetry={fetchPayments}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        emptyTitle="Платежи не найдены"
        emptyDescription={t("ru", "ui4.emptyPaymentsDesc")}
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCenterId("");
                setStatus("");
                setPaymentMethod("");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
            >
              {t("ru", "ui4.resetFilters")}
            </Button>
          ) : undefined
        }
      />

      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Запись оплаты от учебного центра</DialogTitle>
          </DialogHeader>

          {recordError && (
            <Alert variant="destructive">
              <AlertDescription>{recordError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleRecordPayment} className="space-y-4">
            <FormField label="Учебный центр" htmlFor="rec-center" required>
              <select
                id="rec-center"
                value={recordCenterId}
                onChange={(e) => setRecordCenterId(e.target.value)}
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">Выберите центр...</option>
                {centersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Тарифный план" htmlFor="rec-plan">
                <select
                  id="rec-plan"
                  value={recordPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                >
                  <option value="">Выберите тариф...</option>
                  {plansList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priceMonthly.toLocaleString()} UZS)
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Сумма оплаты (UZS)" htmlFor="rec-amount" required>
                <Input
                  id="rec-amount"
                  type="number"
                  min="1"
                  required
                  value={recordAmount || ""}
                  onChange={(e) => setRecordAmount(parseInt(e.target.value || "0", 10))}
                  placeholder="Например: 500000"
                />
              </FormField>
            </div>

            <FormField label="Способ оплаты" htmlFor="rec-method" required>
              <select
                id="rec-method"
                value={recordMethod}
                onChange={(e) =>
                  setRecordMethod(e.target.value as "BANK_TRANSFER" | "CASH" | "ONLINE")
                }
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="BANK_TRANSFER">Банковский перевод (расчётный счёт)</option>
                <option value="CASH">Наличный расчёт</option>
                <option value="ONLINE">Онлайн-платёж (Click, Payme, Uzum)</option>
              </select>
            </FormField>

            <FormField label="Ссылка на чек / платёжное поручение" htmlFor="rec-receipt">
              <Input
                id="rec-receipt"
                type="text"
                value={recordReceiptUrl}
                onChange={(e) => setRecordReceiptUrl(e.target.value)}
                placeholder="https://storage.../receipt.pdf"
              />
            </FormField>

            <FormField label="Примечание / комментарий" htmlFor="rec-notes">
              <Textarea
                id="rec-notes"
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                rows={2}
                placeholder="Номер транзакции, плательщик, договор..."
              />
            </FormField>

            <Alert variant="success">
              <AlertDescription className="text-xs">
                При подтверждении оплаты статус подписки станет <strong>ACTIVE</strong>, срок
                продлится на 1 месяц, а центру будет присвоен активный статус.
              </AlertDescription>
            </Alert>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsRecordModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={recording}>
                {recording ? "Сохранение..." : "Записать оплату"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(refundPayment)} onOpenChange={(next) => !next && setRefundPayment(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оформление возврата</DialogTitle>
          </DialogHeader>

          {refundPayment && (
            <form onSubmit={handleRefund} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Платёж{" "}
                <strong className="text-foreground">
                  {refundPayment.invoiceNumber || refundPayment.id.slice(0, 8)}
                </strong>{" "}
                для <strong className="text-foreground">{refundPayment.center.name}</strong>.
              </p>

              <div className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs tabular-nums text-muted-foreground">
                <div>Исходная сумма: {refundPayment.amount.toLocaleString()} UZS</div>
                <div>
                  Уже возвращено: {(refundPayment.refundAmount || 0).toLocaleString()} UZS
                </div>
                <div className="font-semibold text-foreground">
                  Максимально к возврату:{" "}
                  {(refundPayment.amount - (refundPayment.refundAmount || 0)).toLocaleString()} UZS
                </div>
              </div>

              {refundError && (
                <Alert variant="destructive">
                  <AlertDescription>{refundError}</AlertDescription>
                </Alert>
              )}

              <FormField label="Сумма возврата (UZS)" htmlFor="refund-amount" required>
                <Input
                  id="refund-amount"
                  type="number"
                  min="1"
                  max={refundPayment.amount - (refundPayment.refundAmount || 0)}
                  required
                  value={refundAmount || ""}
                  onChange={(e) => setRefundAmount(parseInt(e.target.value || "0", 10))}
                />
              </FormField>

              <FormField label="Причина возврата (минимум 5 символов)" htmlFor="refund-reason" required>
                <Textarea
                  id="refund-reason"
                  required
                  minLength={5}
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={3}
                  placeholder="Укажите причину возврата средств..."
                />
              </FormField>

              <FormActions>
                <Button type="button" variant="outline" onClick={() => setRefundPayment(null)}>
                  Отмена
                </Button>
                <Button type="submit" variant="destructive" disabled={refunding}>
                  {refunding ? "Оформление..." : "Подтвердить возврат"}
                </Button>
              </FormActions>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
