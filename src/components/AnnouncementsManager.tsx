"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Pin,
  Clock,
  Users,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";

export interface AnnouncementItem {
  id: string;
  title: string;
  body: string;
  targetRole: string | null;
  groupId: string | null;
  isPinned: boolean;
  publishAt: string | Date;
  expiresAt?: string | Date | null;
  createdAt: string | Date;
  author?: {
    user: { fullName: string };
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
}

export interface GroupOption {
  id: string;
  name: string;
}

interface AnnouncementsManagerProps {
  initialAnnouncements: AnnouncementItem[];
  groups: GroupOption[];
  canManage: boolean;
  locale?: string;
}

const ROLE_OPTIONS = [
  { value: "", label: "Все пользователи центра" },
  { value: "STUDENT", label: "Только ученики" },
  { value: "TEACHER", label: "Только преподаватели" },
  { value: "PARENT", label: "Только родители" },
  { value: "CENTER_ADMIN", label: "Только администраторы" },
];

export default function AnnouncementsManager({
  initialAnnouncements,
  groups,
  canManage,
  locale = "ru",
}: AnnouncementsManagerProps) {
  const router = useRouter();
  const [announcements, setAnnouncements] = useState<AnnouncementItem[]>(initialAnnouncements);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"ALL" | "ROLE" | "GROUP">("ALL");
  const [targetRole, setTargetRole] = useState("");
  const [groupId, setGroupId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pinned = announcements.filter((a) => a.isPinned);
  const regular = announcements.filter((a) => !a.isPinned);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle("");
    setBody("");
    setTargetType("ALL");
    setTargetRole("");
    setGroupId("");
    setIsPinned(false);
    setErrorMessage(null);
    setShowModal(true);
  };

  const openEditModal = (item: AnnouncementItem) => {
    setEditingItem(item);
    setTitle(item.title);
    setBody(item.body);
    if (item.groupId) {
      setTargetType("GROUP");
      setGroupId(item.groupId);
      setTargetRole("");
    } else if (item.targetRole) {
      setTargetType("ROLE");
      setTargetRole(item.targetRole);
      setGroupId("");
    } else {
      setTargetType("ALL");
      setTargetRole("");
      setGroupId("");
    }
    setIsPinned(item.isPinned);
    setErrorMessage(null);
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) return;

    setLoading(true);
    setErrorMessage(null);

    const payload = {
      title: title.trim(),
      body: body.trim(),
      targetRole: targetType === "ROLE" ? targetRole || null : null,
      groupId: targetType === "GROUP" ? groupId || null : null,
      isPinned,
    };

    try {
      if (editingItem) {
        const res = await fetch("/api/tenant/announcements", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingItem.id, ...payload }),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось обновить объявление");
          return;
        }
      } else {
        const res = await fetch("/api/tenant/announcements", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMessage(data.error || "Не удалось опубликовать объявление");
          return;
        }
      }
      setShowModal(false);
      router.refresh();
    } catch {
      setErrorMessage("Ошибка сети при сохранении объявления");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (item: AnnouncementItem) => {
    if (!confirm(`Удалить объявление «${item.title}»?`)) return;

    try {
      const res = await fetch("/api/tenant/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (res.ok) {
        router.refresh();
      } else {
        const data = await res.json();
        alert(data.error || "Не удалось удалить объявление");
      }
    } catch {
      alert("Ошибка сети");
    }
  };

  const handleTogglePin = async (item: AnnouncementItem) => {
    try {
      const res = await fetch("/api/tenant/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isPinned: !item.isPinned }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch {
      alert("Ошибка сети");
    }
  };

  const renderAnnouncementCard = (announcement: AnnouncementItem) => {
    const isPinnedCard = announcement.isPinned;
    return (
      <div
        key={announcement.id}
        className={`glass-panel p-6 rounded-2xl border transition-all ${
          isPinnedCard
            ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500/60"
            : "border-slate-800 hover:border-slate-700"
        } space-y-4`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {isPinnedCard && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <Pin className="w-3 h-3" /> Закреплено
                </span>
              )}
              {announcement.group ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-brand-500/10 text-brand-400 border border-brand-500/20">
                  Группа: {announcement.group.name}
                </span>
              ) : announcement.targetRole ? (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Роль: {announcement.targetRole}
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-300">
                  Для всех
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-white mt-1">{announcement.title}</h3>
          </div>

          {canManage && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleTogglePin(announcement)}
                title={announcement.isPinned ? "Открепить" : "Закрепить"}
                className={`p-1.5 rounded-lg border transition-colors ${
                  announcement.isPinned
                    ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:text-white"
                }`}
              >
                <Pin className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => openEditModal(announcement)}
                title="Редактировать"
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDelete(announcement)}
                title="Удалить"
                className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
          {announcement.body}
        </p>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            <span>{formatDateLocalized(announcement.publishAt, locale)}</span>
          </div>
          {announcement.author?.user?.fullName && (
            <span className="text-slate-400">Автор: {announcement.author.user.fullName}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-brand-400" />
            Объявления
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            {announcements.length === 0
              ? "Нет актуальных объявлений"
              : `${announcements.length} актуальных объявлений`}
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreateModal}
            className="px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 self-start sm:self-auto shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            Создать объявление
          </button>
        )}
      </div>

      {announcements.length === 0 ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center">
          <Megaphone className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-400 mb-1">Нет объявлений</h3>
          <p className="text-sm text-slate-500 mb-4">
            Публикуйте важные новости для учителей, студентов и родителей.
          </p>
          {canManage && (
            <button
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Создать объявление
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" /> Закреплённые объявления
              </h3>
              <div className="space-y-4">{pinned.map(renderAnnouncementCard)}</div>
            </div>
          )}

          {regular.length > 0 && (
            <div className="space-y-4">
              {pinned.length > 0 && (
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Все объявления
                </h3>
              )}
              <div className="space-y-4">{regular.map(renderAnnouncementCard)}</div>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Megaphone className="w-5 h-5 text-brand-400" />
                {editingItem ? "Редактировать объявление" : "Новое объявление"}
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

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Заголовок *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Праздничные дни и изменение в расписании"
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Текст сообщения *
                </label>
                <textarea
                  required
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Подробный текст объявления..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Кому показывать
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType("ALL")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      targetType === "ALL"
                        ? "bg-brand-600 border-brand-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Всем
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("ROLE")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      targetType === "ROLE"
                        ? "bg-brand-600 border-brand-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    По ролям
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType("GROUP")}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all ${
                      targetType === "GROUP"
                        ? "bg-brand-600 border-brand-500 text-white"
                        : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    По группам
                  </button>
                </div>
              </div>

              {targetType === "ROLE" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Выберите роль
                  </label>
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    {ROLE_OPTIONS.filter((r) => r.value !== "").map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "GROUP" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Выберите учебную группу
                  </label>
                  <select
                    value={groupId}
                    onChange={(e) => setGroupId(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  >
                    <option value="">-- Выберите группу --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isPinned"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="isPinned" className="text-xs text-slate-300 cursor-pointer font-medium">
                  Закрепить объявление вверху страницы
                </label>
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
                  {editingItem ? "Сохранить изменения" : "Опубликовать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
