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
        <div className="mx-auto mb-16 max-w-3xl text-center md:mb-20">
          <span className="public-eyebrow mb-5">{t.whyUs.badge}</span>
          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl">
            {t.whyUs.title}{" "}
            <span className="text-[color:var(--brand)]">{t.whyUs.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.whyUs.subtitle}
          </p>
        </div>

        {/* 10 Features Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {t.whyUs.items.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Zap;

            return (
              <motion.div
                key={item.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.5,
                  delay: shouldReduceMotion ? 0 : Math.min(index * 0.05, 0.3),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="public-card public-card-hover group relative bg-[color:var(--surface)] p-7"
              >
                {/* Icon box */}
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl border border-[color:var(--line)] bg-[color:var(--brand-soft)] text-[color:var(--brand)] transition-colors duration-300 group-hover:border-[color:var(--brand)] group-hover:bg-[color:var(--brand-solid-hover)] group-hover:text-white">
                  <IconComponent className="h-6 w-6" />
                </div>

                {/* Card Title */}
                <h3 className="mb-2.5 text-lg font-bold tracking-tight text-ink">
                  {item.title}
                </h3>

                {/* Card Description */}
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
