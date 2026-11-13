"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  HelpCircle,
  MessageSquare,
  Plus,
  Clock,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

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

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  LOW: { label: "Низкий", color: "text-slate-400" },
  MEDIUM: { label: "Средний", color: "text-blue-400" },
  HIGH: { label: "Высокий", color: "text-amber-400" },
  URGENT: { label: "Срочный", color: "text-rose-400 font-bold" },
};

export default function CenterSupportList({
  initialTickets,
  locale = "ru",
}: CenterSupportListProps) {
  const router = useRouter();
  const [tickets, setTickets] = useState<TicketSummary[]>(initialTickets);
  const [showModal, setShowModal] = useState(false);

  // Form states
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <HelpCircle className="w-6 h-6 text-brand-400" />
            Служба поддержки
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Вопросы по платформе, тарифам, настройкам центра и техническим проблемам
          </p>
        </div>
        <button
          onClick={() => {
            setShowModal(true);
            setErrorMessage(null);
          }}
          className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-brand-500/20"
        >
          <Plus className="w-4 h-4" />
          Новое обращение
        </button>
      </div>

      {/* Tickets List */}
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
            <HelpCircle className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-slate-300 mb-1">Обращений пока нет</h3>
            <p className="text-sm text-slate-500 mb-4 max-w-sm mx-auto">
              Если у вас возникнут вопросы или потребуется помощь, создайте тикет в службу поддержки.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Создать обращение
            </button>
          </div>
        ) : (
          tickets.map((tkt) => {
            const statusInfo = STATUS_CONFIG[tkt.status] || {
              label: tkt.status,
              badge: "bg-slate-800 text-slate-300",
            };
            const priorityInfo = PRIORITY_CONFIG[tkt.priority] || {
              label: tkt.priority,
              color: "text-slate-400",
            };

            return (
              <Link
                key={tkt.id}
                href={`/center/support/${tkt.id}`}
                className="glass-panel p-5 rounded-2xl border border-slate-800 hover:border-brand-500/40 flex items-center justify-between gap-4 transition-all block group"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${statusInfo.badge}`}
                    >
                      {statusInfo.label}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Приоритет: <span className={priorityInfo.color}>{priorityInfo.label}</span>
                    </span>
                    <span className="text-xs text-slate-600">•</span>
                    <span className="text-xs text-slate-400">
                      {formatDateLocalized(tkt.createdAt, locale)}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors truncate">
                    {tkt.subject}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-slate-500 group-hover:text-white transition-colors shrink-0">
                  <span className="text-xs hidden sm:inline">Перейти</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Link>
            );
          })
        )}
      </div>

      {/* New Ticket Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-brand-400" />
                Новое обращение в поддержку
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {errorMessage && (
              <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Тема обращения *
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Вопрос по оплате тарифа / Сбой в расписании"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Категория
                  </label>
                  <select
                    value={scope}
                    onChange={(e) => setScope(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="TENANT">Учебный центр</option>
                    <option value="PLATFORM">Платформа и тарифы</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Приоритет
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="URGENT">Критический</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Описание проблемы или вопроса *
                </label>
                <textarea
                  required
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Опишите подробно, с чем требуется помощь..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Отправить в поддержку
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
