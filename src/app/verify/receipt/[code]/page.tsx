import { verifyReceiptByCode } from "@/lib/receipt-verify";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function VerifyReceiptPage({
  params,
}: {
  params: { code: string };
}) {
  const result = await verifyReceiptByCode(params.code);

  const formattedDate = result.paidAt
    ? new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Asia/Tashkent",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(result.paidAt))
    : "—";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl space-y-5">
        <div className="flex items-center gap-3">
          {result.valid ? (
            <div className="w-11 h-11 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          ) : (
            <div className="w-11 h-11 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
              <XCircle className="w-6 h-6" />
            </div>
          )}
          <div>
            <h1 className="text-lg font-bold text-white">
              {result.valid
                ? "Квитанция действительна"
                : "Квитанция не найдена"}
            </h1>
            <p className="text-xs text-slate-400">
              {result.valid
                ? "Chek haqiqiy / Receipt Verified"
                : "Chek topilmadi yoki bekor qilingan"}
            </p>
          </div>
        </div>

        {result.valid ? (
          <dl className="divide-y divide-slate-800 text-sm border-t border-b border-slate-800 py-2">
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-400">Номер / Chek №</dt>
              <dd className="font-mono font-semibold text-white">
                {result.receiptNumber}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-400">Учебный центр / Markaz</dt>
              <dd className="font-semibold text-white text-right">
                {result.centerName}
              </dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-400">Сумма / Summa</dt>
              <dd className="font-bold text-emerald-400">
                {Math.round(result.amount ?? 0).toLocaleString("ru-RU")}{" "}
                {result.currency}
              </dd>
            </div>
            {(result.refundedAmount ?? 0) > 0 && (
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-400">Возврат / Qaytarildi</dt>
                <dd className="font-semibold text-amber-400">
                  {Math.round(result.refundedAmount ?? 0).toLocaleString("ru-RU")}{" "}
                  {result.currency}
                </dd>
              </div>
            )}
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-400">Статус / Holat</dt>
              <dd className="font-semibold text-white">{result.status}</dd>
            </div>
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-slate-400">Дата оплаты / Sana</dt>
              <dd className="text-slate-200">{formattedDate}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-slate-400">
            Проверьте QR-код или обратитесь в учебный центр. Персональные данные на этой странице не отображаются.
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-4 h-4 text-brand-400 shrink-0" />
          <span>Защита персональных данных: ФИО и контакты скрыты.</span>
        </div>
      </div>
    </main>
  );
}
