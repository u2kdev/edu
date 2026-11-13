"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Lock,
  Building2,
  User,
  Clock,
  AlertCircle,
  CheckCircle2,
  ShieldAlert,
} from "lucide-react";

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
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketDetails | null>(null);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New message form
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
    try {
      const res = await fetch(`/api/platform/support/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error || "Ошибка обновления тикета");
      } else {
        fetchTicket();
      }
    } catch {
      alert("Ошибка сети");
    } finally {
      setUpdating(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    setSending(true);
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
        alert(data.error || "Ошибка отправки сообщения");
      } else {
        setNewMessage("");
        setIsInternal(false);
        fetchTicket();
      }
    } catch {
      alert("Ошибка соединения");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-500 animate-pulse">
        Загрузка обращения...
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="p-6 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-center space-y-3">
        <p className="font-semibold">{error || "Обращение не найдено"}</p>
        <Link
          href="/platform-admin/support"
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Назад к списку
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/platform-admin/support"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-600 hover:text-slate-900 transition-colors shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{ticket.subject}</h1>
            </div>
            <p className="text-xs text-slate-500 font-mono mt-0.5">Тикет #{ticket.id.slice(0, 8)}</p>
          </div>
        </div>
      </div>

      {/* Control Card: Status, Priority, Assignee */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Статус обращения
          </label>
          <select
            value={ticket.status}
            disabled={updating}
            onChange={(e) => handleUpdateMeta({ status: e.target.value })}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold cursor-pointer"
          >
            <option value="OPEN">OPEN (Новый)</option>
            <option value="IN_PROGRESS">IN_PROGRESS (В работе)</option>
            <option value="RESOLVED">RESOLVED (Решён)</option>
            <option value="CLOSED">CLOSED (Закрыт)</option>
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Приоритет
          </label>
          <select
            value={ticket.priority}
            disabled={updating}
            onChange={(e) => handleUpdateMeta({ priority: e.target.value })}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold cursor-pointer"
          >
            <option value="LOW">LOW (Низкий)</option>
            <option value="MEDIUM">MEDIUM (Обычный)</option>
            <option value="HIGH">HIGH (Высокий)</option>
            <option value="URGENT">URGENT (Срочный)</option>
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
            Ответственный специалист
          </label>
          <select
            value={ticket.assignedTo?.id || ""}
            disabled={updating}
            onChange={(e) => handleUpdateMeta({ assignedToId: e.target.value || null })}
            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-sm cursor-pointer"
          >
            <option value="">Не назначен</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName} ({s.platformRole})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Meta Card: Creator & Center */}
      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-slate-500">Автор:</span>
          <span className="font-semibold text-slate-900">{ticket.creator.fullName}</span>
          <span className="text-slate-400">({ticket.creator.email})</span>
        </div>
        {ticket.center && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            <span className="text-slate-500">Центр:</span>
            <Link
              href={`/platform-admin/centers/${ticket.center.id}`}
              className="font-semibold text-indigo-600 hover:underline"
            >
              {ticket.center.name}
            </Link>
          </div>
        )}
        <div className="flex items-center gap-2 text-slate-400">
          <Clock className="w-4 h-4" />
          <span>Создан: {new Date(ticket.createdAt).toLocaleString()}</span>
        </div>
      </div>

      {/* Messages Thread */}
      <div className="space-y-4">
        {ticket.messages.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400 bg-white rounded-2xl border border-slate-200">
            Сообщений в тикете пока нет.
          </div>
        ) : (
          ticket.messages.map((msg) => {
            const isPlatformStaff = msg.sender.platformRole !== "NONE";
            return (
              <div
                key={msg.id}
                className={`p-5 rounded-2xl border shadow-sm transition-all ${
                  msg.isInternal
                    ? "bg-amber-50/70 border-amber-300"
                    : isPlatformStaff
                    ? "bg-white border-indigo-200"
                    : "bg-white border-slate-200"
                }`}
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{msg.sender.fullName}</span>
                    {msg.isInternal ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                        <Lock className="w-3 h-3" />
                        Внутренняя заметка платформы
                      </span>
                    ) : isPlatformStaff ? (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-100 text-indigo-800">
                        Команда платформы ({msg.sender.platformRole})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700">
                        Клиент
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Reply Composer */}
      <form
        onSubmit={handleSendMessage}
        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Отправить ответ или заметку</h3>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(e) => setIsInternal(e.target.checked)}
                className="rounded text-amber-600 focus:ring-amber-500"
              />
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              <span>Внутренняя заметка (видна только платформе)</span>
            </label>
          </div>
        </div>

        <textarea
          rows={4}
          required
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder={
            isInternal
              ? "Оставьте служебную заметку для сотрудников платформы (клиент её не увидит)..."
              : "Напишите ответ клиенту (клиент получит уведомление на платформе и по email)..."
          }
          className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
        />

        <div className="flex justify-between items-center">
          <p className="text-xs text-slate-400">
            {isInternal
              ? "Заметка останется видна только сотрудникам службы поддержки и суперадминам."
              : "При отправке клиенту тикет автоматически переходит в статус 'В работе'."}
          </p>
          <button
            type="submit"
            disabled={sending || !newMessage.trim()}
            className={`inline-flex items-center gap-2 px-5 py-2 text-white rounded-xl text-sm font-semibold shadow-sm transition-all disabled:opacity-50 ${
              isInternal ? "bg-amber-600 hover:bg-amber-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            <Send className="w-4 h-4" />
            <span>{sending ? "Отправка..." : isInternal ? "Сохранить заметку" : "Отправить ответ"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
