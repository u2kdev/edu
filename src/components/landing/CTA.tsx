"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, Phone, User, Building, ShieldCheck, Sparkles } from "lucide-react";
import { LandingLocale, ContactFormData } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { SectionWrapper } from "./SectionWrapper";

interface CTAProps {
  locale: LandingLocale;
}

const fieldClass =
  "w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]";

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
      setError(locale === "uz" ? "Telefon raqamingizni to'liq kiriting (+998 XX XXX XX XX)" : "Введите полный номер телефона (+998 XX XX XX XX)");
      return;
    }
    if (!formData.organizationName.trim()) {
      setError(locale === "uz" ? "O'quv markazi yoki maktab nomini kiriting" : "Укажите название учебного центра");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          locale,
          source: "landing-bottom-cta",
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to submit");
      }
      setIsSuccess(true);
    } catch {
      // Same rule as the lead modal: only claim success when the lead is stored.
      setError(t.cta.form.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SectionWrapper id="aloqa" className="bg-gradient-to-b from-[color:var(--grad-a)] to-[color:var(--grad-b)] py-16 font-strict md:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-[#0b1220] via-[#172554] to-[#1d4ed8] p-8 text-white shadow-[0_50px_120px_-50px_rgba(23,37,84,0.9)] sm:p-12 lg:p-16">
          {/* Subtle background glow + technical grid */}
          <div className="pointer-events-none absolute -right-16 -top-24 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-80 w-80 rounded-full bg-blue-400/10 blur-3xl" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />

          <div className="relative z-10 grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            {/* Left Copy */}
            <div className="text-center lg:col-span-6 lg:text-left">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5 text-blue-200" />
                <span>{t.cta.badge}</span>
              </div>

              <h2 className="mb-6 text-balance text-3xl font-bold leading-[1.1] tracking-[-0.03em] sm:text-4xl lg:text-5xl">
                {t.cta.title}
              </h2>

              <p className="mx-auto mb-8 max-w-xl text-pretty text-base leading-relaxed text-blue-100/85 sm:text-lg lg:mx-0">
                {t.cta.subtitle}
              </p>

              <div className="flex items-center justify-center gap-2 text-xs font-medium text-blue-100/85 sm:text-sm lg:justify-start">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                <span>{t.cta.form.guarantee}</span>
              </div>
            </div>

            {/* Right Form Container */}
            <div className="lg:col-span-6">
              <div className="rounded-3xl border border-white/40 bg-[color:var(--surface)] p-6 text-ink shadow-[0_40px_90px_-40px_rgba(0,0,0,0.5)] sm:p-8">
                {isSuccess ? (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--brand-soft)] text-[color:var(--brand)]">
                      <CheckCircle2 className="h-10 w-10" />
                    </div>
                    <h3 className="mb-2 text-2xl font-bold tracking-tight text-ink">
                      {t.cta.form.successTitle}
                    </h3>
                    <p className="mb-6 text-pretty text-sm leading-relaxed text-ink-muted">
                      {t.cta.form.successMessage}
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsSuccess(false)}
                      className="cursor-pointer rounded-xl bg-[color:var(--brand-solid)] px-6 py-2.5 text-xs font-medium text-white transition-colors hover:bg-[color:var(--brand-strong)]"
                    >
                      {locale === "uz" ? "Yangi ariza" : "Новая заявка"}
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                      <div className="rounded-xl border border-[color:var(--danger-line)] bg-[color:var(--danger-soft)] p-3 text-xs text-[color:var(--danger)]">
                        {error}
                      </div>
                    )}

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">
                        {t.cta.form.nameLabel}
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3 h-4 w-4 text-ink-faint" />
                        <input
                          type="text"
                          required
                          value={formData.fullName}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, fullName: e.target.value }))
                          }
                          placeholder={t.cta.form.namePlaceholder}
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">
                        {t.cta.form.phoneLabel}
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3 h-4 w-4 text-ink-faint" />
                        <input
                          type="tel"
                          required
                          value={formData.phone}
                          onChange={handlePhoneChange}
                          placeholder="+998 90 123 45 67"
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">
                        {t.cta.form.orgLabel}
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3.5 top-3 h-4 w-4 text-ink-faint" />
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
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand-solid)] px-6 py-3.5 text-sm font-bold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.98] disabled:opacity-60"
                      >
                        <Send className="h-4 w-4" />
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
