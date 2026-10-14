"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  GraduationCap,
  Users,
  Calendar,
  Clock,
  Award,
  BellRing,
  Download,
  BookOpen,
  Check,
  ChevronRight,
  Sparkles,
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

  const roleAvatarMap = {
    student: {
      src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=160&q=80",
      name: locale === "uz" ? "Aziza Karimova" : "Азиза Каримова",
      role: locale === "uz" ? "Talaba • IELTS Guruhi" : "Студент • Группа IELTS",
    },
    teacher: {
      src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=160&q=80",
      name: locale === "uz" ? "Sardor Rahimov" : "Сардор Рахимов",
      role: locale === "uz" ? "Katta O'qituvchi • Matematika" : "Преподаватель • Высшая математика",
    },
    parent: {
      src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=160&q=80",
      name: locale === "uz" ? "Olim Qosimov" : "Олим Касымов",
      role: locale === "uz" ? "Ota-ona • 2 nafar farzand" : "Родитель • 2 ученика",
    },
  };

  return (
    <SectionWrapper id="ilovalari" className="py-20 md:py-28 overflow-hidden font-strict">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="inline-block px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 mb-3 shadow-xs">
            {t.apps.badge}
          </span>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight leading-tight mb-4">
            {t.apps.title}{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-indigo-600 to-teal-600">
              {t.apps.titleHighlight}
            </span>
          </h2>
          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            {t.apps.subtitle}
          </p>

          {/* Role Tabs */}
          <div className="inline-flex p-1.5 mt-8 rounded-2xl bg-white border border-slate-200 shadow-sm max-w-md mx-auto">
            <button
              onClick={() => setActiveTab("student")}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "student"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              {t.apps.tabs.student}
            </button>
            <button
              onClick={() => setActiveTab("teacher")}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "teacher"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
              }`}
            >
              {t.apps.tabs.teacher}
            </button>
            <button
              onClick={() => setActiveTab("parent")}
              className={`px-5 py-2.5 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === "parent"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/20"
                  : "text-slate-600 hover:text-blue-600 hover:bg-slate-50"
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
            <div className="relative w-[290px] sm:w-[320px] h-[590px] rounded-[48px] bg-white border-[10px] border-slate-800 shadow-2xl shadow-blue-500/15 overflow-hidden p-3.5">
              {/* Phone Speaker & Camera Notch */}
              <div className="absolute top-3.5 left-1/2 -translate-x-1/2 w-32 h-5 rounded-full bg-slate-800 z-30 flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-slate-900 mr-2" />
                <div className="w-10 h-1 rounded-full bg-slate-700" />
              </div>

              {/* Screen Content in Crisp Light Theme */}
              <div className="w-full h-full rounded-[36px] bg-slate-50 text-slate-900 pt-7 px-3.5 pb-3 flex flex-col justify-between overflow-hidden border border-slate-200">
                {/* User Profile Mini Bar with Photo Avatar */}
                <div className="pt-2 flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={roleAvatarMap[activeTab].src}
                      alt={roleAvatarMap[activeTab].name}
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-blue-500/30"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900 leading-tight">
                        {roleAvatarMap[activeTab].name}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {roleAvatarMap[activeTab].role}
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5 rounded-full bg-white border border-slate-200 text-slate-600">
                    <BellRing className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                </div>

                {/* Dynamic Screen Tabs */}
                <div className="my-auto py-2">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeTab}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.25 }}
                      className="space-y-2.5"
                    >
                      {activeTab === "student" && (
                        <>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-blue-600" />
                              <span className="text-xs font-medium text-slate-800">
                                {locale === "uz" ? "Navbatdagi dars" : "Следующий урок"}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-blue-600">14:00</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-indigo-600" />
                              <span className="text-xs font-medium text-slate-800">GPA</span>
                            </div>
                            <span className="text-xs font-bold text-indigo-600">4.9 / 5.0</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4 text-emerald-600" />
                              <span className="text-xs font-medium text-slate-800">
                                {locale === "uz" ? "Davomat" : "Посещаемость"}
                              </span>
                            </div>
                            <span className="text-xs font-bold text-emerald-600">98%</span>
                          </div>
                        </>
                      )}

                      {activeTab === "teacher" && (
                        <>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "Bugungi darslar" : "Уроки сегодня"}
                            </span>
                            <span className="text-xs font-bold text-blue-600">
                              {locale === "uz" ? "4 ta guruh" : "4 группы"}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "Tekshirishga ДЗ" : "ДЗ на проверку"}
                            </span>
                            <span className="text-xs font-bold text-amber-600">
                              {locale === "uz" ? "8 ta yangi" : "8 новых"}
                            </span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "Jurnal belgilari" : "Отметки журнала"}
                            </span>
                            <span className="text-xs font-bold text-emerald-600">
                              {locale === "uz" ? "To'liq" : "Заполнен"}
                            </span>
                          </div>
                        </>
                      )}

                      {activeTab === "parent" && (
                        <>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "Farzand davomati" : "Посещаемость"}
                            </span>
                            <span className="text-xs font-bold text-emerald-600">100%</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "Oxirgi baho" : "Последняя оценка"}
                            </span>
                            <span className="text-xs font-bold text-indigo-600">A+ (98 ball)</span>
                          </div>
                          <div className="p-3 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-800">
                              {locale === "uz" ? "To'lov holati" : "Статус оплаты"}
                            </span>
                            <span className="text-xs font-bold text-emerald-600">
                              {locale === "uz" ? "To'langan" : "Оплачено"}
                            </span>
                          </div>
                        </>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Bottom App Navigation Bar */}
                <div className="pt-2.5 border-t border-slate-200/90 flex items-center justify-around text-slate-500 text-[11px] font-semibold">
                  <div className="text-blue-600 font-bold">{locale === "uz" ? "Asosiy" : "Главная"}</div>
                  <div>{locale === "uz" ? "Jadval" : "Расписание"}</div>
                  <div>{locale === "uz" ? "Baholar" : "Оценки"}</div>
                  <div>{locale === "uz" ? "Profil" : "Профиль"}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Column & App Download Badges */}
          <div className="lg:col-span-7">
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mb-6">
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
                  <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <span className="text-base text-slate-700 font-medium">
                    {feat}
                  </span>
                </div>
              ))}
            </div>

            {/* App Store & Google Play buttons */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-sm">
              <p className="text-xs font-semibold text-slate-600 mb-4">
                {t.apps.downloadPrompt}
              </p>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
                >
                  <Download className="w-4 h-4 text-blue-400" />
                  <div className="text-left">
                    <div className="text-[9px] uppercase tracking-wider text-slate-400">Download on</div>
                    <div className="text-xs font-bold leading-tight">App Store</div>
                  </div>
                </button>

                <button
                  type="button"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-2.5 text-xs font-semibold shadow-sm transition-all hover:scale-[1.02] cursor-pointer"
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
