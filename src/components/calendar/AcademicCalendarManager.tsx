"use client";

import { useState } from "react";
import {
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
} from "lucide-react";

export interface AcademicTermItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface HolidayItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

interface AcademicCalendarManagerProps {
  initialTerms: AcademicTermItem[];
  initialHolidays: HolidayItem[];
  canManage: boolean;
}

export default function AcademicCalendarManager({
  initialTerms,
  initialHolidays,
  canManage,
}: AcademicCalendarManagerProps) {
  const [activeTab, setActiveTab] = useState<"TERMS" | "HOLIDAYS">("TERMS");
  const [terms, setTerms] = useState<AcademicTermItem[]>(initialTerms);
  const [holidays, setHolidays] = useState<HolidayItem[]>(initialHolidays);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Term modal state
  const [termModalOpen, setTermModalOpen] = useState(false);
  const [editTermId, setEditTermId] = useState<string | null>(null);
  const [termName, setTermName] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");

  // Holiday modal state
  const [holidayModalOpen, setHolidayModalOpen] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");

  const refreshTerms = async () => {
    try {
      const res = await fetch("/api/tenant/academic-terms");
      if (res.ok) {
        const data = await res.json();
        setTerms(data.terms);
      }
    } catch {}
  };

  const refreshHolidays = async () => {
    try {
      const res = await fetch("/api/tenant/holidays");
      if (res.ok) {
        const data = await res.json();
        setHolidays(data.holidays);
      }
    } catch {}
  };

  // Import Uzbekistan holidays
  const handleImportUzHolidays = async () => {
    if (!window.confirm("Импортировать официальные государственные праздники Узбекистана на текущий год?")) return;
    setLoading(true);
    setNotice(null);
    try {
      const res = await fetch("/api/tenant/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "IMPORT_UZ_HOLIDAYS", year: new Date().getFullYear() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка импорта");
      setHolidays(data.holidays);
      setNotice({ type: "success", text: data.message || "Праздники успешно импортированы" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка импорта" });
    } finally {
      setLoading(false);
    }
  };

  // Save Term (Create or Edit)
  const handleSaveTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termName.trim() || !termStart || !termEnd) return;
    setLoading(true);
    setNotice(null);

    try {
      if (editTermId) {
        const res = await fetch(`/api/tenant/academic-terms/${editTermId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: termName.trim(), startDate: termStart, endDate: termEnd }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка сохранения");
        setNotice({ type: "success", text: "Учебный период обновлен" });
      } else {
        const res = await fetch("/api/tenant/academic-terms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: termName.trim(), startDate: termStart, endDate: termEnd }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Ошибка создания");
        setNotice({ type: "success", text: "Учебный период добавлен" });
      }

      setTermModalOpen(false);
      setEditTermId(null);
      setTermName("");
      setTermStart("");
      setTermEnd("");
      await refreshTerms();
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка сохранения" });
    } finally {
      setLoading(false);
    }
  };

  // Delete Term
  const handleDeleteTerm = async (id: string) => {
    if (!window.confirm("Удалить этот учебный период?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/academic-terms/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshTerms();
      setNotice({ type: "success", text: "Учебный период удален" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setLoading(false);
    }
  };

  // Save Holiday
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayName.trim() || !holidayStart) return;
    setLoading(true);
    setNotice(null);

    try {
      const res = await fetch("/api/tenant/holidays", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "CREATE",
          name: holidayName.trim(),
          startDate: holidayStart,
          endDate: holidayEnd || holidayStart,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка сохранения");

      setHolidayModalOpen(false);
      setHolidayName("");
      setHolidayStart("");
      setHolidayEnd("");
      await refreshHolidays();
      setNotice({ type: "success", text: "Праздник успешно добавлен" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка сохранения" });
    } finally {
      setLoading(false);
    }
  };

  // Delete Holiday
  const handleDeleteHoliday = async (id: string) => {
    if (!window.confirm("Удалить этот праздник?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/holidays/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ошибка удаления");
      await refreshHolidays();
      setNotice({ type: "success", text: "Праздник удален" });
    } catch (err: unknown) {
      setNotice({ type: "error", text: err instanceof Error ? err.message : "Ошибка удаления" });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    } catch {
      return iso;
    }
  };

  const getDaysCount = (startIso: string, endIso: string) => {
    try {
      const s = new Date(startIso).getTime();
      const e = new Date(endIso).getTime();
      return Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1);
    } catch {
      return 1;
    }
  };

  const now = new Date().getTime();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="glass-panel p-6 sm:p-8 rounded-3xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-3">
            <CalendarDays className="w-7 h-7 text-brand-400" />
            <span>Учебный календарь и праздники</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-xl">
            Настройте четверти, семестры и праздничные дни. Расписание автоматически пропускает праздники, а отчёты фильтруются по учебным периодам.
          </p>
        </div>

        {canManage && (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleImportUzHolidays}
              disabled={loading}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Импорт праздников Узбекистана</span>
            </button>
            {activeTab === "TERMS" ? (
              <button
                onClick={() => {
                  setEditTermId(null);
                  setTermName("");
                  setTermStart("");
                  setTermEnd("");
                  setTermModalOpen(true);
                }}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить период</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  setHolidayName("");
                  setHolidayStart("");
                  setHolidayEnd("");
                  setHolidayModalOpen(true);
                }}
                className="px-4 py-2.5 bg-brand-600 hover:bg-brand-500 text-white rounded-xl text-xs font-semibold flex items-center gap-2 shadow-lg shadow-brand-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>Добавить праздник</span>
              </button>
            )}
          </div>
        )}
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

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab("TERMS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "TERMS"
              ? "bg-brand-500/20 text-brand-300 border border-brand-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Учебные периоды ({terms.length})</span>
        </button>
        <button
          onClick={() => setActiveTab("HOLIDAYS")}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
            activeTab === "HOLIDAYS"
              ? "bg-brand-500/20 text-brand-300 border border-brand-500/30"
              : "text-slate-400 hover:text-white"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Праздники и каникулы ({holidays.length})</span>
        </button>
      </div>

      {/* Content Tab 1: Terms */}
      {activeTab === "TERMS" && (
        <div className="space-y-4">
          {terms.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center">
              <CalendarDays className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Учебные периоды не заданы</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Создайте четверти или семестры для фильтрации оценок и посещаемости.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {terms.map((term) => {
                const s = new Date(term.startDate).getTime();
                const e = new Date(term.endDate).getTime();
                const isCurrent = now >= s && now <= e;
                const isPast = now > e;

                return (
                  <div
                    key={term.id}
                    className={`glass-panel p-5 rounded-2xl border transition-all ${
                      isCurrent
                        ? "border-brand-500/40 bg-brand-500/5 shadow-lg shadow-brand-500/10"
                        : "border-slate-800/80 bg-slate-900/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white">{term.name}</h3>
                          {isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 text-[10px] font-bold uppercase">
                              Текущий
                            </span>
                          )}
                          {isPast && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase">
                              Завершен
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {formatDate(term.startDate)} — {formatDate(term.endDate)}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          <span>Продолжительность: {getDaysCount(term.startDate, term.endDate)} дн.</span>
                        </p>
                      </div>

                      {canManage && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditTermId(term.id);
                              setTermName(term.name);
                              setTermStart(term.startDate.split("T")[0]);
                              setTermEnd(term.endDate.split("T")[0]);
                              setTermModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                            title="Редактировать"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteTerm(term.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                            title="Удалить"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content Tab 2: Holidays */}
      {activeTab === "HOLIDAYS" && (
        <div className="space-y-4">
          {holidays.length === 0 ? (
            <div className="glass-panel p-12 rounded-3xl border border-slate-800 text-center">
              <Calendar className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-white">Список праздников пуст</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Добавьте праздники вручную или нажмите «Импорт праздников Узбекистана» выше.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {holidays.map((h) => (
                <div
                  key={h.id}
                  className="glass-panel p-4 rounded-xl border border-slate-800/80 bg-slate-900/50 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-white truncate">{h.name}</h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(h.startDate)}
                      {h.endDate && h.endDate.split("T")[0] !== h.startDate.split("T")[0] ? ` — ${formatDate(h.endDate)}` : ""}
                    </p>
                  </div>
                  {canManage && (
                    <button
                      onClick={() => handleDeleteHoliday(h.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 shrink-0"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Term Modal */}
      {termModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">
              {editTermId ? "Редактирование периода" : "Новый учебный период"}
            </h3>
            <form onSubmit={handleSaveTerm} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название периода *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: I четверть или 1 семестр"
                  value={termName}
                  onChange={(e) => setTermName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Дата начала *
                  </label>
                  <input
                    type="date"
                    required
                    value={termStart}
                    onChange={(e) => setTermStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Дата окончания *
                  </label>
                  <input
                    type="date"
                    required
                    value={termEnd}
                    onChange={(e) => setTermEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTermModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm"
                >
                  {loading ? "Сохранение..." : "Сохранить"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      {holidayModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl border border-slate-800 space-y-4">
            <h3 className="text-lg font-bold text-white">Добавить праздничный день</h3>
            <form onSubmit={handleSaveHoliday} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Название праздника / каникул *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Например: Осенние каникулы"
                  value={holidayName}
                  onChange={(e) => setHolidayName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Дата начала *
                  </label>
                  <input
                    type="date"
                    required
                    value={holidayStart}
                    onChange={(e) => setHolidayStart(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Дата окончания
                  </label>
                  <input
                    type="date"
                    value={holidayEnd}
                    onChange={(e) => setHolidayEnd(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setHolidayModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 font-semibold rounded-xl text-sm"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-xl text-sm"
                >
                  {loading ? "Сохранение..." : "Добавить праздник"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
