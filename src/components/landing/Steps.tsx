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
    <SectionWrapper id="qanday-boshlash" className="py-20 md:py-28 font-strict">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 md:mb-20">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
            {t.steps.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.steps.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
              {t.steps.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t.steps.subtitle}
          </p>
        </div>

        {/* 3 Steps Horizontal Timeline */}
        <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Connecting Line for desktop */}
          <div
            className="hidden md:block absolute top-1/2 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-blue-500/20 via-indigo-500/30 to-blue-500/20 -translate-y-8 pointer-events-none"
            aria-hidden="true"
          />

          {t.steps.items.map((stepItem, idx) => {
            const Icon = stepIcons[idx] || Rocket;

            return (
              <motion.div
                key={stepItem.step}
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: shouldReduceMotion ? 0.1 : 0.45,
                  delay: shouldReduceMotion ? 0 : idx * 0.1,
                  ease: "easeOut",
                }}
                className="relative rounded-3xl p-8 bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:shadow-blue-500/10 hover:border-blue-300 transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Step Number & Icon */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                      <Icon className="w-7 h-7" />
                    </div>

                    <span className="text-3xl font-black text-slate-200 select-none">
                      0{stepItem.step}
                    </span>
                  </div>

                  {/* Title & Badge */}
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">
                      {stepItem.title}
                    </h3>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed mb-6">
                    {stepItem.description}
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-600">
                    {stepItem.highlight}
                  </span>
                  {idx === 0 && (
                    <button
                      onClick={onOpenLeadModal}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{locale === "uz" ? "Ariza" : "Заявка"}</span>
                      <ArrowRight className="w-3 h-3" />
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
