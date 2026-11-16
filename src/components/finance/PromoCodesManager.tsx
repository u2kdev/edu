"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Plus, Power } from "lucide-react";
import { t } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FilterBar } from "@/components/ui/filter-bar";
import { FormActions, FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";

const SELECT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

export interface PromoCodeRow {
  id: string;
  code: string;
  discountType: "PERCENT" | "FIXED";
  value: number;
  validFrom: string | null;
  validUntil: string | null;
  maxUses: number | null;
  usesCount: number;
  isActive: boolean;
  applicableCourse: { id: string; title: string } | null;
  applicableGroup: { id: string; name: string } | null;
  createdAt: string;
}

interface OptionItem {
  id: string;
  label: string;
}

interface Props {
  initialPromoCodes: PromoCodeRow[];
  initialTotal: number;
  courses: OptionItem[];
  groups: OptionItem[];
  canManage: boolean;
  featureLocked?: boolean;
  locale?: string;
}

export default function PromoCodesManager({
  initialPromoCodes,
  initialTotal,
  courses,
  groups,
  canManage,
  featureLocked = false,
  locale = "ru",
}: Props) {
  const isUz = locale === "uz-Latn";
  const [promoCodes, setPromoCodes] = useState<PromoCodeRow[]>(initialPromoCodes);
  const [total, setTotal] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(Math.max(1, Math.ceil(initialTotal / 20)));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "ACTIVE" | "INACTIVE" | "EXPIRED">("");
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [applicableCourseId, setApplicableCourseId] = useState("");
  const [applicableGroupId, setApplicableGroupId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const isFirstRender = useRef(true);

  const fetchList = useCallback(
    async (targetPage: number, targetSearch: string, targetStatus: string) => {
      setLoading(true);
      setListError(null);
      try {
        const params = new URLSearchParams({
          page: String(targetPage),
          limit: "20",
        });
        if (targetSearch.trim()) params.set("search", targetSearch.trim());
        if (targetStatus) params.set("status", targetStatus);

        const res = await fetch(`/api/promo-codes?${params.toString()}`);
        const data = await res.json();
        if (res.ok) {
          setPromoCodes(data.promoCodes || []);
          setTotal(data.pagination?.total || 0);
          setTotalPages(data.pagination?.totalPages || 1);
          setPage(data.pagination?.page || targetPage);
        } else {
          setListError(data.error || (isUz ? "Yuklashda xatolik" : "Ошибка загрузки промокодов"));
        }
      } catch {
        setListError(isUz ? "Tarmoq xatoligi" : "Ошибка сети");
      } finally {
        setLoading(false);
      }
    },
    [isUz]
  );

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      void fetchList(1, search, statusFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, fetchList]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg("");
    try {
      const payload: Record<string, unknown> = {
        code: code.trim().toUpperCase(),
        discountType,
        value: Number(value),
        isActive: true,
      };
      if (maxUses.trim()) payload.maxUses = Number(maxUses);
      if (validFrom) payload.validFrom = new Date(`${validFrom}T00:00:00+05:00`).toISOString();
      if (validUntil) payload.validUntil = new Date(`${validUntil}T23:59:59+05:00`).toISOString();
      if (applicableCourseId) payload.applicableCourseId = applicableCourseId;
      if (applicableGroupId) payload.applicableGroupId = applicableGroupId;

      const res = await fetch("/api/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || (isUz ? "Saqlashda xatolik" : "Ошибка сохранения"));
        return;
      }
      setShowModal(false);
      setCode("");
      setValue("10");
      setMaxUses("");
      setValidFrom("");
      setValidUntil("");
      setApplicableCourseId("");
      setApplicableGroupId("");
      await fetchList(1, search, statusFilter);
    } catch {
      setErrorMsg(isUz ? "Tarmoq xatoligi" : "Ошибка сети");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = useCallback(
    async (item: PromoCodeRow) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/promo-codes/${item.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: !item.isActive }),
        });
        if (res.ok) {
          await fetchList(page, search, statusFilter);
        } else {
          const data = await res.json().catch(() => ({}));
          setActionError(data.error || (isUz ? "Holatni oʻzgartirib boʻlmadi" : "Не удалось обновить статус промокода"));
        }
      } catch {
        setActionError(isUz ? "Tarmoq xatoligi" : "Ошибка сети");
      }
    },
    [fetchList, isUz, page, search, statusFilter]
  );

  const now = Date.now();

  const renderStatusBadge = useCallback(
    (p: PromoCodeRow) => {
      const expired = Boolean(p.validUntil && new Date(p.validUntil).getTime() < now);
      const exhausted = Boolean(p.maxUses !== null && p.usesCount >= p.maxUses);
      if (!p.isActive) {
        return <Badge variant="neutral">{isUz ? "Oʻchirilgan" : "Отключён"}</Badge>;
      }
      if (expired) {
        return <Badge variant="warning">{isUz ? "Muddati tugagan" : "Истёк"}</Badge>;
      }
      if (exhausted) {
        return <Badge variant="warning">{isUz ? "Limit tugagan" : "Лимит исчерпан"}</Badge>;
      }
      return <Badge variant="success">{isUz ? "Faol" : "Активен"}</Badge>;
    },
    [isUz, now]
  );

  const columns = useMemo<DataTableColumn<PromoCodeRow>[]>(() => {
    const base: DataTableColumn<PromoCodeRow>[] = [
      {
        id: "code",
        header: t(locale, "billing.promoCode"),
        sortable: true,
        sortValue: (p) => p.code,
        cell: (p) => <span className="font-mono font-semibold text-foreground">{p.code}</span>,
      },
      {
        id: "discount",
        header: isUz ? "Chegirma" : "Скидка",
        sortable: true,
        sortValue: (p) => p.value,
        cell: (p) => (
          <span className="font-semibold text-success tabular-nums">
            {p.discountType === "PERCENT"
              ? `${p.value}%`
              : `${p.value.toLocaleString("ru-RU")} UZS`}
          </span>
        ),
      },
      {
        id: "scope",
        header: isUz ? "Cheklov" : "Ограничение",
        cell: (p) => (
          <span className="text-muted-foreground">
            {p.applicableGroup
              ? p.applicableGroup.name
              : p.applicableCourse
              ? p.applicableCourse.title
              : isUz
              ? "Barcha guruhlar"
              : "Все группы"}
          </span>
        ),
      },
      {
        id: "uses",
        header: isUz ? "Foydalanish" : "Использования",
        sortable: true,
        sortValue: (p) => p.usesCount,
        cell: (p) => (
          <span className="font-mono text-muted-foreground tabular-nums">
            {p.usesCount} / {p.maxUses ?? "∞"}
          </span>
        ),
      },
      {
        id: "validUntil",
        header: isUz ? "Muddat" : "Срок",
        cell: (p) => (
          <span className="text-muted-foreground tabular-nums">
            {p.validUntil
              ? new Date(p.validUntil).toLocaleDateString(isUz ? "uz-UZ" : "ru-RU")
              : isUz
              ? "Muddatsiz"
              : "Бессрочно"}
          </span>
        ),
      },
      {
        id: "status",
        header: isUz ? "Holat" : "Статус",
        cell: (p) => renderStatusBadge(p),
      },
    ];

    if (canManage) {
      base.push({
        id: "actions",
        header: isUz ? "Amal" : "Действие",
        align: "right",
        cell: (p) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void handleToggleActive(p)}
          >
            <Power className="h-3.5 w-3.5" aria-hidden="true" />
            <span>
              {p.isActive ? (isUz ? "Oʻchirish" : "Выкл") : isUz ? "Yoqish" : "Вкл"}
            </span>
          </Button>
        ),
      });
    }

    return base;
  }, [canManage, handleToggleActive, isUz, locale, renderStatusBadge]);

  return (
    <div className="space-y-6">
      {featureLocked && (
        <Alert variant="warning">
          <AlertTitle>
            {isUz
              ? "Promokodlar joriy tarifda yopiq"
              : "Создание промокодов недоступно на текущем тарифе"}
          </AlertTitle>
          <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {isUz
                ? "Mavjud promokodlarni koʻrish mumkin, yangilarini yaratish uchun tarifni yangilang."
                : "Просмотр существующих промокодов сохранён; для создания и изменения обновите тариф."}
            </span>
            <Link href="/center/upgrade" className="shrink-0">
              <Button type="button" variant="outline" size="sm">
                {isUz ? "Tarifni yaxshilash" : "Улучшить тариф"}
              </Button>
            </Link>
          </AlertDescription>
        </Alert>
      )}

      <PageHeader
        title={t(locale, "billing.promoCodes")}
        description={
          isUz
            ? "Toʻlov vaqtida avtomatik hisoblanadigan chegirma kodlari"
            : "Скидочные коды для автоматического применения при оплате обучения"
        }
        actions={
          canManage ? (
            <Button
              type="button"
              size="sm"
              onClick={() => {
                setErrorMsg("");
                setShowModal(true);
              }}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t(locale, "billing.newPromoCode")}</span>
            </Button>
          ) : undefined
        }
      />

      {actionError && (
        <Alert variant="destructive">
          <AlertDescription>{actionError}</AlertDescription>
        </Alert>
      )}

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={isUz ? "Kod boʻyicha qidirish..." : "Поиск по коду..."}
        hasActiveFilters={Boolean(search || statusFilter)}
        onReset={() => {
          setSearch("");
          setStatusFilter("");
        }}
      >
        <select
          aria-label={isUz ? "Holat" : "Статус"}
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "" | "ACTIVE" | "INACTIVE" | "EXPIRED")
          }
          className={`${SELECT_CLS} w-44 text-[13px]`}
        >
          <option value="">{isUz ? "Barcha holatlar" : "Все статусы"}</option>
          <option value="ACTIVE">{isUz ? "Faol" : "Активные"}</option>
          <option value="INACTIVE">{isUz ? "Oʻchirilgan" : "Отключённые"}</option>
          <option value="EXPIRED">{isUz ? "Muddati tugagan" : "Истёкшие"}</option>
        </select>
      </FilterBar>

      <DataTable
        data={promoCodes}
        columns={columns}
        getRowId={(p) => p.id}
        locale={locale}
        loading={loading && promoCodes.length === 0}
        error={listError}
        onRetry={() => void fetchList(page, search, statusFilter)}
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={20}
        onPageChange={(nextPage) => void fetchList(nextPage, search, statusFilter)}
        emptyTitle={isUz ? "Promokodlar topilmadi" : "Промокоды не найдены"}
        emptyDescription={
          canManage
            ? isUz
              ? "Yangi promokod qoʻshing yoki qidiruv parametrlarini oʻzgartiring."
              : "Создайте первый промокод или измените параметры поиска."
            : undefined
        }
        mobileCardRender={(p) => (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono font-semibold text-foreground">{p.code}</div>
                <div className="text-xs font-medium text-success tabular-nums">
                  {p.discountType === "PERCENT"
                    ? `${p.value}%`
                    : `${p.value.toLocaleString("ru-RU")} UZS`}
                </div>
              </div>
              {renderStatusBadge(p)}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground tabular-nums">
              <span>
                {p.applicableGroup
                  ? p.applicableGroup.name
                  : p.applicableCourse
                  ? p.applicableCourse.title
                  : isUz
                  ? "Barcha guruhlar"
                  : "Все группы"}
              </span>
              <span>
                {p.usesCount} / {p.maxUses ?? "∞"}
              </span>
            </div>
            {canManage && (
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void handleToggleActive(p)}
                >
                  <Power className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>
                    {p.isActive ? (isUz ? "Oʻchirish" : "Выкл") : isUz ? "Yoqish" : "Вкл"}
                  </span>
                </Button>
              </div>
            )}
          </div>
        )}
      />

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t(locale, "billing.newPromoCode")}</DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <Alert variant="destructive">
              <AlertDescription>{errorMsg}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
            <FormField label={t(locale, "billing.promoCode")} htmlFor="promo-code" required>
              <Input
                id="promo-code"
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="SPRING20"
                className="font-mono uppercase"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={isUz ? "Turi" : "Тип"} htmlFor="promo-type">
                <select
                  id="promo-type"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "PERCENT" | "FIXED")}
                  className={SELECT_CLS}
                >
                  <option value="PERCENT">{isUz ? "Foiz (%)" : "Процент (%)"}</option>
                  <option value="FIXED">{isUz ? "Summa (UZS)" : "Фикс (UZS)"}</option>
                </select>
              </FormField>
              <FormField label={isUz ? "Qiymat" : "Значение"} htmlFor="promo-value" required>
                <Input
                  id="promo-value"
                  type="number"
                  min={1}
                  max={discountType === "PERCENT" ? 100 : undefined}
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={isUz ? "Boshlanish" : "Действует с"} htmlFor="promo-from">
                <Input
                  id="promo-from"
                  type="date"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </FormField>
              <FormField label={isUz ? "Tugash" : "Действует до"} htmlFor="promo-until">
                <Input
                  id="promo-until"
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                />
              </FormField>
            </div>

            <FormField
              label={isUz ? "Maks. foydalanish (ixtiyoriy)" : "Макс. использований (опционально)"}
              htmlFor="promo-max-uses"
            >
              <Input
                id="promo-max-uses"
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                placeholder="100"
              />
            </FormField>

            <div className="grid grid-cols-2 gap-3">
              <FormField label={isUz ? "Kurs" : "Курс"} htmlFor="promo-course">
                <select
                  id="promo-course"
                  value={applicableCourseId}
                  onChange={(e) => setApplicableCourseId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">{isUz ? "Barchasi" : "Любой"}</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label={isUz ? "Guruh" : "Группа"} htmlFor="promo-group">
                <select
                  id="promo-group"
                  value={applicableGroupId}
                  onChange={(e) => setApplicableGroupId(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">{isUz ? "Barchasi" : "Любая"}</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <FormActions>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                disabled={submitting}
              >
                {isUz ? "Bekor qilish" : "Отмена"}
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "..." : isUz ? "Yaratish" : "Создать"}
              </Button>
            </FormActions>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
