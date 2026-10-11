"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Smartphone,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  Award,
  BellRing,
  Download,
} from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface AppsSectionProps {
  locale: LandingLocale;
}

export const AppsSection: React.FC<AppsSectionProps> = ({ locale }) => {
  const t = getLandingMessages(locale);
  const [activeTab, setActiveTab] = useState<"student" | "teacher" | "parent">("student");

  const currentFeatures =
    activeTab === "student"
      ? t.apps.studentFeatures
      : activeTab === "teacher"
      ? t.apps.teacherFeatures
      : t.apps.parentFeatures;

  return (
    <SectionWrapper id="ilovalari" className="py-20 md:py-28 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-3">
            {t.apps.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            {t.apps.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-300">
              {t.apps.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
            {t.apps.subtitle}
          </p>

          {/* Role Tabs */}
          <div className="inline-flex p-1.5 mt-8 rounded-2xl bg-slate-100 dark:bg-[#13224D] border border-slate-200 dark:border-white/10 max-w-md mx-auto">
            <button
              onClick={() => setActiveTab("student")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                activeTab === "student"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:text-blue-600"
              }`}
            >
              {t.apps.tabs.student}
            </button>
            <button
              onClick={() => setActiveTab("teacher")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                activeTab === "teacher"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:text-blue-600"
              }`}
            >
              {t.apps.tabs.teacher}
            </button>
            <button
              onClick={() => setActiveTab("parent")}
              className={`px-4 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
                activeTab === "parent"
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-slate-600 dark:text-slate-300 hover:text-blue-600"
              }`}
            >
              {t.apps.tabs.parent}
            </button>
          </div>
        </div>

        {/* Content Showcase: CSS Phone Mockup + Features List */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* CSS Phone Mockup */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-[280px] sm:w-[310px] h-[580px] rounded-[48px] bg-slate-900 border-[10px] border-slate-800 dark:border-slate-700 shadow-2xl shadow-blue-600/20 overflow-hidden p-3.5">
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-5 rounded-full bg-slate-800 z-30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                <div className="w-10 h-1 rounded-full bg-slate-700" />
              </div>

              {/* Screen Content */}
              <div className="w-full h-full rounded-[36px] bg-[#0A1128] text-white pt-8 px-4 pb-4 flex flex-col justify-between overflow-hidden">
                {/* App Top Bar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-xs font-bold">
                        eD
                      </div>
                      <span className="text-xs font-bold tracking-tight">e-darschi</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                  </div>

                  <div className="p-3 rounded-2xl bg-white/5 border border-white/10 mb-3">
                    <span className="text-[10px] text-blue-400 uppercase tracking-wider font-semibold">
                      {activeTab === "student"
                        ? "O'quvchi profili"
                        : activeTab === "teacher"
                        ? "O'qituvchi jurnali"
                        : "Ota-ona kabineti"}
                    </span>
                    <h4 className="text-sm font-bold mt-0.5">
                      {activeTab === "student"
                        ? "Jahongir Aliyev"
                        : activeTab === "teacher"
                        ? "Dilshod Bekmurodov"
                        : "Madina Aliyeva"}
                    </h4>
                    <p className="text-[10px] text-slate-400">Tashkent Academy • Group A-1</p>
                  </div>

                  {/* Dynamic Tab Cards inside Phone */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-2.5"
                    >
                      {activeTab === "student" && (
                        <>
                          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-400" />
                              <span className="text-xs">Navbatdagi dars</span>
                            </div>
                            <span className="text-xs font-bold text-blue-300">14:00</span>
                          </div>
                          <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-400" />
                              <span className="text-xs">{"O'rtacha GPA"}</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-300">4.8 / 5.0</span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs">Davomat</span>
                            </div>
                            <span className="text-xs font-bold text-emerald-300">98%</span>
                          </div>
                        </>
                      )}

                      {activeTab === "teacher" && (
                        <>
                          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">Bugungi darslar</span>
                            <span className="text-xs font-bold text-blue-300">4 ta guruh</span>
                          </div>
                          <div className="p-3 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">Tekshirishga ДЗ</span>
                            <span className="text-xs font-bold text-amber-300">8 ta yangi</span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">Barcha davomat</span>
                            <span className="text-xs font-bold text-emerald-300">{"To'liq"}</span>
                          </div>
                        </>
                      )}

                      {activeTab === "parent" && (
                        <>
                          <div className="p-3 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">Farzand davomati</span>
                            <span className="text-xs font-bold text-emerald-400">Hamma darsda bor</span>
                          </div>
                          <div className="p-3 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">Oxirgi baho</span>
                            <span className="text-xs font-bold text-indigo-300">A (95 ball)</span>
                          </div>
                          <div className="p-3 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-between">
                            <span className="text-xs font-medium">{"To'lov holati"}</span>
                            <span className="text-xs font-bold text-emerald-400">{"To'langan"}</span>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Bottom App Bar */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-around text-slate-400 text-xs">
                  <div className="text-blue-400 font-bold">Asosiy</div>
                  <div>Jadval</div>
                  <div>Baholar</div>
                  <div>Profil</div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Column & App Download Badges */}
          <div className="lg:col-span-7">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white mb-6">
              {activeTab === "student"
                ? locale === "uz"
                  ? "O'quvchilar uchun motivatsiya va nazorat"
                  : "Мотивация и контроль для учеников"
                : activeTab === "teacher"
                ? locale === "uz"
                  ? "O'qituvchilar vaqtini 2 barobar tejash"
                  : "Экономия времени преподавателей в 2 раза"
                : locale === "uz"
                ? "Ota-onalar xotirjamligi va to'liq ochiqlik"
                : "Спокойствие родителей и прозрачность"}
            </h3>

            {/* Features check-list */}
            <div className="space-y-4 mb-8">
              {currentFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-base text-slate-700 dark:text-slate-200 font-medium">
                    {feat}
                  </span>
                </div>
              ))}
            </div>

            {/* App Store & Google Play buttons */}
            <div className="p-5 rounded-2xl bg-blue-50 dark:bg-[#13224D]/60 border border-blue-200/60 dark:border-white/10">
              <p className="text-xs text-slate-600 dark:text-slate-300 mb-4">
                {t.apps.downloadPrompt}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400">Download on</div>
                    <div className="text-xs font-bold leading-tight">App Store</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400">Get it on</div>
                    <div className="text-xs font-bold leading-tight">Google Play</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};
