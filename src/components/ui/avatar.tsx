import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border bg-muted font-medium text-foreground select-none",
  {
    variants: {
      size: {
        sm: "h-7 w-7 text-xs",
        md: "h-9 w-9 text-[13px]",
        lg: "h-11 w-11 text-sm",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

export interface AvatarProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof avatarVariants> {
  src?: string | null;
  alt?: string;
  name?: string;
}

export function Avatar({ src, alt, name = "", size, className, ...props }: AvatarProps) {
  const label = alt || name || "User";
  return (
    <span className={cn(avatarVariants({ size }), className)} {...props}>
      {src ? (
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden={Boolean(alt) || undefined}>{getInitials(name)}</span>
      )}
    </span>
  );
}
