"use client";

import React, { useState } from "react";
import { Save } from "lucide-react";
import { Alert, AlertDescription, Button } from "@/components/ui";

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
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>
            SEO мета-теги сохранены в базе данных платформы
          </AlertDescription>
        </Alert>
      )}

      {children}

      <div className="flex justify-end pt-2">
        <Button type="submit" variant="primary" disabled={saving}>
          <Save className="h-4 w-4" aria-hidden="true" />
          <span>{saving ? "Сохранение..." : "Сохранить SEO теги"}</span>
        </Button>
      </div>
    </form>
  );
}
