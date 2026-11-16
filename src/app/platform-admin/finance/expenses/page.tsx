"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, PlusCircle, RotateCcw } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
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

interface ExpenseCategory {
  id: string;
  name: string;
  code: string | null;
}

interface ExpenseItem {
  id: string;
  amount: number;
  date: string;
  title: string;
  description: string | null;
  counterparty: string | null;
  receiptUrl: string | null;
  isReversal: boolean;
  reversalReason: string | null;
  category: {
    id: string;
    name: string;
    code: string | null;
  };
  creator: {
    id: string;
    name: string | null;
    email: string;
  };
  reversalOf: {
    id: string;
    title: string;
    amount: number;
  } | null;
  reversedBy: {
    id: string;
    title: string;
    amount: number;
    reversalReason: string | null;
  } | null;
}

interface SummaryExpenses {
  totalAmount: number;
  reversalsAmount: number;
  netAmount: number;
  count: number;
}

export default function PlatformExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [summary, setSummary] = useState<SummaryExpenses>({
    totalAmount: 0,
    reversalsAmount: 0,
    netAmount: 0,
    count: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newCounterparty, setNewCounterparty] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState("");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [stornoExpense, setStornoExpense] = useState<ExpenseItem | null>(null);
  const [stornoing, setStornoing] = useState(false);

  useEffect(() => {
    async function loadCats() {
      try {
        const res = await fetch("/api/platform/finance/expenses/categories");
        const data = await res.json();
        if (data.success) {
          setCategories(data.categories || []);
        }
      } catch {}
    }
    loadCats();
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(categoryId && { categoryId }),
        ...(dateFrom && { dateFrom }),
        ...(dateTo && { dateTo }),
      });
      const res = await fetch(`/api/platform/finance/expenses?${q}`);
      const data = await res.json();
      if (data.success) {
        setExpenses(data.expenses || []);
        setSummary(data.summary || { totalAmount: 0, reversalsAmount: 0, netAmount: 0, count: 0 });
        setTotalPages(data.pagination?.totalPages || 1);
      } else {
        setError(data.error || "Не удалось загрузить расходы");
      }
    } catch {
      setError("Ошибка сети");
    } finally {
      setLoading(false);
    }
  }, [page, search, categoryId, dateFrom, dateTo]);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!newCategoryId) {
      setCreateError("Выберите категорию");
      return;
    }
    if (newAmount <= 0) {
      setCreateError("Сумма должна быть положительной");
      return;
    }
    if (!newTitle.trim()) {
      setCreateError("Укажите наименование расхода");
      return;
    }

    setCreating(true);
    try {
      const res = await fetch("/api/platform/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: newCategoryId,
          amount: Number(newAmount),
          title: newTitle.trim(),
          counterparty: newCounterparty.trim() || undefined,
          description: newDescription.trim() || undefined,
          receiptUrl: newReceiptUrl.trim() || undefined,
          date: newDate || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setCreateError(data.error || "Ошибка создания расхода");
      } else {
        setIsCreateOpen(false);
        setNewTitle("");
        setNewAmount(0);
        setNewCounterparty("");
        setNewDescription("");
        setNewReceiptUrl("");
        fetchExpenses();
      }
    } catch {
      setCreateError("Ошибка соединения");
    } finally {
      setCreating(false);
    }
  };

  const handleConfirmStorno = async (reason?: string) => {
    if (!stornoExpense || !reason) return;
    setStornoing(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/finance/expenses/${stornoExpense.id}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Ошибка выполнения сторно");
      } else {
        setStornoExpense(null);
        fetchExpenses();
      }
    } catch {
      setActionError("Ошибка сети");
    } finally {
      setStornoing(false);
    }
  };

  const columns: DataTableColumn<ExpenseItem>[] = [
    {
      id: "date",
      header: "Дата / Автор",
      sortable: true,
      sortValue: (e) => e.date,
      cell: (exp) => (
        <div>
          <div className="font-medium text-foreground tabular-nums">
            {new Date(exp.date).toLocaleDateString()}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {exp.creator.name || exp.creator.email}
          </div>
        </div>
      ),
    },
    {
      id: "category",
      header: "Категория",
      cell: (exp) => <Badge variant="neutral">{exp.category.name}</Badge>,
    },
    {
      id: "title",
      header: "Наименование / Поставщик",
      isMobilePrimary: true,
      cell: (exp) => (
        <div>
          <div className="font-medium text-foreground">{exp.title}</div>
          {exp.counterparty && (
            <div className="text-xs text-muted-foreground">Поставщик: {exp.counterparty}</div>
          )}
          {exp.description && (
            <div className="mt-0.5 text-xs text-muted-foreground">{exp.description}</div>
          )}
          {exp.receiptUrl && (
            <a
              href={exp.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
              <span>Чек / документ</span>
            </a>
          )}
        </div>
      ),
    },
    {
      id: "amount",
      header: "Сумма (UZS)",
      align: "right",
      sortable: true,
      sortValue: (e) => e.amount,
      cell: (exp) => (
        <span
          className={`font-semibold tabular-nums ${
            exp.isReversal ? "text-success" : "text-foreground"
          }`}
        >
          {exp.isReversal ? "-" : ""}
          {exp.amount.toLocaleString()} UZS
        </span>
      ),
    },
    {
      id: "status",
      header: "Статус",
      align: "center",
      cell: (exp) =>
        exp.isReversal ? (
          <Badge variant="warning">Сторно</Badge>
        ) : exp.reversedBy ? (
          <Badge variant="neutral" className="line-through">
            Сторнирован
          </Badge>
        ) : (
          <Badge variant="success">Учтён</Badge>
        ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (exp) =>
        !exp.isReversal && !exp.reversedBy ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setStornoExpense(exp)}
            className="text-destructive border-destructive/30 hover:bg-destructive-subtle"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Сторно</span>
          </Button>
        ) : null,
    },
  ];

  const hasFilters = Boolean(search || categoryId || dateFrom || dateTo);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Расходы платформы"
        description="Учёт операционных затрат, чеки и операции сторно"
        actions={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateError(null);
              setIsCreateOpen(true);
              if (categories.length > 0 && !newCategoryId) {
                setNewCategoryId(categories[0].id);
              }
            }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            <span>Добавить расход</span>
          </Button>
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
          className="px-3 py-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Платежи центров
        </Link>
        <Link
          href="/platform-admin/finance/expenses"
          className="border-b-2 border-primary px-3 py-1.5 font-medium text-primary"
        >
          Расходы платформы
        </Link>
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Всего записей" value={summary.count} />
        <StatCard
          label="Расходы (брутто)"
          value={`${summary.totalAmount.toLocaleString()} UZS`}
        />
        <StatCard
          label="Сторнировано"
          value={`-${summary.reversalsAmount.toLocaleString()} UZS`}
        />
        <StatCard label="Чистые расходы" value={`${summary.netAmount.toLocaleString()} UZS`} />
      </div>

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Поиск по названию, контрагенту..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setCategoryId("");
          setDateFrom("");
          setDateTo("");
          setPage(1);
        }}
      >
        <select
          aria-label="Категория расхода"
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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
        data={expenses}
        columns={columns}
        getRowId={(e) => e.id}
        loading={loading}
        error={error}
        onRetry={fetchExpenses}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowClassName={(exp) =>
          exp.isReversal ? "bg-destructive-subtle/30" : exp.reversedBy ? "opacity-60" : undefined
        }
        emptyTitle="Расходы не найдены"
        emptyDescription="По выбранным фильтрам записей о расходах нет."
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setCategoryId("");
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

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Добавить расход платформы</DialogTitle>
          </DialogHeader>

          {createError && (
            <Alert variant="destructive">
              <AlertDescription>{createError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateExpense} className="space-y-4">
            <FormField label="Категория расхода" htmlFor="exp-cat" required>
              <select
                id="exp-cat"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                required
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Наименование / статья расхода" htmlFor="exp-title" required>
              <Input
                id="exp-title"
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Оплата серверов Hetzner за ноябрь"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Сумма (UZS)" htmlFor="exp-amount" required>
                <Input
                  id="exp-amount"
                  type="number"
                  min="1"
                  required
                  value={newAmount || ""}
                  onChange={(e) => setNewAmount(parseInt(e.target.value || "0", 10))}
                  placeholder="350000"
                />
              </FormField>

              <FormField label="Дата расхода" htmlFor="exp-date">
                <Input
                  id="exp-date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                />
              </FormField>
            </div>

            <FormField label="Поставщик / контрагент" htmlFor="exp-counterparty">
              <Input
                id="exp-counterparty"
                type="text"
                value={newCounterparty}
                onChange={(e) => setNewCounterparty(e.target.value)}
                placeholder="Hetzner Online GmbH, Eskiz SMS..."
              />
            </FormField>

            <FormField label="Ссылка на чек / квитанцию" htmlFor="exp-receipt">
              <Input
                id="exp-receipt"
                type="text"
                value={newReceiptUrl}
                onChange={(e) => setNewReceiptUrl(e.target.value)}
                placeholder="https://storage.../receipt.pdf"
              />
            </FormField>

            <FormField label="Описание / примечание" htmlFor="exp-desc">
              <Textarea
                id="exp-desc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="Дополнительные сведения..."
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={creating}>
                {creating ? "Сохранение..." : "Сохранить расход"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(stornoExpense)}
        onOpenChange={(next) => !next && setStornoExpense(null)}
        title="Сторнирование расхода"
        description={
          stornoExpense
            ? `Будет сформирована корректирующая сторно-проводка для «${stornoExpense.title}» на сумму ${stornoExpense.amount.toLocaleString()} UZS. Запись останется в истории для аудита.`
            : undefined
        }
        variant="destructive"
        loading={stornoing}
        reasonLabel="Обязательная причина сторно"
        reasonPlaceholder="Ошибочный ввод, отмена транзакции банком..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        confirmLabel="Подтвердить сторно"
        onConfirm={handleConfirmStorno}
      />
    </div>
  );
}
