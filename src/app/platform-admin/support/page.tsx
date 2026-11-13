"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  MessageSquare,
  Building2,
  ChevronRight,
  ExternalLink,
  Search,
  User,
} from "lucide-react";

interface SupportTicketItem {
  id: string;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  creator?: { fullName?: string | null; email?: string | null } | null;
  center?: { id: string; name: string; slug: string } | null;
  assignedTo?: { id: string; fullName: string } | null;
  _count?: { messages: number };
}

export default function PlatformSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        ...(search && { search }),
        ...(statusFilter && { status: statusFilter }),
        ...(priorityFilter && { priority: priorityFilter }),
        ...(unansweredOnly && { unanswered: "true" }),
      });
      const res = await fetch(`/api/platform/support?${q}`);
      if (!res.ok) throw new Error("Не удалось загрузить обращения поддержки");
      const json = await res.json();
      setTickets(json.tickets || []);
      setUnansweredCount(json.unansweredCount || 0);
      setTotalPages(json.pagination?.totalPages || 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, priorityFilter, unansweredOnly]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const statusBadges: Record<string, { bg: string; text: string; border: string }> = {
    OPEN: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    IN_PROGRESS: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    RESOLVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    CLOSED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  };

  const priorityBadges: Record<string, string> = {
    LOW: "bg-slate-100 text-slate-600",
    MEDIUM: "bg-blue-50 text-blue-700",
    HIGH: "bg-amber-50 text-amber-800",
    URGENT: "bg-rose-50 text-rose-700 font-bold",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Служба поддержки e-darschi
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Обработка инцидентов, запросов директоров и коммуникация с учебными центрами
          </p>
        </div>

        {unansweredCount > 0 && (
          <button
            onClick={() => {
              setUnansweredOnly(!unansweredOnly);
              setPage(1);
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${
              unansweredOnly
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
            }`}
          >
            <AlertTriangle className="w-4 h-4 text-rose-500" />
            <span>Без ответа &gt; 24 ч: {unansweredCount}</span>
          </button>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Тема, автор, учебный центр..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все статусы</option>
          <option value="OPEN">OPEN (Открытые)</option>
          <option value="IN_PROGRESS">IN_PROGRESS (В обработке)</option>
          <option value="RESOLVED">RESOLVED (Решённые)</option>
          <option value="CLOSED">CLOSED (Закрытые)</option>
        </select>

        {/* Priority Filter */}
        <select
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="py-1.5 px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700"
        >
          <option value="">Все приоритеты</option>
          <option value="LOW">LOW (Низкий)</option>
          <option value="MEDIUM">MEDIUM (Обычный)</option>
          <option value="HIGH">HIGH (Высокий)</option>
          <option value="URGENT">URGENT (Срочный)</option>
        </select>
      </div>

      {/* Tickets List */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 text-sm shadow-sm animate-pulse">
          Загрузка обращений...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-6 rounded-2xl text-center text-sm shadow-sm">
          {error}
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">Обращений не найдено</h3>
          <p className="text-sm text-slate-500 mt-1">
            Все запросы обработаны или фильтры не вернули результатов.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => {
            const badge = statusBadges[ticket.status] || {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-200",
            };
            const priorityClass = priorityBadges[ticket.priority] || "bg-slate-100 text-slate-600";
            const isOldUnanswered =
              (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") &&
              new Date().getTime() - new Date(ticket.createdAt).getTime() > 24 * 60 * 60 * 1000;

            return (
              <div
                key={ticket.id}
                className={`bg-white p-5 rounded-2xl border shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  isOldUnanswered ? "border-rose-300 bg-rose-50/20" : "border-slate-200"
                }`}
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {ticket.status}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${priorityClass}`}>
                      {ticket.priority}
                    </span>
                    {isOldUnanswered && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[11px] font-bold flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        &gt; 24 ч без ответа
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <Link
                    href={`/platform-admin/support/${ticket.id}`}
                    className="text-base font-bold text-slate-900 hover:text-indigo-600 block truncate"
                  >
                    {ticket.subject}
                  </Link>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {ticket.center && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        {ticket.center.name}
                      </span>
                    )}
                    {ticket.creator && (
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {ticket.creator.fullName} ({ticket.creator.email})
                      </span>
                    )}
                    {ticket.assignedTo && (
                      <span className="text-indigo-600 font-medium">
                        Ответственный: {ticket.assignedTo.fullName}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {ticket._count?.messages || 0} сообщений
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/platform-admin/support/${ticket.id}`}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition-all shadow-sm"
                  >
                    <span>Перейти к тикету</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
