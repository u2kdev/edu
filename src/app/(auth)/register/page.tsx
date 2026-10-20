"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Sparkles,
  ArrowRight,
  Lock,
  Mail,
  User,
  KeyRound,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Globe,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { t } from "@/i18n";

function getPasswordStrength(pwd: string): { score: number; labelRu: string; labelUz: string; color: string } {
  if (!pwd) return { score: 0, labelRu: "Не задан", labelUz: "Kiritilmagan", color: "bg-slate-200" };
  let s = 0;
  if (pwd.length >= 10) s += 1;
  if (pwd.length >= 12) s += 1;
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) s += 1;
  if (/[0-9]/.test(pwd)) s += 1;
  if (/[^A-Za-z0-9]/.test(pwd)) s += 1;

  if (s <= 2) return { score: 1, labelRu: "Слабый (мин. 10 симв.)", labelUz: "Zaif (kamida 10 belgi)", color: "bg-amber-400" };
  if (s <= 3) return { score: 2, labelRu: "Средний", labelUz: "O'rtacha", color: "bg-blue-500" };
  return { score: 3, labelRu: "Надёжный", labelUz: "Mustahkam", color: "bg-emerald-500" };
}

const fieldClass =
  "w-full rounded-xl border border-slate-300 bg-slate-50/70 pl-10 pr-4 py-2.5 text-sm text-slate-900 placeholder:text-ink-faint transition-colors focus:border-[color:var(--brand)] focus:outline-none focus:ring-4 focus:ring-[color:var(--brand-a12)]";

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCode = searchParams?.get("code") || "";

  const [formData, setFormData] = useState({
    inviteCode: initialCode,
    email: "",
    password: "",
    fullName: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [success, setSuccess] = useState(false);
  const [locale, setLocale] = useState<"ru" | "uz-Latn">("ru");

  const pwdStrength = getPasswordStrength(formData.password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorBanner("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          locale: locale === "uz-Latn" ? "uz" : "ru",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error) {
          const errMsg = typeof data.error === "object" ? data.error.message : data.error;
          setErrorBanner(errMsg || (locale === "ru" ? "Ошибка при регистрации" : "Roʻyxatdan oʻtishda xatolik"));
        } else {
          setErrorBanner(locale === "ru" ? "Ошибка при регистрации" : "Roʻyxatdan oʻtishda xatolik");
        }
        return;
      }
      setSuccess(true);
    } catch (err: unknown) {
      setErrorBanner(err instanceof Error ? err.message : (locale === "ru" ? "Ошибка сети" : "Tarmoq xatoligi"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_30px_70px_-34px_rgba(16,24,40,0.35)] font-strict sm:p-10">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-600 shadow-sm">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="mb-2 text-2xl font-bold tracking-tight text-slate-900">
          {locale === "ru" ? "Регистрация успешна!" : "Ro'yxatdan muvaffaqiyatli o'tdingiz!"}
        </h2>
        <p className="mb-6 text-pretty text-sm leading-relaxed text-ink-muted">
          {locale === "ru"
            ? "Ваша учетная запись активирована. Проверьте почту или сразу перейдите к авторизации в системе."
            : "Profilingiz faollashtirildi. E-pochtangizni tekshiring yoki to'g'ridan-to'g'ri tizimga kiring."}
        </p>
        <button
          onClick={() => router.push("/login")}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99]"
        >
          <span>{locale === "ru" ? "Войти в систему" : "Tizimga kirish"}</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative z-10 w-full max-w-lg space-y-6 font-strict">
      {/* Top bar with back link and locale switcher */}
      <div className="flex items-center justify-between px-2 text-xs text-ink-muted">
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

      <div className="rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_30px_70px_-34px_rgba(16,24,40,0.35)] transition-all sm:p-10">
        {/* Brand header */}
        <div className="mb-8 text-center">
          <div className="public-eyebrow mb-4">
            <Sparkles className="h-3.5 w-3.5" />
            <span>e-darischi</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {locale === "ru" ? "Регистрация по приглашению" : "Taklifnoma orqali ro'yxatdan o'tish"}
          </h1>
          <p className="mt-2 text-pretty text-sm text-ink-muted">
            {locale === "ru"
              ? "Введите персональный код доступа от вашего учебного центра"
              : "O'quv markazingizdan olingan shaxsiy taklif kodini kiriting"}
          </p>
        </div>

        {/* Error banner */}
        {errorBanner && (
          <div className="animate-fade-in mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" />
            <div className="leading-snug">{errorBanner}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invite Code */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {locale === "ru" ? "Код приглашения" : "Taklif kodi"}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                <KeyRound className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                placeholder="INV-XXXXXX"
                value={formData.inviteCode}
                onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                className={`${fieldClass} font-mono font-semibold uppercase tracking-wider`}
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {locale === "ru" ? "ФИО / Полное имя" : "F.I.SH / To'liq ism"}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                placeholder={locale === "ru" ? "Алишер Навои" : "Alisher Navoiy"}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {locale === "ru" ? "Рабочий или личный Email" : "Ishchi yoki shaxsiy Email"}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                <Mail className="h-4 w-4" />
              </div>
              <input
                type="email"
                required
                placeholder="student@example.uz"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-soft">
              {locale === "ru" ? "Телефон (необязательно)" : "Telefon raqami (ixtiyoriy)"}
            </label>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                <Phone className="h-4 w-4" />
              </div>
              <input
                type="tel"
                placeholder="+998 90 123 45 67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={fieldClass}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                {locale === "ru" ? "Надёжный пароль (мин. 10 символов)" : "Parol (kamida 10 belgi)"}
              </label>
              <span className="text-[11px] font-medium text-ink-muted">
                {locale === "ru" ? pwdStrength.labelRu : pwdStrength.labelUz}
              </span>
            </div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-faint">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`${fieldClass} pr-11`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-ink-faint transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {/* Password strength bar */}
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              <div className={`h-1.5 rounded-full transition-all ${pwdStrength.score >= 1 ? pwdStrength.color : "bg-slate-200"}`} />
              <div className={`h-1.5 rounded-full transition-all ${pwdStrength.score >= 2 ? pwdStrength.color : "bg-slate-200"}`} />
              <div className={`h-1.5 rounded-full transition-all ${pwdStrength.score >= 3 ? pwdStrength.color : "bg-slate-200"}`} />
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-[color:var(--brand)] px-4 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.99] disabled:opacity-60"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            ) : (
              <>
                <span>{locale === "ru" ? "Завершить регистрацию" : "Ro'yxatdan o'tishni yakunlash"}</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badge */}
        <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-ink-faint">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>{locale === "ru" ? "Безопасное соединение и сквозное шифрование" : "Xavfsiz ulanish va shifrlash"}</span>
        </div>

        {/* Login redirect link */}
        <div className="mt-4 text-center">
          <p className="text-xs text-ink-muted">
            {locale === "ru" ? "Уже есть аккаунт в e-darischi?" : "e-darischi tizimida hisobingiz bormi?"}{" "}
            <Link
              href="/login"
              className="font-semibold text-[color:var(--brand)] transition-colors hover:text-[color:var(--brand-strong)] hover:underline"
            >
              {locale === "ru" ? "Войти в систему" : "Kirish"}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <div data-theme="light" className="public-shell mesh-gradient-light relative flex min-h-screen items-center justify-center overflow-hidden p-4 font-strict sm:p-6">
      {/* Ambient single-hue light */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[650px] w-[650px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/12 via-transparent to-transparent blur-[140px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-24 items-center justify-center lg:flex">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <GraduationCap className="h-5 w-5 text-[color:var(--brand)]" />
          <span>e-darischi</span>
        </div>
      </div>

      <Suspense fallback={<div className="text-sm font-strict text-ink-muted">Загрузка формы регистрации...</div>}>
        <RegisterContent />
      </Suspense>
    </div>
  );
}
