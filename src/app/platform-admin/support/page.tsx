"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  HelpCircle,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  Building2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface SupportTicketItem {
  id: string;
  subject: string;
  category?: string | null;
  priority?: string | null;
  status: string;
  createdAt: string;
  creator?: { fullName?: string | null; email?: string | null } | null;
  center?: { name?: string | null; slug?: string | null } | null;
  _count?: { messages: number };
}

export default function PlatformSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = statusFilter
        ? `/api/platform/support?status=${encodeURIComponent(statusFilter)}`
        : "/api/platform/support";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Не удалось загрузить обращения поддержки");
      const json = await res.json();
      setTickets(json.tickets || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  const updateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/platform/support", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error("Не удалось обновить статус обращения");
      fetchTickets();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка обновления статуса");
    } finally {
      setUpdatingId(null);
    }
  };

  const statusBadges: Record<string, { bg: string; text: string; border: string }> = {
    OPEN: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" },
    IN_PROGRESS: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200" },
    RESOLVED: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
    CLOSED: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200" },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
          Служба поддержки e-darischi
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Мониторинг тикетов, запросов директоров и оперативное решение инцидентов
        </p>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-500 uppercase mr-2 flex items-center gap-1.5">
          <Filter className="w-3.5 h-3.5" />
          Статус:
        </span>
        {[
          { id: "", label: "Все" },
          { id: "OPEN", label: "OPEN (Открытые)" },
          { id: "IN_PROGRESS", label: "IN_PROGRESS (В обработке)" },
          { id: "RESOLVED", label: "RESOLVED (Решенные)" },
          { id: "CLOSED", label: "CLOSED (Закрытые)" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setStatusFilter(tab.id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              statusFilter === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
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
          <h3 className="text-base font-semibold text-slate-800">Нет активных обращений</h3>
          <p className="text-sm text-slate-500 mt-1">
            Все запросы директоров обработаны или фильтр не вернул результатов.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const badge = statusBadges[ticket.status] || {
              bg: "bg-slate-100",
              text: "text-slate-700",
              border: "border-slate-200",
            };
            return (
              <div
                key={ticket.id}
                className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                    >
                      {ticket.status}
                    </span>
                    {ticket.priority && (
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[11px] font-semibold">
                        {ticket.priority}
                      </span>
                    )}
                    <span className="text-xs text-slate-400">
                      {new Date(ticket.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 truncate">
                    {ticket.subject}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    {ticket.center && (
                      <span className="flex items-center gap-1 font-medium text-slate-700">
                        <Building2 className="w-3.5 h-3.5 text-blue-600" />
                        {ticket.center.name} ({ticket.center.slug})
                      </span>
                    )}
                    {ticket.creator && (
                      <span>
                        От: <strong className="text-slate-700">{ticket.creator.fullName}</strong> ({ticket.creator.email})
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-slate-500">
                      <MessageSquare className="w-3.5 h-3.5" />
                      {ticket._count?.messages || 0} сообщений
                    </span>
                  </div>
                </div>

                {/* Status action buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {ticket.status === "OPEN" && (
                    <button
                      type="button"
                      disabled={updatingId === ticket.id}
                      onClick={() => updateStatus(ticket.id, "IN_PROGRESS")}
                      className="px-3 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors disabled:opacity-50"
                    >
                      В работу
                    </button>
                  )}
                  {ticket.status !== "RESOLVED" && ticket.status !== "CLOSED" && (
                    <button
                      type="button"
                      disabled={updatingId === ticket.id}
                      onClick={() => updateStatus(ticket.id, "RESOLVED")}
                      className="px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-colors disabled:opacity-50"
                    >
                      Решено
                    </button>
                  )}
                  {ticket.status !== "CLOSED" && (
                    <button
                      type="button"
                      disabled={updatingId === ticket.id}
                      onClick={() => updateStatus(ticket.id, "CLOSED")}
                      className="px-3 py-1.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors disabled:opacity-50"
                    >
                      Закрыть
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
