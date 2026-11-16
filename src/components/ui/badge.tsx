import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium leading-4 tabular-nums",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted text-foreground",
        primary: "border-primary/25 bg-accent text-accent-foreground",
        success: "border-success/25 bg-success-subtle text-success-subtle-foreground",
        warning: "border-warning/25 bg-warning-subtle text-warning-subtle-foreground",
        destructive: "border-destructive/25 bg-destructive-subtle text-destructive-subtle-foreground",
        info: "border-info/25 bg-info-subtle text-info-subtle-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>;

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const DOT_TONES = {
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
} as const;

export interface StatusDotProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: keyof typeof DOT_TONES;
  label: string;
}

/**
 * Accessible status indicator: pairs a semantic dot with explicit text so color
 * is never the sole carrier of meaning.
 */
export function StatusDot({ tone = "neutral", label, className, ...props }: StatusDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground",
        className
      )}
      {...props}
    >
      <span
        className={cn("h-2 w-2 rounded-full shrink-0", DOT_TONES[tone])}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  );
}
