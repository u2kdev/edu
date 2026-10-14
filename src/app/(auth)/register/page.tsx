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
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200/90 p-8 sm:p-10 text-center relative z-10 transition-all font-strict">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
          <CheckCircle2 className="w-9 h-9" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          {locale === "ru" ? "Регистрация успешна!" : "Ro'yxatdan muvaffaqiyatli o'tdingiz!"}
        </h2>
        <p className="text-slate-600 text-sm mb-6 leading-relaxed">
          {locale === "ru"
            ? "Ваша учетная запись активирована. Проверьте почту или сразу перейдите к авторизации в системе."
            : "Profilingiz faollashtirildi. E-pochtangizni tekshiring yoki to'g'ridan-to'g'ri tizimga kiring."}
        </p>
        <button
          onClick={() => router.push("/login")}
          className="w-full py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-500/20 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
        >
          <span>{locale === "ru" ? "Войти в систему" : "Tizimga kirish"}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg relative z-10 space-y-6 font-strict">
      {/* Top bar with back link and locale switcher */}
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

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/90 p-8 sm:p-10 transition-all">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200/60 text-blue-700 text-xs font-semibold tracking-wide uppercase mb-4 shadow-xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span>e-darischi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
            {locale === "ru" ? "Регистрация по приглашению" : "Taklifnoma orqali ro'yxatdan o'tish"}
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {locale === "ru"
              ? "Введите персональный код доступа от вашего учебного центра"
              : "O'quv markazingizdan olingan shaxsiy taklif kodini kiriting"}
          </p>
        </div>

        {/* Error banner */}
        {errorBanner && (
          <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-start gap-3 animate-in fade-in">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="leading-snug">{errorBanner}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Invite Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {locale === "ru" ? "Код приглашения" : "Taklif kodi"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder="INV-XXXXXX"
                value={formData.inviteCode}
                onChange={(e) => setFormData({ ...formData, inviteCode: e.target.value.toUpperCase() })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 font-mono font-semibold tracking-wider text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all uppercase"
              />
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {locale === "ru" ? "ФИО / Полное имя" : "F.I.SH / To'liq ism"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                placeholder={locale === "ru" ? "Алишер Навои" : "Alisher Navoiy"}
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {locale === "ru" ? "Рабочий или личный Email" : "Ishchi yoki shaxsiy Email"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                placeholder="student@example.uz"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              {locale === "ru" ? "Телефон (необязательно)" : "Telefon raqami (ixtiyoriy)"}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Phone className="w-4 h-4" />
              </div>
              <input
                type="tel"
                placeholder="+998 90 123 45 67"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                {locale === "ru" ? "Надёжный пароль (мин. 10 символов)" : "Parol (kamida 10 belgi)"}
              </label>
              <span className="text-[11px] font-medium text-slate-500">
                {locale === "ru" ? pwdStrength.labelRu : pwdStrength.labelUz}
              </span>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
            className="w-full mt-2 py-3 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <span>{locale === "ru" ? "Завершить регистрацию" : "Ro'yxatdan o'tishni yakunlash"}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Security badge */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>{locale === "ru" ? "Безопасное соединение и сквозное шифрование" : "Xavfsiz ulanish va shifrlash"}</span>
        </div>

        {/* Login redirect link */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500">
            {locale === "ru" ? "Уже есть аккаунт в e-darischi?" : "e-darischi tizimida hisobingiz bormi?"}{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden particles-bg font-strict">
      {/* Ambient mesh gradient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[650px] bg-gradient-to-tr from-blue-400/15 via-indigo-400/10 to-transparent rounded-full blur-[140px] pointer-events-none" />

      <Suspense fallback={<div className="text-slate-500 text-sm font-strict">Загрузка формы регистрации...</div>}>
        <RegisterContent />
      </Suspense>
    </div>
  );
}
