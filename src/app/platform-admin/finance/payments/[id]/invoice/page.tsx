"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";

interface PaymentDetails {
  id: string;
  invoiceNumber: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string;
  paymentType: string;
  periodStartsAt: string | null;
  periodEndsAt: string | null;
  paidAt: string | null;
  notes: string | null;
  receiptUrl: string | null;
  refundAmount: number | null;
  refundReason: string | null;
  refundedAt: string | null;
  center: {
    id: string;
    name: string;
    slug: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  };
  plan: {
    id: string;
    name: string;
    priceMonthly: number;
  } | null;
  recorder: {
    name: string | null;
    email: string;
  } | null;
}

export default function InvoicePage() {
  const params = useParams();
  const router = useRouter();
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/platform/finance/payments/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setPayment(data.payment);
        } else {
          setError(data.error || "Не удалось загрузить данные счёта");
        }
      } catch {
        setError("Ошибка соединения с сервером");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500">Загрузка печатной формы...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center">
        <p className="text-rose-600 font-medium mb-4">{error || "Платёж не найден"}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300"
        >
          Вернуться назад
        </button>
      </div>
    );
  }

  const invoiceNum = payment.invoiceNumber || `INV-${payment.id.slice(0, 8).toUpperCase()}`;
  const issueDate = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString("ru-RU")
    : new Date().toLocaleDateString("ru-RU");

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8">
      {/* Action Bar */}
      <div className="max-w-3xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <Link
          href="/platform-admin/finance/payments"
          className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Назад к платежам
        </Link>
        <button
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium shadow-sm"
        >
          <Printer className="w-4 h-4" />
          Распечатать квитанцию
        </button>
      </div>

      {/* Invoice Document Card */}
      <div className="max-w-3xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-md border border-slate-200 print:shadow-none print:border-none print:p-0">
        {/* Header */}
        <div className="flex justify-between items-start pb-8 border-b border-slate-200">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">КВИТАНЦИЯ ОБ ОПЛАТЕ</h1>
            <p className="text-sm font-mono text-indigo-600 font-semibold mt-1">{invoiceNum}</p>
            <p className="text-xs text-slate-500 mt-1">Дата формирования: {issueDate}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-900">e-darschi LMS</h2>
            <p className="text-xs text-slate-500">Платформа управления учебными центрами</p>
            <p className="text-xs text-slate-500">Ташкент, Узбекистан</p>
            <p className="text-xs text-slate-500">support@e-darschi.uz</p>
          </div>
        </div>

        {/* Parties */}
        <div className="grid grid-cols-2 gap-8 py-8 border-b border-slate-200">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Плательщик (Клиент)
            </h3>
            <p className="font-semibold text-slate-900">{payment.center.name}</p>
            <p className="text-sm text-slate-600">ID: {payment.center.slug}</p>
            {payment.center.phone && <p className="text-sm text-slate-600">Тел: {payment.center.phone}</p>}
            {payment.center.email && <p className="text-sm text-slate-600">Email: {payment.center.email}</p>}
            {payment.center.address && <p className="text-sm text-slate-600">Адрес: {payment.center.address}</p>}
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Информация об оплате
            </h3>
            <p className="text-sm text-slate-600">
              Способ: <span className="font-medium text-slate-900">{payment.paymentMethod}</span>
            </p>
            <p className="text-sm text-slate-600">
              Статус:{" "}
              <span
                className={`font-semibold ${
                  payment.status === "PAID"
                    ? "text-emerald-700"
                    : payment.status === "REFUNDED"
                    ? "text-rose-700"
                    : "text-amber-700"
                }`}
              >
                {payment.status === "PAID"
                  ? "ОПЛАЧЕНО"
                  : payment.status === "REFUNDED"
                  ? "ВОЗВРАЩЕНО"
                  : payment.status}
              </span>
            </p>
            {payment.paidAt && (
              <p className="text-sm text-slate-600">
                Дата платежа: {new Date(payment.paidAt).toLocaleDateString("ru-RU")}
              </p>
            )}
            {payment.recorder && (
              <p className="text-xs text-slate-400 mt-2">
                Записал: {payment.recorder.name || payment.recorder.email}
              </p>
            )}
          </div>
        </div>

        {/* Table of Services */}
        <div className="py-8 border-b border-slate-200">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="py-3">Наименование услуги</th>
                <th className="py-3">Период действия</th>
                <th className="py-3 text-right">Сумма (UZS)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-4">
                  <div className="font-medium text-slate-900">
                    Подписка на тариф {payment.plan?.name || "LMS"}
                  </div>
                  <div className="text-xs text-slate-500">Доступ к платформе управления обучением</div>
                </td>
                <td className="py-4 text-slate-600">
                  {payment.periodStartsAt && payment.periodEndsAt ? (
                    <>
                      {new Date(payment.periodStartsAt).toLocaleDateString("ru-RU")} —{" "}
                      {new Date(payment.periodEndsAt).toLocaleDateString("ru-RU")}
                    </>
                  ) : (
                    "1 месяц"
                  )}
                </td>
                <td className="py-4 text-right font-medium text-slate-900">
                  {payment.amount.toLocaleString()} UZS
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="py-6 flex flex-col items-end">
          <div className="w-64 space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Сумма к оплате:</span>
              <span className="font-medium">{payment.amount.toLocaleString()} UZS</span>
            </div>
            {payment.refundAmount ? (
              <div className="flex justify-between text-rose-600">
                <span>Возвращено:</span>
                <span className="font-medium">-{payment.refundAmount.toLocaleString()} UZS</span>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Итого:</span>
              <span>{(payment.amount - (payment.refundAmount || 0)).toLocaleString()} UZS</span>
            </div>
          </div>
        </div>

        {/* Notes & Seal */}
        {payment.notes && (
          <div className="p-4 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200 mt-4">
            <span className="font-semibold text-slate-700">Примечание:</span> {payment.notes}
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-dashed border-slate-200 flex justify-between items-center text-xs text-slate-400">
          <div>Электронная квитанция сформирована в системе e-darschi LMS.</div>
          <div>Подпись не требуется (публичная оферта)</div>
        </div>
      </div>
    </div>
  );
}
