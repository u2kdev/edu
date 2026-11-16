"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-medium",
    "text-sm transition-colors select-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover border border-transparent",
        secondary: "bg-secondary text-secondary-foreground hover:bg-muted border border-border",
        outline: "bg-card text-foreground hover:bg-muted border border-border",
        ghost: "bg-transparent text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent",
        destructive: "bg-destructive text-destructive-foreground hover:opacity-90 border border-transparent",
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-9 px-3.5 text-sm",
        lg: "h-10 px-4 text-sm",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, type, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? "button")}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      >
        {asChild ? (
          children
        ) : (
          <>
            {loading && (
              <span
                className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
                aria-hidden="true"
              />
            )}
            {children}
          </>
        )}
      </Comp>
    );
  }
);
Button.displayName = "Button";
