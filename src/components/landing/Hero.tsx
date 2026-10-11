"use client";

import React, { useState, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Play, Sparkles, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { AnimatedButton } from "./AnimatedButton";

interface HeroProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
  onOpenVideoModal: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  locale,
  onOpenLeadModal,
  onOpenVideoModal,
}) => {
  const t = getLandingMessages(locale);
  const shouldReduceMotion = useReducedMotion();

  // Animated counters
  const [centersCount, setCentersCount] = useState(0);
  const [studentsCount, setStudentsCount] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setCentersCount(t.hero.stats.centers.value);
      setStudentsCount(t.hero.stats.students.value);
      return;
    }

    const duration = 1800;
    const steps = 40;
    const intervalTime = duration / steps;
    let step = 0;

    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setCentersCount(Math.round(progress * t.hero.stats.centers.value));
      setStudentsCount(Math.round(progress * t.hero.stats.students.value));

      if (step >= steps) {
        clearInterval(timer);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [shouldReduceMotion, t.hero.stats.centers.value, t.hero.stats.students.value]);

  return (
    <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 overflow-hidden">
      {/* Background Floating Blurred Gradient Orbs */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/15 dark:bg-blue-600/10 blur-[130px] rounded-full pointer-events-none animate-float-slow -z-10" />
      <div className="absolute top-1/3 right-5 w-[400px] h-[400px] bg-indigo-500/10 dark:bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none -z-10" />

      {/* Subtle Grid overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-7 text-center lg:text-left">
            {/* 14 Days Free Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 border border-blue-500/30 text-xs font-semibold uppercase tracking-wider mb-6"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>{t.hero.badge}</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 dark:text-white leading-[1.12] mb-6"
            >
              {t.hero.title}{" "}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 dark:from-blue-400 dark:via-indigo-300 dark:to-blue-500">
                {t.hero.titleHighlight}
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-8"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-12"
            >
              <AnimatedButton
                size="lg"
                variant="gradient"
                glow
                onClick={onOpenLeadModal}
                className="w-full sm:w-auto"
              >
                <span>{t.hero.ctaStart}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </AnimatedButton>

              <AnimatedButton
                size="lg"
                variant="secondary"
                onClick={onOpenVideoModal}
                className="w-full sm:w-auto group"
              >
                <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center mr-1 group-hover:scale-110 transition-transform">
                  <Play className="w-3 h-3 fill-current ml-0.5" />
                </div>
                <span>{t.hero.ctaDemo}</span>
              </AnimatedButton>
            </motion.div>

            {/* Mini Stats with Animated Counters */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="grid grid-cols-3 gap-4 pt-8 border-t border-slate-200 dark:border-white/10 max-w-lg mx-auto lg:mx-0 text-left"
            >
              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {centersCount}
                  <span className="text-blue-600 dark:text-blue-400">
                    {t.hero.stats.centers.suffix}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.hero.stats.centers.label}
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {studentsCount.toLocaleString()}
                  <span className="text-blue-600 dark:text-blue-400">
                    {t.hero.stats.students.suffix}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.hero.stats.students.label}
                </div>
              </div>

              <div>
                <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                  {t.hero.stats.uptime.value}
                  <span className="text-blue-600 dark:text-blue-400">
                    {t.hero.stats.uptime.suffix}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.hero.stats.uptime.label}
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Video & Platform Showcase Card with Glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            {/* Glowing Accent Border */}
            <div className="relative rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 shadow-glow-lg">
              <div className="relative rounded-[22px] overflow-hidden bg-[#0A1128] aspect-[4/3] sm:aspect-[16/10] flex items-center justify-center group">
                {/* Visual poster / mock screen */}
                <div className="absolute inset-0 bg-gradient-to-b from-blue-950/40 via-[#0A1128]/80 to-[#0A1128] z-10" />

                {/* Simulated UI dashboard in hero frame */}
                <div className="absolute inset-0 p-5 z-0 opacity-70">
                  <div className="w-full h-8 rounded-lg bg-white/5 border border-white/10 flex items-center px-3 gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <div className="ml-3 h-3 w-40 rounded bg-white/10" />
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="h-16 rounded-xl bg-blue-600/20 border border-blue-500/30 p-2.5">
                      <div className="text-[10px] text-blue-300">{"O'quvchilar"}</div>
                      <div className="text-lg font-bold text-white">450+</div>
                    </div>
                    <div className="h-16 rounded-xl bg-indigo-600/20 border border-indigo-500/30 p-2.5">
                      <div className="text-[10px] text-indigo-300">Davomat</div>
                      <div className="text-lg font-bold text-white">96.4%</div>
                    </div>
                    <div className="h-16 rounded-xl bg-emerald-600/20 border border-emerald-500/30 p-2.5">
                      <div className="text-[10px] text-emerald-300">Tushum (UZS)</div>
                      <div className="text-lg font-bold text-white">42M+</div>
                    </div>
                  </div>
                  <div className="h-28 rounded-xl bg-white/5 border border-white/10 p-3">
                    <div className="h-3 w-28 bg-white/20 rounded mb-2" />
                    <div className="space-y-1.5">
                      <div className="h-2 w-full bg-blue-500/30 rounded" />
                      <div className="h-2 w-3/4 bg-blue-500/20 rounded" />
                      <div className="h-2 w-5/6 bg-blue-500/25 rounded" />
                    </div>
                  </div>
                </div>

                {/* Central Play Trigger Button */}
                <div className="relative z-20 text-center">
                  <button
                    onClick={onOpenVideoModal}
                    aria-label="Videoni ko'rish"
                    className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center shadow-2xl shadow-blue-500/50 group-hover:scale-110 transition-all duration-300 mx-auto mb-3"
                  >
                    <Play className="w-7 h-7 fill-current ml-1" />
                  </button>
                  <p className="text-xs font-medium text-white/90 drop-shadow-md">
                    {t.hero.videoCaption}
                  </p>
                </div>
              </div>
            </div>

            {/* Floating verification badge */}
            <div className="hidden sm:flex absolute -bottom-5 -left-5 bg-white dark:bg-[#13224D] rounded-2xl p-3.5 shadow-xl border border-blue-100 dark:border-white/10 items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900 dark:text-white">
                  Payme & Click & Uzum
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {locale === "uz" ? "Avtomatik to'lovlar integratsiyasi" : "Интеграция оплат в один клик"}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
