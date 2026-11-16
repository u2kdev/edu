"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Building2, Calendar, Edit, Eye, Plus, Trash2, Users } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  type DataTableColumn,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  FilterBar,
  FormActions,
  FormField,
  Input,
  PageHeader,
  Textarea,
} from "@/components/ui";

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
  const [actionError, setActionError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterAudience, setFilterAudience] = useState("ALL");

  const [availableCenters, setAvailableCenters] = useState<CenterOption[]>([]);

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

  const [deletingItem, setDeletingItem] = useState<Announcement | null>(null);
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
      const method = editingItem ? "PATCH" : "POST";
      const body = editingItem ? { id: editingItem.id, ...payload } : payload;

      const res = await fetch("/api/platform/announcements", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const resData = await res.json();
      if (!res.ok) {
        setFormError(resData.error?.[0]?.message || resData.error || "Ошибка при сохранении");
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

  const handleDelete = async (reason?: string) => {
    if (!deletingItem || !reason) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/platform/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deletingItem.id, reason }),
      });

      if (!res.ok) {
        const d = await res.json();
        setActionError(d.error || "Ошибка удаления");
        return;
      }

      setDeletingItem(null);
      fetchAnnouncements();
    } catch {
      setActionError("Ошибка сети при удалении");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (publishedAt: string, expiresAt: string | null) => {
    const now = new Date();
    const pub = new Date(publishedAt);
    const exp = expiresAt ? new Date(expiresAt) : null;

    if (pub > now) return <Badge variant="info">Запланировано</Badge>;
    if (exp && exp < now) return <Badge variant="neutral">Истекло</Badge>;
    return <Badge variant="success">Активно</Badge>;
  };

  const filteredAnnouncements = announcements.filter((a) => {
    if (filterAudience !== "ALL" && a.audience !== filterAudience) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return a.title.toLowerCase().includes(q) || a.body.toLowerCase().includes(q);
    }
    return true;
  });

  const columns: DataTableColumn<Announcement>[] = [
    {
      id: "title",
      header: "Объявление",
      isMobilePrimary: true,
      cell: (item) => (
        <div className="space-y-1 max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{item.title}</span>
            {getStatusBadge(item.publishedAt, item.expiresAt)}
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground whitespace-pre-line">{item.body}</p>
        </div>
      ),
    },
    {
      id: "audience",
      header: "Аудитория",
      cell: (item) => {
        let parsedRoles: string[] = [];
        let parsedCenters: string[] = [];
        try {
          if (item.targetRoles) parsedRoles = JSON.parse(item.targetRoles);
        } catch {}
        try {
          if (item.centerIds) parsedCenters = JSON.parse(item.centerIds);
        } catch {}
        if (item.audience === "ALL_CENTERS") {
          return (
            <Badge variant="neutral">
              <Building2 className="h-3 w-3" aria-hidden="true" />
              <span>Все центры</span>
            </Badge>
          );
        }
        if (item.audience === "ROLES") {
          return (
            <Badge variant="info">
              <Users className="h-3 w-3" aria-hidden="true" />
              <span>Роли: {parsedRoles.join(", ") || "Все"}</span>
            </Badge>
          );
        }
        return (
          <Badge variant="warning">
            <Building2 className="h-3 w-3" aria-hidden="true" />
            <span>Центров: {parsedCenters.length}</span>
          </Badge>
        );
      },
    },
    {
      id: "publishedAt",
      header: "Публикация",
      hideOnMobile: true,
      cell: (item) => (
        <div className="space-y-0.5 text-xs text-muted-foreground tabular-nums">
          <div className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
            {new Date(item.publishedAt).toLocaleString("ru-RU")}
          </div>
          {item.expiresAt && (
            <div>До: {new Date(item.expiresAt).toLocaleString("ru-RU")}</div>
          )}
        </div>
      ),
    },
    {
      id: "reads",
      header: "Прочитано",
      align: "center",
      cell: (item) => (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-primary tabular-nums">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          {item._count?.reads ?? 0}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Действия",
      align: "right",
      hideable: false,
      cell: (item) => (
        <div className="inline-flex items-center justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => openEditModal(item)}
            aria-label="Редактировать"
          >
            <Edit className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setDeletingItem(item)}
            aria-label="Удалить"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      ),
    },
  ];

  const hasFilters = Boolean(search || filterAudience !== "ALL");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Объявления платформы"
        description="Таргетированные рассылки и оповещения для центров, преподавателей и учеников"
        actions={
          <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Создать объявление</span>
          </Button>
        }
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по заголовку или тексту..."
        hasActiveFilters={hasFilters}
        onReset={() => {
          setSearch("");
          setFilterAudience("ALL");
        }}
      >
        <select
          aria-label="Аудитория"
          value={filterAudience}
          onChange={(e) => setFilterAudience(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground"
        >
          <option value="ALL">Вся аудитория</option>
          <option value="ALL_CENTERS">Все центры</option>
          <option value="ROLES">По ролям</option>
          <option value="CENTERS">Выбранные центры</option>
        </select>
      </FilterBar>

      <DataTable
        data={filteredAnnouncements}
        columns={columns}
        getRowId={(a) => a.id}
        loading={loading}
        error={error}
        onRetry={fetchAnnouncements}
        emptyTitle="Объявлений не найдено"
        emptyDescription="Создайте первое объявление для уведомления пользователей платформы."
        emptyAction={
          <Button type="button" variant="primary" size="sm" onClick={openCreateModal}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Создать объявление</span>
          </Button>
        }
      />

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Редактировать объявление" : "Новое объявление платформы"}
            </DialogTitle>
          </DialogHeader>

          {formError && (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <FormField label="Заголовок" htmlFor="ann-title" required>
              <Input
                id="ann-title"
                type="text"
                required
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Например: Обновление платформы 2.0"
              />
            </FormField>

            <FormField label="Текст объявления" htmlFor="ann-body" required>
              <Textarea
                id="ann-body"
                rows={4}
                required
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="Введите текст объявления (минимум 5 символов)..."
              />
            </FormField>

            <FormField label="Целевая аудитория">
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={formAudience === "ALL_CENTERS" ? "primary" : "outline"}
                  onClick={() => setFormAudience("ALL_CENTERS")}
                >
                  Все центры
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={formAudience === "ROLES" ? "primary" : "outline"}
                  onClick={() => setFormAudience("ROLES")}
                >
                  По ролям
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={formAudience === "CENTERS" ? "primary" : "outline"}
                  onClick={() => setFormAudience("CENTERS")}
                >
                  Выбранные центры
                </Button>
              </div>
            </FormField>

            {formAudience === "ROLES" && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <span className="block text-xs font-medium text-foreground">
                  Выберите роли получателей:
                </span>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {AVAILABLE_ROLES.map((r) => {
                    const checked = formRoles.includes(r.key);
                    return (
                      <label key={r.key} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormRoles(
                              e.target.checked
                                ? [...formRoles, r.key]
                                : formRoles.filter((k) => k !== r.key)
                            )
                          }
                          className="rounded border-input accent-primary"
                        />
                        {r.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {formAudience === "CENTERS" && (
              <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
                <span className="block text-xs font-medium text-foreground">
                  Выберите учебные центры ({formCenterIds.length} выбрано):
                </span>
                <div className="max-h-36 space-y-1.5 overflow-y-auto pr-2">
                  {availableCenters.map((c) => {
                    const checked = formCenterIds.includes(c.id);
                    return (
                      <label key={c.id} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setFormCenterIds(
                              e.target.checked
                                ? [...formCenterIds, c.id]
                                : formCenterIds.filter((id) => id !== c.id)
                            )
                          }
                          className="rounded border-input accent-primary"
                        />
                        <span>{c.name}</span>
                        <span className="text-xs text-muted-foreground">({c.slug})</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField label="Дата публикации" htmlFor="ann-pub">
                <Input
                  id="ann-pub"
                  type="datetime-local"
                  value={formPublishedAt}
                  onChange={(e) => setFormPublishedAt(e.target.value)}
                />
              </FormField>

              <FormField label="Истекает (опционально)" htmlFor="ann-exp">
                <Input
                  id="ann-exp"
                  type="datetime-local"
                  value={formExpiresAt}
                  onChange={(e) => setFormExpiresAt(e.target.value)}
                />
              </FormField>
            </div>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={saving}>
                {saving ? "Сохранение..." : editingItem ? "Сохранить изменения" : "Опубликовать"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deletingItem)}
        onOpenChange={(next) => !next && setDeletingItem(null)}
        title="Удалить объявление"
        description={
          deletingItem
            ? `Объявление «${deletingItem.title}» будет удалено навсегда. Укажите причину удаления.`
            : undefined
        }
        variant="destructive"
        loading={deleting}
        reasonLabel="Причина удаления"
        reasonPlaceholder="Например: Ошибочная публикация"
        reasonRequired
        reasonMinLength={5}
        confirmLabel="Подтвердить удаление"
        onConfirm={handleDelete}
      />
    </div>
  );
}
