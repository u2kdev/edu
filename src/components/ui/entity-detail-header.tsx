"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { t } from "@/i18n";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";

export interface EntityActionItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  href?: string;
  onSelect?: () => void;
  destructive?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export interface EntityDetailHeaderProps {
  backHref: string;
  backLabel?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusLabel?: string;
  statusVariant?: BadgeVariant;
  badges?: React.ReactNode;
  meta?: React.ReactNode;
  primaryAction?: React.ReactNode;
  menuActions?: EntityActionItem[];
  locale?: string;
  className?: string;
}

/**
 * Shared profile/entity card header for Student, Staff, Group, Center and User detail views.
 */
export function EntityDetailHeader({
  backHref,
  backLabel,
  icon,
  title,
  subtitle,
  statusLabel,
  statusVariant = "neutral",
  badges,
  meta,
  primaryAction,
  menuActions = [],
  locale = "ru",
  className,
}: EntityDetailHeaderProps) {
  const activeMenuItems = menuActions.filter(Boolean);

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>{backLabel ?? t(locale, "common.back")}</span>
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 text-card-foreground flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5 min-w-0">
          {icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
              {icon}
            </div>
          )}
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground truncate">
                {title}
              </h1>
              {statusLabel && <Badge variant={statusVariant}>{statusLabel}</Badge>}
              {badges}
            </div>
            {subtitle && (
              <div className="text-[13px] text-muted-foreground">{subtitle}</div>
            )}
            {meta && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-xs text-muted-foreground">
                {meta}
              </div>
            )}
          </div>
        </div>

        {(primaryAction || activeMenuItems.length > 0) && (
          <div className="flex flex-wrap items-center gap-2 shrink-0 sm:justify-end">
            {primaryAction}
            {activeMenuItems.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={t(locale, "ui4.moreActions")}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only">{t(locale, "ui4.moreActions")}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {activeMenuItems.map((item) => (
                    <React.Fragment key={item.id}>
                      {item.separatorBefore && <DropdownMenuSeparator />}
                      {item.href ? (
                        <DropdownMenuItem asChild disabled={item.disabled}>
                          <Link href={item.href} className="flex items-center gap-2">
                            {item.icon}
                            <span>{item.label}</span>
                          </Link>
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          disabled={item.disabled}
                          onSelect={item.onSelect}
                          className={cn(
                            item.destructive && "text-destructive focus:text-destructive"
                          )}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </DropdownMenuItem>
                      )}
                    </React.Fragment>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
