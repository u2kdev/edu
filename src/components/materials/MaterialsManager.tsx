"use client";

import { useState } from "react";
import {
  FolderOpen,
  Plus,
  Upload,
  Link as LinkIcon,
  Video,
  BookOpen,
  FileText,
  ClipboardList,
  Download,
  Trash2,
  HardDrive,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Textarea } from "@/components/ui/textarea";

const SELECT_CLS =
  "flex h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface MaterialItem {
  id: string;
  title: string;
  materialType: string;
  fileUrl: string | null;
  externalUrl: string | null;
  contentText: string | null;
  fileSizeBytes: number | null;
  durationMinutes: number | null;
  createdAt: string;
  course?: { id: string; title: string } | null;
  group?: { id: string; name: string } | null;
  lesson?: { id: string; title: string } | null;
}

export interface StorageQuotaInfo {
  usedBytes: number;
  maxBytes: number;
  percent: number;
  usedMb: number;
  maxMb: number;
}

interface MaterialsManagerProps {
  initialMaterials: MaterialItem[];
  initialQuota: StorageQuotaInfo;
  canManage: boolean;
  courses: Array<{ id: string; title: string }>;
  groups: Array<{ id: string; name: string }>;
}

export default function MaterialsManager({
  initialMaterials,
  initialQuota,
  canManage,
  courses,
}: MaterialsManagerProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>(initialMaterials);
  const [quota, setQuota] = useState<StorageQuotaInfo>(initialQuota);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"FILE" | "LINK">("FILE");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [modalError, setModalError] = useState("");
  const [title, setTitle] = useState("");
  const [materialType, setMaterialType] = useState("LECTURE");
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refreshMaterials = async () => {
    try {
      const res = await fetch("/api/materials");
      if (res.ok) {
        const data = await res.json();
        setMaterials(
          (data.materials || []).map((m: Record<string, unknown>) => ({
            id: m.id as string,
            title: m.title as string,
            materialType: (m.materialType || m.type || "PDF") as string,
            fileUrl: (m.fileUrl as string) || null,
            externalUrl:
              m.type === "LINK"
                ? (m.fileUrl as string)
                : (m.externalUrl as string) || null,
            contentText:
              (m.contentText as string) || (m.description as string) || null,
            fileSizeBytes: (m.fileSizeBytes as number) || null,
            durationMinutes: null,
            createdAt: m.createdAt as string,
            course: m.course as { id: string; title: string } | null,
            group: m.group as { id: string; name: string } | null,
            lesson: null,
          }))
        );
        if (data.quota) setQuota(data.quota);
      }
    } catch {
      // Ignore refresh error
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setUploadLoading(true);
    setModalError("");
    setNotice(null);

    try {
      let finalFileUrl: string | null = null;
      let finalSizeBytes: number | null = null;

      if (modalMode === "FILE" && selectedFile) {
        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("category", "MATERIAL");

        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || "Ошибка загрузки файла");

        finalFileUrl = uploadData.fileUrl;
        finalSizeBytes = uploadData.sizeBytes;
      }

      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          materialType,
          fileUrl: finalFileUrl,
          externalUrl: modalMode === "LINK" ? externalUrl.trim() : null,
          contentText: contentText.trim() || null,
          fileSizeBytes: finalSizeBytes,
          courseId: courseId || null,
          groupId: groupId || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения материала");

      setModalOpen(false);
      setTitle("");
      setExternalUrl("");
      setContentText("");
      setSelectedFile(null);
      setCourseId("");
      setGroupId("");
      await refreshMaterials();
      setNotice({ type: "success", text: "Материал успешно добавлен в библиотеку" });
    } catch (err: unknown) {
      setModalError(err instanceof Error ? err.message : "Ошибка создания");
    } finally {
      setUploadLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTargetId) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/materials/${deleteTargetId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      setDeleteTargetId(null);
      await refreshMaterials();
      setNotice({ type: "success", text: "Материал удален" });
    } catch (err: unknown) {
      setDeleteTargetId(null);
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setDeleting(false);
    }
  };

  const filtered = materials.filter((m) => {
    if (typeFilter !== "ALL" && m.materialType !== typeFilter) return false;
    if (courseFilter !== "ALL" && m.course?.id !== courseFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchTitle = m.title.toLowerCase().includes(q);
      const matchText = (m.contentText || "").toLowerCase().includes(q);
      if (!matchTitle && !matchText) return false;
    }
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case "VIDEO":
        return <Video className="h-4 w-4 text-info" aria-hidden="true" />;
      case "BOOK":
        return <BookOpen className="h-4 w-4 text-success" aria-hidden="true" />;
      case "TEST":
        return <ClipboardList className="h-4 w-4 text-warning" aria-hidden="true" />;
      case "LINK":
        return <LinkIcon className="h-4 w-4 text-primary" aria-hidden="true" />;
      default:
        return <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <PageHeader
        title="Библиотека материалов"
        description="Централизованное хранилище видео, конспектов, методичек, файлов и полезных ссылок для курсов и учебных групп."
        actions={
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Card className="min-w-[210px]">
              <CardContent className="p-3">
                <div className="mb-1.5 flex items-center justify-between text-xs font-medium text-foreground">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                    Хранилище
                  </span>
                  <span className="tabular-nums">
                    {quota.usedMb} / {quota.maxMb} МБ
                  </span>
                </div>
                <progress
                  value={Math.min(100, quota.percent)}
                  max={100}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted accent-primary"
                />
                <div className="mt-1 text-right text-xs text-muted-foreground tabular-nums">
                  {quota.percent}% использовано
                </div>
              </CardContent>
            </Card>

            {canManage && (
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setModalError("");
                  setModalOpen(true);
                  setTitle("");
                  setSelectedFile(null);
                  setExternalUrl("");
                  setContentText("");
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>Добавить материал</span>
              </Button>
            )}
          </div>
        }
      />

      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{notice.text}</span>
            <Button type="button" variant="ghost" size="sm" onClick={() => setNotice(null)}>
              Закрыть
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Поиск по названию или описанию..."
        hasActiveFilters={Boolean(search || typeFilter !== "ALL" || courseFilter !== "ALL")}
        onReset={() => {
          setSearch("");
          setTypeFilter("ALL");
          setCourseFilter("ALL");
        }}
      >
        <select
          aria-label="Тип материала"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="ALL">Все форматы</option>
          <option value="LECTURE">Конспекты / Лекции</option>
          <option value="BOOK">Книги / Документы</option>
          <option value="VIDEO">Видео</option>
          <option value="LINK">Ссылки</option>
          <option value="TEST">Тесты</option>
        </select>

        <select
          aria-label="Фильтр по курсу"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className={SELECT_CLS}
        >
          <option value="ALL">Все курсы</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </FilterBar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6 text-muted-foreground" aria-hidden="true" />}
          title="Материалы не найдены"
          description={
            search || typeFilter !== "ALL" || courseFilter !== "ALL"
              ? "Попробуйте изменить параметры поиска или сбросить фильтры."
              : "Загрузите первый материал или ссылку, чтобы они стали доступны ученикам."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((mat) => (
            <Card key={mat.id} className="flex flex-col justify-between">
              <CardContent className="flex h-full flex-col justify-between p-5">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted">
                      {getIcon(mat.materialType)}
                    </div>
                    {canManage && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteTargetId(mat.id)}
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      </Button>
                    )}
                  </div>

                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">
                    {mat.title}
                  </h3>

                  {mat.contentText && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
                      {mat.contentText}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    {mat.course && <Badge variant="neutral">{mat.course.title}</Badge>}
                    {mat.group && <Badge variant="neutral">{mat.group.name}</Badge>}
                    {formatFileSize(mat.fileSizeBytes) && (
                      <span className="font-mono text-xs text-muted-foreground tabular-nums">
                        {formatFileSize(mat.fileSizeBytes)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {new Date(mat.createdAt).toLocaleDateString("ru-RU")}
                  </span>

                  {mat.fileUrl ? (
                    <a
                      href={`/api/materials/${mat.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="outline" size="sm">
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Скачать</span>
                      </Button>
                    </a>
                  ) : mat.externalUrl ? (
                    <a
                      href={`/api/materials/${mat.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button type="button" variant="outline" size="sm">
                        <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Открыть</span>
                      </Button>
                    </a>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить материал в библиотеку</DialogTitle>
          </DialogHeader>

          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setModalMode("FILE")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                modalMode === "FILE"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Загрузить файл</span>
            </button>
            <button
              type="button"
              onClick={() => setModalMode("LINK")}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                modalMode === "LINK"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LinkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Ссылка или текст</span>
            </button>
          </div>

          {modalError && (
            <Alert variant="destructive">
              <AlertDescription>{modalError}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleCreateMaterial} className="space-y-4">
            <FormField label="Название материала" htmlFor="mat-title" required>
              <Input
                id="mat-title"
                type="text"
                required
                placeholder="Например: Методичка к модулю 2"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label="Тип материала" htmlFor="mat-type">
                <select
                  id="mat-type"
                  value={materialType}
                  onChange={(e) => setMaterialType(e.target.value)}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="LECTURE">Конспект / Методичка</option>
                  <option value="BOOK">Книга / PDF</option>
                  <option value="VIDEO">Видеоматериал</option>
                  <option value="LINK">Внешняя ссылка</option>
                </select>
              </FormField>

              <FormField label="Привязка к курсу" htmlFor="mat-course">
                <select
                  id="mat-course"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className={`${SELECT_CLS} w-full`}
                >
                  <option value="">Без привязки</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {modalMode === "FILE" ? (
              <FormField label="Выберите файл" htmlFor="mat-file" required>
                <div className="relative cursor-pointer rounded-lg border-2 border-dashed border-border p-6 text-center transition-colors hover:border-primary/50">
                  <input
                    id="mat-file"
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  <Upload className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden="true" />
                  <p className="text-xs font-medium text-foreground">
                    {selectedFile ? selectedFile.name : "Нажмите или перетащите файл сюда"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    PDF, DOCX, PPTX, MP4, MP3, ZIP до 100 МБ
                  </p>
                </div>
              </FormField>
            ) : (
              <FormField label="URL адрес" htmlFor="mat-url" required>
                <Input
                  id="mat-url"
                  type="url"
                  required
                  placeholder="https://..."
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                />
              </FormField>
            )}

            <FormField label="Описание или конспект (опционально)" htmlFor="mat-desc">
              <Textarea
                id="mat-desc"
                rows={2}
                value={contentText}
                onChange={(e) => setContentText(e.target.value)}
                placeholder="Дополнительные указания для учеников..."
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" disabled={uploadLoading || !title.trim()}>
                {uploadLoading ? "Загрузка..." : "Сохранить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTargetId)}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
        title="Удалить материал"
        description="Удалить этот материал из библиотеки?"
        confirmLabel="Удалить"
        variant="destructive"
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
