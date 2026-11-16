"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertTriangle, Building2, ChevronRight, Clock, MessageSquare, User } from "lucide-react";
import {
  Badge,
  type BadgeVariant,
  Button,
  DataTable,
  type DataTableColumn,
  FilterBar,
  PageHeader,
} from "@/components/ui";
import { t } from "@/i18n";

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

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  OPEN: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  CLOSED: "neutral",
};

const PRIORITY_VARIANTS: Record<string, BadgeVariant> = {
  LOW: "neutral",
  MEDIUM: "info",
  HIGH: "warning",
  URGENT: "destructive",
};

export default function PlatformSupportPage() {
  const [tickets, setTickets] = useState<SupportTicketItem[]>([]);
  const [unansweredCount, setUnansweredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const columns: DataTableColumn<SupportTicketItem>[] = [
    {
      id: "subject",
      header: "Обращение",
      isMobilePrimary: true,
      sortable: true,
      sortValue: (tk) => tk.subject,
      cell: (ticket) => {
        const isOldUnanswered =
          (ticket.status === "OPEN" || ticket.status === "IN_PROGRESS") &&
          Date.now() - new Date(ticket.createdAt).getTime() > 24 * 60 * 60 * 1000;
        return (
          <div className="min-w-0 space-y-1">
            <Link
              href={`/platform-admin/support/${ticket.id}`}
              className="block truncate font-medium text-foreground hover:text-primary"
            >
              {ticket.subject}
            </Link>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {ticket.center && (
                <span className="inline-flex items-center gap-1 font-medium text-foreground">
                  <Building2 className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  {ticket.center.name}
                </span>
              )}
              {ticket.creator && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  {ticket.creator.fullName} ({ticket.creator.email})
                </span>
              )}
              {ticket.assignedTo && (
                <span className="text-primary font-medium">
                  Ответственный: {ticket.assignedTo.fullName}
                </span>
              )}
              {isOldUnanswered && (
                <Badge variant="destructive">
                  <Clock className="h-3 w-3" aria-hidden="true" />
                  <span>&gt; 24 ч без ответа</span>
                </Badge>
              )}
            </div>
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Статус",
      sortable: true,
      sortValue: (tk) => tk.status,
      cell: (ticket) => (
        <Badge variant={STATUS_VARIANTS[ticket.status] || "neutral"}>{ticket.status}</Badge>
      ),
    },
    {
      id: "priority",
      header: "Приоритет",
      sortable: true,
      sortValue: (tk) => tk.priority,
      cell: (ticket) => (
        <Badge variant={PRIORITY_VARIANTS[ticket.priority] || "neutral"}>{ticket.priority}</Badge>
      ),
    },
    {
      id: "messages",
      header: "Сообщения",
      hideOnMobile: true,
      cell: (ticket) => (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
          <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
          {ticket._count?.messages || 0} сообщений
        </span>
      ),
    },
    {
      id: "createdAt",
      header: "Дата",
      hideOnMobile: true,
      sortable: true,
      sortValue: (tk) => tk.createdAt,
      cell: (ticket) => (
        <span className="text-xs text-muted-foreground tabular-nums">
          {new Date(ticket.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (ticket) => (
        <Button asChild variant="outline" size="sm">
          <Link href={`/platform-admin/support/${ticket.id}`}>
            <span>Перейти к тикету</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </Button>
      ),
    },
  ];

  const hasFilters = Boolean(search || statusFilter || priorityFilter || unansweredOnly);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Служба поддержки"
        description="Обработка обращений директоров и коммуникация с учебными центрами"
        actions={
          unansweredCount > 0 ? (
            <Button
              type="button"
              variant={unansweredOnly ? "destructive" : "outline"}
              size="sm"
              onClick={() => {
                setUnansweredOnly(!unansweredOnly);
                setPage(1);
              }}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <span>Без ответа &gt; 24 ч: {unansweredCount}</span>
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        search={search}
        onSearchChange={(val) => {
          setSearch(val);
          setPage(1);
        }}
        searchPlaceholder="Тема, автор, учебный центр..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setStatusFilter("");
          setPriorityFilter("");
          setUnansweredOnly(false);
          setPage(1);
        }}
      >
        <select
          aria-label="Статус обращения"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все статусы</option>
          <option value="OPEN">OPEN (Открытые)</option>
          <option value="IN_PROGRESS">IN_PROGRESS (В обработке)</option>
          <option value="RESOLVED">RESOLVED (Решённые)</option>
          <option value="CLOSED">CLOSED (Закрытые)</option>
        </select>

        <select
          aria-label="Приоритет"
          value={priorityFilter}
          onChange={(e) => {
            setPriorityFilter(e.target.value);
            setPage(1);
          }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Все приоритеты</option>
          <option value="LOW">LOW (Низкий)</option>
          <option value="MEDIUM">MEDIUM (Обычный)</option>
          <option value="HIGH">HIGH (Высокий)</option>
          <option value="URGENT">URGENT (Срочный)</option>
        </select>
      </FilterBar>

      <DataTable
        data={tickets}
        columns={columns}
        getRowId={(tk) => tk.id}
        loading={loading}
        loadingLabel="Загрузка обращений..."
        error={error}
        onRetry={fetchTickets}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        getRowHref={(tk) => `/platform-admin/support/${tk.id}`}
        emptyTitle="Обращений не найдено"
        emptyDescription={t("ru", "ui4.emptyTicketsDesc")}
        emptyAction={
          hasFilters ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("");
                setPriorityFilter("");
                setUnansweredOnly(false);
                setPage(1);
              }}
            >
              {t("ru", "ui4.resetFilters")}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
