"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Columns3,
  RefreshCw,
  Rows3,
} from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { EmptyState } from "./empty-state";
import { Pagination } from "./pagination";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Skeleton } from "./skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table";

export type DataTableDensity = "compact" | "comfortable" | "spacious";
export type DataTableSortDirection = "asc" | "desc";

export interface DataTableColumn<T> {
  id: string;
  header: React.ReactNode;
  mobileLabel?: string;
  accessor?: (row: T) => React.ReactNode;
  cell?: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  sortable?: boolean;
  sortKey?: string;
  align?: "left" | "right" | "center";
  hideable?: boolean;
  defaultHidden?: boolean;
  hideOnMobile?: boolean;
  isMobilePrimary?: boolean;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: DataTableColumn<T>[];
  getRowId: (row: T) => string;
  locale?: string;
  loading?: boolean;
  skeletonRows?: number;
  error?: string | null;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Server-side or controlled sorting */
  sortBy?: string | null;
  sortDirection?: DataTableSortDirection;
  onSortChange?: (sortKey: string, direction: DataTableSortDirection) => void;
  /** Server-side pagination */
  page?: number;
  totalPages?: number;
  totalItems?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  /** Row navigation / click */
  getRowHref?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string | undefined;
  /** Row selection & bulk actions */
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  bulkActions?: React.ReactNode;
  /** Toolbar customization */
  showColumnToggle?: boolean;
  showDensityToggle?: boolean;
  defaultDensity?: DataTableDensity;
  stickyHeader?: boolean;
  /** Optional loading caption rendered with skeleton placeholder */
  loadingLabel?: string;
  /** Mobile representation: adaptive stacked cards or horizontal scroll table */
  mobileMode?: "cards" | "scroll";
  mobileCardRender?: (row: T, helpers: { isSelected: boolean; toggleSelected: () => void }) => React.ReactNode;
  toolbarExtra?: React.ReactNode;
  className?: string;
}

const DENSITY_CELL_PADDING: Record<DataTableDensity, string> = {
  compact: "py-1.5 px-2.5 text-[13px]",
  comfortable: "py-2.5 px-3 text-sm",
  spacious: "py-3.5 px-4 text-sm",
};

const DENSITY_HEAD_HEIGHT: Record<DataTableDensity, string> = {
  compact: "h-8 px-2.5",
  comfortable: "h-9 px-3",
  spacious: "h-11 px-4",
};

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(
    target.closest(
      'a,button,input,select,textarea,label,[role="button"],[role="checkbox"],[role="menuitem"],[data-no-row-click="true"]'
    )
  );
}

export function DataTable<T>({
  data,
  columns,
  getRowId,
  locale = "ru",
  loading = false,
  skeletonRows = 6,
  error = null,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyAction,
  sortBy: controlledSortBy,
  sortDirection: controlledSortDir,
  onSortChange,
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  getRowHref,
  onRowClick,
  rowClassName,
  selectable = false,
  selectedIds,
  onSelectionChange,
  bulkActions,
  showColumnToggle = true,
  showDensityToggle = true,
  defaultDensity = "comfortable",
  stickyHeader = true,
  loadingLabel,
  mobileMode = "cards",
  mobileCardRender,
  toolbarExtra,
  className,
}: DataTableProps<T>) {
  const router = useRouter();
  const [density, setDensity] = React.useState<DataTableDensity>(defaultDensity);
  const [hiddenCols, setHiddenCols] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.id))
  );
  const [localSortBy, setLocalSortBy] = React.useState<string | null>(null);
  const [localSortDir, setLocalSortDir] = React.useState<DataTableSortDirection>("asc");
  const [internalSelected, setInternalSelected] = React.useState<string[]>([]);

  const activeSelected = selectedIds ?? internalSelected;
  const setSelection = React.useCallback(
    (next: string[]) => {
      if (onSelectionChange) onSelectionChange(next);
      else setInternalSelected(next);
    },
    [onSelectionChange]
  );

  const activeSortBy = controlledSortBy !== undefined ? controlledSortBy : localSortBy;
  const activeSortDir = controlledSortDir !== undefined ? controlledSortDir : localSortDir;

  const handleSort = (col: DataTableColumn<T>) => {
    if (!col.sortable) return;
    const key = col.sortKey || col.id;
    const nextDir: DataTableSortDirection =
      activeSortBy === key && activeSortDir === "asc" ? "desc" : "asc";
    if (onSortChange) {
      onSortChange(key, nextDir);
    } else {
      setLocalSortBy(key);
      setLocalSortDir(nextDir);
    }
  };

  const sortedData = React.useMemo(() => {
    if (onSortChange || !localSortBy) return data;
    const col = columns.find((c) => (c.sortKey || c.id) === localSortBy);
    if (!col || !col.sortValue) return data;
    const dirMul = localSortDir === "asc" ? 1 : -1;
    return [...data].sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av instanceof Date && bv instanceof Date) {
        return (av.getTime() - bv.getTime()) * dirMul;
      }
      if (typeof av === "number" && typeof bv === "number") {
        return (av - bv) * dirMul;
      }
      return String(av).localeCompare(String(bv), locale) * dirMul;
    });
  }, [columns, data, localSortBy, localSortDir, locale, onSortChange]);

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !hiddenCols.has(c.id)),
    [columns, hiddenCols]
  );

  const toggleColumn = (id: string) => {
    setHiddenCols((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (visibleColumns.length > 1) {
        next.add(id);
      }
      return next;
    });
  };

  const visibleRowIds = React.useMemo(() => sortedData.map(getRowId), [sortedData, getRowId]);
  const selectedSet = React.useMemo(() => new Set(activeSelected), [activeSelected]);
  const allVisibleSelected =
    visibleRowIds.length > 0 && visibleRowIds.every((id) => selectedSet.has(id));
  const someVisibleSelected =
    visibleRowIds.some((id) => selectedSet.has(id)) && !allVisibleSelected;

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      const remaining = activeSelected.filter((id) => !visibleRowIds.includes(id));
      setSelection(remaining);
    } else {
      const next = Array.from(new Set([...activeSelected, ...visibleRowIds]));
      setSelection(next);
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedSet.has(id)) {
      setSelection(activeSelected.filter((item) => item !== id));
    } else {
      setSelection([...activeSelected, id]);
    }
  };

  const handleRowActivate = (row: T, event: React.MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return;
    if (onRowClick) {
      onRowClick(row);
      return;
    }
    const href = getRowHref?.(row);
    if (href) {
      router.push(href);
    }
  };

  const hideableCols = columns.filter((c) => c.hideable !== false);
  const showToolbar =
    showColumnToggle || showDensityToggle || Boolean(toolbarExtra) || (selectable && activeSelected.length > 0);
  const hasRowAction = Boolean(onRowClick || getRowHref);

  const renderCellContent = (col: DataTableColumn<T>, row: T) => {
    if (col.cell) return col.cell(row);
    if (col.accessor) return col.accessor(row);
    return "—";
  };

  const cycleDensity = () => {
    setDensity((prev) =>
      prev === "comfortable" ? "compact" : prev === "compact" ? "spacious" : "comfortable"
    );
  };

  const densityLabel =
    density === "compact"
      ? t(locale, "ui4.densityCompact")
      : density === "spacious"
      ? t(locale, "ui4.densitySpacious")
      : t(locale, "ui4.densityComfortable");

  return (
    <div className={cn("space-y-3", className)}>
      {showToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            {selectable && activeSelected.length > 0 && (
              <div className="inline-flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground">
                <span className="tabular-nums">
                  {t(locale, "ui4.selectedCount", { count: activeSelected.length })}
                </span>
                {bulkActions}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => setSelection([])}
                >
                  {t(locale, "common.cancel")}
                </Button>
              </div>
            )}
            {toolbarExtra}
          </div>

          <div className="flex items-center gap-2 ml-auto shrink-0">
            {showDensityToggle && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={cycleDensity}
                title={t(locale, "ui4.density")}
              >
                <Rows3 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{densityLabel}</span>
              </Button>
            )}
            {showColumnToggle && hideableCols.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button type="button" variant="outline" size="sm">
                    <Columns3 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{t(locale, "ui4.columns")}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-56 p-2">
                  <div className="mb-1.5 px-2 py-1 text-xs font-medium text-muted-foreground">
                    {t(locale, "ui4.columnsVisibility")}
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {hideableCols.map((col) => {
                      const visible = !hiddenCols.has(col.id);
                      const disabled = visible && visibleColumns.length <= 1;
                      const label =
                        typeof col.header === "string"
                          ? col.header
                          : col.mobileLabel || col.id;
                      return (
                        <label
                          key={col.id}
                          className={cn(
                            "flex items-center gap-2 rounded px-2 py-1.5 text-xs text-foreground hover:bg-muted cursor-pointer select-none",
                            disabled && "opacity-60 cursor-not-allowed"
                          )}
                        >
                          <Checkbox
                            checked={visible}
                            disabled={disabled}
                            onCheckedChange={() => toggleColumn(col.id)}
                          />
                          <span className="truncate">{label}</span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      )}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t(locale, "common.error")}</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            {onRetry && (
              <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(locale, "ui4.retry")}</span>
              </Button>
            )}
          </AlertDescription>
        </Alert>
      ) : loading ? (
        <div className="rounded-lg border border-border bg-card p-3 space-y-2.5" aria-busy="true">
          {loadingLabel && (
            <p className="text-xs text-muted-foreground">{loadingLabel}</p>
          )}
          {Array.from({ length: skeletonRows }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <Skeleton className="h-5 w-1/4" />
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-5 w-1/5" />
              <Skeleton className="h-5 w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      ) : sortedData.length === 0 ? (
        <EmptyState
          locale={locale}
          title={emptyTitle ?? t(locale, "ui.noResults")}
          description={emptyDescription}
          action={emptyAction}
        />
      ) : (
        <>
          {/* Mobile card-rows mode (< md) */}
          {mobileMode === "cards" && (
            <div className="space-y-2.5 md:hidden">
              {sortedData.map((row) => {
                const id = getRowId(row);
                const isSelected = selectedSet.has(id);
                if (mobileCardRender) {
                  return (
                    <div
                      key={id}
                      onClick={hasRowAction ? (e) => handleRowActivate(row, e) : undefined}
                      className={cn(
                        "rounded-lg border border-border bg-card p-3.5 text-card-foreground",
                        isSelected && "border-primary bg-accent/30",
                        hasRowAction && "cursor-pointer hover:bg-muted/30 transition-colors",
                        rowClassName?.(row)
                      )}
                    >
                      {mobileCardRender(row, {
                        isSelected,
                        toggleSelected: () => toggleSelectRow(id),
                      })}
                    </div>
                  );
                }

                const cardCols = visibleColumns.filter((c) => !c.hideOnMobile);
                const primaryCol = cardCols.find((c) => c.isMobilePrimary) ?? cardCols[0];
                const actionsCol = cardCols.find((c) => c.id === "actions");
                const detailCols = cardCols.filter(
                  (c) => c.id !== primaryCol?.id && c.id !== "actions"
                );

                return (
                  <div
                    key={id}
                    onClick={hasRowAction ? (e) => handleRowActivate(row, e) : undefined}
                    className={cn(
                      "rounded-lg border border-border bg-card p-3.5 space-y-2.5 text-card-foreground",
                      isSelected && "border-primary bg-accent/30",
                      hasRowAction && "cursor-pointer hover:bg-muted/30 transition-colors",
                      rowClassName?.(row)
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5 min-w-0">
                        {selectable && (
                          <div className="pt-0.5" data-no-row-click="true">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleSelectRow(id)}
                              aria-label={t(locale, "ui.selectAll")}
                            />
                          </div>
                        )}
                        <div className="min-w-0 font-medium text-foreground">
                          {primaryCol ? renderCellContent(primaryCol, row) : null}
                        </div>
                      </div>
                      {actionsCol && (
                        <div className="shrink-0" data-no-row-click="true">
                          {renderCellContent(actionsCol, row)}
                        </div>
                      )}
                    </div>

                    {detailCols.length > 0 && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 pt-2 border-t border-border text-xs">
                        {detailCols.map((col) => {
                          const label =
                            col.mobileLabel ||
                            (typeof col.header === "string" ? col.header : col.id);
                          return (
                            <div key={col.id} className="min-w-0">
                              <div className="text-xs text-muted-foreground truncate">{label}</div>
                              <div className="text-[13px] text-foreground mt-0.5 break-words tabular-nums">
                                {renderCellContent(col, row)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Desktop & horizontal scroll table */}
          <div className={mobileMode === "cards" ? "hidden md:block" : "block"}>
            <Table>
              <TableHeader sticky={stickyHeader}>
                <TableRow>
                  {selectable && (
                    <TableHead className={cn("w-10", DENSITY_HEAD_HEIGHT[density])}>
                      <Checkbox
                        checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                        onCheckedChange={toggleSelectAll}
                        aria-label={t(locale, "ui.selectAll")}
                      />
                    </TableHead>
                  )}
                  {visibleColumns.map((col) => {
                    const key = col.sortKey || col.id;
                    const isSorted = activeSortBy === key;
                    return (
                      <TableHead
                        key={col.id}
                        className={cn(
                          DENSITY_HEAD_HEIGHT[density],
                          col.align === "right"
                            ? "text-right"
                            : col.align === "center"
                            ? "text-center"
                            : "text-left",
                          col.headerClassName
                        )}
                      >
                        {col.sortable ? (
                          <button
                            type="button"
                            onClick={() => handleSort(col)}
                            className={cn(
                              "inline-flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded",
                              col.align === "right" && "ml-auto"
                            )}
                            aria-label={
                              isSorted && activeSortDir === "asc"
                                ? t(locale, "ui.sortDescending")
                                : t(locale, "ui.sortAscending")
                            }
                          >
                            <span>{col.header}</span>
                            {isSorted ? (
                              activeSortDir === "asc" ? (
                                <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          col.header
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedData.map((row) => {
                  const id = getRowId(row);
                  const isSelected = selectedSet.has(id);
                  return (
                    <TableRow
                      key={id}
                      data-state={isSelected ? "selected" : undefined}
                      onClick={hasRowAction ? (e) => handleRowActivate(row, e) : undefined}
                      className={cn(
                        hasRowAction && "cursor-pointer",
                        rowClassName?.(row)
                      )}
                    >
                      {selectable && (
                        <TableCell
                          className={cn("w-10", DENSITY_CELL_PADDING[density])}
                          data-no-row-click="true"
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelectRow(id)}
                            aria-label={t(locale, "ui.selectAll")}
                          />
                        </TableCell>
                      )}
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.id}
                          className={cn(
                            DENSITY_CELL_PADDING[density],
                            col.align === "right"
                              ? "text-right"
                              : col.align === "center"
                              ? "text-center"
                              : "text-left",
                            col.cellClassName
                          )}
                        >
                          {renderCellContent(col, row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {onPageChange && typeof page === "number" && typeof totalPages === "number" && totalPages >= 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={onPageChange}
              locale={locale}
            />
          )}
        </>
      )}
    </div>
  );
}
