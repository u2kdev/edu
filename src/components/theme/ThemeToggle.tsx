"use client";

import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { t } from "@/i18n";
import { type PanelTheme } from "@/lib/panel-theme";
import { cn } from "@/lib/utils";
import { usePanelTheme } from "./PanelThemeProvider";

export interface ThemeToggleProps {
  locale?: string;
  compact?: boolean;
  value?: PanelTheme;
  onChange?: (theme: PanelTheme) => void;
  className?: string;
}

const OPTIONS: { id: PanelTheme; icon: typeof Sun; key: string; shortKey: string }[] = [
  { id: "light", icon: Sun, key: "theme.light", shortKey: "theme.shortLight" },
  { id: "dark", icon: Moon, key: "theme.dark", shortKey: "theme.shortDark" },
  { id: "system", icon: Monitor, key: "theme.system", shortKey: "theme.shortSystem" },
];

export function ThemeToggle({
  locale = "ru",
  compact = false,
  value,
  onChange,
  className,
}: ThemeToggleProps) {
  const { theme, setTheme } = usePanelTheme();
  const activeTheme = value ?? theme;
  const handleSelect = onChange ?? setTheme;

  return (
    <div
      role="radiogroup"
      aria-label={t(locale, "theme.ariaLabel")}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5",
        className
      )}
    >
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const checked = activeTheme === opt.id;
        const label = t(locale, compact ? opt.shortKey : opt.key);
        const fullLabel = t(locale, opt.key);

        return (
          <button
            key={opt.id}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={fullLabel}
            title={fullLabel}
            onClick={() => handleSelect(opt.id)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
              checked
                ? "bg-card text-foreground border border-border"
                : "text-muted-foreground hover:text-foreground border border-transparent"
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className={compact ? "sr-only sm:not-sr-only" : undefined}>
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ThemeToggle;
