"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Quote, ChevronLeft, ChevronRight, Star, Building2, MapPin } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface TestimonialsProps {
  locale: LandingLocale;
}

export const Testimonials: React.FC<TestimonialsProps> = ({ locale }) => {
  const t = getLandingMessages(locale);
  const [currentIndex, setCurrentIndex] = useState(0);

  const testimonials = t.testimonials.items;

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <SectionWrapper id="fikrlar" className="py-20 md:py-28 bg-[#F4F8FF]/60 dark:bg-[#0F1B3D]/50 border-y border-blue-100/60 dark:border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-3">
            {t.testimonials.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            {t.testimonials.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300">
              {t.testimonials.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.testimonials.subtitle}
          </p>
        </div>

        {/* Carousel Container */}
        <div className="max-w-4xl mx-auto relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.35 }}
              className="rounded-3xl p-8 sm:p-12 bg-white dark:bg-[#13224D] border border-blue-100 dark:border-white/10 shadow-xl relative"
            >
              <Quote className="w-12 h-12 text-blue-500/20 dark:text-blue-400/20 absolute top-8 right-8" />

              {/* Stars rating */}
              <div className="flex items-center gap-1 text-amber-400 mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-current" />
                ))}
              </div>

              {/* Quote text */}
              <blockquote className="text-lg sm:text-xl font-medium text-slate-800 dark:text-slate-100 leading-relaxed mb-8">
                &ldquo;{testimonials[currentIndex].quote}&rdquo;
              </blockquote>

              {/* Author info & Metric badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6 border-t border-slate-100 dark:border-white/10">
                <div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white">
                    {testimonials[currentIndex].author}
                  </h4>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{testimonials[currentIndex].role}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-medium">
                      <Building2 className="w-3 h-3" />
                      {testimonials[currentIndex].centerName}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {testimonials[currentIndex].city}
                    </span>
                  </div>
                </div>

                <div className="inline-flex items-center px-3.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold shrink-0">
                  {testimonials[currentIndex].metric}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Carousel Navigation Buttons */}
          <div className="flex items-center justify-center gap-3 mt-8">
            <button
              onClick={handlePrev}
              aria-label="Oldingi fikr"
              className="p-3 rounded-2xl bg-white dark:bg-[#13224D] border border-blue-200/60 dark:border-white/10 text-slate-700 dark:text-white hover:bg-blue-50 dark:hover:bg-[#1C326E] shadow-sm transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  aria-label={`Fikr ${i + 1}`}
                  className={`h-2.5 rounded-full transition-all ${
                    currentIndex === i
                      ? "w-8 bg-blue-600"
                      : "w-2.5 bg-slate-300 dark:bg-white/20 hover:bg-blue-400"
                  }`}
                />
              ))}
            </div>

            <button
              onClick={handleNext}
              aria-label="Keyingi fikr"
              className="p-3 rounded-2xl bg-white dark:bg-[#13224D] border border-blue-200/60 dark:border-white/10 text-slate-700 dark:text-white hover:bg-blue-50 dark:hover:bg-[#1C326E] shadow-sm transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};
