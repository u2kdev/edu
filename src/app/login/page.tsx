"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
} from "lucide-react";
import { t } from "@/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorBanner, setErrorBanner] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [locale, setLocale] = useState<"ru" | "uz-Latn">("ru");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error) {
          if (data.error.code === "VALIDATION_ERROR" && Array.isArray(data.error.details)) {
            const errs: Record<string, string> = {};
            data.error.details.forEach((issue: { path?: string[]; message?: string }) => {
              if (issue.path && issue.path.length > 0 && issue.message) {
                errs[issue.path[0]] = t(locale, issue.message);
              }
            });
            setFieldErrors(errs);
            setErrorBanner(t(locale, "common.error"));
          } else if (data.error.code === "RATE_LIMITED") {
            setErrorBanner(
              locale === "ru"
                ? "Слишком много попыток входа. Пожалуйста, подождите 15 минут."
                : "Urinishlar soni koʻpayib ketdi. Iltimos, 15 daqiqa kuting."
            );
          } else {
            setErrorBanner(t(locale, data.error.message) || data.error.message);
          }
        } else {
          setErrorBanner(data.error || "Ошибка при входе");
        }
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden particles-bg font-strict">
      {/* Ambient mesh gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-tr from-blue-400/15 via-indigo-400/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Top bar with back to home and locale toggle */}
        <div className="flex items-center justify-between text-xs text-slate-500 px-2">
          <Link
            href="/"
            className="hover:text-slate-900 transition-colors flex items-center gap-1 font-medium"
          >
            &larr; {locale === "ru" ? "На главную" : "Bosh sahifaga"}
          </Link>
          <button
            type="button"
            onClick={() => setLocale(locale === "ru" ? "uz-Latn" : "ru")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all"
          >
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span className="font-semibold">{locale === "ru" ? "Oʻzbekcha" : "Русский"}</span>
          </button>
        </div>

        {/* Card */}
        <div className="bg-white/95 backdrop-blur-xl p-8 rounded-3xl border border-slate-200/90 shadow-xl shadow-slate-200/60">
          {/* Brand header */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-flex items-center gap-2.5 group mb-3">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900">
                e-darischi
              </span>
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t(locale, "auth.login")}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              {locale === "ru"
                ? "Введите ваш email и пароль для доступа к кабинету"
                : "Kabinetga kirish uchun email va parolingizni kiriting"}
            </p>
          </div>

          {/* Error Banner */}
          {errorBanner && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5 shadow-sm animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorBanner}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className={`w-full pl-10 pr-4 py-2.5 bg-slate-50 border ${
                    fieldErrors.email ? "border-rose-400 ring-1 ring-rose-400" : "border-slate-200"
                  } rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                {locale === "ru" ? "Пароль" : "Parol"}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-10 pr-10 py-2.5 bg-slate-50 border ${
                    fieldErrors.password ? "border-rose-400 ring-1 ring-rose-400" : "border-slate-200"
                  } rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all text-sm`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-slate-600">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                />
                <span>{locale === "ru" ? "Запомнить меня" : "Eslab qolish"}</span>
              </label>
              <Link
                href="/forgot-password"
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                {locale === "ru" ? "Забыли пароль?" : "Parolni unutdingizmi?"}
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2 text-sm cursor-pointer"
            >
              <span>{loading ? t(locale, "common.loading") : t(locale, "auth.loginButton")}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo fast logins in dev */}
          {process.env.NODE_ENV !== "production" && (
            <div className="mt-6 pt-5 border-t border-slate-100 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 text-center">
                Быстрый вход (Dev)
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setEmail("admin@platform.com");
                    setPassword("Password123!");
                  }}
                  className="py-1.5 px-2 font-medium rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-colors"
                >
                  Суперадмин
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEmail("director1@example.com");
                    setPassword("Password123!");
                  }}
                  className="py-1.5 px-2 font-medium rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                >
                  Директор центра
                </button>
              </div>
            </div>
          )}

          {/* Registration link */}
          <div className="text-center mt-6 pt-4 border-t border-slate-100 text-xs text-slate-500">
            {locale === "ru" ? "Ещё нет аккаунта?" : "Hali profilingiz yoʻqmi?"}{" "}
            <Link href="/register" className="text-blue-600 hover:underline font-semibold">
              {t(locale, "auth.register")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
