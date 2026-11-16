"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/i18n";
import { formatIntegerSpaces } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export interface PaginationProps extends React.HTMLAttributes<HTMLElement> {
  page: number;
  totalPages: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  locale?: string;
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  locale = "ru",
  className,
  ...props
}: PaginationProps) {
  const safeTotal = Math.max(1, totalPages);
  const current = Math.min(Math.max(1, page), safeTotal);
  const hasPrev = current > 1;
  const hasNext = current < safeTotal;

  let summaryText = t(locale, "ui.page", {
    page: formatIntegerSpaces(current),
    total: formatIntegerSpaces(safeTotal),
  });

  if (typeof totalItems === "number" && typeof pageSize === "number" && totalItems > 0 && pageSize > 0) {
    const from = (current - 1) * pageSize + 1;
    const to = Math.min(totalItems, current * pageSize);
    summaryText = t(locale, "ui.showingRange", {
      from: formatIntegerSpaces(from),
      to: formatIntegerSpaces(to),
      total: formatIntegerSpaces(totalItems),
    });
  }

  return (
    <nav
      aria-label={t(locale, "ui.breadcrumbs")}
      className={cn("flex flex-wrap items-center justify-between gap-3 py-2", className)}
      {...props}
    >
      <span className="text-[13px] text-muted-foreground tabular-nums">{summaryText}</span>
      <div className="inline-flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => hasPrev && onPageChange(current - 1)}
          aria-label={t(locale, "ui.previous")}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          <span>{t(locale, "ui.previous")}</span>
        </Button>
        <span className="px-2 text-[13px] font-medium text-foreground tabular-nums">
          {current} / {safeTotal}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => hasNext && onPageChange(current + 1)}
          aria-label={t(locale, "ui.next")}
        >
          <span>{t(locale, "ui.next")}</span>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
