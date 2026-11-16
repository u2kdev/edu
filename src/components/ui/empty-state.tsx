import * as React from "react";
import { Inbox } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title?: string;
  description?: string;
  action?: React.ReactNode;
  locale?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  locale = "ru",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-border bg-card px-6 py-10 text-center",
        className
      )}
      {...props}
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted text-muted-foreground">
        {icon ?? <Inbox className="h-5 w-5" aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-semibold text-foreground">
        {title ?? t(locale, "common.noData")}
      </h3>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
