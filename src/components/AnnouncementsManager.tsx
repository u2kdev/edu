"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Pin,
  Clock,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";
import { formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

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
  const [announcements, setAnnouncements] =
    useState<AnnouncementItem[]>(initialAnnouncements);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<AnnouncementItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AnnouncementItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetType, setTargetType] = useState<"ALL" | "ROLE" | "GROUP">("ALL");
  const [targetRole, setTargetRole] = useState("STUDENT");
  const [groupId, setGroupId] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setAnnouncements(initialAnnouncements);
  }, [initialAnnouncements]);

  const pinned = announcements.filter((a) => a.isPinned);
  const regular = announcements.filter((a) => !a.isPinned);

  const openCreateModal = () => {
    setEditingItem(null);
    setTitle("");
    setBody("");
    setTargetType("ALL");
    setTargetRole("STUDENT");
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
      setTargetRole("STUDENT");
    } else if (item.targetRole) {
      setTargetType("ROLE");
      setTargetRole(item.targetRole);
      setGroupId("");
    } else {
      setTargetType("ALL");
      setTargetRole("STUDENT");
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

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    setActionError(null);
    try {
      const res = await fetch("/api/tenant/announcements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: deleteTarget.id }),
      });
      if (res.ok) {
        setAnnouncements((prev) => prev.filter((a) => a.id !== deleteTarget.id));
        setDeleteTarget(null);
        router.refresh();
      } else {
        const data = await res.json();
        setActionError(data.error || "Не удалось удалить объявление");
        setDeleteTarget(null);
      }
    } catch {
      setActionError("Ошибка сети при удалении объявления");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleTogglePin = async (item: AnnouncementItem) => {
    setActionError(null);
    try {
      const res = await fetch("/api/tenant/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, isPinned: !item.isPinned }),
      });
      if (res.ok) {
        setAnnouncements((prev) =>
          prev.map((a) => (a.id === item.id ? { ...a, isPinned: !a.isPinned } : a))
        );
        router.refresh();
      } else {
        const data = await res.json();
        setActionError(data.error || "Не удалось изменить статус закрепления");
      }
    } catch {
      setActionError("Ошибка сети при обновлении объявления");
    }
  };

  const renderAnnouncementCard = (announcement: AnnouncementItem) => {
    const isPinnedCard = announcement.isPinned;
    return (
      <Card
        key={announcement.id}
        className={cn(
          "transition-colors",
          isPinnedCard && "border-warning/40 bg-warning/5"
        )}
      >
        <CardContent className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {isPinnedCard && (
                  <Badge variant="warning">
                    <Pin className="w-3 h-3" aria-hidden="true" />
                    <span>Закреплено</span>
                  </Badge>
                )}
                {announcement.group ? (
                  <Badge variant="primary">Группа: {announcement.group.name}</Badge>
                ) : announcement.targetRole ? (
                  <Badge variant="info">Роль: {announcement.targetRole}</Badge>
                ) : (
                  <Badge variant="neutral">Для всех</Badge>
                )}
              </div>
              <h3 className="text-base font-semibold text-foreground">
                {announcement.title}
              </h3>
            </div>

            {canManage && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant={announcement.isPinned ? "secondary" : "ghost"}
                  size="icon"
                  onClick={() => void handleTogglePin(announcement)}
                  title={announcement.isPinned ? "Открепить" : "Закрепить"}
                  aria-label={announcement.isPinned ? "Открепить" : "Закрепить"}
                >
                  <Pin
                    className={cn(
                      "w-4 h-4",
                      announcement.isPinned && "text-warning"
                    )}
                    aria-hidden="true"
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(announcement)}
                  title="Редактировать"
                  aria-label="Редактировать"
                >
                  <Edit2 className="w-4 h-4" aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteTarget(announcement)}
                  title="Удалить"
                  aria-label="Удалить"
                  className="hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {announcement.body}
          </p>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground pt-3 border-t border-border">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="tabular-nums">
                {formatDateLocalized(announcement.publishAt, locale)}
              </span>
            </div>
            {announcement.author?.user?.fullName && (
              <span>Автор: {announcement.author.user.fullName}</span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Объявления"
        description={
          announcements.length === 0
            ? "Нет актуальных объявлений"
            : `${announcements.length} актуальных объявлений`
        }
        actions={
          canManage ? (
            <Button type="button" size="sm" onClick={openCreateModal}>
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>Создать объявление</span>
            </Button>
          ) : undefined
        }
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      {announcements.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="w-5 h-5" aria-hidden="true" />}
          title="Нет объявлений"
          description="Публикуйте важные новости для преподавателей, учеников и родителей."
          action={
            canManage ? (
              <Button type="button" size="sm" onClick={openCreateModal}>
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>Создать объявление</span>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-6">
          {pinned.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-[13px] font-semibold text-warning flex items-center gap-1.5">
                <Pin className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Закреплённые объявления</span>
              </h2>
              <div className="space-y-3">{pinned.map(renderAnnouncementCard)}</div>
            </section>
          )}

          {regular.length > 0 && (
            <section className="space-y-3">
              {pinned.length > 0 && (
                <h2 className="text-[13px] font-semibold text-muted-foreground">
                  Все объявления
                </h2>
              )}
              <div className="space-y-3">{regular.map(renderAnnouncementCard)}</div>
            </section>
          )}
        </div>
      )}

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent locale={locale} className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="w-4 h-4 text-primary" aria-hidden="true" />
              <span>
                {editingItem ? "Редактировать объявление" : "Новое объявление"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {errorMessage && (
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="ann-title">Заголовок *</Label>
              <Input
                id="ann-title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Праздничные дни и изменения в расписании"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ann-body">Текст сообщения *</Label>
              <Textarea
                id="ann-body"
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Подробный текст объявления..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>Кому показывать</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === "ALL" ? "primary" : "outline"}
                  onClick={() => setTargetType("ALL")}
                >
                  Всем
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === "ROLE" ? "primary" : "outline"}
                  onClick={() => setTargetType("ROLE")}
                >
                  По ролям
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={targetType === "GROUP" ? "primary" : "outline"}
                  onClick={() => setTargetType("GROUP")}
                >
                  По группам
                </Button>
              </div>
            </div>

            {targetType === "ROLE" && (
              <div className="space-y-1.5">
                <Label htmlFor="ann-role">Выберите роль</Label>
                <select
                  id="ann-role"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value)}
                  className={SELECT_CLS}
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
              <div className="space-y-1.5">
                <Label htmlFor="ann-group">Выберите учебную группу</Label>
                <select
                  id="ann-group"
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Выберите группу...</option>
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
                className="h-4 w-4 rounded border-input bg-card accent-primary"
              />
              <label
                htmlFor="isPinned"
                className="text-[13px] text-foreground cursor-pointer font-medium"
              >
                Закрепить объявление вверху страницы
              </label>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
              >
                Отмена
              </Button>
              <Button type="submit" loading={loading}>
                {editingItem ? "Сохранить изменения" : "Опубликовать"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        locale={locale}
        variant="destructive"
        loading={deleting}
        title="Удалить объявление"
        description={
          deleteTarget
            ? `Объявление «${deleteTarget.title}» будет удалено без возможности восстановления.`
            : undefined
        }
        confirmLabel="Удалить"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
