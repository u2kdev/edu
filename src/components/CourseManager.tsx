"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, BookOpen, Layers, Video, Calendar, Clock, CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";

interface CourseManagerProps {
  initialCourses: any[];
  role?: string;
}

export default function CourseManager({ initialCourses, role }: CourseManagerProps) {
  const router = useRouter();
  const [courses, setCourses] = useState(initialCourses);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [expandedCourseId, setExpandedCourseId] = useState<string | null>(initialCourses[0]?.id || null);

  const canEdit = role === "DIRECTOR" || role === "CENTER_ADMIN";

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description, isPublished: true }),
      });
      const data = await res.json();
      if (res.ok) {
        setShowCreateModal(false);
        setTitle("");
        setDescription("");
        router.refresh();
      } else {
        alert(data.error);
      }
    } catch (err: any) {
      alert("Ошибка сети");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {canEdit && (
        <div className="flex justify-end">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить Новый Курс</span>
          </button>
        </div>
      )}

      {/* Courses Accordion List */}
      <div className="space-y-4">
        {courses.length === 0 ? (
          <div className="glass-panel p-8 rounded-2xl border border-slate-800 text-center text-slate-400">
            В этом учебном центре пока нет добавленных курсов.
          </div>
        ) : (
          courses.map((course) => {
            const isExpanded = expandedCourseId === course.id;
            return (
              <div key={course.id} className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden">
                <div
                  onClick={() => setExpandedCourseId(isExpanded ? null : course.id)}
                  className="p-6 flex items-center justify-between cursor-pointer hover:bg-slate-900/60 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 font-bold shrink-0">
                      <BookOpen className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <span>{course.title}</span>
                        {course.isPublished && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                            Опубликован
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 max-w-2xl">{course.description || "Без описания"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block text-xs text-slate-400">
                      <div>Модулей: <span className="text-slate-200 font-semibold">{course.modules.length}</span></div>
                      <div>Групп: <span className="text-slate-200 font-semibold">{course.groups.length}</span></div>
                    </div>
                    {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800/80 p-6 bg-slate-950/40 space-y-6">
                    {/* Modules & Lessons */}
                    <div>
                      <h4 className="text-sm font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-brand-400" />
                        <span>Учебная Программа (Модули)</span>
                      </h4>

                      {course.modules.length === 0 ? (
                        <p className="text-xs text-slate-500 italic">Модули курса еще не созданы.</p>
                      ) : (
                        <div className="space-y-4">
                          {course.modules.map((mod: any) => (
                            <div key={mod.id} className="p-4 rounded-xl bg-slate-900/80 border border-slate-800">
                              <h5 className="text-sm font-bold text-white mb-3">{mod.title}</h5>
                              <div className="space-y-2">
                                {mod.lessons.map((lesson: any) => (
                                  <div key={lesson.id} className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-3">
                                      <Video className="w-4 h-4 text-blue-400" />
                                      <span className="font-semibold text-slate-200">{lesson.title}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-slate-400">
                                      <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3 text-slate-500" />
                                        {lesson.durationMinutes} мин
                                      </span>
                                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-medium">
                                        {lesson.lessonType}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-6">
            <h3 className="text-xl font-bold text-white">Создать Новый Курс</h3>
            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Название Курса</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Frontend Разработка на React"
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Описание</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="О чем этот курс, требования и результаты..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-brand-600/30"
                >
                  {loading ? "Сохранение..." : "Создать Курс"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
