"use client";

import { useEffect, useState } from "react";
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
  GraduationCap,
  CheckCircle2,
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
  const [nextPath, setNextPath] = useState("/dashboard");

  // Support ?next=/path for post-login redirects (used by invite acceptance).
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("next");
    if (p && p.startsWith("/") && !p.startsWith("//")) setNextPath(p);
  }, []);

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

      router.push(nextPath);
      router.refresh();
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : "Ошибка при входе");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError?: string) =>
    `w-full rounded-xl border bg-slate-50/70 pl-10 pr-10 py-2.5 text-sm text-slate-900 placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)] ${
      hasError ? "border-rose-400 ring-1 ring-rose-400" : "border-slate-200"
    }`;

  return (
    <div data-theme="light" className="public-shell mesh-gradient-light relative min-h-screen overflow-hidden font-strict">
      {/* Ambient single-hue light */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-gradient-to-tr from-blue-500/12 via-transparent to-transparent blur-[140px]" />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-2">
        {/* Left: brand / value panel */}
        <div className="relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_8px_20px_-8px_rgba(29,78,216,0.8)] ring-1 ring-inset ring-white/15">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="flex items-center text-lg font-bold tracking-tight text-slate-900">
              e-darischi
              <span className="ml-2 rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[color:var(--brand-strong)]">
                LMS
              </span>
            </span>
          </Link>

          <div className="max-w-md">
            <h2 className="mb-5 text-4xl font-bold leading-[1.1] tracking-[-0.03em] text-slate-900">
              {locale === "ru"
                ? "Единая платформа для вашего учебного центра"
                : "O'quv markazingiz uchun yagona platforma"}
            </h2>
            <p className="mb-8 text-base leading-relaxed text-ink-muted">
              {locale === "ru"
                ? "Расписание, посещаемость, оплаты и отчётность — в одном кабинете, доступном с любого устройства."
                : "Jadval, davomat, to'lovlar va hisobotlar — bitta kabinetda, istalgan qurilmadan."}
            </p>

            <ul className="space-y-3.5">
              {(locale === "ru"
                ? [
                    "Управление группами и расписанием",
                    "Автоматический учёт посещаемости по QR",
                    "Онлайн-оплаты и прозрачная бухгалтерия",
                  ]
                : [
                    "Guruhlar va jadvalni boshqarish",
                    "QR orqali avtomatik davomat",
                    "Onlayn to'lovlar va shaffof hisobot",
                  ]
              ).map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm font-medium text-ink-soft">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[color:var(--brand)]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-faint">
            <GraduationCap className="h-4 w-4" />
            <span>© {new Date().getFullYear()} e-darischi. Toshkent, O&apos;zbekiston</span>
          </div>
        </div>

        {/* Right: form */}
        <div className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="mx-auto w-full max-w-md">
            {/* Top bar with back to home and locale toggle */}
            <div className="mb-6 flex items-center justify-between px-1 text-xs text-ink-muted">
              <Link
                href="/"
                className="flex items-center gap-1 font-medium transition-colors hover:text-ink"
              >
                &larr; {locale === "ru" ? "На главную" : "Bosh sahifaga"}
              </Link>
              <button
                type="button"
                onClick={() => setLocale(locale === "ru" ? "uz-Latn" : "ru")}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-ink-soft shadow-sm transition-colors hover:bg-[color:var(--paper-2)]"
              >
                <Globe className="h-3.5 w-3.5 text-[color:var(--brand)]" />
                <span className="font-semibold">{locale === "ru" ? "Oʻzbekcha" : "Русский"}</span>
              </button>
            </div>

            {/* Card */}
            <div className="rounded-3xl border border-slate-200/90 bg-white p-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_30px_70px_-34px_rgba(16,24,40,0.35)] sm:p-8">
              {/* Brand header */}
              <div className="mb-6 text-center">
                <Link href="/" className="group mb-3 inline-flex items-center gap-2.5 lg:hidden">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-700 to-[#172554] shadow-[0_10px_24px_-10px_rgba(29,78,216,0.8)] ring-1 ring-inset ring-white/15 transition-transform duration-200 group-hover:scale-105">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-slate-900">
                    e-darischi
                  </span>
                </Link>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                  {t(locale, "auth.login")}
                </h1>
                <p className="mt-1 text-xs text-ink-muted">
                  {locale === "ru"
                    ? "Введите ваш email и пароль для доступа к кабинету"
                    : "Kabinetga kirish uchun email va parolingizni kiriting"}
                </p>
              </div>

              {/* Error Banner */}
              {errorBanner && (
                <div className="animate-fade-in mb-5 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{errorBanner}</span>
                </div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                    <input
                      type="email"
                      required
                      value={email}
                      disabled={loading}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                      className={inputClass(fieldErrors.email)}
                    />
                  </div>
                  {fieldErrors.email && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    {locale === "ru" ? "Пароль" : "Parol"}
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      disabled={loading}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className={inputClass(fieldErrors.password)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-ink-faint transition-colors hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {fieldErrors.password && (
                    <p className="mt-1 text-xs text-rose-600">{fieldErrors.password}</p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-ink-muted">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>{locale === "ru" ? "Запомнить меня" : "Eslab qolish"}</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="font-medium text-[color:var(--brand)] hover:text-[color:var(--brand-strong)] hover:underline"
                  >
                    {locale === "ru" ? "Забыли пароль?" : "Parolni unutdingizmi?"}
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span>{loading ? t(locale, "common.loading") : t(locale, "auth.loginButton")}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>

              {/* Quick Demo fast logins in dev */}
              {process.env.NODE_ENV !== "production" && (
                <div className="mt-6 space-y-2 border-t border-slate-100 pt-5">
                  <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Быстрый вход (Dev)
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("admin@platform.com");
                        setPassword("Password123!");
                      }}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                    >
                      Суперадмин
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("director1@example.com");
                        setPassword("Password123!");
                      }}
                      className="rounded-lg border border-slate-200 bg-[color:var(--brand-soft)] px-2 py-1.5 font-medium text-[color:var(--brand-strong)] transition-colors hover:bg-white"
                    >
                      Директор центра
                    </button>
                  </div>
                </div>
              )}

              {/* Registration link */}
              <div className="mt-6 border-t border-slate-100 pt-4 text-center text-xs text-ink-muted">
                {locale === "ru" ? "Ещё нет аккаунта?" : "Hali profilingiz yoʻqmi?"}{" "}
                <Link
                  href="/register"
                  className="font-semibold text-[color:var(--brand)] hover:underline"
                >
                  {t(locale, "auth.register")}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
