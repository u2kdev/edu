import * as React from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { t } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface AttentionRowItem {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description?: string;
  actionLabel: string;
  actionHref: string;
}

export interface AttentionListCardProps {
  title?: string;
  emptyLabel?: string;
  items: AttentionRowItem[];
  locale?: string;
  className?: string;
}

const DOT_TONES: Record<AttentionRowItem["severity"], string> = {
  critical: "bg-destructive",
  warning: "bg-warning",
  info: "bg-info",
};

export function AttentionListCard({
  title,
  emptyLabel,
  items,
  locale = "ru",
  className,
}: AttentionListCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <CardTitle>{title ?? t(locale, "ui3.attentionTitle")}</CardTitle>
        <span className="text-xs font-medium text-muted-foreground tabular-nums">
          {items.length}
        </span>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3.5 py-3 text-[13px] text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden="true" />
            <span>{emptyLabel ?? t(locale, "ui3.attentionEmpty")}</span>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-2 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-start gap-2.5">
                  <span
                    className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", DOT_TONES[item.severity])}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{item.title}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground truncate">
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
                <Button asChild variant="outline" size="sm" className="shrink-0 self-start sm:self-auto">
                  <Link href={item.actionHref}>
                    <span>{item.actionLabel}</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
