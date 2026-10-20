"use client";

import { useState } from "react";
import { t } from "@/i18n";

export default function ChangePasswordPage() {
  const locale = "ru";

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    try {
      const res = await fetch("/api/auth/password/change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
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
        setCurrentPassword("");
        setNewPassword("");
      }
    } catch {
      setError(t(locale, "common.error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">
        {t(locale, "profile.changePassword")}
      </h1>

      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 text-green-600 p-4 rounded mb-4 text-sm">
          {t(locale, "auth.changePasswordSuccess")}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t(locale, "auth.currentPassword")}
          </label>
          <input
            type="password"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            {t(locale, "auth.newPassword")}
          </label>
          <input
            type="password"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            {t(locale, "auth.passwordHint")}
          </p>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? t(locale, "common.loading") : t(locale, "auth.changePassword")}
          </button>
        </div>
      </form>
    </div>
  );
}
