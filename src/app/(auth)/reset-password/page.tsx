"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { t } from "@/i18n";
import { AuthShell } from "@/components/auth/AuthShell";

function ResetPasswordForm() {
  const locale = "ru";
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setError(t(locale, "auth.token.required"));
    }
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.error?.code === "VALIDATION_ERROR") {
          setError(t(locale, data.error.details[0].message));
        } else {
          setError(t(locale, data.error?.message || "common.error"));
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch {
      setError(t(locale, "common.error"));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-100 bg-rose-50 text-rose-600">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{t(locale, "common.error")}</h1>
          <p className="text-sm text-ink-muted">{error}</p>
          <Link
            href="/forgot-password"
            className="inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
          >
            {t(locale, "auth.requestNewReset")}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={t(locale, "auth.reset.title")} subtitle={t(locale, "auth.reset.subtitle")}>
      {error && (
        <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-4 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-emerald-700">{t(locale, "auth.resetSuccess")}</p>
          <p className="text-sm text-ink-muted">{t(locale, "auth.redirecting")}</p>
          <Link
            href="/login"
            className="inline-block text-sm font-semibold text-[color:var(--brand)] hover:underline"
          >
            {t(locale, "auth.backToLogin")}
          </Link>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {t(locale, "auth.newPassword")}
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
              <input
                id="password"
                name="password"
                type="password"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <p className="mt-1.5 text-xs text-ink-faint">{t(locale, "auth.passwordHint")}</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99] disabled:opacity-50"
          >
            <span>{loading ? t(locale, "common.loading") : t(locale, "auth.reset.submit")}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div data-theme="light" className="public-shell mesh-gradient-light flex min-h-screen items-center justify-center font-strict text-sm text-ink-muted">
          {t("ru", "common.loading")}
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
