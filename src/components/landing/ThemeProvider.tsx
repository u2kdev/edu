"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";

export type { Theme };

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "edarschi-theme";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

/**
 * Public-surface theme. The visitor's choice lives in `data-theme` on <html>,
 * which the inline bootstrap in the root layout applies before the first paint
 * (no flash of the wrong theme). CSS keys off `html[data-theme="dark"]
 * .public-shell`, so dashboards never pick up the public palette.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    let next: Theme = "light";
    // `?theme=dark|light` pins the theme for demos, QA and shared links. It is
    // applied silently (no storage write) so a shared link never overrides the
    // visitor's own saved preference.
    const pinned = new URLSearchParams(window.location.search).get("theme");
    if (pinned === "light" || pinned === "dark") {
      setThemeState(pinned);
      document.documentElement.setAttribute("data-theme", pinned);
      return;
    }
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark") {
        next = saved;
      } else if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
        next = "dark";
      }
    } catch {
      // Private mode / storage disabled: fall back to light.
    }
    setThemeState(next);
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Persistence is best-effort; the theme still applies for this visit.
    }
    document.documentElement.setAttribute("data-theme", next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark");
  }, [setTheme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

/**
 * Non-throwing variant for leaf controls: lets a theme switch render on its own
 * (e.g. a standalone header) by falling back to the `data-theme` attribute.
 */
export function useOptionalTheme(): ThemeContextType | undefined {
  return useContext(ThemeContext);
}
