"use client";

import React, { useState } from "react";
import { Save, CheckCircle2, AlertTriangle } from "lucide-react";

interface SEOFormClientProps {
  initialTitle: string;
  initialDesc: string;
  initialOgImage: string;
  initialKeywords: string;
  children: React.ReactNode;
}

export default function SEOFormClient({ children }: SEOFormClientProps) {
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const payload = {
      metaTitleRu: String(formData.get("metaTitleRu") || "").trim(),
      metaDescRu: String(formData.get("metaDescRu") || "").trim(),
      ogImageUrl: String(formData.get("ogImageUrl") || "").trim(),
      keywords: String(formData.get("keywords") || "").trim(),
    };

    try {
      const res = await fetch("/api/platform/seo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.[0]?.message || data.error || "Ошибка сохранения");
      } else {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      }
    } catch {
      setError("Ошибка сетевого соединения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          SEO мета-теги успешно сохранены в базе данных платформы
        </div>
      )}

      {children}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl shadow-sm transition disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {saving ? "Сохранение..." : "Сохранить SEO теги"}
        </button>
      </div>
    </form>
  );
}
