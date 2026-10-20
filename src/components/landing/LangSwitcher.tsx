"use client";

import React from "react";
import Link from "next/link";
import { LandingLocale } from "../../types/landing";

interface LangSwitcherProps {
  currentLocale: LandingLocale;
  className?: string;
}

export const LangSwitcher: React.FC<LangSwitcherProps> = ({ currentLocale, className = "" }) => {
  const handleSelect = (locale: LandingLocale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("edarschi-lang", locale);
      document.cookie = `edarschi_locale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  };

  const baseSegment =
    "inline-flex items-center px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors";
  const activeSegment = "bg-[color:var(--brand-solid)] text-white shadow-[0_6px_14px_-8px_rgba(29,78,216,0.9)]";
  const idleSegment = "text-ink-muted hover:text-ink";

  return (
    <div
      className={`inline-flex items-center rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] p-0.5 transition-colors ${className}`}
      role="group"
      aria-label="Tilni tanlash"
    >
      <Link
        href="/"
        onClick={() => handleSelect("uz")}
        className={`${baseSegment} ${currentLocale === "uz" ? activeSegment : idleSegment}`}
        aria-current={currentLocale === "uz" ? "page" : undefined}
      >
        UZ
      </Link>
      <Link
        href="/ru"
        onClick={() => handleSelect("ru")}
        className={`${baseSegment} ${currentLocale === "ru" ? activeSegment : idleSegment}`}
        aria-current={currentLocale === "ru" ? "page" : undefined}
      >
        RU
      </Link>
    </div>
  );
};
