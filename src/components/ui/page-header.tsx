import * as React from "react";
import { cn } from "@/lib/utils";
import { Breadcrumbs, type BreadcrumbItem } from "./breadcrumbs";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: React.ReactNode;
  locale?: string;
  bordered?: boolean;
}

export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
  locale = "ru",
  bordered = true,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3",
        bordered && "pb-4 border-b border-border",
        className
      )}
      {...props}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs items={breadcrumbs} locale={locale} />
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {description && (
            <p className="text-[13px] text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
    </div>
  );
}
