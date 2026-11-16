export const PANEL_THEME_COOKIE = "edarschi_panel_theme";
export const PANEL_RESOLVED_THEME_COOKIE = "edarschi_panel_resolved_theme";

export type PanelTheme = "light" | "dark" | "system";
export type ResolvedPanelTheme = "light" | "dark";

export function parsePanelTheme(raw: string | undefined | null): PanelTheme {
  if (raw === "light" || raw === "dark" || raw === "system") {
    return raw;
  }
  return "system";
}

export function parseResolvedPanelTheme(
  theme: PanelTheme,
  rawResolved: string | undefined | null
): ResolvedPanelTheme | null {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  if (rawResolved === "light" || rawResolved === "dark") {
    return rawResolved;
  }
  return null;
}

/**
 * Reads the persisted panel theme from request cookies on the server so SSR renders
 * without light/dark flash and without an inline bootstrap script (CSP-clean).
 * Safely degrades inside unit tests executed outside a Next.js request scope.
 */
export async function getServerPanelTheme(): Promise<{
  theme: PanelTheme;
  resolvedTheme: ResolvedPanelTheme | null;
}> {
  try {
    const { cookies } = await import("next/headers");
    const store = cookies();
    const theme = parsePanelTheme(store.get(PANEL_THEME_COOKIE)?.value);
    const resolvedTheme = parseResolvedPanelTheme(
      theme,
      store.get(PANEL_RESOLVED_THEME_COOKIE)?.value
    );
    return { theme, resolvedTheme };
  } catch {
    return { theme: "system", resolvedTheme: null };
  }
}
