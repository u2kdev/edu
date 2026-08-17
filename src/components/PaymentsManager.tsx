"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Plus, CheckCircle2, AlertCircle, ShieldCheck } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PaymentsManagerProps {
  initialPayments: any[];
  students: any[];
  groups?: any[];
  role?: string;
}

export default function PaymentsManager({ initialPayments, students, role }: PaymentsManagerProps) {
  const router = useRouter();
  const [payments, setPayments] = useState(initialPayments);
  const [showModal, setShowModal] = useState(false);
  const [studentMembershipId, setStudentMembershipId] = useState(students[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);

  const canManage = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/center-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentMembershipId, amount, paymentMethod }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setAmount("");
        router.refresh();
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Commission Banner */}
      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <strong>0% Комиссия Платформы!</strong> Все полученные деньги идут на 100% на счет или в кассу вашего учебного центра. Платформа взимает только фиксированную ежемесячную подписку за аренду LMS.
          </div>
        </div>
      </div>

      {canManage && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Зафиксировать Платеж</span>
          </button>
        </div>
      )}

      {/* Payments History Table */}
      <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/80 text-xs font-semibold uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="p-4">Ученик</th>
              <th className="p-4">Сумма</th>
              <th className="p-4">Способ Оплаты</th>
              <th className="p-4">Статус</th>
              <th className="p-4">Дата Оплаты</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {payments.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-500">
                  История оплат пока пуста.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/40 transition-colors">
                  <td className="p-4 font-semibold text-white">
                    {p.student.user.fullName}
                  </td>
                  <td className="p-4 font-bold text-emerald-400">
                    {formatCurrency(p.amount, p.currency)}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded bg-slate-800 text-xs font-medium text-slate-300">
                      {p.paymentMethod === "ONLINE" && "💳 Онлайн Эквайринг"}
                      {p.paymentMethod === "CASH" && "💵 Наличные / Касса"}
                      {p.paymentMethod === "BANK_TRANSFER" && "🏦 Банковский перевод"}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-400">
                    {formatDate(p.paidAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Зафиксировать Оплату Учеником</h3>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Ученик</label>
                <select
                  required
                  value={studentMembershipId}
                  onChange={(e) => setStudentMembershipId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>{s.user.fullName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Сумма (₽)</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Способ Оплаты</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  <option value="CASH">Наличные / Очно в кассу</option>
                  <option value="ONLINE">Онлайн-эквайринг</option>
                  <option value="BANK_TRANSFER">Банковский перевод на расчетный счет</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Сохранение..." : "Провести Оплату"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
