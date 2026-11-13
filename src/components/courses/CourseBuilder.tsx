"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Layers,
  Video,
  Clock,
  Plus,
  Trash2,
  Edit2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  Eye,
  EyeOff,
  Archive,
  Users,
  FileText,
  AlertCircle,
} from "lucide-react";

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

export default function CourseBuilder({ initialCourse, canManage }: CourseBuilderProps) {
  const router = useRouter();
  const [course, setCourse] = useState<CourseData>(initialCourse);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modals state
  const [editCourseOpen, setEditCourseOpen] = useState(false);
  const [courseTitle, setCourseTitle] = useState(course.title);
  const [courseDesc, setCourseDesc] = useState(course.description || "");
  const [coursePrice, setCoursePrice] = useState(course.priceMonthly || 0);

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  const [addModuleOpen, setAddModuleOpen] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");

  const [editModuleId, setEditModuleId] = useState<string | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");

  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState("OFFLINE");
  const [lessonDuration, setLessonDuration] = useState(60);
  const [lessonVideo, setLessonVideo] = useState("");
  const [lessonContent, setLessonContent] = useState("");

  const [editLesson, setEditLesson] = useState<LessonData | null>(null);

  const refreshCourse = async () => {
    try {
      const res = await fetch(`/api/courses/${course.id}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data.course);
      }
    } catch {
      // fallback
    }
  };

  // Toggle publish
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
        text: !course.isPublished ? "Курс опубликован" : "Курс переведен в черновик",
      });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setLoading(false);
    }
  };

  // Save course details
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

  // Archive course
  const handleArchiveCourse = async () => {
    if (archiveReason.trim().length < 5) {
      alert("Причина обязательна (минимум 5 символов)");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/courses/${course.id}?reason=${encodeURIComponent(archiveReason)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка архивации");
      setArchiveModalOpen(false);
      router.push("/center/courses");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Ошибка архивации");
    } finally {
      setLoading(false);
    }
  };

  // Add module
  const handleAddModule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    setLoading(true);
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

  // Update module title
  const handleUpdateModule = async (moduleId: string) => {
    if (!editModuleTitle.trim()) return;
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
      alert(err instanceof Error ? err.message : "Ошибка");
    }
  };

  // Delete module
  const handleDeleteModule = async (moduleId: string) => {
    if (!window.confirm("Удалить этот модуль и все входящие в него уроки?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/modules/${moduleId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshCourse();
      setNotice({ type: "success", text: "Модуль удален" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setLoading(false);
    }
  };

  // Reorder modules (up / down)
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

  // Add lesson
  const handleAddLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addLessonModuleId || !lessonTitle.trim()) return;
    setLoading(true);
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

  // Save lesson edit
  const handleSaveLessonEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLesson) return;
    setLoading(true);
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
      setNotice({ type: "success", text: "Урок обновлен" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка обновления" });
    } finally {
      setLoading(false);
    }
  };

  // Delete lesson
  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm("Удалить этот урок?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshCourse();
      setNotice({ type: "success", text: "Урок удален" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка" });
    } finally {
      setLoading(false);
    }
  };

  // Reorder lessons
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

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button */}
      <div>
        <Link
          href="/center/courses"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Назад ко всем курсам</span>
        </Link>
      </div>

      {notice && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between ${
            notice.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2 text-sm">
            {notice.type === "success" ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-xs opacity-70 hover:opacity-100">
            ✕
          </button>
        </div>
      )}

      {/* Course Header Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-bold shrink-0">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black text-white">{course.title}</h1>
                {course.isPublished ? (
                  <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Опубликован
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
                    Черновик
                  </span>
                )}
                {course.deletedAt && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase">
                    В архиве
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-2 max-w-2xl">
                {course.description || "Описание курса не указано"}
              </p>
              {course.priceMonthly > 0 && (
                <p className="text-xs text-brand-400 font-semibold mt-2">
                  Стоимость: {course.priceMonthly.toLocaleString("ru-RU")} сум / месяц
                </p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handleTogglePublish}
                disabled={loading}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold border flex items-center gap-2 transition-all ${
                  course.isPublished
                    ? "bg-slate-800/80 hover:bg-slate-800 border-slate-700 text-slate-300"
                    : "bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-600/20"
                }`}
              >
                {course.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{course.isPublished ? "Снять с публикации" : "Опубликовать"}</span>
              </button>

              <button
                onClick={() => {
                  setCourseTitle(course.title);
                  setCourseDesc(course.description || "");
                  setCoursePrice(course.priceMonthly || 0);
                  setEditCourseOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-slate-200 text-sm font-semibold flex items-center gap-2"
              >
                <Edit2 className="w-4 h-4 text-slate-400" />
                <span>Редактировать</span>
              </button>

              <button
                onClick={() => setArchiveModalOpen(true)}
                className="p-2.5 rounded-xl bg-slate-800/60 hover:bg-rose-500/20 border border-slate-700 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-colors"
                title="Архивировать курс"
              >
                <Archive className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Модулей</div>
            <div className="text-lg font-bold text-white mt-0.5">{course.modules.length}</div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Уроков всего</div>
            <div className="text-lg font-bold text-white mt-0.5">{totalLessons}</div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Групп по курсу</div>
            <div className="text-lg font-bold text-white mt-0.5">{course.groups?.length || 0}</div>
          </div>
          <div className="bg-slate-900/40 rounded-xl p-3 border border-slate-800/60">
            <div className="text-xs text-slate-400">Длительность</div>
            <div className="text-lg font-bold text-white mt-0.5">
              {course.modules.reduce((acc, m) => acc + m.lessons.reduce((lSum, l) => lSum + l.durationMinutes, 0), 0)} мин
            </div>
          </div>
        </div>
      </div>

      {/* Curriculum Builder */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-brand-400" />
            <span>Учебная программа (Модули и уроки)</span>
          </h2>
          {canManage && (
            <button
              onClick={() => setAddModuleOpen(true)}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-brand-600/20 transition-all flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить модуль</span>
            </button>
          )}
        </div>

        {course.modules.length === 0 ? (
          <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-white">В курсе пока нет модулей</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Разделите программу курса на логические темы или разделы, создав первый модуль.
            </p>
            {canManage && (
              <button
                onClick={() => setAddModuleOpen(true)}
                className="mt-4 px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Создать первый модуль</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {course.modules.map((mod, modIdx) => (
              <div key={mod.id} className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
                {/* Module Header Bar */}
                <div className="p-4 sm:p-5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-brand-500/20 text-brand-400 border border-brand-500/30 font-bold text-xs flex items-center justify-center shrink-0">
                      {modIdx + 1}
                    </span>

                    {editModuleId === mod.id ? (
                      <div className="flex items-center gap-2 flex-1 max-w-md">
                        <input
                          type="text"
                          value={editModuleTitle}
                          onChange={(e) => setEditModuleTitle(e.target.value)}
                          className="px-3 py-1 bg-slate-950 border border-brand-500 rounded-lg text-white text-sm w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => handleUpdateModule(mod.id)}
                          className="px-3 py-1 bg-brand-600 text-white text-xs rounded-lg font-semibold"
                        >
                          ОК
                        </button>
                        <button
                          onClick={() => setEditModuleId(null)}
                          className="px-2 py-1 text-slate-400 text-xs hover:text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <h3 className="text-base font-bold text-white truncate flex items-center gap-2">
                        <span>{mod.title}</span>
                        <span className="text-xs font-normal text-slate-400">
                          ({mod.lessons.length} {mod.lessons.length === 1 ? "урок" : "уроков"})
                        </span>
                      </h3>
                    )}
                  </div>

                  {canManage && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleMoveModule(modIdx, "up")}
                        disabled={modIdx === 0}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Поднять выше"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveModule(modIdx, "down")}
                        disabled={modIdx === course.modules.length - 1}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-transparent"
                        title="Опустить ниже"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditModuleId(mod.id);
                          setEditModuleTitle(mod.title);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                        title="Переименовать"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteModule(mod.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Удалить модуль"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setAddLessonModuleId(mod.id);
                          setLessonTitle("");
                          setLessonType("OFFLINE");
                          setLessonDuration(60);
                          setLessonVideo("");
                          setLessonContent("");
                        }}
                        className="ml-2 px-3 py-1 bg-brand-500/20 hover:bg-brand-500/30 text-brand-300 border border-brand-500/30 rounded-lg text-xs font-semibold flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Урок</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Lessons in Module */}
                <div className="p-4 space-y-2 bg-slate-950/40">
                  {mod.lessons.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500 italic">
                      В этом модуле пока нет уроков. Нажмите «+ Урок» выше, чтобы добавить первый.
                    </div>
                  ) : (
                    mod.lessons.map((lesson, lesIdx) => (
                      <div
                        key={lesson.id}
                        className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800/80 hover:border-slate-700/80 flex items-center justify-between gap-4 transition-all"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <span className="text-xs text-slate-500 font-mono w-5 text-right shrink-0">
                            {lesIdx + 1}.
                          </span>
                          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                            {lesson.lessonType === "ONLINE" ? (
                              <Video className="w-4 h-4" />
                            ) : (
                              <FileText className="w-4 h-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-slate-200 truncate">{lesson.title}</h4>
                            <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-slate-500" />
                                {lesson.durationMinutes} мин
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 uppercase">
                                {lesson.lessonType}
                              </span>
                              {lesson.materials && lesson.materials.length > 0 && (
                                <span className="text-brand-400 text-[11px]">
                                  {lesson.materials.length} мат.
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {canManage && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => handleMoveLesson(modIdx, lesIdx, "up")}
                              disabled={lesIdx === 0}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20"
                              title="Выше"
                            >
                              <ChevronUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleMoveLesson(modIdx, lesIdx, "down")}
                              disabled={lesIdx === mod.lessons.length - 1}
                              className="p-1 rounded text-slate-500 hover:text-white disabled:opacity-20"
                              title="Ниже"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setEditLesson(lesson)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                              title="Редактировать урок"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLesson(lesson.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                              title="Удалить урок"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Course Modal */}
      {editCourseOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-5">
            <h3 className="text-lg font-bold text-white">Редактирование курса</h3>
            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название курса
                </label>
                <input
                  type="text"
                  required
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Описание
                </label>
                <textarea
                  rows={3}
                  value={courseDesc}
                  onChange={(e) => setCourseDesc(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Стоимость в месяц (сум)
                </label>
                <input
                  type="number"
                  min="0"
                  step="10000"
                  value={coursePrice}
                  onChange={(e) => setCoursePrice(Number(e.target.value))}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditCourseOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Archive Modal */}
      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-rose-500/30 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Archive className="w-5 h-5 text-rose-400" />
              <span>Архивация курса</span>
            </h3>
            <p className="text-xs text-slate-400">
              Архивированный курс перестанет отображаться в активных списках и будет скрыт от публичного каталога.
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Причина архивации (обязательно) *
              </label>
              <textarea
                rows={3}
                required
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Укажите причину снятия курса..."
                className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-rose-500"
              />
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setArchiveModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleArchiveCourse}
                disabled={loading || archiveReason.trim().length < 5}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-rose-600/30 disabled:opacity-50"
              >
                {loading ? "Архивация..." : "Подтвердить архивацию"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Module Modal */}
      {addModuleOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Новый учебный модуль</h3>
            <form onSubmit={handleAddModule} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название модуля
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Введение в алгоритмы"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddModuleOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading || !newModuleTitle.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {loading ? "Создание..." : "Создать модуль"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Lesson Modal */}
      {addLessonModuleId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Добавить урок в модуль</h3>
            <form onSubmit={handleAddLesson} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Тема урока *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Синтаксис переменных"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Тип урока
                  </label>
                  <select
                    value={lessonType}
                    onChange={(e) => setLessonType(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    <option value="OFFLINE">Очный (OFFLINE)</option>
                    <option value="ONLINE">Онлайн (ONLINE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Длительность (мин)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="360"
                    step="5"
                    value={lessonDuration}
                    onChange={(e) => setLessonDuration(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Ссылка на видео (опционально)
                </label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={lessonVideo}
                  onChange={(e) => setLessonVideo(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Конспект / Описание урока
                </label>
                <textarea
                  rows={3}
                  value={lessonContent}
                  onChange={(e) => setLessonContent(e.target.value)}
                  placeholder="Краткий план урока или конспект..."
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAddLessonModuleId(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading || !lessonTitle.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {loading ? "Сохранение..." : "Добавить урок"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lesson Modal */}
      {editLesson && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Редактирование урока</h3>
            <form onSubmit={handleSaveLessonEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Тема урока *
                </label>
                <input
                  type="text"
                  required
                  value={editLesson.title}
                  onChange={(e) => setEditLesson({ ...editLesson, title: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Тип урока
                  </label>
                  <select
                    value={editLesson.lessonType}
                    onChange={(e) => setEditLesson({ ...editLesson, lessonType: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  >
                    <option value="OFFLINE">Очный (OFFLINE)</option>
                    <option value="ONLINE">Онлайн (ONLINE)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Длительность (мин)
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="360"
                    step="5"
                    value={editLesson.durationMinutes}
                    onChange={(e) => setEditLesson({ ...editLesson, durationMinutes: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Ссылка на видео
                </label>
                <input
                  type="url"
                  value={editLesson.videoUrl || ""}
                  onChange={(e) => setEditLesson({ ...editLesson, videoUrl: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Конспект / Описание урока
                </label>
                <textarea
                  rows={3}
                  value={editLesson.content || ""}
                  onChange={(e) => setEditLesson({ ...editLesson, content: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditLesson(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Сохранение..." : "Сохранить урок"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
