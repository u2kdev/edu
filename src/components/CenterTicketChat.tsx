"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HelpCircle,
  ArrowLeft,
  Send,
  User,
  Shield,
  Clock,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

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

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  OPEN: {
    label: "Открыт",
    badge: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  IN_PROGRESS: {
    label: "В работе",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  RESOLVED: {
    label: "Решен",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  CLOSED: {
    label: "Закрыт",
    badge: "bg-slate-800 text-slate-400 border-slate-700",
  },
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
    badge: "bg-slate-800 text-slate-300",
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
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Back and Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/center/support"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusInfo.badge}`}>
              {statusInfo.label}
            </span>
            <span className="text-xs text-slate-400">
              Создан: {formatDateLocalized(ticket.createdAt, locale)}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white truncate">{ticket.subject}</h1>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="glass-panel p-6 rounded-3xl border border-slate-800 space-y-4 min-h-[400px] flex flex-col justify-between">
        <div className="space-y-4 overflow-y-auto max-h-[550px] pr-2">
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
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-white ${
                      isPlatformSupport
                        ? "bg-purple-600/30 border border-purple-500/40 text-purple-300"
                        : "bg-slate-800 border border-slate-700 text-slate-300"
                    }`}
                  >
                    {isPlatformSupport ? <Shield className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                )}

                <div
                  className={`max-w-xl rounded-2xl p-4 space-y-1.5 ${
                    isMe
                      ? "bg-brand-600 text-white rounded-br-none"
                      : isPlatformSupport
                      ? "bg-slate-900 border border-purple-500/30 text-slate-200 rounded-bl-none"
                      : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none"
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 text-[11px] opacity-80">
                    <span className="font-semibold">
                      {isMe
                        ? "Вы"
                        : isPlatformSupport
                        ? `${m.sender?.fullName || "Служба поддержки"} (Платформа)`
                        : m.sender?.fullName || "Сотрудник"}
                    </span>
                    <span className="text-[10px]">{formatDateLocalized(m.createdAt, locale)}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{m.message}</p>
                </div>

                {isMe && (
                  <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center shrink-0 text-brand-300">
                    <User className="w-4 h-4" />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Reply Box */}
        <div className="pt-4 border-t border-slate-800 space-y-3">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSendReply} className="flex gap-3">
            <textarea
              rows={2}
              required
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Напишите ответ или уточнение..."
              className="flex-1 px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-2xl text-white text-sm focus:outline-none focus:border-brand-500 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="px-5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              <span className="hidden sm:inline">Отправить</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
