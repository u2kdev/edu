"use client";

import { Upload, UserPlus } from "lucide-react";
import { t } from "@/i18n";
import { Button, FilterBar, PageHeader } from "@/components/ui";
import type { GroupOption } from "./students-utils";

export interface StudentsToolbarProps {
  locale: string;
  canManage: boolean;
  totalCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  selectedGroup: string;
  onGroupChange: (value: string) => void;
  selectedStatus: string;
  onStatusChange: (value: string) => void;
  sortBy: string;
  sortOrder: "asc" | "desc";
  onSortChange: (value: string) => void;
  initialGroups: GroupOption[];
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  onOpenAdd: () => void;
  onOpenCsv: () => void;
}

const selectClassName =
  "h-9 rounded-md border border-input bg-card px-3 py-1.5 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

export function StudentsToolbar({
  locale,
  canManage,
  totalCount,
  search,
  onSearchChange,
  selectedGroup,
  onGroupChange,
  selectedStatus,
  onStatusChange,
  sortBy,
  sortOrder,
  onSortChange,
  initialGroups,
  hasActiveFilters = false,
  onResetFilters,
  onOpenAdd,
  onOpenCsv,
}: StudentsToolbarProps) {
  return (
    <div className="space-y-4">
      <PageHeader
        title={t(locale, "students.title")}
        description={t(locale, "students.totalCount", { count: String(totalCount) })}
        actions={
          canManage ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={onOpenCsv}>
                <Upload className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "students.importCsv")}</span>
              </Button>
              <Button type="button" variant="primary" size="sm" onClick={onOpenAdd}>
                <UserPlus className="h-4 w-4" aria-hidden="true" />
                <span>{t(locale, "students.addStudent")}</span>
              </Button>
            </div>
          ) : undefined
        }
      />

      <FilterBar
        locale={locale}
        search={search}
        onSearchChange={onSearchChange}
        searchPlaceholder={t(locale, "students.searchPlaceholder")}
        hasActiveFilters={hasActiveFilters}
        onReset={onResetFilters}
      >
        <select
          value={selectedGroup}
          onChange={(e) => onGroupChange(e.target.value)}
          aria-label={t(locale, "students.filterGroup")}
          className={selectClassName}
        >
          <option value="">{t(locale, "students.filterGroup")}</option>
          {initialGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>

        <select
          value={selectedStatus}
          onChange={(e) => onStatusChange(e.target.value)}
          aria-label={t(locale, "students.filterStatus")}
          className={selectClassName}
        >
          <option value="">{t(locale, "students.filterStatus")}</option>
          <option value="ACTIVE">{t(locale, "students.statusActive")}</option>
          <option value="ARCHIVED">{t(locale, "students.statusArchived")}</option>
        </select>

        <select
          value={`${sortBy}-${sortOrder}`}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label={t(locale, "students.sortName")}
          className={selectClassName}
        >
          <option value="name-asc">{t(locale, "students.sortName")} ({t(locale, "students.sortAsc")})</option>
          <option value="name-desc">{t(locale, "students.sortName")} ({t(locale, "students.sortDesc")})</option>
          <option value="createdAt-desc">{t(locale, "students.sortDate")} ({t(locale, "students.sortNewest")})</option>
          <option value="createdAt-asc">{t(locale, "students.sortDate")} ({t(locale, "students.sortOldest")})</option>
        </select>
      </FilterBar>
    </div>
  );
}
