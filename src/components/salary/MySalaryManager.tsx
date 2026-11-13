"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Wallet,
  Clock,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  Loader2,
  DollarSign,
  ArrowRightLeft,
  CalendarRange,
} from "lucide-react";
import { formatCurrencyLocalized, formatDateLocalized } from "@/i18n";

interface LessonRecord {
  id: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  academicHours: number;
  isSubstitute: boolean;
  courseTitle: string;
  groupName: string;
  attendanceCount: number;
  hasAttendance: boolean;
}

interface SalaryData {
  teacher: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  period: {
    from: string;
    to: string;
  };
  conductedLessonsCount: number;
  substituteLessonsCount: number;
  totalAcademicHours: number;
  salaryRate: {
    rateType: "HOURLY" | "PERCENTAGE" | "FIXED";
    amount: number;
    currency: string;
  } | null;
  calculatedSalary: number | null;
  totalPaidAmount: number;
  payouts: Array<{
    id: string;
    amount: number;
    createdAt: string;
    description: string;
  }>;
  lessons: LessonRecord[];
}

interface MySalaryManagerProps {
  role: string;
  locale?: string;
}

export default function MySalaryManager({ locale = "ru" }: MySalaryManagerProps) {
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"CURRENT" | "PREVIOUS">("CURRENT");

  const fetchSalary = useCallback(async (period: "CURRENT" | "PREVIOUS") => {
    setLoading(true);
    setError("");

    const now = new Date();
    let from: Date;
    let to: Date;

    if (period === "CURRENT") {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else {
      from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      to = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    }

    try {
      const res = await fetch(`/api/tenant/my-salary?from=${from.toISOString()}&to=${to.toISOString()}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Ошибка загрузки данных зарплаты");
        return;
      }
      setData(json);
    } catch {
      setError(locale === "uz-Latn" ? "Tarmoq xatosi" : "Ошибка сети при загрузке");
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    fetchSalary(periodFilter);
  }, [fetchSalary, periodFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-6 h-6 text-brand-400" />
            <span>{locale === "uz-Latn" ? "Mening maoshim va dars soatlarim" : "Моя зарплата и учебные часы"}</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {locale === "uz-Latn"
              ? "O'tkazilgan darslar, stavka va hisoblangan mablag'lar (faqat o'qish uchun)"
              : "Фактически проведённые уроки, ставка и расчёт начислений (только чтение)"}
          </p>
        </div>

        {/* Period Selector */}
        <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
          <button
            onClick={() => setPeriodFilter("CURRENT")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              periodFilter === "CURRENT" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            {locale === "uz-Latn" ? "Joriy oy" : "Текущий месяц"}
          </button>
          <button
            onClick={() => setPeriodFilter("PREVIOUS")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              periodFilter === "PREVIOUS" ? "bg-brand-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
            }`}
          >
            {locale === "uz-Latn" ? "O'tgan oy" : "Прошлый месяц"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-panel p-16 rounded-2xl border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
          <p className="text-xs text-slate-400">{locale === "uz-Latn" ? "Hisoblanmoqda..." : "Рассчитываем часы и начисления..."}</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      ) : data ? (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Conducted Lessons */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {locale === "uz-Latn" ? "O'tkazilgan darslar" : "Проведено уроков"}
                </span>
                <CalendarDays className="w-4 h-4 text-brand-400" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">{data.conductedLessonsCount}</div>
                {data.substituteLessonsCount > 0 && (
                  <p className="text-xs text-amber-400 mt-0.5 flex items-center gap-1">
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>
                      {locale === "uz-Latn"
                        ? `${data.substituteLessonsCount} ta almashtirish`
                        : `${data.substituteLessonsCount} на замене`}
                    </span>
                  </p>
                )}
              </div>
            </div>

            {/* 2. Academic Hours */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {locale === "uz-Latn" ? "Akademik soatlar" : "Академические часы"}
                </span>
                <Clock className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-2xl font-extrabold text-white">
                  {data.totalAcademicHours} {locale === "uz-Latn" ? "soat" : "ч."}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  {locale === "uz-Latn" ? "Haqiqiy davomiylik bo'yicha" : "По факту расписания"}
                </p>
              </div>
            </div>

            {/* 3. Salary Rate */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {locale === "uz-Latn" ? "Amaldagi stavka" : "Установленная ставка"}
                </span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                {data.salaryRate ? (
                  <>
                    <div className="text-xl font-extrabold text-white">
                      {formatCurrencyLocalized(data.salaryRate.amount, locale)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {data.salaryRate.rateType === "HOURLY"
                        ? locale === "uz-Latn"
                          ? "Soatbay (1 soat uchun)"
                          : "Почасовая (за 1 час)"
                        : data.salaryRate.rateType === "FIXED"
                        ? locale === "uz-Latn"
                          ? "Oylik fiks"
                          : "Оклад (фикс за месяц)"
                        : "Процентная"}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-400 italic">
                      {locale === "uz-Latn" ? "Stavka belgilanmagan" : "Ставка не задана"}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {locale === "uz-Latn" ? "Ma'muriyatga murojaat qiling" : "Обратитесь к администрации"}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* 4. Calculated Salary & Payouts */}
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2 flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {locale === "uz-Latn" ? "Hisoblangan maosh" : "Начислено к выплате"}
                </span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                {data.calculatedSalary !== null ? (
                  <>
                    <div className="text-2xl font-extrabold text-emerald-400">
                      {formatCurrencyLocalized(data.calculatedSalary, locale)}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {locale === "uz-Latn" ? "To'langan: " : "Выплачено: "}
                      <span className="text-white font-semibold">
                        {formatCurrencyLocalized(data.totalPaidAmount, locale)}
                      </span>
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-slate-400">
                      {locale === "uz-Latn" ? "Hisob mavjud emas" : "Сумма не рассчитана"}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {locale === "uz-Latn" ? "Chunki stavka belgilanmagan" : "Поскольку ставка не задана"}
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Lessons Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden space-y-3 p-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-brand-400" />
              <span>{locale === "uz-Latn" ? "O'tkazilgan darslar ro'yxati" : "Журнал проведённых занятий"}</span>
              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-800 text-slate-400 font-semibold">
                {data.lessons.length}
              </span>
            </h3>

            {data.lessons.length === 0 ? (
              <div className="text-center py-10 space-y-2">
                <Clock className="w-10 h-10 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  {locale === "uz-Latn"
                    ? "Ushbu davrda o'tkazilgan darslar topilmadi"
                    : "В выбранном периоде нет проведённых уроков"}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                    <tr>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Sana va vaqt" : "Дата и время"}</th>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Kurs va guruh" : "Курс и группа"}</th>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Dars mavzusi" : "Тема занятия"}</th>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Davomiyligi" : "Длительность"}</th>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Akademik soat" : "Академ. часы"}</th>
                      <th className="py-3 px-4">{locale === "uz-Latn" ? "Holati" : "Статус"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {data.lessons.map((lesson) => (
                      <tr key={lesson.id} className="hover:bg-slate-900/40 transition-colors">
                        <td className="py-3 px-4 whitespace-nowrap font-medium text-white">
                          {formatDateLocalized(new Date(lesson.scheduledAt), locale)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="text-white font-semibold block">{lesson.groupName}</span>
                          <span className="text-[11px] text-slate-500">{lesson.courseTitle}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-200">{lesson.title}</td>
                        <td className="py-3 px-4">{lesson.durationMinutes} мин</td>
                        <td className="py-3 px-4 font-mono font-semibold text-purple-300">
                          {lesson.academicHours} ч.
                        </td>
                        <td className="py-3 px-4">
                          {lesson.isSubstitute ? (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              {locale === "uz-Latn" ? "O'rinbosar" : "Замена"}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {locale === "uz-Latn" ? "Asosiy" : "Основной"}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
