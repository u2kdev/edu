"use client";

import { LayoutGrid, List, Plus } from "lucide-react";
import { t } from "@/i18n";
import { Button, FilterBar, PageHeader } from "@/components/ui";
import type { CourseOption, TeacherOption } from "./groups-utils";

interface GroupsToolbarProps {
  locale: string;
  canEdit: boolean;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  courses: CourseOption[];
  selectedCourseId: string;
  onCourseChange: (value: string) => void;
  teachers: TeacherOption[];
  selectedTeacherId: string;
  onTeacherChange: (value: string) => void;
  viewMode: "table" | "cards";
  onViewModeChange: (mode: "table" | "cards") => void;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onOpenCreate: () => void;
}

const selectClassName =
  "h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function GroupsToolbar({
  locale,
  canEdit,
  totalCount,
  search,
  onSearchChange,
  courses,
  selectedCourseId,
  onCourseChange,
  teachers,
  selectedTeacherId,
  onTeacherChange,
  viewMode,
  onViewModeChange,
  hasActiveFilters,
  onResetFilters,
  onOpenCreate,
}: GroupsToolbarProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={t(locale, "groups.title")}
        description={
          locale === "uz-Latn" ? `Jami guruhlar: ${totalCount}` : `Всего групп: ${totalCount}`
        }
        actions={
          canEdit ? (
            <Button type="button" variant="primary" size="sm" onClick={onOpenCreate}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>{t(locale, "groups.createGroup")}</span>
            </Button>
          ) : undefined
        }
      />

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={
          locale === "uz-Latn"
            ? "Guruh, kurs, oʻqituvchi yoki oʻquvchi..."
            : "Группа, курс, преподаватель или ученик..."
        }
        hasActiveFilters={hasActiveFilters}
        onReset={onResetFilters}
        actions={
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => onViewModeChange("table")}
              aria-label="Таблица"
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "table"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Таблица</span>
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("cards")}
              aria-label="Карточки"
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Карточки</span>
            </button>
          </div>
        }
      >
        <select
          value={selectedCourseId}
          onChange={(e) => onCourseChange(e.target.value)}
          aria-label="Курс"
          className={selectClassName}
        >
          <option value="">{locale === "uz-Latn" ? "Barcha kurslar" : "Все курсы"}</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>

        <select
          value={selectedTeacherId}
          onChange={(e) => onTeacherChange(e.target.value)}
          aria-label="Преподаватель"
          className={selectClassName}
        >
          <option value="">{locale === "uz-Latn" ? "Barcha oʻqituvchilar" : "Все преподаватели"}</option>
          {teachers.map((tr) => (
            <option key={tr.id} value={tr.id}>
              {tr.user.fullName}
            </option>
          ))}
        </select>
      </FilterBar>
    </div>
  );
}
