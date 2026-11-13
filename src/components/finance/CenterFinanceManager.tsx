"use client";

import { useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRightLeft,
  Calendar,
  Lock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  CreditCard,
  Building,
} from "lucide-react";

export interface AccountItem {
  id: string;
  name: string;
  type: string;
  currency: string;
  balance: number;
  isDefault: boolean;
  isActive: boolean;
}

export interface CategoryItem {
  id: string;
  name: string;
  type: "INCOME" | "EXPENSE";
  isActive: boolean;
}

export interface TransactionItem {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  counterparty: string | null;
  accountId: string;
  targetAccountId?: string | null;
  categoryId?: string | null;
  isReversal: boolean;
  reversalReason?: string | null;
  account?: { name: string; type: string };
  targetAccount?: { name: string };
  category?: { name: string };
}

export interface StudentDebtItem {
  studentId: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  monthlyTuition: number;
  totalDue: number;
  totalPaid: number;
  balance: number;
  debtAmount: number;
  status: "DEBT" | "PAID" | "OVERPAID";
  enrollments: Array<{ groupName: string; courseTitle?: string }>;
}

export interface PeriodItem {
  id: string;
  year: number;
  month: number;
  startDate: string;
  endDate: string;
  status: "OPEN" | "CLOSED";
  closedAt: string | null;
  closedBy?: { user: { fullName: string } } | null;
}

export interface SalaryRateItem {
  id: string;
  rateType: string;
  amount: number;
  teacher: { user: { fullName: string; email: string | null } };
  group?: { name: string } | null;
}

interface CenterFinanceManagerProps {
  initialAccounts: AccountItem[];
  initialCategories: CategoryItem[];
  initialTransactions: TransactionItem[];
  initialDebts: StudentDebtItem[];
  initialPeriods: PeriodItem[];
  initialSalaryRates: SalaryRateItem[];
  canWrite: boolean;
  isDirector: boolean;
}

export default function CenterFinanceManager({
  initialAccounts,
  initialCategories,
  initialTransactions,
  initialDebts,
  initialPeriods,
  initialSalaryRates,
  canWrite,
  isDirector,
}: CenterFinanceManagerProps) {
  const [activeTab, setActiveTab] = useState<
    "overview" | "transactions" | "debts" | "accounts" | "categories" | "periods" | "salaries"
  >("overview");

  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [transactions, setTransactions] = useState<TransactionItem[]>(initialTransactions);
  const [debts, setDebts] = useState<StudentDebtItem[]>(initialDebts);
  const [periods, setPeriods] = useState<PeriodItem[]>(initialPeriods);
  const [salaryRates, setSalaryRates] = useState<SalaryRateItem[]>(initialSalaryRates);

  // Filter states
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [debtSearch, setDebtSearch] = useState("");
  const [debtStatusFilter, setDebtStatusFilter] = useState("ALL");

  // Modals state
  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false);
  const [isDisburseSalariesModalOpen, setIsDisburseSalariesModalOpen] = useState(false);
  const [isDebtPayModalOpen, setIsDebtPayModalOpen] = useState<StudentDebtItem | null>(null);

  // Storno / Reversal modal
  const [reversalTx, setReversalTx] = useState<TransactionItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Forms inputs
  const [txType, setTxType] = useState<"INCOME" | "EXPENSE">("INCOME");
  const [txAmount, setTxAmount] = useState<number | "">("");
  const [txAccountId, setTxAccountId] = useState(accounts[0]?.id || "");
  const [txCategoryId, setTxCategoryId] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCounterparty, setTxCounterparty] = useState("");

  const [trAmount, setTrAmount] = useState<number | "">("");
  const [trSourceAcc, setTrSourceAcc] = useState(accounts[0]?.id || "");
  const [trTargetAcc, setTrTargetAcc] = useState(accounts[1]?.id || "");
  const [trDesc, setTrDesc] = useState("");

  const [newAccName, setNewAccName] = useState("");
  const [newAccType, setNewAccType] = useState<"CASH" | "CARD" | "BANK">("CASH");

  const [newCatName, setNewCatName] = useState("");
  const [newCatType, setNewCatType] = useState<"INCOME" | "EXPENSE">("INCOME");

  const [closePeriodYear, setClosePeriodYear] = useState(new Date().getFullYear());
  const [closePeriodMonth, setClosePeriodMonth] = useState(new Date().getMonth() + 1);
  const [closePeriodNotes, setClosePeriodNotes] = useState("");

  const [disburseStart, setDisburseStart] = useState(
    new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  );
  const [disburseEnd, setDisburseEnd] = useState(new Date().toISOString().slice(0, 10));
  const [disburseAcc, setDisburseAcc] = useState(accounts[0]?.id || "");

  const [debtPayAmount, setDebtPayAmount] = useState<number | "">("");
  const [debtPayMethod, setDebtPayMethod] = useState<"CASH" | "ONLINE" | "BANK_TRANSFER">("CASH");

  // Overview calculations
  const totalBalance = accounts.reduce((acc, a) => acc + a.balance, 0);
  const totalIncome = transactions
    .filter((t) => t.type === "INCOME" && !t.isReversal)
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE" && !t.isReversal)
    .reduce((sum, t) => sum + t.amount, 0);
  const netProfit = totalIncome - totalExpense;
  const totalDebtSum = debts.reduce((sum, d) => sum + d.debtAmount, 0);

  // 1. Create Transaction
  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txAmount || Number(txAmount) <= 0) return alert("Укажите сумму");
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txType,
          amount: Number(txAmount),
          accountId: txAccountId,
          categoryId: txCategoryId || null,
          description: txDesc || null,
          counterparty: txCounterparty || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения операции");

      setTransactions([data.transaction, ...transactions]);
      // Update account balance locally
      setAccounts(
        accounts.map((a) =>
          a.id === txAccountId
            ? {
                ...a,
                balance:
                  txType === "INCOME"
                    ? a.balance + Number(txAmount)
                    : a.balance - Number(txAmount),
              }
            : a
        )
      );

      setIsTxModalOpen(false);
      setTxAmount("");
      setTxDesc("");
      setTxCounterparty("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Transfer between accounts
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!trAmount || Number(trAmount) <= 0) return alert("Укажите сумму");
    if (trSourceAcc === trTargetAcc) return alert("Выберите разные счета");
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "TRANSFER",
          amount: Number(trAmount),
          accountId: trSourceAcc,
          targetAccountId: trTargetAcc,
          description: trDesc || "Внутренний перевод между счетами",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка перевода");

      // Reload accounts balances
      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);

      setIsTransferModalOpen(false);
      setTrAmount("");
      setTrDesc("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Storno / Reversal
  const handleReversal = async () => {
    if (!reversalTx) return;
    if (reversalReason.trim().length < 5) {
      return alert("Причина отмены обязательна (минимум 5 символов)");
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/finance/transactions/${reversalTx.id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reversalReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка отмены операции");

      setTransactions([data.reversalTransaction, ...transactions]);
      setReversalTx(null);
      setReversalReason("");

      // Refresh accounts balances
      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Create Account
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccName.trim()) return alert("Укажите название счета");
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAccName.trim(), type: newAccType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания счета");

      setAccounts([...accounts, { ...data.account, balance: 0 }]);
      setIsAccountModalOpen(false);
      setNewAccName("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Create Category
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return alert("Укажите название категории");
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim(), type: newCatType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка создания категории");

      setCategories([...categories, data.category]);
      setIsCategoryModalOpen(false);
      setNewCatName("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Close Period
  const handleClosePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/periods", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year: Number(closePeriodYear),
          month: Number(closePeriodMonth),
          notes: closePeriodNotes || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка закрытия периода");

      setPeriods([data.period, ...periods]);
      setIsClosePeriodModalOpen(false);
      setClosePeriodNotes("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Disburse Teacher Salaries
  const handleDisburseSalaries = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/salary-rates/disburse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: disburseStart,
          endDate: disburseEnd,
          accountId: disburseAcc,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка начисления зарплат");

      alert(
        `Зарплаты успешно выплачены: ${data.createdCount} операций на общую сумму ${data.totalDisbursedAmount.toLocaleString("ru-RU")} UZS`
      );
      setIsDisburseSalariesModalOpen(false);

      // Refresh transactions and balances
      const [txRes, accRes] = await Promise.all([
        fetch("/api/finance/transactions"),
        fetch("/api/finance/accounts"),
      ]);
      const txData = await txRes.json();
      const accData = await accRes.json();
      if (txData.transactions) setTransactions(txData.transactions);
      if (accData.accounts) setAccounts(accData.accounts);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Record Student Debt Payment
  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isDebtPayModalOpen || !debtPayAmount || Number(debtPayAmount) <= 0) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/finance/student-debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentMembershipId: isDebtPayModalOpen.studentId,
          amount: Number(debtPayAmount),
          paymentMethod: debtPayMethod,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка фиксации оплаты");

      // Update student debt item in state
      setDebts(
        debts.map((d) => {
          if (d.studentId !== isDebtPayModalOpen.studentId) return d;
          const newPaid = d.totalPaid + Number(debtPayAmount);
          const newBalance = newPaid - d.totalDue;
          return {
            ...d,
            totalPaid: newPaid,
            balance: newBalance,
            debtAmount: newBalance < 0 ? Math.abs(newBalance) : 0,
            status: newBalance < 0 ? "DEBT" : newBalance > 0 ? "OVERPAID" : "PAID",
          };
        })
      );

      // Refresh accounts balances
      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);

      setIsDebtPayModalOpen(null);
      setDebtPayAmount("");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-7 h-7 text-indigo-600" />
            Финансы и касса центра
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Учет доходов и расходов, управление счетами, начисление зарплат и контроль задолженностей
          </p>
        </div>

        {canWrite && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTransferModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-lg text-xs font-semibold transition"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              Перевод
            </button>
            <button
              onClick={() => setIsTxModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold transition"
            >
              <Plus className="w-4 h-4" />
              Новая операция
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "overview"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Обзор</span>
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "transactions"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Транзакции ({transactions.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("debts")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "debts"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Задолженности ({debts.filter((d) => d.status === "DEBT").length})</span>
        </button>
        <button
          onClick={() => setActiveTab("accounts")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "accounts"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Счета ({accounts.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "categories"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Filter className="w-4 h-4" />
          <span>Категории ({categories.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("periods")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "periods"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Отчетные периоды ({periods.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("salaries")}
          className={`px-4 py-2.5 text-xs font-bold rounded-t-lg transition border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === "salaries"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20"
              : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Зарплаты преподавателей ({salaryRates.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Остаток на счетах</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white mt-2">
                {totalBalance.toLocaleString("ru-RU")} UZS
              </div>
              <div className="text-xs text-slate-500 mt-1">Доступно по всем активным кассам</div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Всего доходов</span>
              <div className="text-2xl font-black text-emerald-600 mt-2">
                +{totalIncome.toLocaleString("ru-RU")} UZS
              </div>
              <div className="text-xs text-slate-500 mt-1">Оплаты обучения и поступления</div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Всего расходов</span>
              <div className="text-2xl font-black text-rose-600 mt-2">
                -{totalExpense.toLocaleString("ru-RU")} UZS
              </div>
              <div className="text-xs text-slate-500 mt-1">Зарплаты, аренда и прочие траты</div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <span className="text-xs font-semibold text-slate-500 uppercase">Долги учеников</span>
              <div className="text-2xl font-black text-amber-600 mt-2">
                {totalDebtSum.toLocaleString("ru-RU")} UZS
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {debts.filter((d) => d.status === "DEBT").length} учеников с задолженностью
              </div>
            </div>
          </div>

          {/* Accounts Mini-Cards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase text-slate-500">Счета и кассы</h3>
              <button
                onClick={() => setActiveTab("accounts")}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Все счета →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between"
                >
                  <div>
                    <span className="font-semibold text-sm text-slate-900 dark:text-white">
                      {acc.name}
                    </span>
                    <span className="block text-[11px] text-slate-400 uppercase">
                      {acc.type} {acc.isDefault ? "• Основной" : ""}
                    </span>
                  </div>
                  <div className="text-right font-bold text-slate-900 dark:text-white text-sm">
                    {acc.balance.toLocaleString("ru-RU")} UZS
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent transactions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold uppercase text-slate-500">Последние операции</h3>
              <button
                onClick={() => setActiveTab("transactions")}
                className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
              >
                Все операции →
              </button>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
              {transactions.slice(0, 7).map((tx) => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          tx.type === "INCOME"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                            : tx.type === "EXPENSE"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                        }`}
                      >
                        {tx.type}
                      </span>
                      <span>{tx.description || tx.category?.name || "Финансовая операция"}</span>
                      {tx.isReversal && (
                        <span className="text-amber-500 font-bold text-[10px]">[СТОРНО]</span>
                      )}
                    </div>
                    <div className="text-slate-400 text-[11px] mt-0.5">
                      {new Date(tx.date).toLocaleDateString()} • {tx.account?.name || "Счет"}
                      {tx.counterparty ? ` • ${tx.counterparty}` : ""}
                    </div>
                  </div>
                  <div
                    className={`font-black text-sm ${
                      tx.type === "INCOME"
                        ? "text-green-600"
                        : tx.type === "EXPENSE"
                        ? "text-red-600"
                        : "text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {tx.amount.toLocaleString("ru-RU")} UZS
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Transactions */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
            <div className="flex gap-2 w-full sm:w-auto flex-1">
              <input
                type="text"
                placeholder="Поиск по описанию или контрагенту..."
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                <option value="">Все типы</option>
                <option value="INCOME">Доход</option>
                <option value="EXPENSE">Расход</option>
                <option value="TRANSFER">Перевод</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Дата</th>
                  <th className="p-3">Тип</th>
                  <th className="p-3">Счет</th>
                  <th className="p-3">Категория</th>
                  <th className="p-3">Описание / Контрагент</th>
                  <th className="p-3 text-right">Сумма</th>
                  <th className="p-3 text-center">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {transactions
                  .filter((t) => {
                    const matchType = !txTypeFilter || t.type === txTypeFilter;
                    const matchSearch =
                      !txSearch ||
                      (t.description && t.description.toLowerCase().includes(txSearch.toLowerCase())) ||
                      (t.counterparty && t.counterparty.toLowerCase().includes(txSearch.toLowerCase()));
                    return matchType && matchSearch;
                  })
                  .map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {new Date(t.date).toLocaleDateString()}
                      </td>
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            t.type === "INCOME"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                              : t.type === "EXPENSE"
                              ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                          }`}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-900 dark:text-white">
                        {t.account?.name || "Счет"}
                      </td>
                      <td className="p-3 text-slate-500">{t.category?.name || "—"}</td>
                      <td className="p-3">
                        <div className="font-medium text-slate-800 dark:text-slate-200">
                          {t.description || "Без описания"}
                        </div>
                        {t.counterparty && (
                          <div className="text-[11px] text-slate-400">
                            Контрагент: {t.counterparty}
                          </div>
                        )}
                        {t.isReversal && (
                          <div className="text-[11px] text-amber-500 font-semibold mt-0.5">
                            Сторнировано: {t.reversalReason}
                          </div>
                        )}
                      </td>
                      <td
                        className={`p-3 text-right font-black ${
                          t.type === "INCOME"
                            ? "text-green-600"
                            : t.type === "EXPENSE"
                            ? "text-red-600"
                            : "text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        {t.type === "INCOME" ? "+" : t.type === "EXPENSE" ? "-" : ""}
                        {t.amount.toLocaleString("ru-RU")} UZS
                      </td>
                      <td className="p-3 text-center">
                        {canWrite && !t.isReversal && (
                          <button
                            onClick={() => setReversalTx(t)}
                            className="p-1 text-slate-400 hover:text-amber-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                            title="Сторнировать / Отменить"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Debts */}
      {activeTab === "debts" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
            <div className="flex gap-2 w-full sm:w-auto flex-1">
              <input
                type="text"
                placeholder="Поиск ученика по ФИО или телефону..."
                value={debtSearch}
                onChange={(e) => setDebtSearch(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
              <select
                value={debtStatusFilter}
                onChange={(e) => setDebtStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              >
                <option value="ALL">Все статусы</option>
                <option value="DEBT">С долгом</option>
                <option value="PAID">Оплачено</option>
                <option value="OVERPAID">Переплата</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Ученик</th>
                  <th className="p-3">Курсы и группы</th>
                  <th className="p-3 text-right">Тариф / мес</th>
                  <th className="p-3 text-right">Оплачено</th>
                  <th className="p-3 text-right">Баланс / Долг</th>
                  <th className="p-3 text-center">Статус</th>
                  <th className="p-3 text-center">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {debts
                  .filter((d) => {
                    const matchSearch =
                      !debtSearch ||
                      d.fullName.toLowerCase().includes(debtSearch.toLowerCase()) ||
                      (d.phone && d.phone.includes(debtSearch));
                    const matchStatus =
                      debtStatusFilter === "ALL" || d.status === debtStatusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map((d) => (
                    <tr key={d.studentId} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30">
                      <td className="p-3">
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {d.fullName}
                        </div>
                        <div className="text-[11px] text-slate-400">{d.phone || "—"}</div>
                      </td>
                      <td className="p-3">
                        <div className="space-y-0.5">
                          {d.enrollments.map((e, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded text-[10px] mr-1"
                            >
                              {e.groupName}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="p-3 text-right font-medium">
                        {d.monthlyTuition.toLocaleString("ru-RU")} UZS
                      </td>
                      <td className="p-3 text-right text-emerald-600 font-bold">
                        {d.totalPaid.toLocaleString("ru-RU")} UZS
                      </td>
                      <td className="p-3 text-right">
                        <span
                          className={`font-black ${
                            d.balance < 0
                              ? "text-rose-600"
                              : d.balance > 0
                              ? "text-blue-600"
                              : "text-slate-500"
                          }`}
                        >
                          {d.balance.toLocaleString("ru-RU")} UZS
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            d.status === "DEBT"
                              ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                              : d.status === "OVERPAID"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          }`}
                        >
                          {d.status === "DEBT"
                            ? `Долг: ${d.debtAmount.toLocaleString("ru-RU")} UZS`
                            : d.status === "OVERPAID"
                            ? "Переплата"
                            : "Оплачено"}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        {canWrite && (
                          <button
                            onClick={() => {
                              setIsDebtPayModalOpen(d);
                              setDebtPayAmount(d.debtAmount > 0 ? d.debtAmount : d.monthlyTuition);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 rounded text-[11px] font-medium"
                          >
                            Принять оплату
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Счета и способы хранения денежных средств
            </h3>
            {canWrite && (
              <button
                onClick={() => setIsAccountModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Добавить счет
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="p-5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white text-base">
                    {acc.name}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 uppercase">
                    {acc.type}
                  </span>
                </div>
                <div className="text-2xl font-black text-slate-900 dark:text-white">
                  {acc.balance.toLocaleString("ru-RU")} UZS
                </div>
                <div className="text-xs text-slate-400">
                  {acc.isDefault ? "Основной счет для зачисления" : "Дополнительный счет"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Categories */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
              Статьи доходов и расходов
            </h3>
            {canWrite && (
              <button
                onClick={() => setIsCategoryModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Новая статья
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-bold text-xs uppercase text-emerald-600 flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4" /> Статьи доходов
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {categories
                  .filter((c) => c.type === "INCOME")
                  .map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-[10px] text-emerald-600 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                        Доход
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <h4 className="font-bold text-xs uppercase text-rose-600 flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" /> Статьи расходов
              </h4>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {categories
                  .filter((c) => c.type === "EXPENSE")
                  .map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-900 dark:text-white">{c.name}</span>
                      <span className="text-[10px] text-rose-600 font-semibold bg-rose-50 dark:bg-rose-950/30 px-2 py-0.5 rounded">
                        Расход
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Periods */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Бухгалтерские отчетные периоды
              </h3>
              <p className="text-xs text-slate-500">
                Закрытие месяца блокирует редактирование и добавление операций задним числом
              </p>
            </div>
            {isDirector && (
              <button
                onClick={() => setIsClosePeriodModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
              >
                <Lock className="w-3.5 h-3.5" /> Закрыть месяц
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Период</th>
                  <th className="p-3">Даты</th>
                  <th className="p-3 text-center">Статус</th>
                  <th className="p-3">Закрыт кем</th>
                  <th className="p-3">Дата закрытия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {p.year} / {p.month < 10 ? `0${p.month}` : p.month}
                    </td>
                    <td className="p-3 text-slate-500">
                      {new Date(p.startDate).toLocaleDateString()} —{" "}
                      {new Date(p.endDate).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          p.status === "CLOSED"
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        }`}
                      >
                        {p.status === "CLOSED" ? "ЗАКРЫТ" : "ОТКРЫТ"}
                      </span>
                    </td>
                    <td className="p-3 text-slate-500">{p.closedBy?.user.fullName || "—"}</td>
                    <td className="p-3 text-slate-500">
                      {p.closedAt ? new Date(p.closedAt).toLocaleString("ru-RU") : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Salaries */}
      {activeTab === "salaries" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">
                Ставки оплаты труда и расчет зарплат
              </h3>
              <p className="text-xs text-slate-500">
                Автоматическое начисление выплат за проведенные уроки согласно ставкам
              </p>
            </div>
            {canWrite && (
              <button
                onClick={() => setIsDisburseSalariesModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
              >
                <DollarSign className="w-3.5 h-3.5" /> Начислить и выплатить ЗП
              </button>
            )}
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3">Преподаватель</th>
                  <th className="p-3">Группа</th>
                  <th className="p-3">Тип ставки</th>
                  <th className="p-3 text-right">Размер ставки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {salaryRates.map((r) => (
                  <tr key={r.id}>
                    <td className="p-3 font-semibold text-slate-900 dark:text-white">
                      {r.teacher.user.fullName}
                    </td>
                    <td className="p-3 text-slate-500">{r.group?.name || "Все группы"}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {r.rateType}
                      </span>
                    </td>
                    <td className="p-3 text-right font-black text-slate-900 dark:text-white">
                      {r.amount.toLocaleString("ru-RU")}{" "}
                      {r.rateType === "PERCENTAGE" ? "%" : "UZS / час"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: New Transaction */}
      {isTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Новая финансовая операция
            </h3>
            <form onSubmit={handleCreateTx} className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTxType("INCOME")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                    txType === "INCOME"
                      ? "bg-green-600 text-white border-green-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600"
                  }`}
                >
                  Доход (+)
                </button>
                <button
                  type="button"
                  onClick={() => setTxType("EXPENSE")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg border ${
                    txType === "EXPENSE"
                      ? "bg-red-600 text-white border-red-600"
                      : "border-slate-200 dark:border-slate-700 text-slate-600"
                  }`}
                >
                  Расход (-)
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Сумма в UZS *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={txAmount}
                  onChange={(e) =>
                    setTxAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Счет *</label>
                <select
                  value={txAccountId}
                  onChange={(e) => setTxAccountId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toLocaleString("ru-RU")} UZS)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Статья / Категория
                </label>
                <select
                  value={txCategoryId}
                  onChange={(e) => setTxCategoryId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <option value="">Без категории</option>
                  {categories
                    .filter((c) => c.type === txType)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Контрагент
                </label>
                <input
                  type="text"
                  placeholder="ФИО клиента, поставщик или арендатор..."
                  value={txCounterparty}
                  onChange={(e) => setTxCounterparty(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Описание</label>
                <input
                  type="text"
                  placeholder="Примечание к платежу..."
                  value={txDesc}
                  onChange={(e) => setTxDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTxModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {actionLoading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Transfer */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-indigo-600" />
              Перевод между счетами
            </h3>
            <form onSubmit={handleTransfer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Счет списания (Откуда) *
                </label>
                <select
                  value={trSourceAcc}
                  onChange={(e) => setTrSourceAcc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toLocaleString("ru-RU")} UZS)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Счет зачисления (Куда) *
                </label>
                <select
                  value={trTargetAcc}
                  onChange={(e) => setTrTargetAcc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toLocaleString("ru-RU")} UZS)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Сумма перевода *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={trAmount}
                  onChange={(e) =>
                    setTrAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Примечание
                </label>
                <input
                  type="text"
                  placeholder="Причина перевода..."
                  value={trDesc}
                  onChange={(e) => setTrDesc(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {actionLoading ? "Выполнение..." : "Перевести"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Storno / Reversal */}
      {reversalTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-500" />
              Сторнирование / Отмена операции
            </h3>
            <p className="text-xs text-slate-500">
              Операция на сумму {reversalTx.amount.toLocaleString("ru-RU")} UZS будет сторнирована
              обратной проводкой. Укажите обязательную причину отмены (минимум 5 символов).
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">
                Причина отмены *
              </label>
              <textarea
                rows={3}
                required
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                placeholder="Ошибочно введена сумма, возврат клиенту..."
                className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReversalTx(null)}
                className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={actionLoading || reversalReason.trim().length < 5}
                onClick={handleReversal}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold"
              >
                {actionLoading ? "Сторнирование..." : "Подтвердить отмену"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Debt Payment */}
      {isDebtPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Прием оплаты</h3>
            <p className="text-xs text-slate-500">
              Ученик: <strong className="text-slate-800 dark:text-slate-200">{isDebtPayModalOpen.fullName}</strong>
            </p>

            <form onSubmit={handlePayDebt} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Сумма к оплате *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={debtPayAmount}
                  onChange={(e) =>
                    setDebtPayAmount(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  className="w-full px-3 py-2 border rounded-lg text-sm bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Способ оплаты *</label>
                <select
                  value={debtPayMethod}
                  onChange={(e) => setDebtPayMethod(e.target.value as "CASH" | "ONLINE" | "BANK_TRANSFER")}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <option value="CASH">Наличные (Касса)</option>
                  <option value="ONLINE">Онлайн-оплата (Payme / Click)</option>
                  <option value="BANK_TRANSFER">Банковский перевод</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDebtPayModalOpen(null)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {actionLoading ? "Проведение..." : "Провести оплату"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Account */}
      {isAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Новый счет</h3>
            <form onSubmit={handleCreateAccount} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Название счета *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Касса №2 или Расчетный счет"
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Тип счета *</label>
                <select
                  value={newAccType}
                  onChange={(e) => setNewAccType(e.target.value as "CASH" | "CARD" | "BANK")}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <option value="CASH">Наличные (CASH)</option>
                  <option value="CARD">Корпоративная карта (CARD)</option>
                  <option value="BANK">Банковский расчетный счет (BANK)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAccountModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  Создать счет
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Category */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">Новая статья учета</h3>
            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Название статьи *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Аренда помещений или Канцтовары"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Тип статьи *</label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as "INCOME" | "EXPENSE")}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <option value="INCOME">Доход (Поступление)</option>
                  <option value="EXPENSE">Расход (Трата)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  Создать статью
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Close Period */}
      {isClosePeriodModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-sm w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-rose-600" />
              Закрытие финансового периода
            </h3>
            <p className="text-xs text-slate-500">
              После закрытия периода добавление, редактирование и отмена проводок за этот месяц будут заблокированы.
            </p>
            <form onSubmit={handleClosePeriod} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Год</label>
                  <input
                    type="number"
                    required
                    value={closePeriodYear}
                    onChange={(e) => setClosePeriodYear(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Месяц</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    required
                    value={closePeriodMonth}
                    onChange={(e) => setClosePeriodMonth(Number(e.target.value))}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Примечание / Комментарий
                </label>
                <textarea
                  rows={2}
                  placeholder="Отчет сдан, сверка завершена..."
                  value={closePeriodNotes}
                  onChange={(e) => setClosePeriodNotes(e.target.value)}
                  className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsClosePeriodModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold"
                >
                  {actionLoading ? "Закрытие..." : "Закрыть месяц"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Disburse Salaries */}
      {isDisburseSalariesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full p-5 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-600" />
              Начисление и выплата зарплат
            </h3>
            <p className="text-xs text-slate-500">
              Будут рассчитаны выплаты за проведенные уроки согласно почасовым ставкам преподавателей.
            </p>
            <form onSubmit={handleDisburseSalaries} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    С даты *
                  </label>
                  <input
                    type="date"
                    required
                    value={disburseStart}
                    onChange={(e) => setDisburseStart(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">
                    По дату *
                  </label>
                  <input
                    type="date"
                    required
                    value={disburseEnd}
                    onChange={(e) => setDisburseEnd(e.target.value)}
                    className="w-full px-3 py-1.5 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Счет выплаты *
                </label>
                <select
                  value={disburseAcc}
                  onChange={(e) => setDisburseAcc(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.balance.toLocaleString("ru-RU")} UZS)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDisburseSalariesModalOpen(false)}
                  className="px-3 py-1.5 border rounded-lg text-xs text-slate-600 hover:bg-slate-100"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold"
                >
                  {actionLoading ? "Расчет и выплата..." : "Выплатить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
