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
      setIsScrolled(window.scrollY > 12);
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
      className={`sticky top-0 z-40 font-strict transition-all duration-300 ${
        isScrolled
          ? "border-b border-[color:var(--line)] bg-[color:var(--surface-a80)] py-2.5 backdrop-blur-xl shadow-[0_8px_30px_-18px_rgba(16,24,40,0.28)]"
          : "border-b border-transparent py-4"
      }`}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          {/* Brand Logo */}
          <Link href={locale === "uz" ? "/" : "/ru"} className="group flex items-center gap-2.5">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_8px_20px_-8px_rgba(29,78,216,0.8)] ring-1 ring-inset ring-white/15 transition-transform duration-300 group-hover:scale-[1.04]">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <span className="flex items-center text-lg font-bold tracking-tight text-ink">
                e-darischi
                <span className="ml-1.5 rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[color:var(--brand-strong)]">
                  LMS
                </span>
              </span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-ink-faint sm:block">
                {"Toshkent, O'zbekiston"}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-muted lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="group relative py-1 transition-colors hover:text-ink"
              >
                {link.label}
                <span className="absolute -bottom-0.5 left-0 h-px w-0 bg-[color:var(--brand-solid)] transition-all duration-300 group-hover:w-full" />
              </a>
            ))}
          </nav>

          {/* Right Controls */}
          <div className="hidden items-center gap-2 sm:flex">
            <LangSwitcher currentLocale={locale} />
            <ThemeToggle locale={locale} />

            <Link
              href="/login"
              className="rounded-xl px-3 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-[color:var(--paper-2)] hover:text-ink"
            >
              {t.header.login}
            </Link>

            <AnimatedButton
              size="sm"
              variant="primary"
              onClick={onOpenLeadModal}
              className="!text-xs font-semibold"
            >
              <span>{t.header.startFree}</span>
              <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </AnimatedButton>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex items-center gap-2 lg:hidden">
            <LangSwitcher currentLocale={locale} />
            <ThemeToggle locale={locale} />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={t.header.menuToggle}
              className="rounded-xl p-2 text-ink-soft transition-colors hover:bg-[color:var(--paper-2)]"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="animate-fade-in border-b border-[color:var(--line)] bg-[color:var(--surface-a95)] px-6 py-5 shadow-xl backdrop-blur-xl lg:hidden">
          <nav className="flex flex-col space-y-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-xl px-3 py-2.5 text-base font-medium text-ink-soft transition-colors hover:bg-[color:var(--paper-2)] hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-2.5 border-t border-[color:var(--line)] pt-4">
            <Link
              href="/login"
              onClick={() => setMobileMenuOpen(false)}
              className="w-full rounded-xl bg-[color:var(--paper-2)] py-2.5 text-center text-sm font-semibold text-ink"
            >
              {t.header.login}
            </Link>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenLeadModal();
              }}
              className="public-btn w-full py-2.5 text-sm"
            >
              {t.header.startFree}
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
