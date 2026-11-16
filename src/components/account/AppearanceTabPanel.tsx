"use client";

import { useState } from "react";
import { Globe, Monitor } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LOCALE_META, SUPPORTED_LOCALES, t, type SupportedLocale } from "@/i18n";
import { reloadPage } from "@/lib/reload";

interface AppearanceTabPanelProps {
  locale: string;
}

export function AppearanceTabPanel({ locale }: AppearanceTabPanelProps) {
  const [savingLang, setSavingLang] = useState(false);
  const [error, setError] = useState("");

  const handleSelectLanguage = async (nextLocale: SupportedLocale) => {
    if (nextLocale === locale || savingLang) return;
    setSavingLang(true);
    setError("");
    try {
      const res = await fetch("/api/auth/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLocale }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t(locale, "common.error"));
      }
      reloadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : t(locale, "common.error"));
      setSavingLang(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "account.appearanceLangTitle")}</span>
          </CardTitle>
          <CardDescription>{t(locale, "account.appearanceLangDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {SUPPORTED_LOCALES.map((loc) => {
              const active = locale === loc;
              const meta = LOCALE_META[loc];
              return (
                <button
                  key={loc}
                  type="button"
                  disabled={savingLang}
                  aria-pressed={active}
                  onClick={() => handleSelectLanguage(loc)}
                  className={`min-h-[48px] px-4 py-3 rounded-lg border text-left flex items-center justify-between transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-accent border-primary/50 text-accent-foreground font-semibold"
                      : "bg-card border-border text-foreground hover:bg-muted font-medium"
                  }`}
                >
                  <span className="text-sm">{meta.label}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {loc === "ru" ? "RU" : "UZ-LATN"}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="w-4 h-4 text-primary" aria-hidden="true" />
            <span>{t(locale, "account.appearanceThemeTitle")}</span>
          </CardTitle>
          <CardDescription>{t(locale, "account.appearanceThemeDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggle locale={locale} />
        </CardContent>
      </Card>
    </div>
  );
}
