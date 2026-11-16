"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Building2, Clock, Lock, Send, User } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  EmptyState,
  FormField,
  PageHeader,
  Skeleton,
  Textarea,
} from "@/components/ui";
import { t } from "@/i18n";

interface TicketMessage {
  id: string;
  message: string;
  isInternal: boolean;
  createdAt: string;
  sender: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  };
}

interface TicketDetails {
  id: string;
  subject: string;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  priority: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
  createdAt: string;
  creator: {
    id: string;
    fullName: string;
    email: string;
    phone: string | null;
  };
  center: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
  assignedTo: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  } | null;
  messages: TicketMessage[];
}

interface StaffMember {
  id: string;
  fullName: string;
  email: string;
  platformRole: string;
}

export default function PlatformTicketDetailPage() {
  const params = useParams();
  const ticketId = params.id as string;

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);

  const fetchTicket = useCallback(async () => {
    try {
      const res = await fetch(`/api/platform/support/${ticketId}`);
      const data = await res.json();
      if (data.success) {
        setTicket(data.ticket);
        setStaffList(data.staff || []);
      } else {
        setError(data.error || "Тикет не найден");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    fetchTicket();
  }, [fetchTicket]);

  const handleUpdateMeta = async (fields: {
    status?: string;
    priority?: string;
    assignedToId?: string | null;
  }) => {
    setUpdating(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Ошибка обновления тикета");
      } else {
        fetchTicket();
      }
    } catch {
      setActionError("Ошибка сети");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/platform/support/${ticketId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage.trim(),
          isInternal,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setActionError(data.error || "Ошибка отправки сообщения");
      } else {
        setNewMessage("");
        setIsInternal(false);
        fetchTicket();
      }
    } catch {
      setActionError("Ошибка соединения");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error || "Обращение не найдено"}</span>
            <Button asChild variant="outline" size="sm">
              <Link href="/platform-admin/support">
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Назад к списку</span>
              </Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon" aria-label={t("ru", "common.back")}>
          <Link href="/platform-admin/support">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        <PageHeader title={ticket.subject} description={`Тикет #${ticket.id.slice(0, 8)}`} />
      </div>

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-3">
          <FormField label="Статус обращения" htmlFor="ticket-status">
            <select
              id="ticket-status"
              value={ticket.status}
              disabled={updating}
              onChange={(e) => handleUpdateMeta({ status: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
            >
              <option value="OPEN">OPEN (Новый)</option>
              <option value="IN_PROGRESS">IN_PROGRESS (В работе)</option>
              <option value="RESOLVED">RESOLVED (Решён)</option>
              <option value="CLOSED">CLOSED (Закрыт)</option>
            </select>
          </FormField>

          <FormField label="Приоритет" htmlFor="ticket-priority">
            <select
              id="ticket-priority"
              value={ticket.priority}
              disabled={updating}
              onChange={(e) => handleUpdateMeta({ priority: e.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground"
            >
              <option value="LOW">LOW (Низкий)</option>
              <option value="MEDIUM">MEDIUM (Обычный)</option>
              <option value="HIGH">HIGH (Высокий)</option>
              <option value="URGENT">URGENT (Срочный)</option>
            </select>
          </FormField>

          <FormField label="Ответственный специалист" htmlFor="ticket-assignee">
            <select
              id="ticket-assignee"
              value={ticket.assignedTo?.id || ""}
              disabled={updating}
              onChange={(e) => handleUpdateMeta({ assignedToId: e.target.value || null })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
            >
              <option value="">Не назначен</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName} ({s.platformRole})
                </option>
              ))}
            </select>
          </FormField>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-4 text-xs">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <span className="text-muted-foreground">Автор:</span>
          <span className="font-medium text-foreground">{ticket.creator.fullName}</span>
          <span className="text-muted-foreground">({ticket.creator.email})</span>
        </div>
        {ticket.center && (
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-muted-foreground">Центр:</span>
            <Link
              href={`/platform-admin/centers/${ticket.center.id}`}
              className="font-medium text-primary hover:underline"
            >
              {ticket.center.name}
            </Link>
          </div>
        )}
        <div className="flex items-center gap-1.5 text-muted-foreground tabular-nums">
          <Clock className="h-4 w-4" aria-hidden="true" />
          <span>Создан: {new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-3">
        {ticket.messages.length === 0 ? (
          <EmptyState
            title="Сообщений в тикете пока нет"
            description="Отправьте первый ответ пользователю или оставьте внутреннюю заметку."
          />
        ) : (
          ticket.messages.map((msg) => {
            const isPlatformStaff = msg.sender.platformRole !== "NONE";
            return (
              <Card
                key={msg.id}
                className={
                  msg.isInternal
                    ? "border-warning/40 bg-warning-subtle/40"
                    : isPlatformStaff
                    ? "border-primary/30"
                    : undefined
                }
              >
                <CardContent className="space-y-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {msg.sender.fullName}
                      </span>
                      {msg.isInternal ? (
                        <Badge variant="warning">
                          <Lock className="h-3 w-3" aria-hidden="true" />
                          <span>Внутренняя заметка платформы</span>
                        </Badge>
                      ) : isPlatformStaff ? (
                        <Badge variant="primary">
                          Команда платформы ({msg.sender.platformRole})
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Клиент</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                    {msg.message}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      <Card>
        <CardContent className="p-5">
          <form onSubmit={handleSendMessage} className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-foreground">
                Отправить ответ или заметку
              </h3>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-input accent-primary"
                />
                <Lock className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
                <span>Внутренняя заметка (видна только платформе)</span>
              </label>
            </div>

            <Textarea
              rows={4}
              required
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                isInternal
                  ? "Служебная заметка для сотрудников платформы (клиент её не увидит)..."
                  : "Ответ клиенту (пользователь получит уведомление)..."
              }
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {isInternal
                  ? "Заметка видна только сотрудникам поддержки и суперадминам."
                  : "При отправке клиенту тикет переходит в статус «В работе»."}
              </p>
              <Button
                type="submit"
                variant="primary"
                disabled={sending || !newMessage.trim()}
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                <span>
                  {sending
                    ? "Отправка..."
                    : isInternal
                    ? "Сохранить заметку"
                    : "Отправить ответ"}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
