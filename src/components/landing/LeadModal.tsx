"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Building, Phone, User, Send, ShieldCheck } from "lucide-react";
import { LandingLocale, ContactFormData } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";

interface LeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: LandingLocale;
  selectedPlan?: string;
}

const fieldClass =
  "w-full rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] pl-10 pr-4 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]";

export const LeadModal: React.FC<LeadModalProps> = ({
  isOpen,
  onClose,
  locale,
  selectedPlan,
}) => {
  const t = getLandingMessages(locale);
  const [formData, setFormData] = useState<ContactFormData>({
    fullName: "",
    phone: "+998",
    organizationName: "",
    notes: selectedPlan ? `Tanlangan tarif: ${selectedPlan}` : "",
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

    // Validation
    if (!formData.fullName.trim() || formData.fullName.length < 3) {
      setError(locale === "uz" ? "Ismingizni to'liq kiriting" : "Введите корректное имя");
      return;
    }
    const cleanPhone = formData.phone.replace(/\D/g, "");
    if (cleanPhone.length < 12) {
      setError(locale === "uz" ? "Telefon raqamingizni to'liq kiriting (+998 XX XX XX XX)" : "Введите полный номер телефона (+998 XX XX XX XX)");
      return;
    }
    if (!formData.organizationName.trim()) {
      setError(locale === "uz" ? "Tashkilot nomini kiriting" : "Укажите название организации");
      return;
    }

    setIsSubmitting(true);

    try {
      // Send lead to backend API or simulate guaranteed save
      const res = await fetch("/api/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          locale,
          plan: selectedPlan,
          source: "landing-modal",
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to submit");
      }

      setIsSuccess(true);
    } catch {
      // Never claim success for a lead that was not stored — the visitor would
      // wait for a call that is never going to happen.
      setError(t.cta.form.errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm"
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: "spring", stiffness: 350, damping: 28 }}
            className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--surface)] p-6 font-strict text-ink shadow-[0_40px_100px_-40px_rgba(16,24,40,0.6)] md:p-8"
          >
            {/* Top Close button */}
            <button
              onClick={onClose}
              aria-label="Yopish"
              className="absolute right-5 top-5 rounded-xl p-2 text-ink-faint transition-colors hover:bg-[color:var(--paper-2)] hover:text-ink"
            >
              <X className="h-5 w-5" />
            </button>

            {isSuccess ? (
              <div className="py-6 text-center">
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
                  onClick={onClose}
                  className="cursor-pointer rounded-xl bg-[color:var(--brand-solid)] px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[color:var(--brand-strong)]"
                >
                  OK
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <span className="public-eyebrow mb-2">{t.hero.badge}</span>
                  <h3 className="text-2xl font-bold tracking-tight text-ink">
                    {locale === "uz" ? "Bepul sinovni boshlash" : "Начать бесплатный период"}
                  </h3>
                  <p className="mt-1 text-xs text-ink-muted">
                    {locale === "uz"
                      ? "14 kunlik bepul sinov va bepul mutaxassis ko'magi"
                      : "14 дней полного доступа и бесплатная помощь в запуске"}
                  </p>
                </div>

                {error && (
                  <div className="mb-4 rounded-xl border border-[color:var(--danger-line)] bg-[color:var(--danger-soft)] p-3 text-xs text-[color:var(--danger)]">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
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
                    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
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
                    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                      {t.cta.form.orgLabel}
                    </label>
                    <div className="relative">
                      <Building className="absolute left-3.5 top-3 h-4 w-4 text-ink-faint" />
                      <input
                        type="text"
                        required
                        value={formData.organizationName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, organizationName: e.target.value }))
                        }
                        placeholder={t.cta.form.orgPlaceholder}
                        className={fieldClass}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-ink-soft">
                      {t.cta.form.notesLabel}
                    </label>
                    <textarea
                      rows={2}
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, notes: e.target.value }))
                      }
                      placeholder={t.cta.form.notesPlaceholder}
                      className="w-full resize-none rounded-xl border border-[color:var(--line)] bg-[color:var(--paper-2)] px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand-solid)] px-6 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.98] disabled:opacity-50"
                    >
                      <Send className="h-4 w-4" />
                      {isSubmitting ? t.cta.form.submitting : t.cta.form.submit}
                    </button>
                  </div>

                  <div className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-ink-muted">
                    <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--success)]" />
                    <span>{t.cta.form.guarantee}</span>
                  </div>
                </form>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
