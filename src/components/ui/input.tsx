import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", error = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={error || undefined}
        className={cn(
          "flex h-9 w-full rounded-md border bg-card px-3 py-1.5 text-sm text-foreground",
          "placeholder:text-muted-foreground tabular-nums transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
          "disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive focus-visible:ring-destructive" : "border-input",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
