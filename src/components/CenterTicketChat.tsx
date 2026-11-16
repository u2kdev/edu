"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, User, Shield, Loader2 } from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export interface TicketMessageItem {
  id: string;
  senderUserId: string;
  message: string;
  createdAt: string | Date;
  sender?: {
    fullName: string;
    email: string;
    platformRole?: string | null;
  } | null;
}

export interface TicketDetail {
  id: string;
  subject: string;
  status: string;
  priority: string;
  scope: string;
  createdAt: string | Date;
  creator?: { fullName: string; email: string } | null;
  messages: TicketMessageItem[];
}

interface CenterTicketChatProps {
  ticket: TicketDetail;
  currentUserId: string;
  locale?: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: BadgeVariant }> = {
  OPEN: { label: "Открыт", variant: "info" },
  IN_PROGRESS: { label: "В работе", variant: "warning" },
  RESOLVED: { label: "Решен", variant: "success" },
  CLOSED: { label: "Закрыт", variant: "neutral" },
};

export default function CenterTicketChat({
  ticket,
  currentUserId,
  locale = "ru",
}: CenterTicketChatProps) {
  const router = useRouter();
  const [messages, setMessages] = useState<TicketMessageItem[]>(ticket.messages);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const statusInfo = STATUS_CONFIG[ticket.status] || {
    label: ticket.status,
    variant: "neutral" as BadgeVariant,
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/tickets/${ticket.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || "Не удалось отправить сообщение");
        return;
      }

      setNewMessage("");
      router.refresh();
      if (data.data?.message || data.message) {
        const added = data.data?.message || data.message;
        setMessages((prev) => [...prev, added]);
      }
    } catch {
      setErrorMessage("Ошибка сети при отправке сообщения");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Back and Header */}
      <div className="flex items-center gap-3">
        <Link href="/center/support">
          <Button type="button" variant="outline" size="icon" aria-label="Назад к обращениям">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              Создан: {formatDateLocalized(ticket.createdAt, locale)}
            </span>
          </div>
          <h1 className="truncate text-xl font-semibold text-foreground">{ticket.subject}</h1>
        </div>
      </div>

      {/* Messages Feed */}
      <Card>
        <CardHeader className="border-b border-border py-3.5">
          <CardTitle className="text-sm">Переписка по обращению</CardTitle>
        </CardHeader>
        <CardContent className="flex min-h-[400px] flex-col justify-between space-y-4 p-5">
          <div className="max-h-[550px] space-y-4 overflow-y-auto pr-1">
            {messages.map((m) => {
              const isMe = m.senderUserId === currentUserId;
              const isPlatformSupport =
                m.sender?.platformRole &&
                ["SUPERADMIN", "PLATFORM_ADMIN", "PLATFORM_SUPPORT"].includes(m.sender.platformRole);

              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isMe ? "justify-end" : "justify-start"}`}
                >
                  {!isMe && (
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${
                        isPlatformSupport
                          ? "border-primary/30 bg-accent text-accent-foreground"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
                      {isPlatformSupport ? (
                        <Shield className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <User className="h-4 w-4" aria-hidden="true" />
                      )}
                    </div>
                  )}

                  <div
                    className={`max-w-xl space-y-1.5 rounded-lg border p-3.5 ${
                      isMe
                        ? "border-primary bg-primary text-primary-foreground"
                        : isPlatformSupport
                        ? "border-primary/30 bg-muted/50 text-foreground"
                        : "border-border bg-muted/40 text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-4 text-xs opacity-85">
                      <span className="font-semibold">
                        {isMe
                          ? "Вы"
                          : isPlatformSupport
                          ? `${m.sender?.fullName || "Служба поддержки"} (Платформа)`
                          : m.sender?.fullName || "Сотрудник"}
                      </span>
                      <span className="tabular-nums">{formatDateLocalized(m.createdAt, locale)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.message}</p>
                  </div>

                  {isMe && (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-accent text-accent-foreground">
                      <User className="h-4 w-4" aria-hidden="true" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            {errorMessage && (
              <Alert variant="destructive">
                <AlertDescription>{errorMessage}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSendReply} className="flex gap-3">
              <Textarea
                rows={2}
                required
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Напишите ответ или уточнение..."
                className="flex-1 resize-none"
              />
              <Button type="submit" disabled={sending || !newMessage.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">Отправить</span>
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
