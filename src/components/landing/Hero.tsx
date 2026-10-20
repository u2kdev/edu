"use client";

import React from "react";
import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { AnimatedButton } from "./AnimatedButton";

interface HeroProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

/**
 * Deliberately sparse hero: one message, one action, one product window.
 * Every extra chip, badge row and floating card was removed on purpose — the
 * security story lives in one quiet line, the rest is carried by the sections
 * below.
 */
export const Hero: React.FC<HeroProps> = ({ locale, onOpenLeadModal }) => {
  const t = getLandingMessages(locale);

  const trustTitles = [
    t.hero.trust.isolation.title,
    t.hero.trust.roles.title,
    t.hero.trust.audit.title,
  ];

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[color:var(--grad-base)] via-[color:var(--grad-e)] to-[color:var(--grad-c)] pb-20 pt-14 font-strict md:pb-28 md:pt-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-12 lg:gap-16">
          {/* Left: message and actions */}
          <div className="text-center lg:col-span-6 lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
              className="public-eyebrow mb-6"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{t.hero.badge}</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="mb-5 text-balance text-[2.5rem] font-bold leading-[1.06] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[3.4rem]"
            >
              {t.hero.title}{" "}
              <span className="text-[color:var(--brand)]">{t.hero.titleHighlight}</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
              className="mx-auto mb-8 max-w-lg text-pretty text-base leading-relaxed text-ink-muted sm:text-lg lg:mx-0"
            >
              {t.hero.subtitle}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-7 lg:justify-start"
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
                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition-colors hover:text-[color:var(--brand)]"
              >
                <span>{locale === "uz" ? "Imkoniyatlar" : "Возможности"}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.32, ease: EASE }}
              className="mt-10 text-xs font-medium tracking-[0.02em] text-ink-faint"
            >
              {trustTitles.map((title, index) => (
                <React.Fragment key={title}>
                  {index > 0 && <span aria-hidden="true"> · </span>}
                  <span>{title}</span>
                </React.Fragment>
              ))}
            </motion.p>
          </div>

          {/* Right: a single, calm product window */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.18, ease: EASE }}
            className="lg:col-span-6"
          >
            <div className="rounded-[24px] bg-[color:var(--surface)] p-2 shadow-[0_32px_80px_-48px_rgba(16,24,40,0.38)] ring-1 ring-[color:var(--line)]">
              <div className="overflow-hidden rounded-[18px] border border-[color:var(--line)]">
                <div className="flex items-center gap-2 border-b border-[color:var(--line)] bg-[color:var(--paper-2-a80)] px-4 py-3">
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[color:var(--line-strong)]" />
                  <span className="ml-2 text-xs font-semibold text-ink-soft">
                    e-darischi LMS
                  </span>
                </div>

                <div className="relative aspect-[16/10] w-full overflow-hidden bg-[color:var(--paper-2)]">
                  <img
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                    alt="e-darischi o'quv markazida talabalar va o'qituvchilar interaktiv ta'lim jarayoni"
                    className="h-full w-full object-cover object-center"
                    loading="eager"
                  />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
