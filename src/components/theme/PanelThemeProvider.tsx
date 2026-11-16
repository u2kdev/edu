"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  PANEL_RESOLVED_THEME_COOKIE,
  PANEL_THEME_COOKIE,
  type PanelTheme,
  type ResolvedPanelTheme,
} from "@/lib/panel-theme";
import { cn } from "@/lib/utils";

interface PanelThemeContextValue {
  theme: PanelTheme;
  resolvedTheme: ResolvedPanelTheme;
  setTheme: (theme: PanelTheme) => void;
}

const PanelThemeContext = createContext<PanelThemeContextValue | null>(null);

function readSystemTheme(): ResolvedPanelTheme {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "light";
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`;
}

export interface PanelThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: PanelTheme;
  initialResolvedTheme?: ResolvedPanelTheme | null;
  className?: string;
}

export function PanelThemeProvider({
  children,
  initialTheme = "system",
  initialResolvedTheme = null,
  className,
}: PanelThemeProviderProps) {
  const [theme, setThemeState] = useState<PanelTheme>(initialTheme);
  const [systemPref, setSystemPref] = useState<ResolvedPanelTheme>(() =>
    initialResolvedTheme ?? "light"
  );
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-color-scheme: dark)")
        : null;

    const currentSystem: ResolvedPanelTheme = media?.matches ? "dark" : "light";
    setSystemPref(currentSystem);

    if (theme === "system") {
      writeCookie(PANEL_RESOLVED_THEME_COOKIE, currentSystem);
    }

    if (!media) return;
    const onMediaChange = (event: MediaQueryListEvent) => {
      const next: ResolvedPanelTheme = event.matches ? "dark" : "light";
      setSystemPref(next);
      if (theme === "system") {
        writeCookie(PANEL_RESOLVED_THEME_COOKIE, next);
      }
    };
    media.addEventListener("change", onMediaChange);
    return () => media.removeEventListener("change", onMediaChange);
  }, [theme]);

  const resolvedTheme: ResolvedPanelTheme =
    theme === "system" ? systemPref : theme;

  const setTheme = useCallback((next: PanelTheme) => {
    setThemeState(next);
    writeCookie(PANEL_THEME_COOKIE, next);
    const resolved: ResolvedPanelTheme = next === "system" ? readSystemTheme() : next;
    setSystemPref(resolved);
    writeCookie(PANEL_RESOLVED_THEME_COOKIE, resolved);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", resolvedTheme === "dark");
    return () => {
      root.classList.remove("dark");
    };
  }, [resolvedTheme]);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme }),
    [theme, resolvedTheme, setTheme]
  );

  // SSR with theme="system" and no resolved cookie omits data-resolved-theme so CSS
  // @media (prefers-color-scheme: dark) paints the right palette on frame 0 without hydration mismatch.
  const attrResolved: ResolvedPanelTheme | undefined = mounted
    ? resolvedTheme
    : theme === "dark"
      ? "dark"
      : theme === "light"
        ? "light"
        : initialResolvedTheme ?? undefined;
  const resolvedClass = attrResolved === "dark" ? "dark" : "";

  return (
    <PanelThemeContext.Provider value={value}>
      <div
        className={cn("panel-shell min-h-screen", resolvedClass, className)}
        data-panel-theme={theme}
        data-resolved-theme={attrResolved}
      >
        {children}
      </div>
    </PanelThemeContext.Provider>
  );
}

export function usePanelTheme(): PanelThemeContextValue {
  const ctx = useContext(PanelThemeContext);
  const [fallbackTheme, setFallbackTheme] = useState<PanelTheme>("system");
  const [fallbackResolved, setFallbackResolved] = useState<ResolvedPanelTheme>("light");

  const fallbackSet = useCallback((next: PanelTheme) => {
    setFallbackTheme(next);
    const resolved: ResolvedPanelTheme = next === "system" ? readSystemTheme() : next;
    setFallbackResolved(resolved);
    writeCookie(PANEL_THEME_COOKIE, next);
    writeCookie(PANEL_RESOLVED_THEME_COOKIE, resolved);
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", resolved === "dark");
    }
  }, []);

  if (ctx) return ctx;
  return {
    theme: fallbackTheme,
    resolvedTheme: fallbackResolved,
    setTheme: fallbackSet,
  };
}
