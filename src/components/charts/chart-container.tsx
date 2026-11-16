"use client";

import * as React from "react";
import { BarChart2, Table2 } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ChartTableColumn {
  key: string;
  label: string;
  align?: "left" | "right";
}

export interface ChartLegendEntry {
  key: string;
  label: string;
  color: string;
  formattedValue?: string;
  percent?: number;
}

export interface ChartContainerProps {
  title: string;
  subtitle?: string;
  locale?: string;
  loading?: boolean;
  empty?: boolean;
  emptyMessage?: string;
  headerActions?: React.ReactNode;
  tableColumns?: ChartTableColumn[];
  tableRows?: Record<string, string | number>[];
  legendItems?: ChartLegendEntry[];
  minHeight?: number;
  className?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ChartErrorBoundary extends React.Component<
  { fallback: string; children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="flex h-48 items-center justify-center rounded-md border border-destructive/30 bg-destructive-subtle px-4 text-sm text-destructive-subtle-foreground"
        >
          {this.props.fallback}
        </div>
      );
    }
    return this.props.children;
  }
}

export function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      className="flex w-full flex-col justify-between gap-3 py-2"
      style={{ height }}
      aria-busy="true"
    >
      <div className="flex items-end gap-2 h-full pt-4">
        <Skeleton className="w-full h-2/5" />
        <Skeleton className="w-full h-4/5" />
        <Skeleton className="w-full h-3/5" />
        <Skeleton className="w-full h-full" />
        <Skeleton className="w-full h-2/3" />
        <Skeleton className="w-full h-3/4" />
      </div>
      <div className="flex justify-between gap-4">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-12" />
      </div>
    </div>
  );
}

export function ChartContainer({
  title,
  subtitle,
  locale = "ru",
  loading = false,
  empty = false,
  emptyMessage,
  headerActions,
  tableColumns,
  tableRows,
  legendItems,
  minHeight = 240,
  className,
  children,
}: ChartContainerProps) {
  const [viewMode, setViewMode] = React.useState<"chart" | "table">("chart");
  const hasTable = Boolean(tableColumns && tableColumns.length > 0 && tableRows && tableRows.length > 0);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-[180px] flex-1 space-y-0.5">
          <CardTitle className="leading-snug">{title}</CardTitle>
          {subtitle && <CardDescription>{subtitle}</CardDescription>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 max-w-full">
          {headerActions}
          {hasTable && !loading && !empty && (
            <div
              role="group"
              aria-label={t(locale, "charts.toggleViewAria")}
              className="inline-flex items-center rounded-md border border-border bg-muted p-0.5"
            >
              <button
                type="button"
                aria-pressed={viewMode === "chart"}
                onClick={() => setViewMode("chart")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  viewMode === "chart"
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <BarChart2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(locale, "charts.viewChart")}</span>
              </button>
              <button
                type="button"
                aria-pressed={viewMode === "table"}
                onClick={() => setViewMode("table")}
                className={cn(
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  viewMode === "table"
                    ? "bg-card text-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground border border-transparent"
                )}
              >
                <Table2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{t(locale, "charts.viewTable")}</span>
              </button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <ChartSkeleton height={minHeight} />
        ) : empty ? (
          <EmptyState
            locale={locale}
            title={emptyMessage ?? t(locale, "charts.noData")}
            className="border-dashed py-8"
          />
        ) : viewMode === "table" && hasTable ? (
          <Table wrapperClassName="max-h-72">
            <TableHeader>
              <TableRow>
                {tableColumns!.map((col) => (
                  <TableHead
                    key={col.key}
                    className={col.align === "right" ? "text-right" : "text-left"}
                  >
                    {col.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableRows!.map((row, idx) => (
                <TableRow key={idx}>
                  {tableColumns!.map((col) => (
                    <TableCell
                      key={col.key}
                      className={col.align === "right" ? "text-right font-medium" : "text-left"}
                    >
                      {row[col.key] ?? "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="space-y-4">
            <ChartErrorBoundary fallback={t(locale, "charts.error")}>
              {children}
            </ChartErrorBoundary>

            {legendItems && legendItems.length > 0 && (
              <ul
                aria-label={title}
                className="grid grid-cols-1 gap-x-4 gap-y-1.5 border-t border-border pt-3 sm:grid-cols-2"
              >
                {legendItems.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-2 text-xs tabular-nums"
                  >
                    <span className="inline-flex min-w-0 items-center gap-2 text-muted-foreground">
                      <span
                        className="h-2.5 w-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-foreground font-medium">{item.label}</span>
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {item.formattedValue}
                      {typeof item.percent === "number" ? ` (${Math.round(item.percent)}%)` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
