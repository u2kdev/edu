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
  TrendingUp,
  CreditCard,
  Users,
  Check,
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
    <section className="relative pt-12 pb-24 md:pt-20 md:pb-32 overflow-hidden font-strict">
      {/* Background Soft Mesh Ambient Lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[850px] h-[850px] bg-gradient-to-tr from-blue-400/20 via-indigo-300/15 to-transparent blur-[140px] rounded-full pointer-events-none -z-10" />
      <div className="absolute top-1/3 right-5 w-[500px] h-[500px] bg-gradient-to-bl from-teal-400/15 via-blue-300/15 to-transparent blur-[120px] rounded-full pointer-events-none -z-10" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
          {/* Left Column: Hero Copy & Actions */}
          <div className="lg:col-span-6 text-center lg:text-left">
            {/* 14 Days Free Badge */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80 text-xs font-bold uppercase tracking-wider mb-6 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>{t.hero.badge}</span>
            </motion.div>

            {/* Main Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
              className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight text-slate-900 leading-[1.12] mb-6"
            >
              {t.hero.title}{" "}
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
                {t.hero.titleHighlight}
              </span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
              className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto lg:mx-0 leading-relaxed mb-8"
            >
              {t.hero.subtitle}
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 mb-10"
            >
              <AnimatedButton
                size="lg"
                variant="gradient"
                glow
                onClick={onOpenLeadModal}
                className="w-full sm:w-auto shadow-lg shadow-blue-500/25 cursor-pointer"
              >
                <span>{t.hero.ctaStart}</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </AnimatedButton>

              <a
                href="#ilovalari"
                className="w-full sm:w-auto px-6 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold transition-all shadow-xs flex items-center justify-center gap-2 hover:border-slate-400 cursor-pointer active:scale-[0.98]"
              >
                <span>{locale === "uz" ? "Platforma imkoniyatlari" : "Возможности платформы"}</span>
              </a>
            </motion.div>

            {/* Trust Block: Architecture, Data Isolation & Role Security */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
              className="pt-8 border-t border-slate-200/90 max-w-xl mx-auto lg:mx-0"
            >
              <div className="flex items-center justify-center lg:justify-start gap-2 mb-4">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.hero.trust.badge}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-blue-300 transition-colors">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                    <Database className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>{t.hero.trust.isolation.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {t.hero.trust.isolation.description}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                    <Lock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>{t.hero.trust.roles.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {t.hero.trust.roles.description}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-xs hover:border-emerald-300 transition-colors">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-slate-900 mb-1">
                    <Shield className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{t.hero.trust.audit.title}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug">
                    {t.hero.trust.audit.description}
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Right Column: High-Res Photo Showcase & Tactile UI Floating Cards */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-6 relative"
          >
            {/* Background glowing frame */}
            <div className="relative rounded-3xl p-2.5 bg-gradient-to-tr from-blue-500/15 via-indigo-500/15 to-teal-400/15 shadow-2xl">
              <div className="relative rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xl">
                {/* Window top bar */}
                <div className="px-4 py-3 bg-slate-50/90 backdrop-blur-sm border-b border-slate-200/90 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-400/90" />
                    <div className="w-3 h-3 rounded-full bg-amber-400/90" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400/90" />
                    <span className="text-xs font-bold text-slate-700 ml-2">e-darischi LMS • Toshkent</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{locale === "uz" ? "Jonli tizim" : "Система онлайн"}</span>
                  </div>
                </div>

                {/* Photo Element: Modern Collaborative Education with Students */}
                <div className="relative h-64 sm:h-80 w-full overflow-hidden bg-slate-100">
                  <img
                    src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=1200&q=80"
                    alt="e-darischi o'quv markazida talabalar va o'qituvchilar interaktiv ta'lim jarayoni"
                    className="w-full h-full object-cover object-center transform hover:scale-105 transition-transform duration-700 ease-out"
                    loading="eager"
                  />
                  {/* Subtle photo gradient vignette */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent pointer-events-none" />

                  {/* Photo overlay badge */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between text-white text-xs">
                    <div className="flex items-center gap-2 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/20">
                      <GraduationCap className="w-4 h-4 text-blue-400" />
                      <span className="font-semibold">{locale === "uz" ? "IELTS & IT Bo'limi" : "Факультет Языков и IT"}</span>
                    </div>
                    <div className="bg-emerald-600/90 backdrop-blur-md px-3 py-1.5 rounded-xl font-bold flex items-center gap-1 shadow-sm">
                      <TrendingUp className="w-3.5 h-3.5" />
                      <span>+34% {locale === "uz" ? "O'sish" : "Прирост"}</span>
                    </div>
                  </div>
                </div>

                {/* Sub-card live modules showcase */}
                <div className="p-4 sm:p-5 bg-white grid grid-cols-2 gap-3 border-t border-slate-100">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-blue-300 transition-colors">
                    <div className="flex items-center gap-2 text-blue-600 mb-1">
                      <Calendar className="w-4 h-4" />
                      <span className="text-xs font-bold text-slate-800">{locale === "uz" ? "Aqlli jadval" : "Умное расписание"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{locale === "uz" ? "Afg'on xonasi • 14:00" : "Аудитория 4 • 14:00"}</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-emerald-300 transition-colors">
                    <div className="flex items-center gap-2 text-emerald-600 mb-1">
                      <Award className="w-4 h-4" />
                      <span className="text-xs font-bold text-slate-800">{locale === "uz" ? "Davomat va Jurnal" : "Посещаемость"}</span>
                    </div>
                    <div className="text-[11px] text-slate-500">{locale === "uz" ? "24/25 o'quvchi darsda" : "96% явка сегодня"}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Tactile Card 1: Live Student Attendance with Real Photo Avatars */}
            <motion.div
              initial={{ opacity: 0, x: -20, y: 20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.35, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="absolute -bottom-6 -left-6 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200/90 flex items-center gap-3.5 hidden sm:flex z-20"
            >
              {/* Stacked Real Avatar Photos */}
              <div className="flex -space-x-2.5 overflow-hidden">
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80"
                  alt="Aziza"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=160&q=80"
                  alt="Jamshid"
                />
                <img
                  className="inline-block h-9 w-9 rounded-full ring-2 ring-white object-cover"
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80"
                  alt="Bekzod"
                />
              </div>

              <div className="text-left">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{locale === "uz" ? "98.4% Davomat" : "98.4% Посещаемость"}</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {locale === "uz" ? "QR orqali tasdiqlandi" : "Подтверждено по QR"}
                </div>
              </div>
            </motion.div>

            {/* Floating Tactile Card 2: Quick Billing / Payment badge */}
            <motion.div
              initial={{ opacity: 0, x: 20, y: -20 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="absolute -top-6 -right-6 bg-white/95 backdrop-blur-md rounded-2xl p-3.5 shadow-xl border border-slate-200/90 flex items-center gap-3 hidden sm:flex z-20"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                <CreditCard className="w-5 h-5" />
              </div>
              <div className="text-left">
                <div className="text-xs font-bold text-slate-900">
                  Payme & Click & Uzum
                </div>
                <div className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>{locale === "uz" ? "1-klikda to'lov" : "Оплата в 1 клик"}</span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
