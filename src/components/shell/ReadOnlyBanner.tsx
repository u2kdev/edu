"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import { t } from "@/i18n";

interface ReadOnlyBannerProps {
  locale: string;
  centerStatus?: string | null;
  isSuspendedCenterNotice?: boolean;
}

export function ReadOnlyBanner({
  locale,
  centerStatus,
  isSuspendedCenterNotice = false,
}: ReadOnlyBannerProps) {
  return (
    <div
      role="status"
      className="w-full bg-warning-subtle border-b border-warning/30 px-4 sm:px-6 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs text-warning-subtle-foreground"
    >
      <div className="flex items-center gap-2 min-w-0 flex-wrap">
        <span className="inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md bg-warning/15 border border-warning/30 shrink-0">
          <Lock className="w-3 h-3" aria-hidden="true" />
          <span>{centerStatus && isSuspendedCenterNotice ? centerStatus : t(locale, "shell.readOnlyBadge")}</span>
        </span>
        <span className="truncate">
          {isSuspendedCenterNotice
            ? t(locale, "dashboard.suspendedNotice")
            : t(locale, "shell.readOnlySupportNotice")}
        </span>
      </div>
      {isSuspendedCenterNotice && (
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/center/suspended"
            className="underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
          >
            {t(locale, "dashboard.moreDetails")}
          </Link>
          <Link
            href="/center/support"
            className="px-3 py-1 rounded-md bg-warning text-warning-foreground font-medium transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t(locale, "dashboard.writeToSupport")}
          </Link>
        </div>
      )}
    </div>
  );
}
