"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { SUPPORTED_LOCALES, LOCALE_META, type SupportedLocale } from "@/i18n";

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
      window.location.reload();
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={saving}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-xl
          text-sm font-medium text-slate-300 
          bg-slate-900/60 border border-slate-700/60
          hover:bg-slate-800/80 hover:border-slate-600/60 hover:text-white
          transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed
          ${compact ? "px-2.5" : ""}
        `}
        aria-label="Change language"
        title="Change language"
      >
        <Globe className="w-4 h-4 text-brand-400" />
        {!compact && (
          <>
            <span>{currentMeta.flag}</span>
            <span className="hidden sm:inline">{currentMeta.nativeLabel}</span>
          </>
        )}
        {saving && (
          <span className="w-3 h-3 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
        )}
      </button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-2 z-50
            min-w-[200px] py-1.5
            glass-panel rounded-xl border border-slate-700/80
            shadow-xl shadow-black/30
            animate-in fade-in slide-in-from-top-1
          "
        >
          {SUPPORTED_LOCALES.map((locale) => {
            const meta = LOCALE_META[locale];
            const isActive = locale === currentLocale;

            return (
              <button
                key={locale}
                onClick={() => handleSelect(locale)}
                className={`
                  w-full flex items-center gap-3 px-4 py-2.5
                  text-sm font-medium text-left
                  transition-colors duration-150
                  ${
                    isActive
                      ? "text-brand-400 bg-brand-500/10"
                      : "text-slate-300 hover:text-white hover:bg-slate-800/60"
                  }
                `}
              >
                <span className="text-lg">{meta.flag}</span>
                <div className="flex flex-col">
                  <span>{meta.nativeLabel}</span>
                  {meta.label !== meta.nativeLabel && (
                    <span className="text-[10px] text-slate-500">
                      {meta.label}
                    </span>
                  )}
                </div>
                {isActive && (
                  <span className="ml-auto w-2 h-2 rounded-full bg-brand-400" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
