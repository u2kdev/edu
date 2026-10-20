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
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors ${
            filterStatus === st
              ? "bg-brand-500 text-white border-brand-400"
              : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800"
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
