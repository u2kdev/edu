"use client";

import { useState } from "react";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import { t } from "@/i18n";

interface ImpersonationBannerProps {
  userName: string;
  role: string;
  centerName: string;
  locale: string;
}

export default function ImpersonationBanner({
  userName,
  role,
  centerName,
  locale,
}: ImpersonationBannerProps) {
  const [loading, setLoading] = useState(false);

  const handleStop = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/impersonate/stop", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        window.location.href = data.redirectUrl || "/platform-admin";
      } else {
        alert(data.error || "Ошибка возврата в платформу");
        setLoading(false);
      }
    } catch {
      alert("Ошибка сети");
      setLoading(false);
    }
  };

  const roleLabel = t(locale, `roles.${role}`) || role;
  const message = t(locale, "platform.impersonationBanner", {
    userName,
    role: roleLabel,
    centerName,
  });

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 w-full bg-amber-400 text-amber-950 px-4 py-2.5 shadow-md flex flex-wrap items-center justify-between gap-3 border-b border-amber-500 font-sans text-xs sm:text-sm font-medium"
    >
      <div className="flex items-center gap-2 min-w-0">
        <ShieldAlert className="w-4 h-4 text-amber-900 shrink-0" />
        <span className="truncate">{message}</span>
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleStop}
        className="px-3 py-1.5 bg-amber-950 text-amber-100 hover:bg-black rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ArrowLeft className="w-3.5 h-3.5" />
        )}
        <span>{loading ? t(locale, "platform.returningToPlatform") : t(locale, "platform.returnToPlatform")}</span>
      </button>
    </div>
  );
}
