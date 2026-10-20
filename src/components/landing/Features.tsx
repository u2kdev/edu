"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  Smartphone,
  GraduationCap,
  UserCheck,
  Bell,
  CreditCard,
  BarChart3,
  Calendar,
  ShieldCheck,
  Headphones,
  Zap,
} from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface FeaturesProps {
  locale: LandingLocale;
}

const iconMap: Record<string, React.ElementType> = {
  Smartphone,
  GraduationCap,
  UserCheck,
  Bell,
  CreditCard,
  BarChart3,
  Calendar,
  ShieldCheck,
  Headphones,
  Zap,
};

/**
 * Six quiet text blocks instead of a wall of cards. The goal is scanability:
 * a visitor reads the headlines in one pass and only stops where it matters.
 */
export const Features: React.FC<FeaturesProps> = ({ locale }) => {
  const t = getLandingMessages(locale);
  const shouldReduceMotion = useReducedMotion();

  return (
    <SectionWrapper
      id="nega-biz"
      className="bg-gradient-to-b from-[color:var(--grad-c)] to-[color:var(--grad-a)] py-20 font-strict md:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-14 max-w-2xl md:mb-16">
          <span className="public-eyebrow mb-5">{t.whyUs.badge}</span>
          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-[2.75rem]">
            {t.whyUs.title}{" "}
            <span className="text-[color:var(--brand)]">{t.whyUs.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted">
            {t.whyUs.subtitle}
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {t.whyUs.items.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Zap;

            return (
              <motion.div
                key={item.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.5,
                  delay: shouldReduceMotion ? 0 : Math.min(index * 0.05, 0.25),
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <div className="mb-2.5 flex items-center gap-2.5 text-[color:var(--brand)]">
                  <IconComponent className="h-5 w-5 shrink-0" strokeWidth={1.75} />
                  <h3 className="text-base font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                </div>
                <p className="text-pretty text-sm leading-relaxed text-ink-muted">
                  {item.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};
