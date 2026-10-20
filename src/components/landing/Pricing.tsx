"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages, formatPrice } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";
import { AnimatedButton } from "./AnimatedButton";

interface PricingProps {
  locale: LandingLocale;
  onSelectPlan: (planId: string) => void;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const Pricing: React.FC<PricingProps> = ({ locale, onSelectPlan }) => {
  const t = getLandingMessages(locale);
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionWrapper
      id="tariflar"
      className="relative overflow-hidden bg-gradient-to-b from-[color:var(--grad-b)] via-[color:var(--grad-f)] to-[color:var(--grad-a)] py-20 font-strict md:py-28"
    >
      {/* Ambient background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-24 h-80 w-80 rounded-full bg-[color:var(--brand-a10)] blur-[120px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 bottom-10 h-96 w-96 rounded-full bg-[color:var(--brand-a08)] blur-[130px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header with 14-days free badge */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="public-eyebrow mb-5">
            <Sparkles className="h-3.5 w-3.5" />
            <span>{t.pricing.headerNote}</span>
          </div>

          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl">
            {t.pricing.title}{" "}
            <span className="text-[color:var(--brand)]">{t.pricing.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.pricing.subtitle}
          </p>
        </div>

        {/* Rental Cards */}
        <div className="grid grid-cols-1 items-stretch gap-6 pt-4 lg:grid-cols-3 lg:gap-8">
          {t.pricing.plans.map((plan, index) => {
            const isPopular = plan.isPopular;

            return (
              <motion.div
                key={plan.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 26 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.55,
                  delay: shouldReduceMotion ? 0 : index * 0.08,
                  ease: EASE,
                }}
                whileHover={shouldReduceMotion ? undefined : { y: -8 }}
                className="group relative isolate h-full"
              >
                {/* Pulsing outer glow for the popular plan */}
                {isPopular && !shouldReduceMotion && (
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-2 -z-10 rounded-[2rem] bg-gradient-to-b from-[color:var(--brand-a30)] to-transparent blur-xl"
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}

                <div
                  className={`relative flex h-full flex-col justify-between overflow-hidden rounded-3xl bg-[color:var(--surface)] p-7 transition-shadow duration-300 sm:p-8 ${
                    isPopular
                      ? "shadow-[0_1px_2px_rgba(16,24,40,0.05),0_40px_80px_-34px_rgba(29,78,216,0.5)] lg:-translate-y-4"
                      : "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_18px_48px_-26px_rgba(16,24,40,0.28)] group-hover:shadow-[0_1px_2px_rgba(16,24,40,0.05),0_34px_70px_-30px_rgba(29,78,216,0.35)]"
                  }`}
                >
                  {/* Gradient border ring */}
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none absolute inset-0 rounded-3xl transition-colors duration-300 ${
                      isPopular
                        ? "ring-1 ring-inset ring-[color:var(--brand-a40)]"
                        : "ring-1 ring-inset ring-[color:var(--line)] group-hover:ring-[color:var(--brand-a35)]"
                    }`}
                  />

                  {/* Hover spotlight */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                    style={{
                      background:
                        "radial-gradient(420px circle at 50% 0%, rgba(29,78,216,0.10), transparent 70%)",
                    }}
                  />

                  {/* Popular top accent line */}
                  {isPopular && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--brand)] to-transparent"
                    />
                  )}

                  <div className="relative">
                    {/* Header: Name and Badge */}
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="text-2xl font-bold tracking-tight text-ink">{plan.name}</h3>
                      {isPopular && (
                        <span className="relative overflow-hidden rounded-full bg-[color:var(--brand-solid)] px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white">
                          {t.pricing.popular}
                          {!shouldReduceMotion && (
                            <motion.span
                              aria-hidden="true"
                              className="absolute inset-y-0 w-10 bg-white/30 blur-sm"
                              initial={{ x: "-140%" }}
                              animate={{ x: "260%" }}
                              transition={{
                                duration: 2.6,
                                repeat: Infinity,
                                repeatDelay: 1.4,
                                ease: "easeInOut",
                              }}
                            />
                          )}
                        </span>
                      )}
                    </div>

                    <p className="mb-6 min-h-[32px] text-xs leading-relaxed text-ink-muted">
                      {plan.description}
                    </p>

                    {/* Price */}
                    <div className="mb-7 border-b border-[color:var(--line)] pb-7">
                      <div className="flex items-baseline gap-1.5">
                        <span
                          className={`public-tabular text-3xl font-bold tracking-tight sm:text-4xl ${
                            isPopular ? "text-[color:var(--brand)]" : "text-ink"
                          }`}
                        >
                          {formatPrice(plan.price, locale)}
                        </span>
                        <span className="text-xs font-semibold text-ink-faint">
                          / {t.pricing.perMonth}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="mb-8 space-y-3.5">
                      {plan.features.map((feature, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-2.5 text-xs text-ink-soft sm:text-sm"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[color:var(--line)] bg-[color:var(--brand-soft)] text-[color:var(--brand)] transition-transform duration-300 group-hover:scale-110">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="relative pt-2">
                    <AnimatedButton
                      variant={isPopular ? "gradient" : "secondary"}
                      onClick={() => onSelectPlan(plan.id)}
                      className="w-full py-3"
                    >
                      <span>{t.pricing.tryFree}</span>
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </AnimatedButton>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};
