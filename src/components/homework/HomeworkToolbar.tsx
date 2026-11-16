"use client";

import { t } from "@/i18n";
import { HOMEWORK_FILTER_STATUSES } from "./homework-utils";

interface HomeworkToolbarProps {
  locale: string;
  filterStatus: string;
  onFilterChange: (status: string) => void;
}

export function HomeworkToolbar({
  locale,
  filterStatus,
  onFilterChange,
}: HomeworkToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {HOMEWORK_FILTER_STATUSES.map((st) => (
        <button
          key={st}
          type="button"
          onClick={() => onFilterChange(st)}
          className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
            filterStatus === st
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          {st === "ALL"
            ? t(locale, "common.all")
            : t(
                locale,
                `homework.${st === "REVISION_REQUESTED" ? "revisionRequested" : st.toLowerCase()}`
              ) || st}
        </button>
      ))}
    </div>
  );
}
