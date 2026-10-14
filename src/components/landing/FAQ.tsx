"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, HelpCircle } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface FAQProps {
  locale: LandingLocale;
}

export const FAQ: React.FC<FAQProps> = ({ locale }) => {
  const t = getLandingMessages(locale);
  const [openId, setOpenId] = useState<string | null>("faq1");

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <SectionWrapper id="faq" className="py-20 md:py-28 font-strict">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
            {t.faq.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.faq.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
              {t.faq.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t.faq.subtitle}
          </p>
        </div>

        {/* 6 FAQ Accordion Items */}
        <div className="space-y-4">
          {t.faq.items.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all duration-300 overflow-hidden ${
                  isOpen
                    ? "bg-white border-blue-500/50 shadow-md shadow-blue-500/5"
                    : "bg-white/90 border-slate-200/90 hover:border-blue-300 shadow-xs"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 focus:outline-none cursor-pointer"
                >
                  <span className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <HelpCircle className="w-5 h-5 text-blue-600 shrink-0" />
                    <span>{item.question}</span>
                  </span>

                  <ChevronDown
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 shrink-0 ${
                      isOpen ? "rotate-180 text-blue-600" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base text-slate-600 leading-relaxed border-t border-slate-100">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </SectionWrapper>
  );
};
