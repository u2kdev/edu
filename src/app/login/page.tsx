"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Building2, ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";
import { t } from "@/i18n";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorBanner, setErrorBanner] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const locale = "ru"; // hardcoded for now, can be read from context/provider

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner("");
    setFieldErrors({});
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        if (data.error) {
          if (data.error.code === "VALIDATION_ERROR" && Array.isArray(data.error.details)) {
            const errs: Record<string, string> = {};
            data.error.details.forEach((issue: any) => {
              if (issue.path && issue.path.length > 0) {
                // issue.message contains the i18n key (e.g. auth.email.invalid)
                errs[issue.path[0]] = t(locale, issue.message);
              }
            });
            setFieldErrors(errs);
            setErrorBanner(t(locale, "common.error"));
          } else if (data.error.code === "RATE_LIMITED") {
            setErrorBanner("Слишком много попыток. Пожалуйста, попробуйте через 15 минут.");
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
    } catch (err: any) {
      setErrorBanner(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand-600/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-brand-500/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">{t(locale, "auth.login")}</h1>
          <p className="text-sm text-slate-400">Введите ваш email и пароль для доступа к кабинету</p>
        </div>

        {/* Login Form */}
        <div className="glass-panel p-8 rounded-3xl border border-slate-800 shadow-2xl">
          {errorBanner && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{errorBanner}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Email</label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  disabled={loading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="director@it-academy.com"
                  className={`w-full pl-11 pr-4 py-3 bg-slate-900/80 border ${fieldErrors.email ? 'border-rose-500' : 'border-slate-700/80'} rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors text-sm`}
                />
              </div>
              {fieldErrors.email && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.email}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Пароль</label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  disabled={loading}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className={`w-full pl-11 pr-4 py-3 bg-slate-900/80 border ${fieldErrors.password ? 'border-rose-500' : 'border-slate-700/80'} rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors text-sm`}
                />
              </div>
              {fieldErrors.password && (
                <p className="mt-1 text-xs text-rose-400">{fieldErrors.password}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold rounded-xl shadow-lg shadow-brand-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t(locale, "common.loading") : t(locale, "auth.loginButton")}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Development Fast Login */}
        <div className="mt-6 flex flex-col gap-2">
          <p className="text-xs text-slate-500 text-center uppercase tracking-wider font-semibold mb-2">Быстрый вход (Dev)</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                setEmail("admin@platform.com");
                setPassword("Password123!");
              }}
              className="py-2 text-xs font-semibold rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all"
            >
              Суперадмин
            </button>
            <button
              onClick={() => {
                setEmail("director@it-academy.com");
                setPassword("Password123!");
              }}
              className="py-2 text-xs font-semibold rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
            >
              Директор Центра
            </button>
          </div>
        </div>

        <div className="text-center mt-6 text-sm text-slate-400">
          Ещё нет аккаунта?{" "}
          <Link href="/register" className="text-brand-400 hover:underline font-semibold">
            {t(locale, "auth.register")}
          </Link>
        </div>
      </div>
    </div>
  );
}
