"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { SUPPORTED_LOCALES, LOCALE_META, type SupportedLocale } from "@/i18n";
import { reloadPage } from "@/lib/reload";

interface LanguageSwitcherProps {
  currentLocale: string;
  onLocaleChange?: (locale: SupportedLocale) => void;
  /** If true, will call the API endpoint to persist the change */
  persist?: boolean;
  /** Compact mode shows only the flag/icon */
  compact?: boolean;
}

export default function LanguageSwitcher({
  currentLocale,
  onLocaleChange,
  persist = true,
  compact = false,
}: LanguageSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentMeta =
    LOCALE_META[currentLocale as SupportedLocale] || LOCALE_META["ru"];

  async function handleSelect(locale: SupportedLocale) {
    if (locale === currentLocale) {
      setIsOpen(false);
      return;
    }

    setSaving(true);

    if (persist) {
      try {
        const res = await fetch("/api/auth/me/language", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language: locale }),
        });

        if (!res.ok) {
          console.error("Failed to update language preference");
          setSaving(false);
          return;
        }
      } catch (err) {
        console.error("Error updating language:", err);
        setSaving(false);
        return;
      }
    }

    onLocaleChange?.(locale);
    setSaving(false);
    setIsOpen(false);

    // Reload to apply language change across all server components
    if (persist) {
      reloadPage();
    }
  }

  const currentCode = currentLocale === "uz-Latn" ? "UZ" : "RU";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={saving}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg
          text-sm font-medium text-foreground
          bg-card border border-border
          hover:bg-muted transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? "px-2.5" : ""}
        `}
        aria-label="Change language"
        aria-expanded={isOpen}
        title="Change language"
      >
        <Globe className="w-4 h-4 text-primary shrink-0" />
        {!compact && (
          <>
            <span className="text-xs font-semibold text-muted-foreground">{currentCode}</span>
            <span className="hidden sm:inline">{currentMeta.nativeLabel}</span>
          </>
        )}
        {saving && (
          <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-1.5 z-50
            min-w-[200px] py-1
            bg-popover text-popover-foreground rounded-lg border border-border
            shadow-sm
          "
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const meta = LOCALE_META[locale];
            const isActive = locale === currentLocale;
            const code = locale === "uz-Latn" ? "UZ" : "RU";

            return (
              <button
                key={locale}
                type="button"
                onClick={() => handleSelect(locale)}
                className={`
                  w-full flex items-center gap-2.5 px-3 py-2
                  text-sm font-medium text-left
                  transition-colors
                  ${
                    isActive
                      ? "text-accent-foreground bg-accent"
                      : "text-popover-foreground hover:bg-muted"
                  }
                `}
              >
                <span className="w-6 text-xs font-semibold text-muted-foreground">{code}</span>
                <div className="flex flex-col">
                  <span>{meta.nativeLabel}</span>
                  {meta.label !== meta.nativeLabel && (
                    <span className="text-xs text-muted-foreground">
                      {meta.label}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
