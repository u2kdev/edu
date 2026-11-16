"use client";

import { useState } from "react";
import { ShieldAlert, ArrowLeft, Loader2, Lock } from "lucide-react";
import { t } from "@/i18n";

interface ImpersonationBannerProps {
  userName: string;
  role: string;
  centerName: string;
  locale: string;
  isReadOnly?: boolean;
}

export default function ImpersonationBanner({
  userName,
  role,
  centerName,
  locale,
  isReadOnly,
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
        alert(data.error || "Failed to return to platform");
        setLoading(false);
      }
    } catch {
      alert("Network error");
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
      className="sticky top-0 z-50 w-full bg-warning-subtle text-warning-subtle-foreground px-4 py-2 flex flex-wrap items-center justify-between gap-2.5 border-b border-warning/40 font-sans text-xs sm:text-sm font-medium"
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <ShieldAlert className="w-4 h-4 text-warning shrink-0" aria-hidden="true" />
        <span className="truncate">{message}</span>
        {isReadOnly && (
          <span className="inline-flex items-center gap-1 rounded-md border border-warning/40 bg-card/80 px-2 py-0.5 text-xs font-medium text-warning-subtle-foreground shrink-0">
            <Lock className="w-3 h-3" aria-hidden="true" />
            <span>{t(locale, "shell.readOnlyBadge")}</span>
          </span>
        )}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handleStop}
        className="min-h-[36px] px-3 py-1.5 bg-warning text-warning-foreground hover:opacity-90 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-opacity cursor-pointer shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
        )}
        <span>{loading ? t(locale, "platform.returningToPlatform") : t(locale, "platform.returnToPlatform")}</span>
      </button>
    </div>
  );
}
