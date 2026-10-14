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
    <SectionWrapper id="nega-biz" className="py-20 md:py-28 bg-white/60 border-y border-slate-200/80 font-strict">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
            {t.whyUs.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.whyUs.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
              {t.whyUs.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t.whyUs.subtitle}
          </p>
        </div>

        {/* 10 Features Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {t.whyUs.items.map((item, index) => {
            const IconComponent = iconMap[item.icon] || Zap;

            return (
              <motion.div
                key={item.id}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.45,
                  delay: shouldReduceMotion ? 0 : index * 0.05,
                  ease: "easeOut",
                }}
                whileHover={
                  shouldReduceMotion
                    ? {}
                    : {
                        y: -6,
                        transition: { duration: 0.2, ease: "easeOut" },
                      }
                }
                className="group relative rounded-3xl p-7 bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all duration-300"
              >
                {/* Micro accent glow on hover */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Icon box */}
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 shadow-xs">
                  <IconComponent className="w-6 h-6" />
                </div>

                {/* Card Title */}
                <h3 className="text-lg font-bold text-slate-900 mb-2.5 tracking-tight group-hover:text-blue-600 transition-colors">
                  {item.title}
                </h3>

                {/* Card Description */}
                <p className="text-sm text-slate-600 leading-relaxed">
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
