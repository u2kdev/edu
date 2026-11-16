import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export const alertVariants = cva(
  "relative flex items-start gap-3 rounded-lg border p-3.5 text-sm",
  {
    variants: {
      variant: {
        neutral: "border-border bg-muted/60 text-foreground",
        info: "border-info/30 bg-info-subtle text-info-subtle-foreground",
        success: "border-success/30 bg-success-subtle text-success-subtle-foreground",
        warning: "border-warning/30 bg-warning-subtle text-warning-subtle-foreground",
        destructive: "border-destructive/30 bg-destructive-subtle text-destructive-subtle-foreground",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

const ALERT_ICONS = {
  neutral: Info,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  destructive: AlertCircle,
} as const;

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {
  icon?: React.ReactNode;
}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "neutral", icon, children, role, ...props }, ref) => {
    const resolvedVariant = variant ?? "neutral";
    const DefaultIcon = ALERT_ICONS[resolvedVariant];
    return (
      <div
        ref={ref}
        role={role ?? (resolvedVariant === "destructive" ? "alert" : "status")}
        className={cn(alertVariants({ variant: resolvedVariant }), className)}
        {...props}
      >
        <span className="mt-0.5 shrink-0" aria-hidden="true">
          {icon ?? <DefaultIcon className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1 space-y-1">{children}</div>
      </div>
    );
  }
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-sm font-semibold leading-5", className)} {...props} />
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("text-[13px] leading-5 opacity-95", className)} {...props} />
));
AlertDescription.displayName = "AlertDescription";
