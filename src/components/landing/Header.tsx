"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { GraduationCap, Menu, X, ArrowRight } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { LangSwitcher } from "./LangSwitcher";
import { ThemeToggle } from "./ThemeToggle";
import { AnimatedButton } from "./AnimatedButton";

interface HeaderProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({ locale, onOpenLeadModal }) => {
  const t = getLandingMessages(locale);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { href: "#imkoniyatlar", label: t.header.nav.features },
    { href: "#nega-biz", label: t.header.nav.whyUs },
    { href: "#ilovalari", label: t.header.nav.apps },
    { href: "#tariflar", label: t.header.nav.pricing },
    { href: "#faq", label: t.header.nav.faq },
    { href: "#aloqa", label: t.header.nav.contact },
  ];

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        isScrolled
          ? "bg-white/85 dark:bg-[#0A1128]/85 backdrop-blur-md shadow-sm border-b border-blue-100 dark:border-white/10 py-3"
          : "bg-transparent py-4 border-b border-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link href={locale === "uz" ? "/" : "/ru"} className="flex items-center gap-2.5 group">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white flex items-center">
                e-darschi
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  LMS
                </span>
              </span>
              <span className="hidden sm:block text-[10px] tracking-wider uppercase text-slate-500 dark:text-slate-400 font-medium">
                {"Toshkent, O'zbekiston"}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="hidden sm:flex items-center gap-3">
            <LangSwitcher currentLocale={locale} />
            <ThemeToggle />

            <Link
              href="/login"
              className="text-xs font-semibold px-3 py-2 rounded-xl text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
            >
              {t.header.login}
            </Link>

            <AnimatedButton
              size="sm"
              variant="primary"
              glow
              onClick={onOpenLeadModal}
              className="!text-xs font-semibold"
            >
              <span>{t.header.startFree}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </AnimatedButton>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex lg:hidden items-center gap-2">
            <LangSwitcher currentLocale={locale} />
            <ThemeToggle />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t.header.menuToggle}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-white/95 dark:bg-[#0A1128]/95 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 px-6 py-5 space-y-4 animate-fade-in shadow-xl">
          <nav className="flex flex-col space-y-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="text-base font-medium text-slate-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 py-1 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="pt-3 border-t border-slate-100 dark:border-white/10 flex flex-col gap-2.5">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full text-center py-2.5 text-sm font-semibold rounded-xl bg-slate-100 dark:bg-[#13224D] text-slate-900 dark:text-white"
            >
              {t.header.login}
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLeadModal();
              }}
              className="w-full py-2.5 text-sm font-semibold rounded-xl bg-blue-600 text-white shadow-md shadow-blue-600/30"
            >
              {t.header.startFree}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
