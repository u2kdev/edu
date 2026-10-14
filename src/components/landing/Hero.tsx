"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Database,
  Lock,
  Shield,
  Layers,
  GraduationCap,
  Calendar,
  Award,
} from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { AnimatedButton } from "./AnimatedButton";

interface HeroProps {
  locale: LandingLocale;
  onOpenLeadModal: () => void;
}

export const Hero: React.FC<HeroProps> = ({
  locale,
  onOpenLeadModal,
}) => {
  const t = getLandingMessages(locale);

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

            {/* CTA Button */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10"
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
            </motion.div>

            {/* Trust Block: Architecture, Data Isolation & Role Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.4 }}
              className="pt-8 border-t border-slate-200 dark:border-white/10 max-w-xl mx-auto lg:mx-0"
            >
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {t.hero.trust.badge}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white mb-1">
                    <Database className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span>{t.hero.trust.isolation.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {t.hero.trust.isolation.description}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white mb-1">
                    <Lock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    <span>{t.hero.trust.roles.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {t.hero.trust.roles.description}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/80 dark:border-white/10">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 dark:text-white mb-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{t.hero.trust.audit.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {t.hero.trust.audit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Platform Showcase Card with Capability Modules */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.85, delay: 0.2 }}
            className="lg:col-span-5 relative"
          >
            {/* Glowing Accent Border */}
            <div className="relative rounded-3xl p-1 bg-gradient-to-tr from-blue-600 via-indigo-500 to-cyan-400 shadow-glow-lg">
              <div className="relative rounded-[22px] overflow-hidden bg-[#0A1128] aspect-[4/3] sm:aspect-[16/10] flex flex-col justify-between p-6">
                {/* Header Bar */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                    <span className="text-xs font-semibold text-white/80 ml-2">e-darschi LMS</span>
                  </div>
                  <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-medium text-emerald-400">
                    <ShieldCheck className="w-3 h-3" />
                    <span>{locale === "uz" ? "Xavfsiz tezant" : "Изолированный тенант"}</span>
                  </div>
                </div>

                {/* Modules Grid */}
                <div className="grid grid-cols-2 gap-3 my-4">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-blue-400 mb-1.5">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">{locale === "uz" ? "Dars jadvali" : "Расписание"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{locale === "uz" ? "Xonalar va o'qituvchilar filtri" : "Контроль аудиторий и смен"}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-indigo-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-indigo-400 mb-1.5">
                      <GraduationCap className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">{locale === "uz" ? "Davomat va Jurnal" : "Посещаемость"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{locale === "uz" ? "Tezkor QR va belgilash" : "Отметка за 5 секунд"}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-emerald-400 mb-1.5">
                      <Award className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">{locale === "uz" ? "Baholash tizimi" : "Журнал оценок"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{locale === "uz" ? "Final baholar blokirovkasi" : "Фиксация и аудит оценок"}</div>
                  </div>

                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center gap-2 text-cyan-400 mb-1.5">
                      <Layers className="w-4 h-4" />
                      <span className="text-xs font-bold text-white">{locale === "uz" ? "Guruhlar boshqaruvi" : "Группы и курсы"}</span>
                    </div>
                    <div className="text-[10px] text-slate-400">{locale === "uz" ? "Talabalar o'tkazmasi" : "Переводы и лимиты"}</div>
                  </div>
                </div>

                {/* Footer status */}
                <div className="flex items-center justify-between pt-2 border-t border-white/10 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {locale === "uz" ? "Tizim to'liq tayyor" : "Система активна"}
                  </span>
                  <span>{locale === "uz" ? "100% Ma'lumotlar xavfsizligi" : "100% Защита данных"}</span>
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
