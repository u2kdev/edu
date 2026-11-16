import * as React from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[];
  locale?: string;
}

export function Breadcrumbs({ items, locale = "ru", className, ...props }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <nav aria-label={t(locale, "ui.breadcrumbs")} className={cn("flex items-center", className)} {...props}>
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li key={`${item.label}-${idx}`} className="inline-flex items-center gap-1.5">
              {idx > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              )}
              {isLast || !item.href ? (
                <span
                  aria-current={isLast ? "page" : undefined}
                  className={cn(isLast ? "font-medium text-foreground" : "text-muted-foreground")}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
