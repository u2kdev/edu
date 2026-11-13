"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Printer,
  Wallet,
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  X,
  Plus,
  ShieldCheck,
} from "lucide-react";
import type { StudentBalanceSummaryDTO, StudentReceiptDTO } from "@/lib/student-balance";

export interface PaymentItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt?: Date | string | null;
  createdAt?: Date | string;
  student: {
    user: { fullName: string; email?: string };
  };
  group?: { name: string } | null;
}

export interface StudentSelectItem {
  id: string;
  user: { fullName: string; email?: string };
}

interface PaymentsManagerProps {
  initialPayments: PaymentItem[];
  students: StudentSelectItem[];
  groups?: { id: string; name: string }[];
  role?: string;
  studentBalances?: StudentBalanceSummaryDTO[];
  centerName?: string;
}

export default function PaymentsManager({
  initialPayments,
  students,
  role,
  studentBalances = [],
  centerName = "Учебный центр",
}: PaymentsManagerProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [studentMembershipId, setStudentMembershipId] = useState(students[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [loading, setLoading] = useState(false);

  const [selectedChildId, setSelectedChildId] = useState<string>(
    studentBalances[0]?.studentMembershipId || ""
  );
  const [activeReceipt, setActiveReceipt] = useState<StudentReceiptDTO | null>(null);

  const canManage = role === "DIRECTOR" || role === "CENTER_ADMIN" || role === "ACCOUNTANT";
  const isStudentOrParent = role === "STUDENT" || role === "PARENT";

  const activeBalance =
    studentBalances.find((b) => b.studentMembershipId === selectedChildId) ||
    studentBalances[0] ||
    null;

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/center-payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId,
          amount,
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowModal(false);
        setAmount("");
        router.refresh();
      } else {
        alert(data.error);
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue?: Date | string | null) => {
    if (!dateValue) return "—";
    return new Date(dateValue).toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  const openReceiptForPayment = (p: PaymentItem) => {
    const matchedReceipt = activeBalance?.payments.find((r) => r.id === p.id);
    if (matchedReceipt) {
      setActiveReceipt(matchedReceipt);
      return;
    }
    setActiveReceipt({
      id: p.id,
      receiptNumber: `INV-${p.id.slice(0, 8).toUpperCase()}`,
      studentMembershipId: "",
      studentName: p.student.user.fullName,
      groupName: p.group?.name || null,
      courseTitle: null,
      amount: p.amount,
      originalAmount: p.amount,
      discountPercent: null,
      promoCodeUsed: null,
      currency: p.currency,
      status: p.status,
      paymentMethod: p.paymentMethod,
      paidAt: p.paidAt ? new Date(p.paidAt).toISOString() : null,
      createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : new Date().toISOString(),
      center: {
        name: centerName,
        legalName: null,
        inn: null,
        address: null,
        phone: null,
      },
    });
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
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Зафиксировать Платеж</span>
          </button>
        </div>
      )}

      {/* Parent Child Selector */}
      {role === "PARENT" && studentBalances.length > 1 && (
        <div className="flex flex-wrap items-center gap-2 p-3 rounded-2xl bg-slate-900/60 border border-slate-800">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-2">
            Ребёнок:
          </span>
          {studentBalances.map((child) => (
            <button
              key={child.studentMembershipId}
              onClick={() => setSelectedChildId(child.studentMembershipId)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeBalance?.studentMembershipId === child.studentMembershipId
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/25"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {child.fullName}
              {child.debtAmount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px]">
                  Долг: {child.debtAmount.toLocaleString("ru-RU")} UZS
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Student / Parent Balance Overview */}
      {isStudentOrParent && activeBalance && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div
              className={`glass-panel p-5 rounded-2xl border ${
                activeBalance.debtAmount > 0
                  ? "border-rose-500/30 bg-rose-500/5"
                  : "border-emerald-500/30 bg-emerald-500/5"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Текущий долг
                </span>
                {activeBalance.debtAmount > 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <p
                className={`text-2xl font-extrabold ${
                  activeBalance.debtAmount > 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {activeBalance.debtAmount.toLocaleString("ru-RU")} UZS
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {activeBalance.debtAmount > 0
                  ? "Требуется погашение задолженности"
                  : activeBalance.overpaidAmount > 0
                  ? `Переплата: ${activeBalance.overpaidAmount.toLocaleString("ru-RU")} UZS`
                  : "Задолженности нет"}
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ближайший платёж
                </span>
                <CalendarClock className="w-4 h-4 text-amber-400" />
              </div>
              {activeBalance.nextPayment ? (
                <>
                  <p className="text-2xl font-extrabold text-white">
                    {activeBalance.nextPayment.amount.toLocaleString("ru-RU")} UZS
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    До {formatDate(activeBalance.nextPayment.dueDate)} •{" "}
                    {activeBalance.nextPayment.description}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xl font-bold text-slate-300">Нет активных счетов</p>
                  <p className="text-xs text-slate-500 mt-1">Все начисления оплачены</p>
                </>
              )}
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Всего оплачено
                </span>
                <Wallet className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-extrabold text-emerald-400">
                {activeBalance.totalPaid.toLocaleString("ru-RU")} UZS
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Начислено за весь период: {activeBalance.totalAccrued.toLocaleString("ru-RU")} UZS
              </p>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800/80">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Ежемесячный тариф
                </span>
                <Wallet className="w-4 h-4 text-cyan-400" />
              </div>
              <p className="text-2xl font-extrabold text-white">
                {activeBalance.monthlyTuition.toLocaleString("ru-RU")} UZS
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Активных групп: {activeBalance.enrollments.length}
              </p>
            </div>
          </div>

          {activeBalance.enrollments.length > 0 && (
            <div className="glass-panel p-4 rounded-2xl border border-slate-800/80">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Детализация начислений по группам ({activeBalance.fullName})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {activeBalance.enrollments.map((en) => (
                  <div
                    key={en.enrollmentId}
                    className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">{en.groupName}</p>
                      <p className="text-xs text-slate-400">
                        {en.courseTitle} • {en.priceMonthly.toLocaleString("ru-RU")} UZS/мес. ×{" "}
                        {en.monthsEnrolled} мес.
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-slate-200">
                        {en.accruedAmount.toLocaleString("ru-RU")} UZS
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
              <th className="p-4 text-right">Квитанция</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80">
            {initialPayments.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-500">
                  История оплат пока пуста.
                </td>
              </tr>
            ) : (
              initialPayments.map((p) => (
                <tr key={p.id} className="hover:bg-slate-900/30 transition-colors">
                  <td className="p-4">
                    <div className="font-semibold text-white">{p.student.user.fullName}</div>
                    {(p.group?.name || p.student.user.email) && (
                      <div className="text-xs text-slate-500">
                        {p.group?.name || p.student.user.email}
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-bold text-emerald-400">
                    {p.amount.toLocaleString("ru-RU")} {p.currency}
                  </td>
                  <td className="p-4 text-slate-300">
                    {p.paymentMethod === "CASH"
                      ? "💵 Наличные / Касса"
                      : p.paymentMethod === "ONLINE"
                      ? "💳 Онлайн Эквайринг"
                      : p.paymentMethod === "BANK_TRANSFER"
                      ? "🏦 Банковский перевод"
                      : p.paymentMethod || "Не указан"}
                  </td>
                  <td className="p-4">
                    <span
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                        p.status === "PAID"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : p.status === "PENDING"
                          ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          : "bg-red-500/10 text-red-400 border-red-500/20"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-400">{formatDate(p.paidAt || p.createdAt)}</td>
                  <td className="p-4 text-right">
                    <button
                      type="button"
                      onClick={() => openReceiptForPayment(p)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Квитанция
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Printable Receipt Modal */}
      {activeReceipt && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
                  Платёжная квитанция
                </p>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  № {activeReceipt.receiptNumber}
                </h3>
              </div>
              <button
                onClick={() => setActiveReceipt(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Учебный центр:</span>
                <span className="font-semibold text-white">{activeReceipt.center.name}</span>
              </div>
              {activeReceipt.center.inn && (
                <div className="flex justify-between">
                  <span className="text-slate-400">ИНН:</span>
                  <span className="text-slate-200">{activeReceipt.center.inn}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Ученик:</span>
                <span className="font-semibold text-white">{activeReceipt.studentName}</span>
              </div>
              {activeReceipt.groupName && (
                <div className="flex justify-between">
                  <span className="text-slate-400">Группа:</span>
                  <span className="text-slate-200">{activeReceipt.groupName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-400">Способ оплаты:</span>
                <span className="text-slate-200">{activeReceipt.paymentMethod || "CASH"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Статус:</span>
                <span className="font-semibold text-emerald-400">{activeReceipt.status}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Дата:</span>
                <span className="text-slate-200">
                  {formatDate(activeReceipt.paidAt || activeReceipt.createdAt)}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-between items-baseline">
                <span className="text-slate-300 font-semibold">Итоговая сумма:</span>
                <span className="text-xl font-extrabold text-emerald-400">
                  {activeReceipt.amount.toLocaleString("ru-RU")} {activeReceipt.currency}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setActiveReceipt(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/25"
              >
                <Printer className="w-4 h-4" />
                Распечатать квитанцию
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Зафиксировать Оплату Учеником</h3>
            <form onSubmit={handleRecordPayment} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Ученик
                </label>
                <select
                  required
                  value={studentMembershipId}
                  onChange={(e) => setStudentMembershipId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                >
                  {students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.user.fullName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Сумма (UZS)
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="например 500 000"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Способ Оплаты
                </label>
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
