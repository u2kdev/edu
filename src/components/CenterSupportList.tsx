"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle, Plus, Loader2, ChevronRight } from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface TicketSummary {
  id: string;
  subject: string;
  status: string;
  priority: string;
  scope: string;
  createdAt: string | Date;
  updatedAt: string | Date;
  creator?: { fullName: string; email: string } | null;
  _count?: { messages: number };
}

interface CenterSupportListProps {
  initialTickets: TicketSummary[];
  locale?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "Открыт", variant: "info" },
  IN_PROGRESS: { label: "В работе", variant: "warning" },
  RESOLVED: { label: "Решен", variant: "success" },
  CLOSED: { label: "Закрыт", variant: "neutral" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: "Низкий", className: "text-muted-foreground" },
  MEDIUM: { label: "Средний", className: "text-info" },
  HIGH: { label: "Высокий", className: "text-warning" },
  URGENT: { label: "Критический", className: "text-destructive font-semibold" },
};

export default function CenterSupportList({
  initialTickets,
  locale = "ru",
}: CenterSupportListProps) {
  const router = useRouter();
  const [tickets] = useState<TicketSummary[]>(initialTickets);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showModal, setShowModal] = useState(false);

  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState("MEDIUM");
  const [scope, setScope] = useState("TENANT");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: subject.trim(),
          message: message.trim(),
          priority,
          scope,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Не удалось отправить обращение");
        return;
      }

      setShowModal(false);
      setSubject("");
      setMessage("");
      router.refresh();
      if (data.ticket?.id) {
        router.push(`/center/support/${data.ticket.id}`);
      }
    } catch {
      setErrorMessage("Ошибка сети при отправке обращения");
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((tkt) => {
      if (statusFilter && tkt.status !== statusFilter) return false;
      if (q && !tkt.subject.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [tickets, search, statusFilter]);

  const columns = useMemo<DataTableColumn<TicketSummary>[]>(
    () => [
      {
        id: "subject",
        header: "Тема обращения",
        sortable: true,
        sortValue: (tkt) => tkt.subject,
        cell: (tkt) => (
          <div className="font-medium text-foreground">{tkt.subject}</div>
        ),
      },
      {
        id: "status",
        header: "Статус",
        sortable: true,
        sortValue: (tkt) => tkt.status,
        cell: (tkt) => {
          const statusInfo = STATUS_CONFIG[tkt.status] || {
            label: tkt.status,
            variant: "neutral" as BadgeVariant,
          };
          return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
        },
      },
      {
        id: "priority",
        header: "Приоритет",
        cell: (tkt) => {
          const pInfo = PRIORITY_CONFIG[tkt.priority] || {
            label: tkt.priority,
            className: "text-muted-foreground",
          };
          return <span className={`text-xs font-medium ${pInfo.className}`}>{pInfo.label}</span>;
        },
      },
      {
        id: "createdAt",
        header: "Создан",
        sortable: true,
        sortValue: (tkt) => new Date(tkt.createdAt).getTime(),
        cell: (tkt) => (
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatDateLocalized(tkt.createdAt, locale)}
          </span>
        ),
      },
      {
        id: "go",
        header: "",
        align: "right",
        cell: () => (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span>Перейти</span>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        ),
      },
    ],
    [locale]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Служба поддержки"
        description="Вопросы по платформе, тарифам, настройкам центра и техническим проблемам"
        actions={
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setErrorMessage(null);
              setShowModal(true);
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Новое обращение</span>
          </Button>
        }
      />

      {tickets.length > 0 && (
        <FilterBar
          locale={locale}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Поиск по теме обращения..."
          hasActiveFilters={Boolean(search || statusFilter)}
          onReset={() => {
            setSearch("");
            setStatusFilter("");
          }}
        >
          <select
            aria-label="Статус"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={`${SELECT_CLS} w-44 text-[13px]`}
          >
            <option value="">Все статусы</option>
            <option value="OPEN">Открыт</option>
            <option value="IN_PROGRESS">В работе</option>
            <option value="RESOLVED">Решен</option>
            <option value="CLOSED">Закрыт</option>
          </select>
        </FilterBar>
      )}

      <DataTable
        data={filteredTickets}
        columns={columns}
        getRowId={(tkt) => tkt.id}
        getRowHref={(tkt) => `/center/support/${tkt.id}`}
        locale={locale}
        emptyTitle="Обращений пока нет"
        emptyDescription="Если у вас возникнут вопросы или потребуется помощь, создайте тикет в службу поддержки."
        mobileCardRender={(tkt) => {
          const statusInfo = STATUS_CONFIG[tkt.status] || {
            label: tkt.status,
            variant: "neutral" as BadgeVariant,
          };
          const pInfo = PRIORITY_CONFIG[tkt.priority] || {
            label: tkt.priority,
            className: "text-muted-foreground",
          };
          return (
            <div className="space-y-1.5 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-foreground">{tkt.subject}</div>
                <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              </div>
              <div className="flex items-center justify-between gap-2 text-muted-foreground tabular-nums">
                <span>
                  Приоритет: <span className={pInfo.className}>{pInfo.label}</span>
                </span>
                <span>{formatDateLocalized(tkt.createdAt, locale)}</span>
              </div>
            </div>
          );
        }}
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              <span>Новое обращение в поддержку</span>
            </DialogTitle>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreate} className="space-y-4">
            <FormField label="Тема обращения" htmlFor="ticket-subject" required>
              <Input
                id="ticket-subject"
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Например: Вопрос по оплате тарифа / Сбой в расписании"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Категория" htmlFor="ticket-scope">
                <select
                  id="ticket-scope"
                  value={scope}
                  onChange={(e) => setScope(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="TENANT">Учебный центр</option>
                  <option value="PLATFORM">Платформа и тарифы</option>
                </select>
              </FormField>

              <FormField label="Приоритет" htmlFor="ticket-priority">
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                  <option value="URGENT">Критический</option>
                </select>
              </FormField>
            </div>

            <FormField label="Описание проблемы или вопроса" htmlFor="ticket-message" required>
              <Textarea
                id="ticket-message"
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Опишите подробно, с чем требуется помощь..."
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setShowModal(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                <span>Отправить в поддержку</span>
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
