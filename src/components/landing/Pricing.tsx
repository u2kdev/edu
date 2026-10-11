"use client";

import React from "react";
import { Check, Sparkles, ArrowRight } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages, formatPrice } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";
import { AnimatedButton } from "./AnimatedButton";

interface PricingProps {
  locale: LandingLocale;
  onSelectPlan: (planId: string) => void;
}

export const Pricing: React.FC<PricingProps> = ({ locale, onSelectPlan }) => {
  const t = getLandingMessages(locale);

  return (
    <SectionWrapper id="tariflar" className="py-20 md:py-28 bg-[#F4F8FF]/60 dark:bg-[#0F1B3D]/50 border-y border-blue-100/60 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with 14-days free badge */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-bold uppercase tracking-wider mb-4">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>{t.pricing.headerNote}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            {t.pricing.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300">
              {t.pricing.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.pricing.subtitle}
          </p>
        </div>

        {/* 3 Rental Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch pt-4">
          {t.pricing.plans.map((plan) => {
            const isPopular = plan.isPopular;

            return (
              <div
                key={plan.id}
                className={`relative rounded-3xl flex flex-col justify-between transition-all duration-300 ${
                  isPopular
                    ? "lg:-translate-y-4 p-1 bg-gradient-to-b from-blue-600 via-indigo-600 to-blue-700 shadow-2xl shadow-blue-600/30 dark:shadow-glow-lg"
                    : "p-7 bg-white dark:bg-[#13224D] border border-blue-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:border-blue-400/40"
                }`}
              >
                {/* Popular card inner container */}
                <div
                  className={`flex flex-col justify-between h-full rounded-[22px] ${
                    isPopular ? "bg-white dark:bg-[#0A1128] p-7 sm:p-8" : ""
                  }`}
                >
                  <div>
                    {/* Header: Name and Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {plan.name}
                      </h3>
                      {isPopular && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-sm uppercase tracking-wider">
                          {t.pricing.popular}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 min-h-[32px]">
                      {plan.description}
                    </p>

                    {/* Price in UZS with Intl.NumberFormat */}
                    <div className="mb-7 pb-7 border-b border-slate-100 dark:border-white/10">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                          {formatPrice(plan.price, locale)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          / {t.pricing.perMonth}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3.5 mb-8">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200">
                          <div className="w-5 h-5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                          <span>{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* CTA Button */}
                  <div className="pt-2">
                    <AnimatedButton
                      variant={isPopular ? "gradient" : "secondary"}
                      glow={isPopular}
                      onClick={() => onSelectPlan(plan.id)}
                      className="w-full py-3"
                    >
                      <span>{t.pricing.tryFree}</span>
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </AnimatedButton>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};
