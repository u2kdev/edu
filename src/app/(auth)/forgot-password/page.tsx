"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { t } from "@/i18n";
import { AuthShell } from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const locale = "ru";
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/password/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(t(locale, data.error?.message || "common.error"));
      } else {
        setSuccess(true);
      }
    } catch {
      setError(t(locale, "common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t(locale, "auth.forgot.title")}
      subtitle={t(locale, "auth.forgot.subtitle")}
    >
      {error && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            <span>{t(locale, "auth.resetLinkSent")}</span>
          </div>
          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-semibold text-[color:var(--brand)] hover:text-[color:var(--brand-strong)] hover:underline"
            >
              {t(locale, "auth.backToLogin")}
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {t(locale, "auth.email")}
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99] disabled:opacity-50"
          >
            <span>{loading ? t(locale, "common.loading") : t(locale, "auth.forgot.submit")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="text-center">
            <Link
              href="/login"
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t(locale, "auth.backToLogin")}
            </Link>
          </div>
        </form>
      )}
    </AuthShell>
  );
}
