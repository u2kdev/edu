"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Megaphone,
  Plus,
  Trash2,
  Edit,
  Eye,
  Calendar,
  Users,
  Building2,
  AlertCircle,
  Search,
  Filter,
} from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: "ALL_CENTERS" | "ROLES" | "CENTERS";
  targetRoles: string | null;
  centerIds: string | null;
  publishedAt: string;
  expiresAt: string | null;
  createdAt: string;
  author?: {
    id: string;
    fullName: string;
    email: string;
    platformRole: string;
  };
  _count?: {
    reads: number;
  };
}

interface CenterOption {
  id: string;
  name: string;
  slug: string;
}

const AVAILABLE_ROLES = [
  { key: "DIRECTOR", label: "Директора (DIRECTOR)" },
  { key: "CENTER_ADMIN", label: "Администраторы (CENTER_ADMIN)" },
  { key: "TEACHER", label: "Учителя (TEACHER)" },
  { key: "STUDENT", label: "Ученики (STUDENT)" },
  { key: "PARENT", label: "Родители (PARENT)" },
];

export default function PlatformAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterAudience, setFilterAudience] = useState("ALL");

  // Centers list for selection
  const [availableCenters, setAvailableCenters] = useState<CenterOption[]>([]);

  // Modal Create / Edit
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Announcement | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formAudience, setFormAudience] = useState<"ALL_CENTERS" | "ROLES" | "CENTERS">("ALL_CENTERS");
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [formCenterIds, setFormCenterIds] = useState<string[]>([]);
  const [formPublishedAt, setFormPublishedAt] = useState("");
  const [formExpiresAt, setFormExpiresAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Modal
  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/announcements?limit=100");
      const data = await res.json();
      if (data.announcements) {
        setAnnouncements(data.announcements);
      } else {
        setError(data.error || "Не удалось загрузить объявления");
      }
    } catch {
      setError("Ошибка соединения");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();

    // Fetch centers for picker
    fetch("/api/platform/centers?limit=100")
      .then((res) => res.json())
      .then((data) => {
        if (data.centers) {
          setAvailableCenters(
            data.centers.map((c: { id: string; name: string; slug: string }) => ({
              id: c.id,
              name: c.name,
              slug: c.slug,
            }))
          );
        }
      })
      .catch((err) => console.error("Failed to load centers:", err));
  }, [fetchAnnouncements]);

  const openCreateModal = () => {
    setEditingItem(null);
    setFormTitle("");
    setFormBody("");
    setFormAudience("ALL_CENTERS");
    setFormRoles([]);
    setFormCenterIds([]);
    setFormPublishedAt(new Date().toISOString().slice(0, 16));
    setFormExpiresAt("");
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (item: Announcement) => {
    setEditingItem(item);
    setFormTitle(item.title);
    setFormBody(item.body);
    setFormAudience(item.audience);
    try {
      setFormRoles(item.targetRoles ? JSON.parse(item.targetRoles) : []);
    } catch {
      setFormRoles([]);
    }
    try {
      setFormCenterIds(item.centerIds ? JSON.parse(item.centerIds) : []);
    } catch {
      setFormCenterIds([]);
    }
    setFormPublishedAt(new Date(item.publishedAt).toISOString().slice(0, 16));
    setFormExpiresAt(item.expiresAt ? new Date(item.expiresAt).toISOString().slice(0, 16) : "");
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setFormError("Заголовок обязателен");
      return;
    }
    if (!formBody.trim() || formBody.trim().length < 5) {
      setFormError("Текст объявления должен быть не менее 5 символов");
      return;
    }

    setSaving(true);
    setFormError(null);

    const payload = {
      title: formTitle.trim(),
      body: formBody.trim(),
      audience: formAudience,
      targetRoles: formAudience === "ROLES" ? formRoles : undefined,
      centerIds: formAudience === "CENTERS" ? formCenterIds : undefined,
      publishedAt: formPublishedAt ? new Date(formPublishedAt).toISOString() : undefined,
      expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
    };

    try {
      const url = "/api/platform/announcements";
      const method = editingItem ? "PATCH" : "POST";
      const body = editingItem ? { id: editingItem.id, ...payload } : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error?.[0]?.message || resData.error || "Ошибка при сохранении");
        setSaving(false);
        return;
      }

      setIsModalOpen(false);
      fetchAnnouncements();
    } catch {
      setFormError("Ошибка сети");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    if (!deleteReason.trim() || deleteReason.trim().length < 5) {
      alert("Укажите обязательную причину удаления (минимум 5 символов)");
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch("/api/platform/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingItem.id, reason: deleteReason.trim() }),
      });

      if (!res.ok) {
        const d = await res.json();
        alert(d.error || "Ошибка удаления");
        setDeleting(false);
        return;
      }

      setDeletingItem(null);
      setDeleteReason("");
      fetchAnnouncements();
    } catch {
      alert("Ошибка сети при удалении");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (publishedAt: string, expiresAt: string | null) => {
    const now = new Date();
    const pub = new Date(publishedAt);
    const exp = expiresAt ? new Date(expiresAt) : null;

    if (pub > now) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
          Запланировано
        </span>
      );
    }
    if (exp && exp < now) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          Истекло
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
        Активно
      </span>
    );
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (filterAudience !== "ALL" && a.audience !== filterAudience) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                Объявления платформы
              </h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Таргетированные рассылки и важные оповещения для центров, учителей и студентов
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Создать объявление
        </button>
      </div>

      {/* Filter toolbar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Поиск по заголовку или тексту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-zinc-400 shrink-0" />
          <select
            value={filterAudience}
            onChange={(e) => setFilterAudience(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="ALL">Вся аудитория</option>
            <option value="ALL_CENTERS">Все центры</option>
            <option value="ROLES">По ролям</option>
            <option value="CENTERS">Выбранные центры</option>
          </select>
        </div>
      </div>

      {/* Announcements List */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          Загрузка объявлений...
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-12 text-center text-zinc-500 dark:text-zinc-400">
          <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30 text-indigo-500" />
          <p className="text-base font-medium">Объявлений не найдено</p>
          <p className="text-sm mt-1">Создайте первое объявление для уведомления пользователей платформы</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredAnnouncements.map((item) => {
            let parsedRoles: string[] = [];
            try {
              if (item.targetRoles) parsedRoles = JSON.parse(item.targetRoles);
            } catch {
              // ignore
            }

            let parsedCenters: string[] = [];
            try {
              if (item.centerIds) parsedCenters = JSON.parse(item.centerIds);
            } catch {
              // ignore
            }

            return (
              <div
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition"
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </h2>
                      {getStatusBadge(item.publishedAt, item.expiresAt)}

                      {item.audience === "ALL_CENTERS" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                          <Building2 className="w-3 h-3" /> Все центры
                        </span>
                      )}

                      {item.audience === "ROLES" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          <Users className="w-3 h-3" /> Роли: {parsedRoles.join(", ") || "Все"}
                        </span>
                      )}

                      {item.audience === "CENTERS" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">
                          <Building2 className="w-3 h-3" /> Центров: {parsedCenters.length}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-zinc-600 dark:text-zinc-300 whitespace-pre-line">
                      {item.body}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        Опубликовано: {new Date(item.publishedAt).toLocaleString("ru-RU")}
                      </span>

                      {item.expiresAt && (
                        <span>Истекает: {new Date(item.expiresAt).toLocaleString("ru-RU")}</span>
                      )}

                      <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                        <Eye className="w-3.5 h-3.5" />
                        Прочитано: {item._count?.reads ?? 0}
                      </span>

                      {item.author && (
                        <span>Автор: {item.author.fullName || item.author.email}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-start">
                    <button
                      onClick={() => openEditModal(item)}
                      className="p-2 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                      title="Редактировать"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingItem(item);
                        setDeleteReason("");
                      }}
                      className="p-2 text-red-500 hover:text-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-xl w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-4">
              {editingItem ? "Редактировать объявление" : "Новое объявление платформы"}
            </h3>

            {formError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Заголовок *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Например: Обновление платформы 2.0"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                  Текст объявления *
                </label>
                <textarea
                  rows={4}
                  required
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Введите текст объявления (минимум 5 символов)..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Target Audience */}
              <div>
                <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">
                  Целевая аудитория
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAudience("ALL_CENTERS")}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition ${
                      formAudience === "ALL_CENTERS"
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    Все центры
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAudience("ROLES")}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition ${
                      formAudience === "ROLES"
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    По ролям
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAudience("CENTERS")}
                    className={`px-3 py-2 text-xs font-medium rounded-lg border text-center transition ${
                      formAudience === "CENTERS"
                        ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    Выбранные центры
                  </button>
                </div>
              </div>

              {/* Audience Specific: Roles */}
              {formAudience === "ROLES" && (
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Выберите роли получателей:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {AVAILABLE_ROLES.map((r) => {
                      const checked = formRoles.includes(r.key);
                      return (
                        <label
                          key={r.key}
                          className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormRoles([...formRoles, r.key]);
                              } else {
                                setFormRoles(formRoles.filter((k) => k !== r.key));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          {r.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Audience Specific: Centers */}
              {formAudience === "CENTERS" && (
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
                    Выберите учебные центры ({formCenterIds.length} выбрано):
                  </span>
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2">
                    {availableCenters.map((c) => {
                      const checked = formCenterIds.includes(c.id);
                      return (
                        <label
                          key={c.id}
                          className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormCenterIds([...formCenterIds, c.id]);
                              } else {
                                setFormCenterIds(formCenterIds.filter((id) => id !== c.id));
                              }
                            }}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>{c.name}</span>
                          <span className="text-zinc-400 text-[10px]">({c.slug})</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Дата публикации
                  </label>
                  <input
                    type="datetime-local"
                    value={formPublishedAt}
                    onChange={(e) => setFormPublishedAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                    Истекает (опционально)
                  </label>
                  <input
                    type="datetime-local"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                >
                  {saving ? "Сохранение..." : editingItem ? "Сохранить изменения" : "Опубликовать"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-2">
              Удалить объявление?
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Объявление &laquo;{deletingItem.title}&raquo; будет удалено навсегда. Для безопасности и аудита укажите причину удаления.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1">
                Причина удаления (минимум 5 символов) *
              </label>
              <input
                type="text"
                required
                placeholder="Например: Ошибочная публикация"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-transparent text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleting || deleteReason.trim().length < 5}
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {deleting ? "Удаление..." : "Подтвердить удаление"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
