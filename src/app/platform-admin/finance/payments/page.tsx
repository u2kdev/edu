"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  CreditCard,
  PlusCircle,
  Download,
  Filter,
  Search,
  Printer,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";

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

  // Filters
  const [search, setSearch] = useState("");
  const [centerId, setCenterId] = useState(prefillCenterId);
  const [status, setStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Centers & Plans options for dropdowns
  const [centersList, setCentersList] = useState<{ id: string; name: string }[]>([]);
  const [plansList, setPlansList] = useState<{ id: string; name: string; priceMonthly: number }[]>([]);

  // Record Payment Modal
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordCenterId, setRecordCenterId] = useState(prefillCenterId);
  const [recordPlanId, setRecordPlanId] = useState(prefillPlanId);
  const [recordAmount, setRecordAmount] = useState<number>(0);
  const [recordMethod, setRecordMethod] = useState<"BANK_TRANSFER" | "CASH" | "ONLINE">("BANK_TRANSFER");
  const [recordNotes, setRecordNotes] = useState("");
  const [recordReceiptUrl, setRecordReceiptUrl] = useState("");
  const [recording, setRecording] = useState(false);

  // Refund Modal
  const [refundPayment, setRefundPayment] = useState<PaymentItem | null>(null);
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);

  // Load centers and plans
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

  // Open modal if prefilled
  useEffect(() => {
    if (prefillCenterId) {
      setIsRecordModalOpen(true);
      setRecordCenterId(prefillCenterId);
    }
  }, [prefillCenterId]);

  // Handle plan change to prefill amount
  const handlePlanChange = (pId: string) => {
    setRecordPlanId(pId);
    const selected = plansList.find((p) => p.id === pId);
    if (selected) {
      setRecordAmount(Math.round(selected.priceMonthly));
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordCenterId) {
      alert("Выберите учебный центр");
      return;
    }
    if (recordAmount <= 0) {
      alert("Сумма должна быть больше 0");
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
        alert(data.error || "Ошибка при записи оплаты");
      } else {
        setIsRecordModalOpen(false);
        setRecordNotes("");
        setRecordReceiptUrl("");
        fetchPayments();
      }
    } catch {
      alert("Ошибка сети при отправке формы");
    } finally {
      setRecording(false);
    }
  };

  const handleRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundPayment) return;
    if (refundAmount <= 0) {
      alert("Сумма возврата должна быть больше 0");
      return;
    }
    if (refundReason.trim().length < 5) {
      alert("Причина возврата обязательна (минимум 5 символов)");
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
        alert(data.error || "Ошибка выполнения возврата");
      } else {
        setRefundPayment(null);
        setRefundReason("");
        fetchPayments();
      }
    } catch {
      alert("Ошибка сети при возврате");
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

  return (
    <div className="space-y-6">
      {/* Header and Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Платежи центров
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Реестр поступивших платежей, выставление счетов и оформление возвратов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={exportUrl}
            download
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 shadow-sm transition-all"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Экспорт CSV</span>
          </a>
          <button
            onClick={() => setIsRecordModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Записать оплату</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Link
          href="/platform-admin/finance"
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Обзор и отчёты
        </Link>
        <Link
          href="/platform-admin/finance/payments"
          className="px-4 py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600"
        >
          Платежи центров
        </Link>
        <Link
          href="/platform-admin/finance/expenses"
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Расходы платформы
        </Link>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Всего платежей</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{summary.count}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Начислено</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
            {summary.totalAmount.toLocaleString()} UZS
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Возвращено</div>
          <div className="text-xl font-extrabold text-rose-600 mt-0.5">
            -{summary.totalRefunded.toLocaleString()} UZS
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Чистая выручка</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
            {summary.netAmount.toLocaleString()} UZS
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Номер счёта, центр, чек..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Center Select */}
        <select
          value={centerId}
          onChange={(e) => {
            setCenterId(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все центры</option>
          {centersList.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все статусы</option>
          <option value="PAID">PAID (Оплачено)</option>
          <option value="REFUNDED">REFUNDED (Возвращено)</option>
          <option value="PENDING">PENDING (Ожидает)</option>
        </select>

        {/* Payment Method */}
        <select
          value={paymentMethod}
          onChange={(e) => {
            setPaymentMethod(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все способы</option>
          <option value="BANK_TRANSFER">Банковский перевод</option>
          <option value="CASH">Наличные</option>
          <option value="ONLINE">Онлайн (Click/Payme/Uzum)</option>
        </select>

        {/* Date From & To */}
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
        />
        <span className="text-slate-400 text-xs">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="py-1 px-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
        />
      </div>

      {/* Payments Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка истории платежей...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm">
          {error}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Платежи не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">По выбранным фильтрам записей не обнаружено.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left px-6 py-3.5">Счёт / Дата</th>
                  <th className="text-left px-6 py-3.5">Учебный центр</th>
                  <th className="text-left px-6 py-3.5">Тариф / Способ</th>
                  <th className="text-right px-6 py-3.5">Сумма (UZS)</th>
                  <th className="text-center px-6 py-3.5">Статус</th>
                  <th className="text-right px-6 py-3.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((p) => {
                  const net = p.amount - (p.refundAmount || 0);
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-slate-900">
                          {p.invoiceNumber || `INV-${p.id.slice(0, 8)}`}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {p.paidAt ? new Date(p.paidAt).toLocaleDateString() : "Не оплачен"}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Link
                          href={`/platform-admin/centers/${p.center.id}`}
                          className="font-semibold text-slate-900 hover:text-indigo-600 block"
                        >
                          {p.center.name}
                        </Link>
                        <div className="text-xs text-slate-500 font-mono">{p.center.slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-800">{p.plan?.name || "LMS Тариф"}</div>
                        <div className="text-xs text-slate-500">{p.paymentMethod}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="font-bold text-slate-900">{p.amount.toLocaleString()} UZS</div>
                        {p.refundAmount ? (
                          <div className="text-xs text-rose-600 font-medium">
                            Возврат: -{p.refundAmount.toLocaleString()} UZS
                          </div>
                        ) : null}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            p.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : p.status === "REFUNDED"
                              ? "bg-rose-50 text-rose-700 border border-rose-200"
                              : "bg-amber-50 text-amber-700 border border-amber-200"
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <Link
                            href={`/platform-admin/finance/payments/${p.id}/invoice`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Печатная квитанция"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Чек</span>
                          </Link>
                          {p.status === "PAID" && (
                            <button
                              onClick={() => {
                                setRefundPayment(p);
                                setRefundAmount(p.amount - (p.refundAmount || 0));
                                setRefundReason("");
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                              title="Оформить возврат"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Возврат</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Назад</span>
              </button>
              <span className="text-xs font-medium text-slate-500">
                Страница {page} из {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 transition-colors"
              >
                <span>Вперед</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      {isRecordModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRecordPayment}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">Запись оплаты от учебного центра</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Учебный центр *
              </label>
              <select
                value={recordCenterId}
                onChange={(e) => setRecordCenterId(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="">Выберите центр...</option>
                {centersList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Тарифный план
                </label>
                <select
                  value={recordPlanId}
                  onChange={(e) => handlePlanChange(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                >
                  <option value="">Выберите тариф...</option>
                  {plansList.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.priceMonthly.toLocaleString()} UZS)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Сумма оплаты (UZS) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={recordAmount || ""}
                  onChange={(e) => setRecordAmount(parseInt(e.target.value || "0", 10))}
                  placeholder="Например: 500000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Способ оплаты *
              </label>
              <select
                value={recordMethod}
                onChange={(e) =>
                  setRecordMethod(e.target.value as "BANK_TRANSFER" | "CASH" | "ONLINE")
                }
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                <option value="BANK_TRANSFER">Банковский перевод (Расчётный счёт)</option>
                <option value="CASH">Наличный расчёт</option>
                <option value="ONLINE">Онлайн-платеж (Click, Payme, Uzum)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Ссылка на чек / платёжное поручение
              </label>
              <input
                type="text"
                value={recordReceiptUrl}
                onChange={(e) => setRecordReceiptUrl(e.target.value)}
                placeholder="https://storage.../receipt.pdf"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Примечание / Комментарий
              </label>
              <textarea
                value={recordNotes}
                onChange={(e) => setRecordNotes(e.target.value)}
                rows={2}
                placeholder="Номер транзакции, плательщик, договор..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-xs text-emerald-800 border border-emerald-200">
              При подтверждении оплаты статус подписки автоматически станет <strong>ACTIVE</strong>,
              срок продлится на 1 месяц, а центру будет присвоен активный статус.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={recording}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {recording ? "Сохранение..." : "Записать оплату"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Refund Modal */}
      {refundPayment && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleRefund}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900">Оформление возврата</h3>
            </div>

            <p className="text-sm text-slate-600">
              Платёж <strong>{refundPayment.invoiceNumber || refundPayment.id.slice(0, 8)}</strong> для{" "}
              <strong>{refundPayment.center.name}</strong>.
            </p>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
              <div>Исходная сумма: {refundPayment.amount.toLocaleString()} UZS</div>
              <div>
                Уже возвращено: {(refundPayment.refundAmount || 0).toLocaleString()} UZS
              </div>
              <div className="font-semibold text-slate-900">
                Максимально к возврату:{" "}
                {(refundPayment.amount - (refundPayment.refundAmount || 0)).toLocaleString()} UZS
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Сумма возврата (UZS) *
              </label>
              <input
                type="number"
                min="1"
                max={refundPayment.amount - (refundPayment.refundAmount || 0)}
                required
                value={refundAmount || ""}
                onChange={(e) => setRefundAmount(parseInt(e.target.value || "0", 10))}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Причина возврата (минимум 5 символов) *
              </label>
              <textarea
                required
                minLength={5}
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                rows={3}
                placeholder="Укажите подробную причину возврата средств..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRefundPayment(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={refunding}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {refunding ? "Оформление..." : "Подтвердить возврат"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
