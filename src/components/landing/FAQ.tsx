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
    <SectionWrapper
      id="faq"
      className="bg-gradient-to-b from-[color:var(--grad-c)] to-[color:var(--grad-a)] py-20 font-strict md:py-28"
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-16 text-center">
          <span className="public-eyebrow mb-5">{t.faq.badge}</span>
          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl">
            {t.faq.title}{" "}
            <span className="text-[color:var(--brand)]">{t.faq.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.faq.subtitle}
          </p>
        </div>

        {/* FAQ Accordion Items */}
        <div className="space-y-3">
          {t.faq.items.map((item) => {
            const isOpen = openId === item.id;

            return (
              <div
                key={item.id}
                className={`overflow-hidden rounded-2xl border bg-[color:var(--surface)] transition-all duration-300 ${
                  isOpen
                    ? "border-[color:var(--brand-a40)] shadow-[0_1px_2px_rgba(16,24,40,0.05),0_20px_50px_-30px_rgba(29,78,216,0.35)]"
                    : "border-[color:var(--line)] hover:border-[color:var(--brand-a30)]"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(item.id)}
                  aria-expanded={isOpen}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 p-5 text-left focus:outline-none sm:p-6"
                >
                  <span className="flex items-center gap-3 text-base font-bold tracking-tight text-ink sm:text-lg">
                    <HelpCircle className="h-5 w-5 shrink-0 text-[color:var(--brand)]" />
                    <span>{item.question}</span>
                  </span>

                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-ink-faint transition-transform duration-300 ${
                      isOpen ? "rotate-180 text-[color:var(--brand)]" : ""
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                    >
                      <div className="border-t border-[color:var(--line)] px-5 pb-6 pt-4 text-sm leading-relaxed text-ink-muted sm:px-6 sm:text-base">
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
