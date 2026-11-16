"use client";

import * as React from "react";
import { Search, X } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Input } from "./input";

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  hasActiveFilters?: boolean;
  onReset?: () => void;
  actions?: React.ReactNode;
  locale?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder,
  searchAriaLabel,
  hasActiveFilters = false,
  onReset,
  actions,
  locale = "ru",
  children,
  className,
  ...props
}: FilterBarProps) {
  const placeholder = searchPlaceholder ?? t(locale, "ui.searchPlaceholder");

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border bg-card p-3",
        className
      )}
      {...props}
    >
      <div className="flex w-full sm:w-auto sm:flex-1 flex-wrap items-center gap-2 min-w-0 sm:min-w-[220px]">
        {onSearchChange && (
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search ?? ""}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              aria-label={searchAriaLabel ?? placeholder}
              className="pl-8"
            />
          </div>
        )}
        {children}
        {hasActiveFilters && onReset && (
          <Button variant="ghost" size="sm" onClick={onReset}>
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t(locale, "ui.clearFilters")}</span>
          </Button>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
