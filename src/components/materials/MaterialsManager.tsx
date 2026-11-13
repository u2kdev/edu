"use client";

import { useState } from "react";
import {
  FolderOpen,
  Search,
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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

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
  groups,
}: MaterialsManagerProps) {
  const [materials, setMaterials] = useState<MaterialItem[]>(initialMaterials);
  const [quota, setQuota] = useState<StorageQuotaInfo>(initialQuota);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Upload modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"FILE" | "LINK">("FILE");
  const [uploadLoading, setUploadLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [materialType, setMaterialType] = useState("LECTURE");
  const [courseId, setCourseId] = useState("");
  const [groupId, setGroupId] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [contentText, setContentText] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
    } catch {}
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setUploadLoading(true);
    setNotice(null);

    try {
      let finalFileUrl: string | null = null;
      let finalSizeBytes: number | null = null;

      // 1. If file upload mode, upload file to /api/upload
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

      // 2. Create Material record
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
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка создания" });
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Удалить этот материал из библиотеки?")) return;
    try {
      const res = await fetch(`/api/materials/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshMaterials();
      setNotice({ type: "success", text: "Материал удален" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
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
        return <Video className="w-5 h-5 text-blue-400" />;
      case "BOOK":
        return <BookOpen className="w-5 h-5 text-emerald-400" />;
      case "TEST":
        return <ClipboardList className="w-5 h-5 text-amber-400" />;
      case "LINK":
        return <LinkIcon className="w-5 h-5 text-purple-400" />;
      default:
        return <FileText className="w-5 h-5 text-slate-300" />;
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return null;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <FolderOpen className="w-7 h-7 text-brand-400" />
            <span>Библиотека материалов</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Централизованное хранилище видео, конспектов, методичек, файлов и полезных ссылок для курсов и учебных групп.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          {/* Storage Quota Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-3.5 min-w-[220px]">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-brand-400" />
                Хранилище
              </span>
              <span>
                {quota.usedMb} / {quota.maxMb} МБ
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  quota.percent >= 90 ? "bg-rose-500" : quota.percent >= 70 ? "bg-amber-500" : "bg-brand-500"
                }`}
                style={{ width: `${Math.min(100, quota.percent)}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-500 mt-1 text-right">{quota.percent}% использовано</div>
          </div>

          {canManage && (
            <button
              onClick={() => {
                setModalOpen(true);
                setTitle("");
                setSelectedFile(null);
                setExternalUrl("");
                setContentText("");
              }}
              className="px-5 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-brand-600/30 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Добавить материал</span>
            </button>
          )}
        </div>
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

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск по названию или описанию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none"
          >
            <option value="ALL">Все форматы</option>
            <option value="LECTURE">Конспекты / Лекции</option>
            <option value="BOOK">Книги / Документы</option>
            <option value="VIDEO">Видео</option>
            <option value="LINK">Ссылки</option>
            <option value="TEST">Тесты</option>
          </select>

          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="px-3 py-2 bg-slate-900 border border-slate-700/80 rounded-xl text-white text-xs focus:outline-none"
          >
            <option value="ALL">Все курсы</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Materials Grid */}
      {filtered.length === 0 ? (
        <div className="glass-panel p-16 rounded-3xl border border-slate-800 text-center">
          <FolderOpen className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-white">Материалы не найдены</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {search || typeFilter !== "ALL" || courseFilter !== "ALL"
              ? "Попробуйте изменить параметры поиска или сбросить фильтры."
              : "Загрузите первый материал или ссылку, чтобы они стали доступны ученикам."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((mat) => (
            <div
              key={mat.id}
              className="glass-panel p-5 rounded-2xl border border-slate-800/80 bg-slate-900/40 hover:border-slate-700/80 flex flex-col justify-between transition-all"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
                    {getIcon(mat.materialType)}
                  </div>
                  <div className="flex items-center gap-1">
                    {canManage && (
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10"
                        title="Удалить"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                <h3 className="text-sm font-bold text-white mt-3 line-clamp-2">{mat.title}</h3>

                {mat.contentText && (
                  <p className="text-xs text-slate-400 mt-1.5 line-clamp-2">{mat.contentText}</p>
                )}

                <div className="flex flex-wrap items-center gap-2 mt-3">
                  {mat.course && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 text-[10px] font-medium">
                      {mat.course.title}
                    </span>
                  )}
                  {mat.group && (
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 text-[10px]">
                      {mat.group.name}
                    </span>
                  )}
                  {formatFileSize(mat.fileSizeBytes) && (
                    <span className="text-[10px] text-slate-500 font-mono">
                      {formatFileSize(mat.fileSizeBytes)}
                    </span>
                  )}
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                <span className="text-[10px] text-slate-500">
                  {new Date(mat.createdAt).toLocaleDateString("ru-RU")}
                </span>

                {mat.fileUrl ? (
                  <a
                    href={`/api/materials/${mat.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-brand-500/10 hover:bg-brand-500/20 text-brand-300 border border-brand-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Скачать</span>
                  </a>
                ) : mat.externalUrl ? (
                  <a
                    href={`/api/materials/${mat.id}/download`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                  >
                    <LinkIcon className="w-3.5 h-3.5" />
                    <span>Открыть</span>
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Material Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Добавить материал в библиотеку</h3>

            <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setModalMode("FILE")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalMode === "FILE"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Загрузить файл</span>
              </button>
              <button
                type="button"
                onClick={() => setModalMode("LINK")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  modalMode === "LINK"
                    ? "bg-brand-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <LinkIcon className="w-3.5 h-3.5" />
                <span>Ссылка или текст</span>
              </button>
            </div>

            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название материала *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Методичка к модулю 2"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Тип материала
                  </label>
                  <select
                    value={materialType}
                    onChange={(e) => setMaterialType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="LECTURE">Конспект / Методичка</option>
                    <option value="BOOK">Книга / PDF</option>
                    <option value="VIDEO">Видеоматериал</option>
                    <option value="LINK">Внешняя ссылка</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Привязка к курсу
                  </label>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                  >
                    <option value="">Без привязки</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {modalMode === "FILE" ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Выберите файл *
                  </label>
                  <div className="border-2 border-dashed border-slate-700 hover:border-slate-500 rounded-2xl p-6 text-center cursor-pointer transition-colors relative">
                    <input
                      type="file"
                      required
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <Upload className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                    <p className="text-xs text-slate-300 font-semibold">
                      {selectedFile ? selectedFile.name : "Нажмите или перетащите файл сюда"}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      PDF, DOCX, PPTX, MP4, MP3, ZIP до 100 МБ
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    URL адрес *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://..."
                    value={externalUrl}
                    onChange={(e) => setExternalUrl(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Описание или конспект (опционально)
                </label>
                <textarea
                  rows={2}
                  value={contentText}
                  onChange={(e) => setContentText(e.target.value)}
                  placeholder="Дополнительные указания для студентов..."
                  className="w-full px-4 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={uploadLoading || !title.trim()}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {uploadLoading ? "Загрузка..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
