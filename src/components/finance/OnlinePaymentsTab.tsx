"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { formatUzs } from "@/lib/money";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";

interface OnlineIntentItem {
  id: string;
  merchantTransId: string;
  clickTransId: string | null;
  amount: number;
  status: string;
  periodMonths: number;
  errorNote: string | null;
  createdAt: string;
  preparedAt: string | null;
  confirmedAt: string | null;
  student: { user: { fullName: string; phone: string | null } };
  group: { id: string; name: string } | null;
  centerPayment: { id: string; receiptNumber: string | null; status: string } | null;
}

interface WebhookEventItem {
  id: string;
  clickTransId: string | null;
  merchantTransId: string | null;
  action: number | null;
  amount: number | null;
  signatureValid: boolean;
  status: string;
  errorCode: number | null;
  errorNote: string | null;
  createdAt: string;
}

interface ManualOnlineRefundItem {
  id: string;
  receiptNumber: string | null;
  amount: number;
  refundedAmount: number;
  refundedAt: string | null;
  manualRefundStatus: "NONE" | "PENDING_MANUAL" | "COMPLETED" | string;
  manualRefundNote: string | null;
  manualRefundCompletedAt: string | null;
  student: { user: { fullName: string; phone: string | null } };
  group: { id: string; name: string } | null;
}

interface OnlinePaymentsTabProps {
  isDirector: boolean;
}

export function OnlinePaymentsTab({ isDirector }: OnlinePaymentsTabProps) {
  const [intents, setIntents] = useState<OnlineIntentItem[]>([]);
  const [events, setEvents] = useState<WebhookEventItem[]>([]);
  const [manualRefunds, setManualRefunds] = useState<ManualOnlineRefundItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [actionErr, setActionErr] = useState("");
  const [confirmRefundId, setConfirmRefundId] = useState<string | null>(null);
  const [confirmNote, setConfirmNote] = useState("Возврат проведён в кабинете Click");
  const [confirmDate, setConfirmDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [failTargetId, setFailTargetId] = useState<string | null>(null);
  const [failLoading, setFailLoading] = useState(false);

  const loadData = useCallback(async (targetPage: number, targetStatus: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({
        page: String(targetPage),
        limit: "20",
      });
      if (targetStatus) params.set("status", targetStatus);
      const res = await fetch(`/api/finance/online-payments?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setIntents(data.intents || []);
        setEvents(data.events || []);
        setManualRefunds(data.manualRefunds || []);
        setPage(data.pagination?.page || targetPage);
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setLoadError(data.error || "Не удалось загрузить онлайн-оплаты");
      }
    } catch {
      setLoadError("Ошибка сети при загрузке онлайн-оплат");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(1, statusFilter);
  }, [statusFilter, loadData]);

  const handleReconcile = async () => {
    setActionMsg("");
    setActionErr("");
    try {
      const res = await fetch("/api/finance/online-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reconcile" }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        setActionMsg(
          `Сверка выполнена: истекло ${data.summary.expiredCount}, восстановлено ${data.summary.healedCount}, зависших ${data.summary.flaggedStaleCount}`
        );
        await loadData(page, statusFilter);
      } else {
        setActionErr(data.error || "Ошибка сверки");
      }
    } catch {
      setActionErr("Ошибка сети при сверке");
    }
  };

  const handleMarkFailed = async (intentId: string) => {
    setFailLoading(true);
    setActionMsg("");
    setActionErr("");
    try {
      const res = await fetch("/api/finance/online-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_failed", intentId, reason: "Ручная проверка" }),
      });
      if (res.ok) {
        setFailTargetId(null);
        setActionMsg("Заявка помечена как FAILED.");
        await loadData(page, statusFilter);
      } else {
        const data = await res.json().catch(() => ({}));
        setActionErr(data.error || "Не удалось обновить статус заявки");
      }
    } catch {
      setActionErr("Ошибка сети");
    } finally {
      setFailLoading(false);
    }
  };

  const handleConfirmManualRefund = async (paymentId: string) => {
    setActionMsg("");
    setActionErr("");
    try {
      const res = await fetch(`/api/center-payments/${paymentId}/manual-refund-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: confirmNote.trim() || "Возврат проведён в кабинете Click",
          completedAt: confirmDate
            ? new Date(`${confirmDate}T12:00:00+05:00`).toISOString()
            : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActionMsg("Возврат в кабинете Click подтверждён.");
        setConfirmRefundId(null);
        await loadData(page, statusFilter);
      } else {
        setActionErr(data.error || "Ошибка подтверждения возврата");
      }
    } catch {
      setActionErr("Ошибка сети");
    }
  };

  const columns = useMemo<DataTableColumn<OnlineIntentItem>[]>(() => {
    const base: DataTableColumn<OnlineIntentItem>[] = [
      {
        id: "createdAt",
        header: "Создан",
        sortable: true,
        sortValue: (it) => new Date(it.createdAt).getTime(),
        cell: (it) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(it.createdAt).toLocaleString("ru-RU")}
          </span>
        ),
      },
      {
        id: "student",
        header: "Ученик / Группа",
        sortable: true,
        sortValue: (it) => it.student.user.fullName,
        cell: (it) => (
          <div>
            <div className="text-xs font-medium text-foreground">{it.student.user.fullName}</div>
            <div className="text-xs text-muted-foreground">
              {it.group?.name || "По счёту"} · {it.periodMonths} мес.
            </div>
          </div>
        ),
      },
      {
        id: "amount",
        header: "Сумма",
        align: "right",
        sortable: true,
        sortValue: (it) => it.amount,
        cell: (it) => (
          <span className="text-xs font-medium text-foreground tabular-nums">
            {formatUzs(it.amount)}
          </span>
        ),
      },
      {
        id: "clickId",
        header: "Click ID / Ошибки",
        cell: (it) => (
          <div className="text-xs">
            <div className="font-mono text-foreground">
              {it.clickTransId || it.merchantTransId.slice(0, 12)}
            </div>
            {it.errorNote && <div className="mt-0.5 text-xs text-warning">{it.errorNote}</div>}
            {it.centerPayment && (
              <div className="mt-0.5 text-xs text-success">
                Чек: {it.centerPayment.receiptNumber || it.centerPayment.id.slice(0, 8)}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "status",
        header: "Статус",
        sortable: true,
        sortValue: (it) => it.status,
        cell: (it) => (
          <Badge
            variant={
              it.status === "CONFIRMED"
                ? "success"
                : it.status === "PREPARED"
                ? "warning"
                : it.status === "FAILED" || it.status === "CANCELLED"
                ? "destructive"
                : "neutral"
            }
          >
            {it.status === "CONFIRMED" && <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />}
            {it.status === "PREPARED" && <AlertTriangle className="mr-1 h-3 w-3" aria-hidden="true" />}
            {(it.status === "FAILED" || it.status === "CANCELLED") && (
              <XCircle className="mr-1 h-3 w-3" aria-hidden="true" />
            )}
            {it.status}
          </Badge>
        ),
      },
    ];

    if (isDirector) {
      base.push({
        id: "actions",
        header: "Действие",
        align: "right",
        cell: (it) =>
          it.status === "PREPARED" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFailTargetId(it.id)}
            >
              Пометить FAILED
            </Button>
          ) : null,
      });
    }

    return base;
  }, [isDirector]);

  return (
    <div className="space-y-6">
      {manualRefunds.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-1 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden="true" />
              <span>Возвраты по онлайн-оплатам Click</span>
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              После возврата в LMS необходимо вернуть деньги в кабинете Click
            </span>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {manualRefunds.map((mr) => (
              <div
                key={mr.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs"
              >
                <div>
                  <div className="font-semibold text-foreground">
                    {mr.student.user.fullName}{" "}
                    <span className="font-normal text-muted-foreground tabular-nums">
                      · Возврат {formatUzs(mr.refundedAmount)}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {mr.receiptNumber || mr.id.slice(0, 8)}{" "}
                    {mr.group?.name ? `· ${mr.group.name}` : ""}{" "}
                    {mr.manualRefundNote ? `· ${mr.manualRefundNote}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {mr.manualRefundStatus === "PENDING_MANUAL" ? (
                    confirmRefundId === mr.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="date"
                          value={confirmDate}
                          onChange={(e) => setConfirmDate(e.target.value)}
                          className="h-8 w-auto text-xs"
                        />
                        <Input
                          type="text"
                          value={confirmNote}
                          onChange={(e) => setConfirmNote(e.target.value)}
                          placeholder="Причина / номер транзакции Click"
                          className="h-8 w-48 text-xs"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void handleConfirmManualRefund(mr.id)}
                        >
                          Сохранить
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setConfirmRefundId(mr.id);
                          setConfirmNote(mr.manualRefundNote || "Возврат проведён в кабинете Click");
                          setConfirmDate(new Date().toISOString().slice(0, 10));
                        }}
                      >
                        Возврат выполнен
                      </Button>
                    )
                  ) : (
                    <Badge variant="success">
                      <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" />
                      Возврат в Click подтверждён
                      {mr.manualRefundCompletedAt
                        ? ` (${new Date(mr.manualRefundCompletedAt).toLocaleDateString("ru-RU")})`
                        : ""}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {["", "CREATED", "PREPARED", "CONFIRMED", "CANCELLED", "EXPIRED", "FAILED"].map((st) => (
            <button
              key={st || "ALL"}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === st
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {st || "Все статусы"}
            </button>
          ))}
        </div>
        {isDirector && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleReconcile()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            <span>Сверить зависшие</span>
          </Button>
        )}
      </div>

      {actionMsg && (
        <Alert variant="info">
          <AlertDescription>{actionMsg}</AlertDescription>
        </Alert>
      )}

      {actionErr && (
        <Alert variant="destructive">
          <AlertDescription>{actionErr}</AlertDescription>
        </Alert>
      )}

      <DataTable
        data={intents}
        columns={columns}
        getRowId={(it) => it.id}
        loading={loading && intents.length === 0}
        error={loadError}
        onRetry={() => void loadData(page, statusFilter)}
        page={page}
        totalPages={totalPages}
        onPageChange={(next) => void loadData(next, statusFilter)}
        emptyTitle="Онлайн-оплаты Click не найдены"
        mobileCardRender={(it) => (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-medium text-foreground">{it.student.user.fullName}</div>
                <div className="text-muted-foreground">
                  {it.group?.name || "По счёту"} · {it.periodMonths} мес.
                </div>
              </div>
              <span className="font-semibold text-foreground tabular-nums">
                {formatUzs(it.amount)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-muted-foreground">
                {it.clickTransId || it.merchantTransId.slice(0, 12)}
              </span>
              <Badge
                variant={
                  it.status === "CONFIRMED"
                    ? "success"
                    : it.status === "PREPARED"
                    ? "warning"
                    : it.status === "FAILED" || it.status === "CANCELLED"
                    ? "destructive"
                    : "neutral"
                }
              >
                {it.status}
              </Badge>
            </div>
            {isDirector && it.status === "PREPARED" && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFailTargetId(it.id)}
                >
                  Пометить FAILED
                </Button>
              </div>
            )}
          </div>
        )}
      />

      {/* Recent Webhooks */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Последние вебхуки Click (секреты скрыты)</CardTitle>
        </CardHeader>
        <CardContent className="max-h-56 space-y-1.5 overflow-y-auto pt-0 text-xs">
          {events.length === 0 ? (
            <div className="py-2 text-muted-foreground">Вебхуки ещё не поступали</div>
          ) : (
            events.map((ev) => (
              <div
                key={ev.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2"
              >
                <span className="font-mono text-foreground">
                  {ev.action === 0 ? "PREPARE" : ev.action === 1 ? "COMPLETE" : `ACT:${ev.action ?? "?"}`}{" "}
                  · {ev.clickTransId || "-"}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {ev.amount !== null ? formatUzs(ev.amount) : ""}
                </span>
                <Badge variant={ev.status === "PROCESSED" ? "success" : "destructive"}>
                  {ev.status} ({ev.errorCode ?? 0}: {ev.errorNote || "-"})
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(failTargetId)}
        onOpenChange={(open) => !open && setFailTargetId(null)}
        title="Пометить заявку как FAILED"
        description="Пометить заявку как FAILED после ручной проверки? Это действие нельзя отменить."
        confirmLabel="Пометить FAILED"
        variant="destructive"
        loading={failLoading}
        onConfirm={() => {
          if (failTargetId) return handleMarkFailed(failTargetId);
        }}
      />
    </div>
  );
}
