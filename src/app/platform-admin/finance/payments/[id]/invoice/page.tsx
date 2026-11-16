"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Alert, AlertDescription, Badge, Button, Card, CardContent, Skeleton } from "@/components/ui";

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
      <div className="mx-auto max-w-3xl space-y-4 py-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-lg" />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center justify-center gap-4 py-12">
        <Alert variant="destructive">
          <AlertDescription>{error || "Платёж не найден"}</AlertDescription>
        </Alert>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Вернуться назад
        </Button>
      </div>
    );
  }

  const invoiceNum = payment.invoiceNumber || `INV-${payment.id.slice(0, 8).toUpperCase()}`;
  const issueDate = payment.paidAt
    ? new Date(payment.paidAt).toLocaleDateString("ru-RU")
    : new Date().toLocaleDateString("ru-RU");

  return (
    <div className="space-y-6">
      <div className="mx-auto flex max-w-3xl items-center justify-between print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link href="/platform-admin/finance/payments">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Назад к платежам</span>
          </Link>
        </Button>
        <Button type="button" variant="primary" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          <span>Распечатать квитанцию</span>
        </Button>
      </div>

      <Card className="mx-auto max-w-3xl print:border-none print:shadow-none">
        <CardContent className="p-8 sm:p-12 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-8">
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
                Квитанция об оплате
              </h1>
              <p className="mt-1 font-mono text-sm font-semibold text-primary">{invoiceNum}</p>
              <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                Дата формирования: {issueDate}
              </p>
            </div>
            <div className="text-right">
              <h2 className="font-display text-lg font-semibold text-foreground">e-darschi LMS</h2>
              <p className="text-xs text-muted-foreground">Платформа управления учебными центрами</p>
              <p className="text-xs text-muted-foreground">Ташкент, Узбекистан</p>
              <p className="text-xs text-muted-foreground">support@e-darschi.uz</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 border-b border-border py-8 sm:grid-cols-2">
            <div>
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Плательщик (клиент)</h3>
              <p className="font-semibold text-foreground">{payment.center.name}</p>
              <p className="text-sm text-muted-foreground">ID: {payment.center.slug}</p>
              {payment.center.phone && (
                <p className="text-sm text-muted-foreground tabular-nums">Тел: {payment.center.phone}</p>
              )}
              {payment.center.email && (
                <p className="text-sm text-muted-foreground">Email: {payment.center.email}</p>
              )}
              {payment.center.address && (
                <p className="text-sm text-muted-foreground">Адрес: {payment.center.address}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">Информация об оплате</h3>
              <p className="text-sm text-muted-foreground">
                Способ: <span className="font-medium text-foreground">{payment.paymentMethod}</span>
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Статус:</span>
                <Badge
                  variant={
                    payment.status === "PAID"
                      ? "success"
                      : payment.status === "REFUNDED"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {payment.status === "PAID"
                    ? "Оплачено"
                    : payment.status === "REFUNDED"
                    ? "Возвращено"
                    : payment.status}
                </Badge>
              </div>
              {payment.paidAt && (
                <p className="text-sm text-muted-foreground tabular-nums">
                  Дата платежа: {new Date(payment.paidAt).toLocaleDateString("ru-RU")}
                </p>
              )}
              {payment.recorder && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Записал: {payment.recorder.name || payment.recorder.email}
                </p>
              )}
            </div>
          </div>

          <div className="border-b border-border py-8">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs font-medium text-muted-foreground">
                  <th className="py-3">Наименование услуги</th>
                  <th className="py-3">Период действия</th>
                  <th className="py-3 text-right">Сумма (UZS)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="py-4">
                    <div className="font-medium text-foreground">
                      Подписка на тариф {payment.plan?.name || "LMS"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Доступ к платформе управления обучением
                    </div>
                  </td>
                  <td className="py-4 text-muted-foreground tabular-nums">
                    {payment.periodStartsAt && payment.periodEndsAt ? (
                      <>
                        {new Date(payment.periodStartsAt).toLocaleDateString("ru-RU")} —{" "}
                        {new Date(payment.periodEndsAt).toLocaleDateString("ru-RU")}
                      </>
                    ) : (
                      "1 месяц"
                    )}
                  </td>
                  <td className="py-4 text-right font-medium text-foreground tabular-nums">
                    {payment.amount.toLocaleString()} UZS
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col items-end py-6">
            <div className="w-64 space-y-2 text-sm tabular-nums">
              <div className="flex justify-between text-muted-foreground">
                <span>Сумма к оплате:</span>
                <span className="font-medium text-foreground">{payment.amount.toLocaleString()} UZS</span>
              </div>
              {payment.refundAmount ? (
                <div className="flex justify-between text-destructive">
                  <span>Возвращено:</span>
                  <span className="font-medium">-{payment.refundAmount.toLocaleString()} UZS</span>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold text-foreground">
                <span>Итого:</span>
                <span>{(payment.amount - (payment.refundAmount || 0)).toLocaleString()} UZS</span>
              </div>
            </div>
          </div>

          {payment.notes && (
            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Примечание:</span> {payment.notes}
            </div>
          )}

          <div className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-dashed border-border pt-8 text-xs text-muted-foreground">
            <div>Электронная квитанция сформирована в системе e-darschi LMS.</div>
            <div>Подпись не требуется (публичная оферта)</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
