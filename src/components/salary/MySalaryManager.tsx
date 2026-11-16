"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import { formatCurrencyLocalized, formatDateLocalized } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";

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
  const isUz = locale === "uz-Latn";
  const [data, setData] = useState<SalaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodFilter, setPeriodFilter] = useState<"CURRENT" | "PREVIOUS">("CURRENT");

  const fetchSalary = useCallback(
    async (period: "CURRENT" | "PREVIOUS") => {
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
        const res = await fetch(
          `/api/tenant/my-salary?from=${from.toISOString()}&to=${to.toISOString()}`
        );
        const json = await res.json();
        if (!res.ok) {
          setError(
            json.error || (isUz ? "Maosh ma'lumotlarini yuklashda xatolik" : "Ошибка загрузки данных зарплаты")
          );
          return;
        }
        setData(json);
      } catch {
        setError(isUz ? "Tarmoq xatosi" : "Ошибка сети при загрузке");
      } finally {
        setLoading(false);
      }
    },
    [isUz]
  );

  useEffect(() => {
    void fetchSalary(periodFilter);
  }, [fetchSalary, periodFilter]);

  const lessonColumns = useMemo<DataTableColumn<LessonRecord>[]>(
    () => [
      {
        id: "scheduledAt",
        header: isUz ? "Sana va vaqt" : "Дата и время",
        sortable: true,
        sortValue: (row) => new Date(row.scheduledAt).getTime(),
        cell: (row) => (
          <span className="whitespace-nowrap font-medium text-foreground tabular-nums">
            {formatDateLocalized(new Date(row.scheduledAt), locale)}
          </span>
        ),
      },
      {
        id: "group",
        header: isUz ? "Kurs va guruh" : "Курс и группа",
        sortable: true,
        sortValue: (row) => row.groupName,
        cell: (row) => (
          <div>
            <div className="font-medium text-foreground">{row.groupName}</div>
            <div className="text-xs text-muted-foreground">{row.courseTitle}</div>
          </div>
        ),
      },
      {
        id: "title",
        header: isUz ? "Dars mavzusi" : "Тема занятия",
        cell: (row) => <span className="text-foreground">{row.title}</span>,
      },
      {
        id: "duration",
        header: isUz ? "Davomiyligi" : "Длительность",
        align: "right",
        sortable: true,
        sortValue: (row) => row.durationMinutes,
        cell: (row) => (
          <span className="text-muted-foreground tabular-nums">
            {row.durationMinutes} {isUz ? "daq." : "мин"}
          </span>
        ),
      },
      {
        id: "hours",
        header: isUz ? "Akademik soat" : "Академ. часы",
        align: "right",
        sortable: true,
        sortValue: (row) => row.academicHours,
        cell: (row) => (
          <span className="font-mono font-medium text-foreground tabular-nums">
            {row.academicHours} {isUz ? "soat" : "ч."}
          </span>
        ),
      },
      {
        id: "status",
        header: isUz ? "Holati" : "Статус",
        cell: (row) =>
          row.isSubstitute ? (
            <Badge variant="warning">
              {isUz ? "Oʻrinbosar" : "Замена"}
            </Badge>
          ) : (
            <Badge variant="success">
              {isUz ? "Asosiy" : "Основной"}
            </Badge>
          ),
      },
    ],
    [isUz, locale]
  );

  const rateHint = data?.salaryRate
    ? data.salaryRate.rateType === "HOURLY"
      ? isUz
        ? "Soatbay (1 soat uchun)"
        : "Почасовая (за 1 час)"
      : data.salaryRate.rateType === "FIXED"
      ? isUz
        ? "Oylik fiks"
        : "Оклад (фикс за месяц)"
      : isUz
      ? "Foizli"
      : "Процентная"
    : isUz
    ? "Maʼmuriyatga murojaat qiling"
    : "Обратитесь к администрации";

  return (
    <div className="space-y-6">
      <PageHeader
        title={isUz ? "Mening maoshim va dars soatlarim" : "Моя зарплата и учебные часы"}
        description={
          isUz
            ? "Oʻtkazilgan darslar, stavka va hisoblangan mablagʻlar (faqat oʻqish uchun)"
            : "Фактически проведённые уроки, ставка и расчёт начислений (только чтение)"
        }
        actions={
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setPeriodFilter("CURRENT")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                periodFilter === "CURRENT"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isUz ? "Joriy oy" : "Текущий месяц"}
            </button>
            <button
              type="button"
              onClick={() => setPeriodFilter("PREVIOUS")}
              className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                periodFilter === "PREVIOUS"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {isUz ? "Oʻtgan oy" : "Прошлый месяц"}
            </button>
          </div>
        }
      />

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>{isUz ? "Yuklashda xatolik" : "Ошибка загрузки"}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void fetchSalary(periodFilter)}
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{isUz ? "Qayta urinish" : "Повторить"}</span>
            </Button>
          </AlertDescription>
        </Alert>
      ) : data ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label={isUz ? "Oʻtkazilgan darslar" : "Проведено уроков"}
              value={data.conductedLessonsCount}
              hint={
                data.substituteLessonsCount > 0
                  ? isUz
                    ? `${data.substituteLessonsCount} ta almashtirish`
                    : `${data.substituteLessonsCount} на замене`
                  : undefined
              }
            />
            <StatCard
              label={isUz ? "Akademik soatlar" : "Академические часы"}
              value={`${data.totalAcademicHours} ${isUz ? "soat" : "ч."}`}
              hint={isUz ? "Haqiqiy davomiylik boʻyicha" : "По факту расписания"}
            />
            <StatCard
              label={isUz ? "Amaldagi stavka" : "Установленная ставка"}
              value={
                data.salaryRate
                  ? formatCurrencyLocalized(data.salaryRate.amount, locale)
                  : isUz
                  ? "Belgilanmagan"
                  : "Не задана"
              }
              hint={rateHint}
            />
            <StatCard
              label={isUz ? "Hisoblangan maosh" : "Начислено к выплате"}
              value={
                data.calculatedSalary !== null
                  ? formatCurrencyLocalized(data.calculatedSalary, locale)
                  : isUz
                  ? "Hisoblanmagan"
                  : "Не рассчитана"
              }
              hint={
                data.calculatedSalary !== null
                  ? `${isUz ? "Toʻlangan" : "Выплачено"}: ${formatCurrencyLocalized(
                      data.totalPaidAmount,
                      locale
                    )}`
                  : isUz
                  ? "Stavka belgilanmagan"
                  : "Ставка не задана"
              }
            />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <span>
                  {isUz ? "Oʻtkazilgan darslar roʻyxati" : "Журнал проведённых занятий"}
                </span>
                <Badge variant="neutral">{data.lessons.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <DataTable
                data={data.lessons}
                columns={lessonColumns}
                getRowId={(row) => row.id}
                locale={locale}
                emptyTitle={
                  isUz
                    ? "Ushbu davrda oʻtkazilgan darslar topilmadi"
                    : "В выбранном периоде нет проведённых уроков"
                }
                emptyDescription={
                  isUz
                    ? "Oʻtgan oyni tanlab koʻring yoki jadvalni tekshiring."
                    : "Выберите прошлый месяц или проверьте расписание занятий."
                }
                mobileCardRender={(row) => (
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">{row.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.groupName} · {row.courseTitle}
                        </div>
                      </div>
                      {row.isSubstitute ? (
                        <Badge variant="warning">
                          {isUz ? "Oʻrinbosar" : "Замена"}
                        </Badge>
                      ) : (
                        <Badge variant="success">
                          {isUz ? "Asosiy" : "Основной"}
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
                      <span>{formatDateLocalized(new Date(row.scheduledAt), locale)}</span>
                      <span>
                        {row.durationMinutes} {isUz ? "daq." : "мин"} · {row.academicHours}{" "}
                        {isUz ? "soat" : "ч."}
                      </span>
                    </div>
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
