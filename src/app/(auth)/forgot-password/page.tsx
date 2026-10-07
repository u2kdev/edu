"use client";

import { useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";

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
        setError(t(data.error?.message || "auth.error", locale));
      } else {
        setSuccess(true);
      }
    } catch (err: any) {
      setError(t("auth.error", locale));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 bg-white p-8 shadow rounded-lg">
        <div>
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">
            {t("auth.forgotPassword.title", locale)}
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {t("auth.forgotPassword.subtitle", locale)}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded text-sm text-center">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 text-green-600 p-4 rounded text-center">
              {t("auth.resetLinkSent", locale)}
            </div>
            <div className="text-center">
              <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
                {t("auth.backToLogin", locale)}
              </Link>
            </div>
          </div>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                {t("auth.email", locale)}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative flex w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
              >
                {loading ? t("common.loading", locale) : t("auth.forgotPassword.submit", locale)}
              </button>
            </div>

            <div className="text-center mt-4">
              <Link href="/login" className="text-blue-600 hover:text-blue-500 font-medium text-sm">
                {t("auth.backToLogin", locale)}
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
