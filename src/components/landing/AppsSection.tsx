"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Calendar,
  Clock,
  Award,
  BellRing,
  CreditCard,
  BookOpen,
  MessageCircle,
} from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface AppsSectionProps {
  locale: LandingLocale;
}

const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

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

  const tabs: Array<{ id: "student" | "teacher" | "parent"; label: string }> = [
    { id: "student", label: t.apps.tabs.student },
    { id: "teacher", label: t.apps.tabs.teacher },
    { id: "parent", label: t.apps.tabs.parent },
  ];

  const screenCard =
    "flex items-center justify-between rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

  const quickActions = [
    { icon: Calendar, label: locale === "uz" ? "Jadval" : "Расписание" },
    { icon: CreditCard, label: locale === "uz" ? "To'lov" : "Оплата" },
    { icon: BookOpen, label: locale === "uz" ? "Vazifa" : "Задания" },
    { icon: MessageCircle, label: locale === "uz" ? "Chat" : "Чат" },
  ];

  return (
    <SectionWrapper
      id="ilovalari"
      className="overflow-hidden bg-gradient-to-b from-[color:var(--grad-a)] via-[color:var(--grad-d)] to-[color:var(--grad-b)] py-20 font-strict md:py-28"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mx-auto mb-14 max-w-3xl text-center">
          <span className="public-eyebrow mb-5">{t.apps.badge}</span>
          <h2 className="mb-4 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl lg:text-5xl">
            {t.apps.title}{" "}
            <span className="text-[color:var(--brand)]">{t.apps.titleHighlight}</span>
          </h2>
          <p className="text-pretty text-base leading-relaxed text-ink-muted sm:text-lg">
            {t.apps.subtitle}
          </p>

          {/* Role Tabs */}
          <div className="mx-auto mt-8 inline-flex max-w-md rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_14px_36px_-24px_rgba(16,24,40,0.3)]">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`cursor-pointer rounded-xl px-5 py-2.5 text-xs font-bold transition-all duration-200 sm:text-sm ${
                  activeTab === tab.id
                    ? "bg-[color:var(--brand-solid)] text-white shadow-[0_8px_20px_-10px_rgba(29,78,216,0.8)]"
                    : "text-ink-muted hover:bg-[color:var(--paper-2)] hover:text-ink"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content Showcase: iPhone 15 Pro Mockup + Features List */}
        <div className="grid grid-cols-1 items-center gap-16 lg:grid-cols-12 lg:gap-12">
          {/* Realistic iPhone 15 Pro device with a live app UI */}
          <div className="flex justify-center lg:col-span-5">
            <div className="relative mx-auto w-[248px] sm:w-[272px]">
              {/* Soft single-hue glow behind the device */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-12 -z-10 rounded-[70px] bg-gradient-to-br from-blue-600/25 via-blue-500/5 to-transparent blur-3xl"
              />

              {/* Side hardware buttons (left: action + volume, right: power) */}
              <span
                aria-hidden="true"
                className="absolute -left-[3px] top-[14%] h-5 w-[3px] rounded-l-[3px] bg-gradient-to-b from-[#c9cbd1] to-[#8b8d94]"
              />
              <span
                aria-hidden="true"
                className="absolute -left-[3px] top-[22%] h-9 w-[3px] rounded-l-[3px] bg-gradient-to-b from-[#c9cbd1] to-[#8b8d94]"
              />
              <span
                aria-hidden="true"
                className="absolute -left-[3px] top-[30%] h-9 w-[3px] rounded-l-[3px] bg-gradient-to-b from-[#c9cbd1] to-[#8b8d94]"
              />
              <span
                aria-hidden="true"
                className="absolute -right-[3px] top-[24%] h-16 w-[3px] rounded-r-[3px] bg-gradient-to-b from-[#c9cbd1] to-[#8b8d94]"
              />

              {/* Titanium frame */}
              <div className="relative aspect-[390/844] rounded-[3rem] bg-gradient-to-b from-[#9fa1a7] via-[#eceef2] to-[#7f8188] p-[3px] shadow-[0_50px_100px_-45px_rgba(16,24,40,0.7)] ring-1 ring-black/10">
                {/* Black bezel */}
                <div className="relative h-full w-full rounded-[2.75rem] bg-[#05070d] p-[3px]">
                  {/* Screen */}
                  <div className="relative h-full w-full overflow-hidden rounded-[2.55rem] bg-[color:var(--paper-2)]">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] font-semibold text-ink">
                      <span className="public-tabular">9:41</span>
                      <span className="flex items-center gap-1 text-ink-faint">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>5G</span>
                      </span>
                    </div>

                    {/* Live app UI */}
                    <div className="flex h-[calc(100%-1.6rem)] flex-col px-3 pb-4 pt-1">
                      {/* iOS-style push notification */}
                      <motion.div
                        initial={{ opacity: 0, y: -14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.45, ease: EASE }}
                        className="mb-2.5 flex items-center gap-2 rounded-2xl border border-white/60 bg-[color:var(--surface-a90)] p-2 shadow-[0_10px_26px_-14px_rgba(16,24,40,0.55)] backdrop-blur-xl"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                          <BellRing className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[10px] font-bold text-ink">
                            {locale === "uz" ? "To'lov qabul qilindi" : "Платёж получен"}
                          </span>
                          <span className="block truncate text-[9px] text-ink-muted">
                            Payme • 450 000
                          </span>
                        </span>
                      </motion.div>

                      {/* User profile bar with a real photo avatar */}
                      <div className="flex items-center justify-between border-b border-[color:var(--line)] pb-2.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={roleAvatarMap[activeTab].src}
                            alt={roleAvatarMap[activeTab].name}
                            className="h-9 w-9 rounded-full object-cover ring-2 ring-[color:var(--brand-a25)]"
                          />
                          <div>
                            <div className="text-[11px] font-bold leading-tight text-ink">
                              {roleAvatarMap[activeTab].name}
                            </div>
                            <div className="text-[9px] text-ink-faint">
                              {roleAvatarMap[activeTab].role}
                            </div>
                          </div>
                        </div>
                        <div className="rounded-full border border-[color:var(--line)] bg-[color:var(--surface)] p-1.5">
                          <BellRing className="h-3 w-3 text-[color:var(--brand)]" />
                        </div>
                      </div>

                      {/* Animated role-specific cards */}
                      <div className="mt-2.5">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeTab}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.25, ease: EASE }}
                            className="space-y-2"
                          >
                            {activeTab === "student" && (
                              <>
                                <div className={screenCard}>
                                  <span className="flex items-center gap-1.5">
                                    <Calendar className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                                    <span className="text-[11px] font-medium text-ink-soft">
                                      {locale === "uz" ? "Navbatdagi dars" : "Следующий урок"}
                                    </span>
                                  </span>
                                  <span className="public-tabular text-[11px] font-bold text-[color:var(--brand)]">
                                    14:00
                                  </span>
                                </div>
                                <div className={screenCard}>
                                  <span className="flex items-center gap-1.5">
                                    <Award className="h-3.5 w-3.5 text-[color:var(--brand-strong)]" />
                                    <span className="text-[11px] font-medium text-ink-soft">GPA</span>
                                  </span>
                                  <span className="public-tabular text-[11px] font-bold text-[color:var(--brand-strong)]">
                                    4.9 / 5.0
                                  </span>
                                </div>
                                <div className={screenCard}>
                                  <span className="flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5 text-[color:var(--success)]" />
                                    <span className="text-[11px] font-medium text-ink-soft">
                                      {locale === "uz" ? "Davomat" : "Посещаемость"}
                                    </span>
                                  </span>
                                  <span className="public-tabular text-[11px] font-bold text-[color:var(--success)]">
                                    98%
                                  </span>
                                </div>
                              </>
                            )}

                            {activeTab === "teacher" && (
                              <>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "Bugungi darslar" : "Уроки сегодня"}
                                  </span>
                                  <span className="text-[11px] font-bold text-[color:var(--brand)]">
                                    {locale === "uz" ? "4 ta guruh" : "4 группы"}
                                  </span>
                                </div>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "Tekshirish uchun DZ" : "ДЗ на проверку"}
                                  </span>
                                  <span className="text-[11px] font-bold text-[color:var(--warning)]">
                                    {locale === "uz" ? "8 ta yangi" : "8 новых"}
                                  </span>
                                </div>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "Jurnal belgilari" : "Отметки журнала"}
                                  </span>
                                  <span className="text-[11px] font-bold text-[color:var(--success)]">
                                    {locale === "uz" ? "To'liq" : "Заполнен"}
                                  </span>
                                </div>
                              </>
                            )}

                            {activeTab === "parent" && (
                              <>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "Farzand davomati" : "Посещаемость"}
                                  </span>
                                  <span className="text-[11px] font-bold text-[color:var(--success)]">100%</span>
                                </div>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "Oxirgi baho" : "Последняя оценка"}
                                  </span>
                                  <span className="public-tabular text-[11px] font-bold text-[color:var(--brand-strong)]">
                                    A+ (98)
                                  </span>
                                </div>
                                <div className={screenCard}>
                                  <span className="text-[11px] font-medium text-ink-soft">
                                    {locale === "uz" ? "To'lov holati" : "Статус оплаты"}
                                  </span>
                                  <span className="text-[11px] font-bold text-[color:var(--success)]">
                                    {locale === "uz" ? "To'langan" : "Оплачено"}
                                  </span>
                                </div>
                              </>
                            )}
                          </motion.div>
                        </AnimatePresence>

                        {/* Weekly activity mini-chart */}
                        <div className="mt-2 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[10px] font-semibold text-ink-muted">
                              {locale === "uz" ? "Haftalik faollik" : "Активность за неделю"}
                            </span>
                            <span className="public-tabular text-[10px] font-bold text-[color:var(--brand)]">
                              84%
                            </span>
                          </div>
                          <div className="flex h-9 items-end gap-1.5">
                            {[38, 62, 48, 78, 56, 92, 68].map((barHeight, i) => (
                              <span
                                key={i}
                                className={`flex-1 rounded-[3px] ${
                                  i === 5 ? "bg-[color:var(--brand-solid)]" : "bg-[color:var(--brand-a20)]"
                                }`}
                                style={{ height: `${barHeight}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Quick actions + bottom navigation */}
                      <div className="mt-auto">
                        <div className="grid grid-cols-4 gap-1.5">
                          {quickActions.map((action) => (
                            <span
                              key={action.label}
                              className="flex flex-col items-center gap-1 rounded-xl border border-[color:var(--line)] bg-[color:var(--surface)] py-2"
                            >
                              <action.icon className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                              <span className="text-[8px] font-semibold text-ink-faint">
                                {action.label}
                              </span>
                            </span>
                          ))}
                        </div>

                        <div className="mt-2.5 flex items-center justify-around border-t border-[color:var(--line)] pt-2 text-[10px] font-semibold text-ink-faint">
                          <span className="font-bold text-[color:var(--brand)]">
                            {locale === "uz" ? "Asosiy" : "Главная"}
                          </span>
                          <span>{locale === "uz" ? "Jadval" : "Расписание"}</span>
                          <span>{locale === "uz" ? "Baholar" : "Оценки"}</span>
                          <span>{locale === "uz" ? "Profil" : "Профиль"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Dynamic Island */}
                    <div className="absolute left-1/2 top-2 z-30 flex h-[22px] w-[76px] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-2">
                      <span className="h-2 w-2 rounded-full bg-[#0d1a33] ring-1 ring-white/10" />
                    </div>

                    {/* Glass reflection */}
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 z-20 rounded-[2.55rem] bg-gradient-to-tr from-white/0 via-white/[0.04] to-white/20"
                    />

                    {/* Home indicator */}
                    <div
                      aria-hidden="true"
                      className="absolute bottom-1.5 left-1/2 z-30 h-[4px] w-[92px] -translate-x-1/2 rounded-full bg-black/85"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Features Column & Real store badges */}
          <div className="lg:col-span-7">
            <h3 className="mb-6 text-balance text-2xl font-bold tracking-tight text-ink sm:text-3xl">
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
            <div className="mb-8 space-y-4">
              {currentFeatures.map((feat, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-[color:var(--line)] bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                  <span className="text-pretty text-base font-medium text-ink-soft">{feat}</span>
                </div>
              ))}
            </div>

            {/* Official App Store & Google Play badges */}
            <div className="rounded-2xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_44px_-24px_rgba(16,24,40,0.24)]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-semibold text-ink-muted">{t.apps.availableOn}</p>
                <span className="rounded-full border border-[color:var(--warning-line)] bg-[color:var(--warning-soft)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[color:var(--warning)]">
                  {t.apps.soon}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href="#aloqa"
                  aria-label={t.apps.appStoreLabel}
                  className="rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-a20)]"
                >
                  <img
                    src="/badges/app-store.svg"
                    alt={t.apps.appStoreLabel}
                    className="h-12 w-auto"
                    loading="lazy"
                  />
                </a>

                <a
                  href="#aloqa"
                  aria-label={t.apps.googlePlayLabel}
                  className="rounded-xl transition-transform duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-4 focus-visible:ring-[color:var(--brand-a20)]"
                >
                  <img
                    src="/badges/google-play.png"
                    alt={t.apps.googlePlayLabel}
                    className="h-12 w-auto"
                    loading="lazy"
                  />
                </a>
              </div>

              <p className="mt-4 text-xs leading-relaxed text-ink-faint">{t.apps.downloadPrompt}</p>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};
