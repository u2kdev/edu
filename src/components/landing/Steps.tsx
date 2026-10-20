"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FileText, Settings, Rocket, ArrowRight } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface StepsProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
}

const stepIcons = [FileText, Settings, Rocket];

export const Steps: React.FC<StepsProps> = ({ locale, onOpenLeadModal }) => {
  const t = getLandingMessages(locale);
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionWrapper id="qanday-boshlash" className="bg-gradient-to-b from-[color:var(--grad-a)] to-[color:var(--grad-c)] py-20 font-strict md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
          <span className="public-eyebrow mb-5">{t.steps.badge}</span>
          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl">
            {t.steps.title}{" "}
            <span className="text-[color:var(--brand)]">{t.steps.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.steps.subtitle}
          </p>
        </div>

        {/* 3 Steps Horizontal Timeline */}
        <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          {/* Connecting Line for desktop */}
          <div
            className="pointer-events-none absolute left-[15%] right-[15%] top-[3.25rem] hidden h-px bg-gradient-to-r from-transparent via-[color:var(--brand-a25)] to-transparent md:block"
            aria-hidden="true"
          />

          {t.steps.items.map((stepItem, idx) => {
            const Icon = stepIcons[idx] || Rocket;

            return (
              <motion.div
                key={stepItem.step}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.5,
                  delay: shouldReduceMotion ? 0 : idx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="public-card public-card-hover relative flex flex-col justify-between bg-[color:var(--surface)] p-8"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="mb-6 flex items-center justify-between">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_12px_28px_-14px_rgba(29,78,216,0.9)]">
                      <Icon className="h-6 w-6" />
                    </div>

                    <span className="public-tabular select-none text-3xl font-bold text-[color:var(--line-strong)]">
                      0{stepItem.step}
                    </span>
                  </div>

                  {/* Title & Badge */}
                  <div className="mb-3 flex items-center gap-2">
                    <h3 className="text-xl font-bold tracking-tight text-ink">
                      {stepItem.title}
                    </h3>
                  </div>

                  <p className="mb-6 text-pretty text-sm leading-relaxed text-ink-muted">
                    {stepItem.description}
                  </p>
                </div>

                <div className="flex items-center justify-between border-t border-[color:var(--line)] pt-4">
                  <span className="text-xs font-semibold text-[color:var(--brand)]">
                    {stepItem.highlight}
                  </span>
                  {idx === 0 && (
                    <button
                      onClick={onOpenLeadModal}
                      className="flex cursor-pointer items-center gap-1 text-xs font-semibold text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)]"
                    >
                      <span>{locale === "uz" ? "Ariza" : "Заявка"}</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};
