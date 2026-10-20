"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { useOptionalTheme, type Theme } from "./ThemeProvider";

interface ThemeToggleProps {
  locale: LandingLocale;
  className?: string;
}

/**
 * Light/dark switch for the public surface. The label describes the *action*
 * (what a click will do) so it reads correctly for screen readers.
 *
 * Works inside `ThemeProvider`, and also standalone: without a provider it
 * falls back to the `data-theme` attribute on <html>.
 */
export const ThemeToggle: React.FC<ThemeToggleProps> = ({ locale, className = "" }) => {
  const t = getLandingMessages(locale);
  const ctx = useOptionalTheme();
  const [standaloneTheme, setStandaloneTheme] = useState<Theme>("light");

  useEffect(() => {
    if (ctx) return;
    const current = document.documentElement.getAttribute("data-theme");
    setStandaloneTheme(current === "dark" ? "dark" : "light");
  }, [ctx]);

  const theme: Theme = ctx ? ctx.theme : standaloneTheme;

  const toggle = useCallback(() => {
    if (ctx) {
      ctx.toggleTheme();
      return;
    }
    const next: Theme =
      document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      window.localStorage.setItem("edarschi-theme", next);
    } catch {
      // Ignore storage failures (private mode).
    }
    setStandaloneTheme(next);
  }, [ctx]);

  const isDark = theme === "dark";
  const label = isDark ? t.header.theme.toLight : t.header.theme.toDark;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] text-ink-soft transition-colors hover:text-ink ${className}`}
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden="true" />
      ) : (
        <Moon className="h-4 w-4" aria-hidden="true" />
      )}
    </button>
  );
};
