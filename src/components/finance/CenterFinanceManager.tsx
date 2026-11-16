"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { OnlinePaymentsTab } from "./OnlinePaymentsTab";
import { CenterFinanceAnalytics } from "./CenterFinanceAnalytics";
import type { CenterFinanceAnalyticsDTO } from "@/lib/finance-analytics";
import { formatUzs } from "@/lib/money";
import { t } from "@/i18n";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  ArrowRightLeft,
  Lock,
  Plus,
  Filter,
  RotateCcw,
  UserCheck,
  CreditCard,
  Building,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  status: "DEBT" | "PAID" | "OVERPAID" | "FROZEN" | "NO_CHARGES";
  paidUntil?: string | null;
  enrollments: Array<{
    groupName: string;
    courseTitle?: string;
    status?: string;
    paidUntil?: string | null;
  }>;
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
  initialAnalytics?: CenterFinanceAnalyticsDTO | null;
  canExport?: boolean;
  canWrite: boolean;
  isDirector: boolean;
  locale?: string;
}

const FINANCE_TABS = [
  "overview",
  "transactions",
  "debts",
  "accounts",
  "categories",
  "periods",
  "salaries",
  "online",
] as const;

type FinanceTab = (typeof FINANCE_TABS)[number];

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export default function CenterFinanceManager({
  initialAccounts,
  initialCategories,
  initialTransactions,
  initialDebts,
  initialPeriods,
  initialSalaryRates,
  initialAnalytics = null,
  canExport = true,
  canWrite,
  isDirector,
  locale = "ru",
}: CenterFinanceManagerProps) {
  const searchParams = useSearchParams();
  const requestedTabParam = searchParams?.get("tab");
  const initialResolvedTab: FinanceTab =
    requestedTabParam && (FINANCE_TABS as readonly string[]).includes(requestedTabParam)
      ? (requestedTabParam as FinanceTab)
      : "overview";

  const [activeTab, setActiveTab] = useState<FinanceTab>(initialResolvedTab);

  useEffect(() => {
    if (requestedTabParam && (FINANCE_TABS as readonly string[]).includes(requestedTabParam)) {
      setActiveTab(requestedTabParam as FinanceTab);
    } else if (!requestedTabParam) {
      setActiveTab("overview");
    }
  }, [requestedTabParam]);

  const [accounts, setAccounts] = useState<AccountItem[]>(initialAccounts);
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [transactions, setTransactions] = useState<TransactionItem[]>(initialTransactions);
  const [debts, setDebts] = useState<StudentDebtItem[]>(initialDebts);
  const [debtsPage, setDebtsPage] = useState(1);
  const [debtsTotalPages, setDebtsTotalPages] = useState(1);
  const [debtsTotal, setDebtsTotal] = useState(initialDebts.length);
  const [periods, setPeriods] = useState<PeriodItem[]>(initialPeriods);
  const [salaryRates] = useState<SalaryRateItem[]>(initialSalaryRates);

  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("");
  const [debtSearch, setDebtSearch] = useState("");
  const [debtStatusFilter, setDebtStatusFilter] = useState("ALL");

  const fetchServerDebts = useCallback(
    async (pageNum: number, searchStr: string, statusStr: string) => {
      try {
        const params = new URLSearchParams({ page: String(pageNum), limit: "25" });
        if (searchStr.trim()) params.set("search", searchStr.trim());
        if (statusStr && statusStr !== "ALL") params.set("status", statusStr);
        const res = await fetch(`/api/finance/student-debts?${params.toString()}`);
        const data = await res.json();
        if (res.ok && Array.isArray(data.debts)) {
          setDebts(data.debts);
          setDebtsPage(data.pagination?.page || pageNum);
          setDebtsTotalPages(data.pagination?.totalPages || 1);
          setDebtsTotal(data.pagination?.total ?? data.debts.length);
        }
      } catch {
        // Keep initial SSR debts on transient error
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab !== "debts") return;
    const timer = setTimeout(() => {
      void fetchServerDebts(debtsPage, debtSearch, debtStatusFilter);
    }, 200);
    return () => clearTimeout(timer);
  }, [activeTab, debtsPage, debtSearch, debtStatusFilter, fetchServerDebts]);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isClosePeriodModalOpen, setIsClosePeriodModalOpen] = useState(false);
  const [isDisburseSalariesModalOpen, setIsDisburseSalariesModalOpen] = useState(false);
  const [isDebtPayModalOpen, setIsDebtPayModalOpen] = useState<StudentDebtItem | null>(null);

  const [reversalTx, setReversalTx] = useState<TransactionItem | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [financeNotice, setFinanceNotice] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

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

  const handleCreateTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!txAmount || Number(txAmount) <= 0) {
      setModalError("Укажите сумму");
      return;
    }
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
      setFinanceNotice({ type: "success", text: "Операция сохранена." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!trAmount || Number(trAmount) <= 0) {
      setModalError("Укажите сумму");
      return;
    }
    if (trSourceAcc === trTargetAcc) {
      setModalError("Выберите разные счета");
      return;
    }
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

      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);

      setIsTransferModalOpen(false);
      setTrAmount("");
      setTrDesc("");
      setFinanceNotice({ type: "success", text: "Перевод между счетами выполнен." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReversal = async () => {
    if (!reversalTx) return;
    setModalError(null);
    if (reversalReason.trim().length < 5) {
      setModalError("Причина отмены обязательна (минимум 5 символов)");
      return;
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

      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);
      setFinanceNotice({ type: "success", text: "Операция сторнирована." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newAccName.trim()) {
      setModalError("Укажите название счета");
      return;
    }
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
      setFinanceNotice({ type: "success", text: "Счет создан." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!newCatName.trim()) {
      setModalError("Укажите название категории");
      return;
    }
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
      setFinanceNotice({ type: "success", text: "Статья учета создана." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleClosePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
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
      setFinanceNotice({ type: "success", text: "Финансовый период закрыт." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisburseSalaries = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
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

      setFinanceNotice({
        type: "success",
        text: `Зарплаты успешно выплачены: ${data.createdCount} операций на общую сумму ${formatUzs(
          data.totalDisbursedAmount,
          { locale }
        )}`,
      });
      setIsDisburseSalariesModalOpen(false);

      const [txRes, accRes] = await Promise.all([
        fetch("/api/finance/transactions"),
        fetch("/api/finance/accounts"),
      ]);
      const txData = await txRes.json();
      const accData = await accRes.json();
      if (txData.transactions) setTransactions(txData.transactions);
      if (accData.accounts) setAccounts(accData.accounts);
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePayDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    if (!isDebtPayModalOpen || !debtPayAmount || Number(debtPayAmount) <= 0) {
      setModalError("Укажите сумму");
      return;
    }
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

      const accRes = await fetch("/api/finance/accounts");
      const accData = await accRes.json();
      if (accData.accounts) setAccounts(accData.accounts);

      setIsDebtPayModalOpen(null);
      setDebtPayAmount("");
      setFinanceNotice({ type: "success", text: "Оплата долга зафиксирована." });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setActionLoading(false);
    }
  };

  const tabClass = (key: FinanceTab) =>
    `px-3.5 py-2.5 text-xs font-medium rounded-t-md transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
      activeTab === key
        ? "border-primary text-primary bg-primary/5"
        : "border-transparent text-muted-foreground hover:text-foreground"
    }`;

  const filteredTransactions = useMemo(() => {
    const q = txSearch.toLowerCase();
    return transactions.filter((tx) => {
      const matchType = !txTypeFilter || tx.type === txTypeFilter;
      const matchSearch =
        !q ||
        (tx.description && tx.description.toLowerCase().includes(q)) ||
        (tx.counterparty && tx.counterparty.toLowerCase().includes(q));
      return matchType && matchSearch;
    });
  }, [transactions, txSearch, txTypeFilter]);

  const filteredDebts = useMemo(() => {
    const q = debtSearch.toLowerCase();
    return debts.filter((d) => {
      const matchSearch =
        !q ||
        d.fullName.toLowerCase().includes(q) ||
        (d.phone && d.phone.includes(debtSearch));
      const matchStatus = debtStatusFilter === "ALL" || d.status === debtStatusFilter;
      return matchSearch && matchStatus;
    });
  }, [debts, debtSearch, debtStatusFilter]);

  const txColumns = useMemo<DataTableColumn<TransactionItem>[]>(
    () => [
      {
        id: "date",
        header: "Дата",
        sortable: true,
        sortValue: (tx) => new Date(tx.date).getTime(),
        cell: (tx) => (
          <span className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
            {new Date(tx.date).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "type",
        header: "Тип",
        sortable: true,
        sortValue: (tx) => tx.type,
        cell: (tx) => (
          <Badge
            variant={
              tx.type === "INCOME"
                ? "success"
                : tx.type === "EXPENSE"
                ? "destructive"
                : "info"
            }
          >
            {tx.type}
          </Badge>
        ),
      },
      {
        id: "account",
        header: "Счет",
        cell: (tx) => (
          <span className="text-xs font-medium text-foreground">
            {tx.account?.name || "Счет"}
          </span>
        ),
      },
      {
        id: "category",
        header: "Категория",
        cell: (tx) => (
          <span className="text-xs text-muted-foreground">{tx.category?.name || "—"}</span>
        ),
      },
      {
        id: "description",
        header: "Описание / Контрагент",
        cell: (tx) => (
          <div className="text-xs">
            <div className="font-medium text-foreground">
              {tx.description || "Без описания"}
            </div>
            {tx.counterparty && (
              <div className="text-xs text-muted-foreground">Контрагент: {tx.counterparty}</div>
            )}
            {tx.isReversal && (
              <div className="mt-0.5 text-xs font-medium text-warning">
                Сторнировано: {tx.reversalReason}
              </div>
            )}
          </div>
        ),
      },
      {
        id: "amount",
        header: "Сумма",
        align: "right",
        sortable: true,
        sortValue: (tx) => tx.amount,
        cell: (tx) => (
          <span
            className={`text-xs font-semibold tabular-nums ${
              tx.type === "INCOME"
                ? "text-success"
                : tx.type === "EXPENSE"
                ? "text-destructive"
                : "text-foreground"
            }`}
          >
            {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
            {formatUzs(tx.amount, { locale })}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Действия",
        align: "center",
        cell: (tx) =>
          canWrite && !tx.isReversal ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setModalError(null);
                setReversalReason("");
                setReversalTx(tx);
              }}
              title="Сторнировать / Отменить"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          ) : null,
      },
    ],
    [canWrite, locale]
  );

  const debtColumns = useMemo<DataTableColumn<StudentDebtItem>[]>(
    () => [
      {
        id: "student",
        header: "Ученик",
        sortable: true,
        sortValue: (d) => d.fullName,
        cell: (d) => (
          <div>
            <div className="text-xs font-medium text-foreground">{d.fullName}</div>
            <div className="text-xs text-muted-foreground">{d.phone || "—"}</div>
          </div>
        ),
      },
      {
        id: "groups",
        header: "Курсы и группы",
        cell: (d) => (
          <div className="flex flex-wrap gap-1">
            {d.enrollments.map((e, idx) => (
              <Badge key={idx} variant="neutral">
                {e.groupName}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        id: "monthlyTuition",
        header: "Тариф / мес",
        align: "right",
        sortable: true,
        sortValue: (d) => d.monthlyTuition,
        cell: (d) => (
          <span className="text-xs font-medium tabular-nums">
            {formatUzs(d.monthlyTuition, { locale })}
          </span>
        ),
      },
      {
        id: "totalPaid",
        header: "Оплачено",
        align: "right",
        sortable: true,
        sortValue: (d) => d.totalPaid,
        cell: (d) => (
          <span className="text-xs font-medium text-success tabular-nums">
            {formatUzs(d.totalPaid, { locale })}
          </span>
        ),
      },
      {
        id: "paidUntil",
        header: "Оплачено до",
        align: "center",
        cell: (d) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {d.paidUntil ? new Date(d.paidUntil).toLocaleDateString("ru-RU") : "—"}
          </span>
        ),
      },
      {
        id: "balance",
        header: "Баланс / Долг",
        align: "right",
        sortable: true,
        sortValue: (d) => d.balance,
        cell: (d) => (
          <span
            className={`text-xs font-semibold tabular-nums ${
              d.balance < 0
                ? "text-destructive"
                : d.balance > 0
                ? "text-info"
                : "text-muted-foreground"
            }`}
          >
            {formatUzs(d.balance, { locale })}
          </span>
        ),
      },
      {
        id: "status",
        header: "Статус",
        align: "center",
        cell: (d) => (
          <Badge
            variant={
              d.status === "DEBT"
                ? "destructive"
                : d.status === "FROZEN" || d.status === "OVERPAID"
                ? "info"
                : d.status === "NO_CHARGES"
                ? "neutral"
                : "success"
            }
          >
            {d.status === "DEBT"
              ? `Долг: ${formatUzs(d.debtAmount, { locale })}`
              : d.status === "FROZEN"
              ? "Заморожен"
              : d.status === "OVERPAID"
              ? "Переплата"
              : d.status === "NO_CHARGES"
              ? "Нет начислений"
              : "Оплачено"}
          </Badge>
        ),
      },
      {
        id: "action",
        header: "Действие",
        align: "center",
        cell: (d) =>
          canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setModalError(null);
                setIsDebtPayModalOpen(d);
                setDebtPayAmount(d.debtAmount > 0 ? d.debtAmount : d.monthlyTuition);
              }}
            >
              Принять оплату
            </Button>
          ) : null,
      },
    ],
    [canWrite, locale]
  );

  const periodColumns = useMemo<DataTableColumn<PeriodItem>[]>(
    () => [
      {
        id: "period",
        header: "Период",
        sortable: true,
        sortValue: (p) => p.year * 100 + p.month,
        cell: (p) => (
          <span className="text-xs font-medium text-foreground tabular-nums">
            {p.year} / {p.month < 10 ? `0${p.month}` : p.month}
          </span>
        ),
      },
      {
        id: "dates",
        header: "Даты",
        cell: (p) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(p.startDate).toLocaleDateString()} —{" "}
            {new Date(p.endDate).toLocaleDateString()}
          </span>
        ),
      },
      {
        id: "status",
        header: "Статус",
        align: "center",
        cell: (p) => (
          <Badge variant={p.status === "CLOSED" ? "destructive" : "success"}>
            {p.status === "CLOSED" ? "Закрыт" : "Открыт"}
          </Badge>
        ),
      },
      {
        id: "closedBy",
        header: "Закрыт кем",
        cell: (p) => (
          <span className="text-xs text-muted-foreground">
            {p.closedBy?.user.fullName || "—"}
          </span>
        ),
      },
      {
        id: "closedAt",
        header: "Дата закрытия",
        cell: (p) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {p.closedAt ? new Date(p.closedAt).toLocaleString("ru-RU") : "—"}
          </span>
        ),
      },
    ],
    []
  );

  const salaryColumns = useMemo<DataTableColumn<SalaryRateItem>[]>(
    () => [
      {
        id: "teacher",
        header: "Преподаватель",
        sortable: true,
        sortValue: (r) => r.teacher.user.fullName,
        cell: (r) => (
          <span className="text-xs font-medium text-foreground">{r.teacher.user.fullName}</span>
        ),
      },
      {
        id: "group",
        header: "Группа",
        cell: (r) => (
          <span className="text-xs text-muted-foreground">{r.group?.name || "Все группы"}</span>
        ),
      },
      {
        id: "rateType",
        header: "Тип ставки",
        cell: (r) => <Badge variant="neutral">{r.rateType}</Badge>,
      },
      {
        id: "amount",
        header: "Размер ставки",
        align: "right",
        sortable: true,
        sortValue: (r) => r.amount,
        cell: (r) => (
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {r.rateType === "PERCENTAGE"
              ? `${r.amount}%`
              : `${formatUzs(r.amount, { locale })} / час`}
          </span>
        ),
      },
    ],
    [locale]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t(locale, "finance.title")}
        description={t(locale, "finance.subtitle")}
        actions={
          canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsTransferModalOpen(true);
                }}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t(locale, "finance.addTransfer")}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsTxModalOpen(true);
                }}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{t(locale, "finance.addIncome")}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      {financeNotice && (
        <Alert variant={financeNotice.type === "success" ? "success" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{financeNotice.text}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFinanceNotice(null)}
            >
              Закрыть
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border gap-1 overflow-x-auto">
        <button type="button" onClick={() => setActiveTab("overview")} className={tabClass("overview")}>
          <TrendingUp className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.overview")}</span>
        </button>
        <button type="button" onClick={() => setActiveTab("transactions")} className={tabClass("transactions")}>
          <DollarSign className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.transactions")} ({transactions.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("debts")} className={tabClass("debts")}>
          <UserCheck className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.debtors")} ({debts.filter((d) => d.status === "DEBT").length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("accounts")} className={tabClass("accounts")}>
          <CreditCard className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.accounts")} ({accounts.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("categories")} className={tabClass("categories")}>
          <Filter className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.categories")} ({categories.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("periods")} className={tabClass("periods")}>
          <Lock className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.periods")} ({periods.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("salaries")} className={tabClass("salaries")}>
          <Building className="w-4 h-4" aria-hidden="true" />
          <span>{t(locale, "finance.salaries")} ({salaryRates.length})</span>
        </button>
        <button type="button" onClick={() => setActiveTab("online")} className={tabClass("online")}>
          <CreditCard className="w-4 h-4" aria-hidden="true" />
          <span>Click</span>
        </button>
      </div>

      {/* Tab 1: Overview & Full Financial Charts */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {initialAnalytics && (
            <CenterFinanceAnalytics
              initialData={initialAnalytics}
              locale={locale}
              canExport={canExport}
            />
          )}

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">{t(locale, "finance.accounts")}</h3>
              <button
                type="button"
                onClick={() => setActiveTab("accounts")}
                className="text-xs text-primary hover:underline font-medium"
              >
                {t(locale, "dashboard.moreDetails")} →
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {accounts.map((acc) => (
                <Card key={acc.id}>
                  <CardContent className="p-4 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium text-sm text-foreground">{acc.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {acc.type} {acc.isDefault ? "• Основной" : ""}
                      </div>
                    </div>
                    <div className="text-right font-semibold text-foreground text-sm tabular-nums">
                      {formatUzs(acc.balance, { locale })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>{t(locale, "finance.transactions")}</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab("transactions")}>
                {t(locale, "dashboard.moreDetails")}
              </Button>
            </CardHeader>
            <CardContent className="pt-0 divide-y divide-border">
              {transactions.slice(0, 7).map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                  <div>
                    <div className="font-medium text-foreground flex items-center gap-2">
                      <Badge
                        variant={
                          tx.type === "INCOME"
                            ? "success"
                            : tx.type === "EXPENSE"
                            ? "destructive"
                            : "info"
                        }
                      >
                        {tx.type}
                      </Badge>
                      <span>{tx.description || tx.category?.name || "Финансовая операция"}</span>
                      {tx.isReversal && (
                        <Badge variant="warning">{t(locale, "finance.reversalBadge")}</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {new Date(tx.date).toLocaleDateString()} • {tx.account?.name || "Счет"}
                      {tx.counterparty ? ` • ${tx.counterparty}` : ""}
                    </div>
                  </div>
                  <div
                    className={`font-semibold text-sm tabular-nums ${
                      tx.type === "INCOME"
                        ? "text-success"
                        : tx.type === "EXPENSE"
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {formatUzs(tx.amount, { locale })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab 2: Transactions */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          <FilterBar
            locale={locale}
            search={txSearch}
            onSearchChange={setTxSearch}
            searchPlaceholder="Поиск по описанию или контрагенту..."
            hasActiveFilters={Boolean(txSearch || txTypeFilter)}
            onReset={() => {
              setTxSearch("");
              setTxTypeFilter("");
            }}
          >
            <select
              aria-label="Тип операции"
              value={txTypeFilter}
              onChange={(e) => setTxTypeFilter(e.target.value)}
              className={`${SELECT_CLS} w-40 text-[13px]`}
            >
              <option value="">Все типы</option>
              <option value="INCOME">Доход</option>
              <option value="EXPENSE">Расход</option>
              <option value="TRANSFER">Перевод</option>
            </select>
          </FilterBar>

          <DataTable
            data={filteredTransactions}
            columns={txColumns}
            getRowId={(tx) => tx.id}
            locale={locale}
            emptyTitle="Финансовые операции не найдены"
            mobileCardRender={(tx) => (
              <div className="space-y-1.5 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">
                      {tx.description || tx.category?.name || "Без описания"}
                    </div>
                    <div className="text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString()} · {tx.account?.name || "Счет"}
                    </div>
                  </div>
                  <span
                    className={`font-semibold tabular-nums ${
                      tx.type === "INCOME"
                        ? "text-success"
                        : tx.type === "EXPENSE"
                        ? "text-destructive"
                        : "text-foreground"
                    }`}
                  >
                    {tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "-" : ""}
                    {formatUzs(tx.amount, { locale })}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Badge
                    variant={
                      tx.type === "INCOME"
                        ? "success"
                        : tx.type === "EXPENSE"
                        ? "destructive"
                        : "info"
                    }
                  >
                    {tx.type}
                  </Badge>
                  {canWrite && !tx.isReversal && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setModalError(null);
                        setReversalReason("");
                        setReversalTx(tx);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>Сторнировать</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          />
        </div>
      )}

      {/* Tab 3: Debts */}
      {activeTab === "debts" && (
        <div className="space-y-4">
          <FilterBar
            locale={locale}
            search={debtSearch}
            onSearchChange={setDebtSearch}
            searchPlaceholder="Поиск ученика по ФИО или телефону..."
            hasActiveFilters={Boolean(debtSearch || debtStatusFilter !== "ALL")}
            onReset={() => {
              setDebtSearch("");
              setDebtStatusFilter("ALL");
              setDebtsPage(1);
            }}
          >
            <select
              aria-label="Статус долга"
              value={debtStatusFilter}
              onChange={(e) => {
                setDebtStatusFilter(e.target.value);
                setDebtsPage(1);
              }}
              className={`${SELECT_CLS} w-44 text-[13px]`}
            >
              <option value="ALL">Все статусы</option>
              <option value="DEBT">С долгом</option>
              <option value="PAID">Оплачено</option>
              <option value="OVERPAID">Переплата</option>
              <option value="FROZEN">Заморожен</option>
            </select>
          </FilterBar>

          <DataTable
            data={filteredDebts}
            columns={debtColumns}
            getRowId={(d) => d.studentId}
            locale={locale}
            page={debtsPage}
            totalPages={debtsTotalPages}
            totalItems={debtsTotal}
            pageSize={25}
            onPageChange={setDebtsPage}
            emptyTitle="Записи по долгам учеников не найдены"
            mobileCardRender={(d) => (
              <div className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-foreground">{d.fullName}</div>
                    <div className="text-muted-foreground">{d.phone || "—"}</div>
                  </div>
                  <Badge
                    variant={
                      d.status === "DEBT"
                        ? "destructive"
                        : d.status === "FROZEN" || d.status === "OVERPAID"
                        ? "info"
                        : d.status === "NO_CHARGES"
                        ? "neutral"
                        : "success"
                    }
                  >
                    {d.status === "DEBT"
                      ? `Долг: ${formatUzs(d.debtAmount, { locale })}`
                      : d.status === "FROZEN"
                      ? "Заморожен"
                      : d.status === "OVERPAID"
                      ? "Переплата"
                      : d.status === "NO_CHARGES"
                      ? "Нет начислений"
                      : "Оплачено"}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground tabular-nums">
                  <span>Тариф: {formatUzs(d.monthlyTuition, { locale })}</span>
                  <span>Оплачено: {formatUzs(d.totalPaid, { locale })}</span>
                </div>
                {canWrite && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setModalError(null);
                      setIsDebtPayModalOpen(d);
                      setDebtPayAmount(d.debtAmount > 0 ? d.debtAmount : d.monthlyTuition);
                    }}
                  >
                    Принять оплату
                  </Button>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* Tab 4: Accounts */}
      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-foreground">
              Счета и способы хранения денежных средств
            </h3>
            {canWrite && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsAccountModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Добавить счет</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <Card key={acc.id}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground text-base">{acc.name}</span>
                    <Badge variant="neutral">{acc.type}</Badge>
                  </div>
                  <div className="text-2xl font-semibold text-foreground tabular-nums">
                    {formatUzs(acc.balance, { locale })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {acc.isDefault ? "Основной счет для зачисления" : "Дополнительный счет"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 5: Categories */}
      {activeTab === "categories" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-semibold text-foreground">
              Статьи доходов и расходов
            </h3>
            {canWrite && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsCategoryModalOpen(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Новая статья</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-success flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" aria-hidden="true" />
                  <span>Статьи доходов</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border pt-0">
                {categories
                  .filter((c) => c.type === "INCOME")
                  .map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <Badge variant="success">Доход</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-destructive flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" aria-hidden="true" />
                  <span>Статьи расходов</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border pt-0">
                {categories
                  .filter((c) => c.type === "EXPENSE")
                  .map((c) => (
                    <div key={c.id} className="py-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground">{c.name}</span>
                      <Badge variant="destructive">Расход</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Tab 6: Periods */}
      {activeTab === "periods" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Бухгалтерские отчетные периоды
              </h3>
              <p className="text-xs text-muted-foreground">
                Закрытие месяца блокирует редактирование и добавление операций задним числом
              </p>
            </div>
            {isDirector && (
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsClosePeriodModalOpen(true);
                }}
              >
                <Lock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Закрыть месяц</span>
              </Button>
            )}
          </div>

          <DataTable
            data={periods}
            columns={periodColumns}
            getRowId={(p) => p.id}
            locale={locale}
            emptyTitle="Отчетные периоды еще не созданы"
          />
        </div>
      )}

      {/* Tab 7: Salaries */}
      {activeTab === "salaries" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Ставки оплаты труда и расчет зарплат
              </h3>
              <p className="text-xs text-muted-foreground">
                Автоматическое начисление выплат за проведенные уроки согласно ставкам
              </p>
            </div>
            {canWrite && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setModalError(null);
                  setIsDisburseSalariesModalOpen(true);
                }}
              >
                <DollarSign className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Начислить и выплатить ЗП</span>
              </Button>
            )}
          </div>

          <DataTable
            data={salaryRates}
            columns={salaryColumns}
            getRowId={(r) => r.id}
            locale={locale}
            emptyTitle="Ставки зарплат еще не заданы"
          />
        </div>
      )}

      {/* Tab 8: Online Payments (Click) */}
      {activeTab === "online" && <OnlinePaymentsTab isDirector={isDirector} />}

      {/* Modals via UI1 Dialog */}
      <Dialog open={isTxModalOpen} onOpenChange={setIsTxModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новая финансовая операция</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreateTx} className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={txType === "INCOME" ? "primary" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setTxType("INCOME")}
              >
                Доход (+)
              </Button>
              <Button
                type="button"
                variant={txType === "EXPENSE" ? "destructive" : "outline"}
                size="sm"
                className="flex-1"
                onClick={() => setTxType("EXPENSE")}
              >
                Расход (-)
              </Button>
            </div>

            <FormField label="Сумма в UZS" htmlFor="fin-tx-amount" required>
              <Input
                id="fin-tx-amount"
                type="number"
                required
                min={1}
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </FormField>

            <FormField label="Счет" htmlFor="fin-tx-account" required>
              <select
                id="fin-tx-account"
                value={txAccountId}
                onChange={(e) => setTxAccountId(e.target.value)}
                className={SELECT_CLS}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatUzs(a.balance, { locale })})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Статья / Категория" htmlFor="fin-tx-category">
              <select
                id="fin-tx-category"
                value={txCategoryId}
                onChange={(e) => setTxCategoryId(e.target.value)}
                className={SELECT_CLS}
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
            </FormField>

            <FormField label="Контрагент" htmlFor="fin-tx-counterparty">
              <Input
                id="fin-tx-counterparty"
                type="text"
                placeholder="ФИО клиента, поставщик или арендатор..."
                value={txCounterparty}
                onChange={(e) => setTxCounterparty(e.target.value)}
              />
            </FormField>

            <FormField label="Описание" htmlFor="fin-tx-desc">
              <Input
                id="fin-tx-desc"
                type="text"
                placeholder="Примечание к платежу..."
                value={txDesc}
                onChange={(e) => setTxDesc(e.target.value)}
              />
            </FormField>

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTxModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Сохранение..." : "Сохранить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTransferModalOpen} onOpenChange={setIsTransferModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Перевод между счетами</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleTransfer} className="space-y-4">
            <FormField label="Счет списания (Откуда)" htmlFor="fin-tr-source" required>
              <select
                id="fin-tr-source"
                value={trSourceAcc}
                onChange={(e) => setTrSourceAcc(e.target.value)}
                className={SELECT_CLS}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatUzs(a.balance, { locale })})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Счет зачисления (Куда)" htmlFor="fin-tr-target" required>
              <select
                id="fin-tr-target"
                value={trTargetAcc}
                onChange={(e) => setTrTargetAcc(e.target.value)}
                className={SELECT_CLS}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatUzs(a.balance, { locale })})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Сумма перевода" htmlFor="fin-tr-amount" required>
              <Input
                id="fin-tr-amount"
                type="number"
                required
                min={1}
                value={trAmount}
                onChange={(e) => setTrAmount(e.target.value === "" ? "" : Number(e.target.value))}
              />
            </FormField>

            <FormField label="Примечание" htmlFor="fin-tr-desc">
              <Input
                id="fin-tr-desc"
                type="text"
                placeholder="Причина перевода..."
                value={trDesc}
                onChange={(e) => setTrDesc(e.target.value)}
              />
            </FormField>

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsTransferModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Выполнение..." : "Перевести"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(reversalTx)} onOpenChange={(open) => !open && setReversalTx(null)}>
        <DialogContent className="max-w-md">
          {reversalTx && (
            <>
              <DialogHeader>
                <DialogTitle>Сторнирование / Отмена операции</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground tabular-nums">
                Операция на сумму {formatUzs(reversalTx.amount, { locale })} будет сторнирована
                обратной проводкой. Укажите причину отмены (минимум 5 символов).
              </p>
              {modalError && (
                <Alert variant="destructive">
                  <AlertDescription>{modalError}</AlertDescription>
                </Alert>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleReversal();
                }}
                className="space-y-4"
              >
                <FormField label="Причина отмены" htmlFor="fin-rev-reason" required>
                  <Textarea
                    id="fin-rev-reason"
                    rows={3}
                    required
                    value={reversalReason}
                    onChange={(e) => setReversalReason(e.target.value)}
                    placeholder="Ошибочно введена сумма, возврат клиенту..."
                  />
                </FormField>
                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setReversalTx(null)}
                    disabled={actionLoading}
                  >
                    Отмена
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionLoading || reversalReason.trim().length < 5}
                  >
                    {actionLoading ? "Сторнирование..." : "Подтвердить отмену"}
                  </Button>
                </FormActions>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(isDebtPayModalOpen)}
        onOpenChange={(open) => !open && setIsDebtPayModalOpen(null)}
      >
        <DialogContent className="max-w-md">
          {isDebtPayModalOpen && (
            <>
              <DialogHeader>
                <DialogTitle>Прием оплаты</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Ученик: <strong className="text-foreground">{isDebtPayModalOpen.fullName}</strong>
              </p>
              {modalError && (
                <Alert variant="destructive">
                  <AlertDescription>{modalError}</AlertDescription>
                </Alert>
              )}
              <form onSubmit={handlePayDebt} className="space-y-4">
                <FormField label="Сумма к оплате" htmlFor="fin-debt-amount" required>
                  <Input
                    id="fin-debt-amount"
                    type="number"
                    required
                    min={1}
                    value={debtPayAmount}
                    onChange={(e) =>
                      setDebtPayAmount(e.target.value === "" ? "" : Number(e.target.value))
                    }
                  />
                </FormField>
                <FormField label="Способ оплаты" htmlFor="fin-debt-method" required>
                  <select
                    id="fin-debt-method"
                    value={debtPayMethod}
                    onChange={(e) =>
                      setDebtPayMethod(e.target.value as "CASH" | "ONLINE" | "BANK_TRANSFER")
                    }
                    className={SELECT_CLS}
                  >
                    <option value="CASH">Наличные (Касса)</option>
                    <option value="ONLINE">Онлайн / Терминал</option>
                    <option value="BANK_TRANSFER">Банковский перевод</option>
                  </select>
                </FormField>
                <FormActions>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDebtPayModalOpen(null)}
                    disabled={actionLoading}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={actionLoading}>
                    {actionLoading ? "Проведение..." : "Провести оплату"}
                  </Button>
                </FormActions>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isAccountModalOpen} onOpenChange={setIsAccountModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новый счет</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreateAccount} className="space-y-4">
            <FormField label="Название счета" htmlFor="fin-acc-name" required>
              <Input
                id="fin-acc-name"
                type="text"
                required
                placeholder="Например: Касса №2"
                value={newAccName}
                onChange={(e) => setNewAccName(e.target.value)}
              />
            </FormField>
            <FormField label="Тип счета" htmlFor="fin-acc-type" required>
              <select
                id="fin-acc-type"
                value={newAccType}
                onChange={(e) => setNewAccType(e.target.value as "CASH" | "CARD" | "BANK")}
                className={SELECT_CLS}
              >
                <option value="CASH">Наличные (CASH)</option>
                <option value="CARD">Карта / Терминал (CARD)</option>
                <option value="BANK">Банковский счет (BANK)</option>
              </select>
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAccountModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={actionLoading}>
                Создать счет
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Новая статья учета</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleCreateCategory} className="space-y-4">
            <FormField label="Название статьи" htmlFor="fin-cat-name" required>
              <Input
                id="fin-cat-name"
                type="text"
                required
                placeholder="Например: Аренда"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
              />
            </FormField>
            <FormField label="Тип статьи" htmlFor="fin-cat-type" required>
              <select
                id="fin-cat-type"
                value={newCatType}
                onChange={(e) => setNewCatType(e.target.value as "INCOME" | "EXPENSE")}
                className={SELECT_CLS}
              >
                <option value="INCOME">Доход</option>
                <option value="EXPENSE">Расход</option>
              </select>
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCategoryModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={actionLoading}>
                Создать статью
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isClosePeriodModalOpen} onOpenChange={setIsClosePeriodModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Закрытие финансового периода</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleClosePeriod} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Год" htmlFor="fin-period-year" required>
                <Input
                  id="fin-period-year"
                  type="number"
                  required
                  value={closePeriodYear}
                  onChange={(e) => setClosePeriodYear(Number(e.target.value))}
                />
              </FormField>
              <FormField label="Месяц" htmlFor="fin-period-month" required>
                <Input
                  id="fin-period-month"
                  type="number"
                  min={1}
                  max={12}
                  required
                  value={closePeriodMonth}
                  onChange={(e) => setClosePeriodMonth(Number(e.target.value))}
                />
              </FormField>
            </div>
            <FormField label="Примечание" htmlFor="fin-period-notes">
              <Textarea
                id="fin-period-notes"
                rows={2}
                placeholder="Отчет сдан, сверка завершена..."
                value={closePeriodNotes}
                onChange={(e) => setClosePeriodNotes(e.target.value)}
              />
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsClosePeriodModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" variant="destructive" disabled={actionLoading}>
                {actionLoading ? "Закрытие..." : "Закрыть месяц"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDisburseSalariesModalOpen} onOpenChange={setIsDisburseSalariesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Начисление и выплата зарплат</DialogTitle>
          </DialogHeader>
          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}
          <form onSubmit={handleDisburseSalaries} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="С даты" htmlFor="fin-sal-start" required>
                <Input
                  id="fin-sal-start"
                  type="date"
                  required
                  value={disburseStart}
                  onChange={(e) => setDisburseStart(e.target.value)}
                />
              </FormField>
              <FormField label="По дату" htmlFor="fin-sal-end" required>
                <Input
                  id="fin-sal-end"
                  type="date"
                  required
                  value={disburseEnd}
                  onChange={(e) => setDisburseEnd(e.target.value)}
                />
              </FormField>
            </div>
            <FormField label="Счет выплаты" htmlFor="fin-sal-acc" required>
              <select
                id="fin-sal-acc"
                value={disburseAcc}
                onChange={(e) => setDisburseAcc(e.target.value)}
                className={SELECT_CLS}
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({formatUzs(a.balance, { locale })})
                  </option>
                ))}
              </select>
            </FormField>
            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDisburseSalariesModalOpen(false)}
                disabled={actionLoading}
              >
                Отмена
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "Расчет и выплата..." : "Выплатить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
