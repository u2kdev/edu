"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Clock,
  Edit2,
  Eye,
  EyeOff,
  FileText,
  Layers,
  Plus,
  Trash2,
  Video,
  X,
} from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  type BadgeVariant,
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  EntityDetailHeader,
  type EntityActionItem,
  FormActions,
  FormField,
  Input,
  StatCard,
  Textarea,
} from "@/components/ui";

export interface LessonData {
  id: string;
  moduleId: string;
  title: string;
  lessonType: string;
  status: string;
  orderIndex: number;
  durationMinutes: number;
  content: string | null;
  videoUrl: string | null;
  materials?: Array<{ id: string; title: string; materialType: string; fileUrl: string | null }>;
}

export interface ModuleData {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  lessons: LessonData[];
}

export interface CourseData {
  id: string;
  title: string;
  description: string | null;
  coverImage: string | null;
  priceMonthly: number;
  isPublished: boolean;
  deletedAt: string | null;
  modules: ModuleData[];
  groups?: Array<{ id: string; name: string }>;
}

interface CourseBuilderProps {
  initialCourse: CourseData;
  canManage: boolean;
  locale?: string;
}

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export default function CourseBuilder({
  initialCourse,
  canManage,
  locale = "ru",
}: CourseBuilderProps) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseData>(initialCourse);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState(course.title);
  const [courseDesc, setCourseDesc] = useState(course.description || "");
  const [coursePrice, setCoursePrice] = useState(course.priceMonthly || 0);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);

  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const [editModuleId, setEditModuleId] = useState<string | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);

  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState("OFFLINE");
  const [lessonDuration, setLessonDuration] = useState(60);
  const [lessonVideo, setLessonVideo] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const [editLesson, setEditLesson] = useState<LessonData | null>(null);
  const [deleteLessonId, setDeleteLessonId] = useState<string | null>(null);

  const refreshCourse = async () => {
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
      }
    } catch {
      // keep current state on fallback
    }
  };

  const handleTogglePublish = async () => {
    if (!canManage) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublished: !course.isPublished }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка обновления");
      setCourse((prev) => ({ ...prev, isPublished: !prev.isPublished }));
      setNotice({
        type: "success",
        text: !course.isPublished ? "Курс опубликован" : "Курс переведён в черновик",
      });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: courseTitle,
          description: courseDesc,
          priceMonthly: Number(coursePrice),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
      setCourse((prev) => ({
        ...prev,
        title: courseTitle,
        description: courseDesc,
        priceMonthly: Number(coursePrice),
      }));
      setEditCourseOpen(false);
      setNotice({ type: "success", text: "Данные курса сохранены" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка сохранения" });
    } finally {
      setLoading(false);
    }
  };

  const handleArchiveCourse = async (reason?: string) => {
    if (!reason || reason.trim().length < 5) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/courses/${course.id}?reason=${encodeURIComponent(reason)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка архивации");
      setArchiveModalOpen(false);
      router.push("/center/courses");
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка архивации" });
    } finally {
      setLoading(false);
    }
  };

  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseId: course.id,
          title: newModuleTitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка добавления модуля");
      setAddModuleOpen(false);
      setNewModuleTitle("");
      await refreshCourse();
      setNotice({ type: "success", text: "Модуль успешно добавлен" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка добавления" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateModule = async (moduleId: string) => {
    if (!editModuleTitle.trim()) return;
    setNotice(null);
    try {
      const res = await fetch(`/api/modules/${moduleId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editModuleTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка переименования");
      setEditModuleId(null);
      await refreshCourse();
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка переименования" });
    }
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleId) return;
    const moduleId = deleteModuleId;
    setDeleteModuleId(null);
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshCourse();
      setNotice({ type: "success", text: "Модуль удалён" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveModule = async (index: number, direction: "up" | "down") => {
    const modules = [...course.modules];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= modules.length) return;

    const currentMod = modules[index];
    const targetMod = modules[targetIndex];

    const newCurrentOrder = targetMod.orderIndex;
    const newTargetOrder = currentMod.orderIndex;

    modules[index] = { ...targetMod, orderIndex: newTargetOrder };
    modules[targetIndex] = { ...currentMod, orderIndex: newCurrentOrder };
    setCourse((prev) => ({ ...prev, modules }));

    try {
      await fetch("/api/modules/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: currentMod.id, orderIndex: newCurrentOrder },
            { id: targetMod.id, orderIndex: newTargetOrder },
          ],
        }),
      });
    } catch {
      await refreshCourse();
    }
  };

  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addLessonModuleId || !lessonTitle.trim()) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/lessons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId: addLessonModuleId,
          title: lessonTitle.trim(),
          lessonType,
          durationMinutes: Number(lessonDuration),
          videoUrl: lessonVideo.trim() || undefined,
          content: lessonContent.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка добавления урока");
      setAddLessonModuleId(null);
      setLessonTitle("");
      setLessonVideo("");
      setLessonContent("");
      await refreshCourse();
      setNotice({ type: "success", text: "Урок успешно добавлен" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка добавления" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLessonEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLesson) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/lessons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId: editLesson.id,
          title: editLesson.title.trim(),
          lessonType: editLesson.lessonType,
          durationMinutes: Number(editLesson.durationMinutes),
          videoUrl: editLesson.videoUrl || null,
          content: editLesson.content || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка обновления урока");
      setEditLesson(null);
      await refreshCourse();
      setNotice({ type: "success", text: "Урок обновлён" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!deleteLessonId) return;
    const lessonId = deleteLessonId;
    setDeleteLessonId(null);
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshCourse();
      setNotice({ type: "success", text: "Урок удалён" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setLoading(false);
    }
  };

  const handleMoveLesson = async (moduleIndex: number, lessonIndex: number, direction: "up" | "down") => {
    const mod = course.modules[moduleIndex];
    if (!mod) return;
    const lessons = [...mod.lessons];
    const targetIndex = direction === "up" ? lessonIndex - 1 : lessonIndex + 1;
    if (targetIndex < 0 || targetIndex >= lessons.length) return;

    const currentLesson = lessons[lessonIndex];
    const targetLesson = lessons[targetIndex];

    const newCurrentOrder = targetLesson.orderIndex;
    const newTargetOrder = currentLesson.orderIndex;

    lessons[lessonIndex] = { ...targetLesson, orderIndex: newTargetOrder };
    lessons[targetIndex] = { ...currentLesson, orderIndex: newCurrentOrder };

    const updatedModules = [...course.modules];
    updatedModules[moduleIndex] = { ...mod, lessons };
    setCourse((prev) => ({ ...prev, modules: updatedModules }));

    try {
      await fetch("/api/lessons/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [
            { id: currentLesson.id, orderIndex: newCurrentOrder },
            { id: targetLesson.id, orderIndex: newTargetOrder },
          ],
        }),
      });
    } catch {
      await refreshCourse();
    }
  };

  const totalLessons = course.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalMinutes = course.modules.reduce(
    (acc, m) => acc + m.lessons.reduce((lSum, l) => lSum + l.durationMinutes, 0),
    0
  );

  const statusLabel = course.deletedAt
    ? "В архиве"
    : course.isPublished
    ? "Опубликован"
    : "Черновик";
  const statusVariant: BadgeVariant = course.deletedAt
    ? "destructive"
    : course.isPublished
    ? "success"
    : "warning";

  const menuActions: EntityActionItem[] = canManage
    ? [
        {
          id: "edit-course",
          label: "Редактировать",
          onSelect: () => {
            setCourseTitle(course.title);
            setCourseDesc(course.description || "");
            setCoursePrice(course.priceMonthly || 0);
            setEditCourseOpen(true);
          },
        },
        {
          id: "archive-course",
          label: "Архивировать курс",
          destructive: true,
          onSelect: () => setArchiveModalOpen(true),
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <EntityDetailHeader
        backHref="/center/courses"
        backLabel="Назад ко всем курсам"
        icon={<BookOpen className="h-5 w-5" />}
        title={course.title}
        subtitle={course.description || "Описание курса не указано"}
        statusLabel={statusLabel}
        statusVariant={statusVariant}
        locale={locale}
        badges={
          course.priceMonthly > 0 ? (
            <Badge variant="primary" className="tabular-nums">
              {course.priceMonthly.toLocaleString("ru-RU")} сум / месяц
            </Badge>
          ) : undefined
        }
        primaryAction={
          canManage ? (
            <Button
              type="button"
              variant={course.isPublished ? "secondary" : "primary"}
              size="sm"
              onClick={handleTogglePublish}
              disabled={loading}
            >
              {course.isPublished ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              <span>{course.isPublished ? "Снять с публикации" : "Опубликовать"}</span>
            </Button>
          ) : undefined
        }
        menuActions={menuActions}
      />

      {notice && (
        <Alert variant={notice.type === "success" ? "success" : "destructive"}>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{notice.text}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Close"
              className="rounded p-1 hover:opacity-75"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Модулей" value={course.modules.length} />
        <StatCard label="Уроков всего" value={totalLessons} />
        <StatCard label="Групп по курсу" value={course.groups?.length || 0} />
        <StatCard label="Длительность" value={`${totalMinutes} мин`} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <Layers className="h-5 w-5 text-primary" aria-hidden="true" />
            <span>Учебная программа (Модули и уроки)</span>
          </h2>
          {canManage && (
            <Button type="button" variant="primary" size="sm" onClick={() => setAddModuleOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Добавить модуль</span>
            </Button>
          )}
        </div>

        {course.modules.length === 0 ? (
          <EmptyState
            icon={<Layers className="h-5 w-5" />}
            title="В курсе пока нет модулей"
            description="Разделите программу курса на логические темы или разделы, создав первый модуль."
            action={
              canManage ? (
                <Button type="button" variant="primary" size="sm" onClick={() => setAddModuleOpen(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Создать первый модуль</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-4">
            {course.modules.map((mod, modIdx) => (
              <Card key={mod.id} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border bg-muted/50 py-3.5 space-y-0">
                  <div className="flex flex-1 min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-primary/10 text-xs font-semibold text-primary tabular-nums">
                      {modIdx + 1}
                    </span>

                    {editModuleId === mod.id ? (
                      <div className="flex max-w-md flex-1 items-center gap-2">
                        <Input
                          type="text"
                          value={editModuleTitle}
                          onChange={(e) => setEditModuleTitle(e.target.value)}
                          autoFocus
                        />
                        <Button type="button" variant="primary" size="sm" onClick={() => handleUpdateModule(mod.id)}>
                          ОК
                        </Button>
                        <Button type="button" variant="ghost" size="icon" onClick={() => setEditModuleId(null)}>
                          <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                      </div>
                    ) : (
                      <h3 className="flex items-center gap-2 truncate text-base font-semibold text-foreground">
                        <span className="truncate">{mod.title}</span>
                        <span className="text-xs font-normal text-muted-foreground tabular-nums">
                          ({mod.lessons.length} {mod.lessons.length === 1 ? "урок" : "уроков"})
                        </span>
                      </h3>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveModule(modIdx, "up")}
                        disabled={modIdx === 0}
                        title="Поднять выше"
                      >
                        <ChevronUp className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleMoveModule(modIdx, "down")}
                        disabled={modIdx === course.modules.length - 1}
                        title="Опустить ниже"
                      >
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditModuleId(mod.id);
                          setEditModuleTitle(mod.title);
                        }}
                        title="Переименовать"
                      >
                        <Edit2 className="h-4 w-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteModuleId(mod.id)}
                        title="Удалить модуль"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setAddLessonModuleId(mod.id);
                          setLessonTitle("");
                          setLessonType("OFFLINE");
                          setLessonDuration(60);
                          setLessonVideo("");
                          setLessonContent("");
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Урок</span>
                      </Button>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-2 p-4">
                  {mod.lessons.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      В этом модуле пока нет уроков. Нажмите «+ Урок» выше, чтобы добавить первый.
                    </p>
                  ) : (
                    mod.lessons.map((lesson, lesIdx) => (
                      <div
                        key={lesson.id}
                        className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/60"
                      >
                        <div className="flex flex-1 min-w-0 items-center gap-3">
                          <span className="w-5 shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
                            {lesIdx + 1}.
                          </span>
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-info-subtle text-info">
                            {lesson.lessonType === "ONLINE" ? (
                              <Video className="h-4 w-4" aria-hidden="true" />
                            ) : (
                              <FileText className="h-4 w-4" aria-hidden="true" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="truncate text-sm font-medium text-foreground">{lesson.title}</h4>
                            <div className="mt-0.5 flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground tabular-nums">
                              <span className="inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" aria-hidden="true" />
                                <span>{lesson.durationMinutes} мин</span>
                              </span>
                              <Badge variant="neutral">{lesson.lessonType}</Badge>
                              {lesson.materials && lesson.materials.length > 0 && (
                                <span className="text-primary">{lesson.materials.length} мат.</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveLesson(modIdx, lesIdx, "up")}
                              disabled={lesIdx === 0}
                              title="Выше"
                            >
                              <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => handleMoveLesson(modIdx, lesIdx, "down")}
                              disabled={lesIdx === mod.lessons.length - 1}
                              title="Ниже"
                            >
                              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditLesson(lesson)}
                              title="Редактировать урок"
                            >
                              <Edit2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteLessonId(lesson.id)}
                              title="Удалить урок"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" aria-hidden="true" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={editCourseOpen} onOpenChange={setEditCourseOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактирование курса</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveCourse} className="space-y-4">
            <FormField label="Название курса" htmlFor="edit-course-title" required>
              <Input
                id="edit-course-title"
                type="text"
                required
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
              />
            </FormField>

            <FormField label="Описание" htmlFor="edit-course-desc">
              <Textarea
                id="edit-course-desc"
                rows={3}
                value={courseDesc}
                onChange={(e) => setCourseDesc(e.target.value)}
              />
            </FormField>

            <FormField label="Стоимость в месяц (сум)" htmlFor="edit-course-price">
              <Input
                id="edit-course-price"
                type="number"
                min="0"
                step="10000"
                value={coursePrice}
                onChange={(e) => setCoursePrice(Number(e.target.value))}
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setEditCourseOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={loading} loading={loading}>
                {loading ? "Сохранение..." : "Сохранить"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={archiveModalOpen}
        onOpenChange={setArchiveModalOpen}
        title="Архивация курса"
        description="Архивированный курс перестанет отображаться в активных списках и будет скрыт от публичного каталога."
        reasonLabel="Причина архивации"
        reasonPlaceholder="Укажите причину снятия курса..."
        reasonRequired
        reasonMinLength={5}
        reasonMultiline
        confirmLabel="Подтвердить архивацию"
        variant="destructive"
        loading={loading}
        locale={locale}
        onConfirm={handleArchiveCourse}
      />

      <ConfirmDialog
        open={Boolean(deleteModuleId)}
        onOpenChange={(next) => !next && setDeleteModuleId(null)}
        title="Удаление модуля"
        description="Удалить этот модуль и все входящие в него уроки?"
        confirmLabel="Удалить"
        variant="destructive"
        loading={loading}
        locale={locale}
        onConfirm={handleDeleteModule}
      />

      <ConfirmDialog
        open={Boolean(deleteLessonId)}
        onOpenChange={(next) => !next && setDeleteLessonId(null)}
        title="Удаление урока"
        description="Вы уверены, что хотите удалить этот урок?"
        confirmLabel="Удалить"
        variant="destructive"
        loading={loading}
        locale={locale}
        onConfirm={handleDeleteLesson}
      />

      <Dialog open={addModuleOpen} onOpenChange={setAddModuleOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый учебный модуль</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddModule} className="space-y-4">
            <FormField label="Название модуля" htmlFor="new-module-title" required>
              <Input
                id="new-module-title"
                type="text"
                required
                placeholder="Например: Введение в алгоритмы"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                autoFocus
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setAddModuleOpen(false)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={loading || !newModuleTitle.trim()} loading={loading}>
                {loading ? "Создание..." : "Создать модуль"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(addLessonModuleId)} onOpenChange={(next) => !next && setAddLessonModuleId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Добавить урок в модуль</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddLesson} className="space-y-4">
            <FormField label="Тема урока" htmlFor="add-lesson-title" required>
              <Input
                id="add-lesson-title"
                type="text"
                required
                placeholder="Например: Синтаксис переменных"
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
              />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Тип урока" htmlFor="add-lesson-type">
                <select
                  id="add-lesson-type"
                  value={lessonType}
                  onChange={(e) => setLessonType(e.target.value)}
                  className={selectClassName}
                >
                  <option value="OFFLINE">Очный (OFFLINE)</option>
                  <option value="ONLINE">Онлайн (ONLINE)</option>
                </select>
              </FormField>

              <FormField label="Длительность (мин)" htmlFor="add-lesson-duration">
                <Input
                  id="add-lesson-duration"
                  type="number"
                  min="15"
                  max="360"
                  step="5"
                  value={lessonDuration}
                  onChange={(e) => setLessonDuration(Number(e.target.value))}
                />
              </FormField>
            </div>

            <FormField label="Ссылка на видео (опционально)" htmlFor="add-lesson-video">
              <Input
                id="add-lesson-video"
                type="url"
                placeholder="https://..."
                value={lessonVideo}
                onChange={(e) => setLessonVideo(e.target.value)}
              />
            </FormField>

            <FormField label="Конспект / Описание урока" htmlFor="add-lesson-content">
              <Textarea
                id="add-lesson-content"
                rows={3}
                value={lessonContent}
                onChange={(e) => setLessonContent(e.target.value)}
                placeholder="Краткий план урока или конспект..."
              />
            </FormField>

            <FormActions>
              <Button type="button" variant="secondary" onClick={() => setAddLessonModuleId(null)}>
                Отмена
              </Button>
              <Button type="submit" variant="primary" disabled={loading || !lessonTitle.trim()} loading={loading}>
                {loading ? "Сохранение..." : "Добавить урок"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(editLesson)} onOpenChange={(next) => !next && setEditLesson(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Редактирование урока</DialogTitle>
          </DialogHeader>
          {editLesson && (
            <form onSubmit={handleSaveLessonEdit} className="space-y-4">
              <FormField label="Тема урока" htmlFor="edit-lesson-title" required>
                <Input
                  id="edit-lesson-title"
                  type="text"
                  required
                  value={editLesson.title}
                  onChange={(e) => setEditLesson({ ...editLesson, title: e.target.value })}
                />
              </FormField>

              <div className="grid grid-cols-2 gap-4">
                <FormField label="Тип урока" htmlFor="edit-lesson-type">
                  <select
                    id="edit-lesson-type"
                    value={editLesson.lessonType}
                    onChange={(e) => setEditLesson({ ...editLesson, lessonType: e.target.value })}
                    className={selectClassName}
                  >
                    <option value="OFFLINE">Очный (OFFLINE)</option>
                    <option value="ONLINE">Онлайн (ONLINE)</option>
                  </select>
                </FormField>

                <FormField label="Длительность (мин)" htmlFor="edit-lesson-duration">
                  <Input
                    id="edit-lesson-duration"
                    type="number"
                    min="15"
                    max="360"
                    step="5"
                    value={editLesson.durationMinutes}
                    onChange={(e) => setEditLesson({ ...editLesson, durationMinutes: Number(e.target.value) })}
                  />
                </FormField>
              </div>

              <FormField label="Ссылка на видео" htmlFor="edit-lesson-video">
                <Input
                  id="edit-lesson-video"
                  type="url"
                  value={editLesson.videoUrl || ""}
                  onChange={(e) => setEditLesson({ ...editLesson, videoUrl: e.target.value })}
                />
              </FormField>

              <FormField label="Конспект / Описание урока" htmlFor="edit-lesson-content">
                <Textarea
                  id="edit-lesson-content"
                  rows={3}
                  value={editLesson.content || ""}
                  onChange={(e) => setEditLesson({ ...editLesson, content: e.target.value })}
                />
              </FormField>

              <FormActions>
                <Button type="button" variant="secondary" onClick={() => setEditLesson(null)}>
                  Отмена
                </Button>
                <Button type="submit" variant="primary" disabled={loading} loading={loading}>
                  {loading ? "Сохранение..." : "Сохранить урок"}
                </Button>
              </FormActions>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
