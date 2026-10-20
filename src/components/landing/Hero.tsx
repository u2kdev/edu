"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Database,
  Lock,
  Shield,
  Calendar,
  Award,
  TrendingUp,
  CreditCard,
  GraduationCap,
} from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { AnimatedButton } from "./AnimatedButton";

interface HeroProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const Hero: React.FC<HeroProps> = ({ locale, onOpenLeadModal }) => {
  const t = getLandingMessages(locale);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[color:var(--grad-base)] via-[color:var(--grad-e)] to-[color:var(--grad-c)] pb-24 pt-14 font-strict md:pb-32 md:pt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-12">
          {/* Left Column: Hero Copy & Actions */}
          <div className="text-center lg:col-span-6 lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="public-eyebrow mb-7"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t.hero.badge}</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="mb-6 text-balance text-[2.6rem] font-bold leading-[1.04] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.5rem]"
            >
              {t.hero.title}{" "}
              <span className="relative inline-block text-[color:var(--brand)]">
                {t.hero.titleHighlight}
                <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-[color:var(--brand-a20)]" />
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
              className="mx-auto mb-9 max-w-xl text-pretty text-base leading-relaxed text-ink-muted sm:text-lg lg:mx-0"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
              className="mb-12 flex flex-col items-center justify-center gap-3 sm:flex-row lg:justify-start"
            >
              <AnimatedButton
                size="lg"
                variant="primary"
                onClick={onOpenLeadModal}
                className="w-full sm:w-auto"
              >
                <span>{t.hero.ctaStart}</span>
                <ArrowRight className="ml-1 h-4 w-4" />
              </AnimatedButton>

              <a
                href="#ilovalari"
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[color:var(--line-strong)] bg-[color:var(--surface)] px-6 py-3.5 text-sm font-semibold text-ink-soft transition-all duration-200 hover:border-[color:var(--brand-a50)] hover:text-ink active:scale-[0.98] sm:w-auto"
              >
                <span>{locale === "uz" ? "Platforma imkoniyatlari" : "Возможности платформы"}</span>
              </a>
            </motion.div>

            {/* Trust Block: Architecture, Data Isolation & Role Security */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.32, ease: EASE }}
              className="mx-auto max-w-xl border-t border-[color:var(--line)] pt-8 lg:mx-0"
            >
              <div className="mb-4 flex items-center justify-center gap-2 lg:justify-start">
                <ShieldCheck className="h-4 w-4 text-[color:var(--brand)]" />
                <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-faint">
                  {t.hero.trust.badge}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-3">
                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-a70)] p-4 transition-colors hover:border-[color:var(--brand-a30)]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Database className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand)]" />
                    <span>{t.hero.trust.isolation.title}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-ink-muted">
                    {t.hero.trust.isolation.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-a70)] p-4 transition-colors hover:border-[color:var(--brand-a30)]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Lock className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand)]" />
                    <span>{t.hero.trust.roles.title}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-ink-muted">
                    {t.hero.trust.roles.description}
                  </p>
                </div>

                <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-a70)] p-4 transition-colors hover:border-[color:var(--brand-a30)]">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink">
                    <Shield className="h-3.5 w-3.5 shrink-0 text-[color:var(--brand)]" />
                    <span>{t.hero.trust.audit.title}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-ink-muted">
                    {t.hero.trust.audit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Application Preview & Floating Metric Cards */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
            className="relative lg:col-span-6"
          >
            {/* Soft single-hue glow behind the preview */}
            <div
              aria-hidden="true"
              className="absolute -inset-6 -z-0 rounded-[36px] bg-gradient-to-br from-blue-600/12 via-transparent to-transparent blur-2xl"
            />

            <div className="relative rounded-[28px] bg-[color:var(--surface)] p-2.5 shadow-[0_40px_90px_-40px_rgba(16,24,40,0.45)] ring-1 ring-[color:var(--line-strong)]">
              <div className="relative overflow-hidden rounded-[20px] border border-[color:var(--line)] bg-[color:var(--surface)]">
                {/* Window top bar */}
                <div className="flex items-center justify-between border-b border-[color:var(--line)] bg-[color:var(--paper-2-a80)] px-4 py-3 backdrop-blur-sm">
                  <div className="flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                    <div className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                    <span className="ml-2 text-xs font-semibold text-ink-soft">e-darischi LMS • Toshkent</span>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-[color:var(--success-line)] bg-[color:var(--success-soft)] px-2.5 py-0.5 text-[11px] font-semibold text-[color:var(--success)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span>{locale === "uz" ? "Jonli tizim" : "Система онлайн"}</span>
                  </div>
                </div>

                {/* Photo Element: Modern Collaborative Education with Students */}
                <div className="relative h-64 w-full overflow-hidden bg-[color:var(--paper-2)] sm:h-80">
                  <img
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                    alt="e-darischi o'quv markazida talabalar va o'qituvchilar interaktiv ta'lim jarayoni"
                    className="h-full w-full object-cover object-center"
                    loading="eager"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/5 to-transparent" />

                  <div className="absolute inset-x-4 bottom-3 flex items-center justify-between text-xs text-white">
                    <div className="flex items-center gap-2 rounded-xl border border-white/15 bg-slate-950/70 px-3 py-1.5 backdrop-blur-md">
                      <GraduationCap className="h-4 w-4 text-blue-300" />
                      <span className="font-semibold">
                        {locale === "uz" ? "IELTS & IT Bo'limi" : "Факультет Языков и IT"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 rounded-xl bg-[color:var(--surface-a95)] px-3 py-1.5 font-bold text-ink shadow-sm">
                      <TrendingUp className="h-3.5 w-3.5 text-[color:var(--success)]" />
                      <span>+34% {locale === "uz" ? "O'sish" : "Прирост"}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-card live modules showcase */}
                <div className="grid grid-cols-2 gap-3 border-t border-[color:var(--line)] bg-[color:var(--surface)] p-4 sm:p-5">
                  <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2-a70)] p-3.5 transition-colors hover:border-[color:var(--brand-a30)]">
                    <div className="mb-1 flex items-center gap-2 text-[color:var(--brand)]">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs font-bold text-ink">
                        {locale === "uz" ? "Aqlli jadval" : "Умное расписание"}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      {locale === "uz" ? "4-xona • 14:00" : "Аудитория 4 • 14:00"}
                    </div>
                  </div>

                  <div className="rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2-a70)] p-3.5 transition-colors hover:border-[color:var(--brand-a30)]">
                    <div className="mb-1 flex items-center gap-2 text-[color:var(--brand)]">
                      <Award className="h-4 w-4" />
                      <span className="text-xs font-bold text-ink">
                        {locale === "uz" ? "Davomat va Jurnal" : "Посещаемость"}
                      </span>
                    </div>
                    <div className="text-[11px] text-ink-muted">
                      {locale === "uz" ? "24/25 o'quvchi darsda" : "96% явка сегодня"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating card: live attendance with real photo avatars */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="absolute -bottom-6 -left-4 z-20 hidden items-center gap-3.5 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-a95)] p-4 shadow-[0_24px_60px_-28px_rgba(16,24,40,0.5)] backdrop-blur-md sm:flex lg:-left-8"
            >
              <div className="flex -space-x-2.5 overflow-hidden">
                <img
                  className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-[color:var(--surface)]"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
                  alt="Aziza"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-[color:var(--surface)]"
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=160&q=80"
                  alt="Jamshid"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full object-cover ring-2 ring-[color:var(--surface)]"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80"
                  alt="Bekzod"
                />
              </div>

              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-ink">
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--success)]" />
                  <span className="public-tabular">
                    {locale === "uz" ? "98.4% Davomat" : "98.4% Посещаемость"}
                  </span>
                </div>
                <div className="text-[11px] text-ink-muted">
                  {locale === "uz" ? "QR orqali tasdiqlandi" : "Подтверждено по QR"}
                </div>
              </div>
            </motion.div>

            {/* Floating card: quick billing */}
            <motion.div
              initial={{ opacity: 0, y: -18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5, ease: EASE }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="absolute -right-4 -top-6 z-20 hidden items-center gap-3 rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface-a95)] p-3.5 shadow-[0_24px_60px_-28px_rgba(16,24,40,0.5)] backdrop-blur-md sm:flex lg:-right-8"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                <CreditCard className="h-5 w-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-ink">Payme &amp; Click &amp; Uzum</div>
                <div className="flex items-center gap-1 text-[11px] font-semibold text-[color:var(--success)]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  <span>{locale === "uz" ? "1-klikda to'lov" : "Оплата в 1 клик"}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
