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

  return (
    <div
      className={`inline-flex items-center p-0.5 rounded-xl border transition-colors ${
        "bg-[#F4F8FF] dark:bg-[#13224D] border-blue-200/50 dark:border-white/10"
      } ${className}`}
      role="group"
      aria-label="Tilni tanlash"
    >
      <Link
        href="/"
        onClick={() => handleSelect("uz")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
          currentLocale === "uz"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white"
        }`}
        aria-current={currentLocale === "uz" ? "page" : undefined}
      >
        UZ
      </Link>
      <Link
        href="/ru"
        onClick={() => handleSelect("ru")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
          currentLocale === "ru"
            ? "bg-blue-600 text-white shadow-sm"
            : "text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-white"
        }`}
        aria-current={currentLocale === "ru" ? "page" : undefined}
      >
        RU
      </Link>
    </div>
  );
};
