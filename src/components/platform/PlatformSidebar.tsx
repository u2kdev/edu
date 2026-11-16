"use client";

import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

interface PlatformSidebarProps {
  user: {
    fullName: string;
    email: string;
    avatarUrl?: string | null;
    platformRole: string;
  };
  locale: string;
  children?: ReactNode;
}

/**
 * Legacy wrapper kept for backwards compatibility with isolated component tests;
 * delegates directly to the unified `AppShell` in platform scope.
 */
export default function PlatformSidebar({ user, locale, children }: PlatformSidebarProps) {
  return (
    <AppShell
      scope="platform"
      locale={locale}
      user={user}
      navContext={{
        scope: "platform",
        platformRole: user.platformRole,
      }}
      showReturnToCenterLink
    >
      {children}
    </AppShell>
  );
}
