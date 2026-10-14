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
    <SectionWrapper id="tariflar" className="py-20 md:py-28 bg-white/70 border-y border-slate-200/80 font-strict">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with 14-days free badge */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold uppercase tracking-wider mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.pricing.headerNote}</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.pricing.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
              {t.pricing.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
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
                    ? "lg:-translate-y-4 p-1 bg-gradient-to-b from-blue-600 via-indigo-600 to-blue-700 shadow-xl shadow-blue-500/20"
                    : "p-7 bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-blue-300"
                }`}
              >
                {/* Popular card inner container */}
                <div
                  className={`flex flex-col justify-between h-full rounded-[22px] ${
                    isPopular ? "bg-white p-7 sm:p-8" : ""
                  }`}
                >
                  <div>
                    {/* Header: Name and Badge */}
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                        {plan.name}
                      </h3>
                      {isPopular && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-600 text-white shadow-xs uppercase tracking-wider">
                          {t.pricing.popular}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-500 mb-6 min-h-[32px]">
                      {plan.description}
                    </p>

                    {/* Price in UZS with Intl.NumberFormat */}
                    <div className="mb-7 pb-7 border-b border-slate-100">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
                          {formatPrice(plan.price, locale)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">
                          / {t.pricing.perMonth}
                        </span>
                      </div>
                    </div>

                    {/* Features list */}
                    <div className="space-y-3.5 mb-8">
                      {plan.features.map((feature, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                          <div className="w-5 h-5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5">
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
