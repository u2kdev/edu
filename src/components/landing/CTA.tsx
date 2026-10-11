"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, Phone, User, Building, ShieldCheck, Sparkles } from "lucide-react";
import { LandingLocale, ContactFormData } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface CTAProps {
  locale: LandingLocale;
}

export const CTA: React.FC<CTAProps> = ({ locale }) => {
  const t = getLandingMessages(locale);
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: "",
    phone: "+998",
    organizationName: "",
    notes: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (!val.startsWith("+998")) {
      val = "+998";
    }
    setFormData((prev) => ({ ...prev, phone: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.fullName.trim() || formData.fullName.length < 3) {
      setError(locale === "uz" ? "Ismingizni to'liq kiriting" : "Введите корректное имя");
      return;
    }
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length < 12) {
      setError(locale === "uz" ? "Telefon raqamingizni to'liq kiriting (+998 XX XXX XX XX)" : "Введите полный номер телефона (+998 XX XXX XX XX)");
      return;
    }
    if (!formData.organizationName.trim()) {
      setError(locale === "uz" ? "O'quv markazi yoki maktab nomini kiriting" : "Укажите название учебного центра");
      return;
    }

    setIsSubmitting(true);

    try {
      await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          locale,
          source: "landing-bottom-cta",
        }),
      });
      setIsSuccess(true);
    } catch {
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionWrapper id="aloqa" className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-[36px] overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-700 to-[#1E3A8A] p-8 sm:p-12 lg:p-16 text-white shadow-2xl shadow-blue-600/25">
          {/* Subtle background circles */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none -z-0" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-400/10 rounded-full blur-2xl pointer-events-none -z-0" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-semibold uppercase tracking-wider mb-6">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>{t.cta.badge}</span>
              </div>

              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight mb-6">
                {t.cta.title}
              </h2>

              <p className="text-base sm:text-lg text-blue-100 max-w-xl mx-auto lg:mx-0 leading-relaxed mb-8">
                {t.cta.subtitle}
              </p>

              <div className="flex items-center justify-center lg:justify-start gap-2 text-xs sm:text-sm text-blue-100/90 font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                <span>{t.cta.form.guarantee}</span>
              </div>
            </div>

            {/* Right Form Container */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl bg-white dark:bg-[#0A1128] text-slate-900 dark:text-white p-6 sm:p-8 shadow-2xl border border-white/20">
                {isSuccess ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
                      <CheckCircle2 className="w-10 h-10" />
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                      {t.cta.form.successTitle}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-6 leading-relaxed">
                      {t.cta.form.successMessage}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSuccess(false)}
                      className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium text-xs"
                    >
                      {locale === "uz" ? "Yangi ariza" : "Новая заявка"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs">
                        {error}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.cta.form.nameLabel}
                      </label>
                      <div className="relative">
                        <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          placeholder={t.cta.form.namePlaceholder}
                          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-[#13224D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.cta.form.phoneLabel}
                      </label>
                      <div className="relative">
                        <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          placeholder="+998 90 123 45 67"
                          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-[#13224D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        {t.cta.form.orgLabel}
                      </label>
                      <div className="relative">
                        <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                        <input
                          type="text"
                          required
                          value={formData.organizationName}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              organizationName: e.target.value,
                            }))
                          }
                          placeholder={t.cta.form.orgPlaceholder}
                          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 dark:bg-[#13224D] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-blue-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        <Send className="w-4 h-4" />
                        <span>{isSubmitting ? t.cta.form.submitting : t.cta.form.submit}</span>
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </SectionWrapper>
  );
};
