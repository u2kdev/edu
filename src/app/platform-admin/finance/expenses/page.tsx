"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Receipt,
  PlusCircle,
  Filter,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  FileText,
  ExternalLink,
} from "lucide-react";

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

  // Filters
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Create Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newAmount, setNewAmount] = useState<number>(0);
  const [newCounterparty, setNewCounterparty] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newReceiptUrl, setNewReceiptUrl] = useState("");
  const [newDate, setNewDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Storno Modal
  const [stornoExpense, setStornoExpense] = useState<ExpenseItem | null>(null);
  const [stornoReason, setStornoReason] = useState("");
  const [stornoing, setStornoing] = useState(false);

  // Load categories
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
    if (!newCategoryId) {
      alert("Выберите категорию");
      return;
    }
    if (newAmount <= 0) {
      alert("Сумма должна быть положительной");
      return;
    }
    if (!newTitle.trim()) {
      alert("Укажите наименование расхода");
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
        alert(data.error || "Ошибка создания расхода");
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
      alert("Ошибка соединения");
    } finally {
      setCreating(false);
    }
  };

  const handleStorno = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stornoExpense) return;
    if (stornoReason.trim().length < 5) {
      alert("Причина сторно обязательна (минимум 5 символов)");
      return;
    }

    setStornoing(true);
    try {
      const res = await fetch(`/api/platform/finance/expenses/${stornoExpense.id}/storno`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: stornoReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Ошибка выполнения сторно");
      } else {
        setStornoExpense(null);
        setStornoReason("");
        fetchExpenses();
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setStornoing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Subnav */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Расходы платформы
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Учёт операционных затрат (хостинг, SMS, сервисы, ФОТ), чеки и операции сторно
          </p>
        </div>
        <div>
          <button
            onClick={() => {
              setIsCreateOpen(true);
              if (categories.length > 0 && !newCategoryId) {
                setNewCategoryId(categories[0].id);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Добавить расход</span>
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
          className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors"
        >
          Платежи центров
        </Link>
        <Link
          href="/platform-admin/finance/expenses"
          className="px-4 py-2 text-sm font-semibold text-indigo-600 border-b-2 border-indigo-600"
        >
          Расходы платформы
        </Link>
      </div>

      {/* Summary KPI Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Всего записей</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">{summary.count}</div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Расходы (брутто)</div>
          <div className="text-xl font-extrabold text-rose-600 mt-0.5">
            {summary.totalAmount.toLocaleString()} UZS
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Сторнировано</div>
          <div className="text-xl font-extrabold text-emerald-600 mt-0.5">
            -{summary.reversalsAmount.toLocaleString()} UZS
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-500 uppercase font-semibold">Чистые расходы</div>
          <div className="text-xl font-extrabold text-slate-900 mt-0.5">
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
            placeholder="Поиск по названию, контрагенту..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Category Select */}
        <select
          value={categoryId}
          onChange={(e) => {
            setCategoryId(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все категории</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
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

      {/* Expenses Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка расходов...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm">
          {error}
        </div>
      ) : expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Расходы не найдены</h3>
          <p className="text-sm text-slate-500 mt-1">По выбранным фильтрам записей нет.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <th className="text-left px-6 py-3.5">Дата / Автор</th>
                  <th className="text-left px-6 py-3.5">Категория</th>
                  <th className="text-left px-6 py-3.5">Наименование / Поставщик</th>
                  <th className="text-right px-6 py-3.5">Сумма (UZS)</th>
                  <th className="text-center px-6 py-3.5">Статус</th>
                  <th className="text-right px-6 py-3.5">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((exp) => {
                  return (
                    <tr
                      key={exp.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        exp.isReversal ? "bg-rose-50/30" : exp.reversedBy ? "opacity-60 bg-slate-50/50" : ""
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">
                          {new Date(exp.date).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {exp.creator.name || exp.creator.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {exp.category.name}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{exp.title}</div>
                        {exp.counterparty && (
                          <div className="text-xs text-slate-500">Поставщик: {exp.counterparty}</div>
                        )}
                        {exp.description && (
                          <div className="text-xs text-slate-400 mt-0.5">{exp.description}</div>
                        )}
                        {exp.receiptUrl && (
                          <a
                            href={exp.receiptUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            Чек / документ
                          </a>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-bold ${
                            exp.isReversal ? "text-emerald-700" : "text-slate-900"
                          }`}
                        >
                          {exp.isReversal ? "-" : ""}
                          {exp.amount.toLocaleString()} UZS
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {exp.isReversal ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            СТОРНО
                          </span>
                        ) : exp.reversedBy ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 line-through">
                            Сторнирован
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700">
                            Учтён
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!exp.isReversal && !exp.reversedBy && (
                          <button
                            onClick={() => {
                              setStornoExpense(exp);
                              setStornoReason("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors border border-rose-200"
                            title="Сторнировать расход"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Сторно</span>
                          </button>
                        )}
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

      {/* Create Expense Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateExpense}
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 border border-slate-200 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-900">Добавить расход платформы</h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Категория расхода *
              </label>
              <select
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
                required
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Наименование / Статья расхода *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Оплата серверов Hetzner за ноябрь"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Сумма (UZS) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={newAmount || ""}
                  onChange={(e) => setNewAmount(parseInt(e.target.value || "0", 10))}
                  placeholder="350000"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                  Дата расхода
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Поставщик / Контрагент
              </label>
              <input
                type="text"
                value={newCounterparty}
                onChange={(e) => setNewCounterparty(e.target.value)}
                placeholder="Hetzner Online GmbH, Eskiz SMS..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Ссылка на чек / квитанцию
              </label>
              <input
                type="text"
                value={newReceiptUrl}
                onChange={(e) => setNewReceiptUrl(e.target.value)}
                placeholder="https://storage.../receipt.pdf"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Описание / Примечание
              </label>
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={2}
                placeholder="Дополнительные сведения..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {creating ? "Сохранение..." : "Сохранить расход"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Storno Modal */}
      {stornoExpense && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleStorno}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-slate-200 space-y-4"
          >
            <div className="flex items-center gap-2 text-rose-600">
              <RotateCcw className="w-5 h-5" />
              <h3 className="text-lg font-bold text-slate-900">Сторнирование расхода</h3>
            </div>

            <p className="text-sm text-slate-600">
              Вы выполняете сторнирование расхода &quot;<strong>{stornoExpense.title}</strong>&quot; на сумму{" "}
              <strong>{stornoExpense.amount.toLocaleString()} UZS</strong>.
            </p>

            <div className="p-3 bg-amber-50 rounded-xl text-xs text-amber-800 border border-amber-200">
              Запись расхода не будет удалена из базы данных. Будет сформирована корректирующая сторно-проводка,
              которая нейтрализует влияние на финансовую отчётность.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                Обязательная причина сторно (минимум 5 символов) *
              </label>
              <textarea
                required
                minLength={5}
                value={stornoReason}
                onChange={(e) => setStornoReason(e.target.value)}
                rows={3}
                placeholder="Ошибочный ввод, отмена транзакции банком..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStornoExpense(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={stornoing}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-semibold shadow-sm disabled:opacity-50"
              >
                {stornoing ? "Выполнение..." : "Подтвердить сторно"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
