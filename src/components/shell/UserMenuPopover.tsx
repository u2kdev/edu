"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronsUpDown,
  Globe,
  HelpCircle,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Sliders,
  Sun,
  User,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { usePanelTheme } from "@/components/theme/PanelThemeProvider";
import { t, type SupportedLocale } from "@/i18n";
import { reloadPage } from "@/lib/reload";
import type { AppScope } from "@/config/navigation";

interface UserMenuPopoverProps {
  user: {
    fullName: string;
    email: string;
    avatarUrl?: string | null;
  };
  roleLabel: string;
  contextLabel: string;
  locale: string;
  scope: AppScope;
  supportHref?: string | null;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function UserMenuPopover({
  user,
  roleLabel,
  contextLabel,
  locale,
  supportHref,
  collapsed = false,
  onNavigate,
}: UserMenuPopoverProps) {
  const router = useRouter();
  const { theme, setTheme } = usePanelTheme();
  const [open, setOpen] = useState(false);
  const [savingLang, setSavingLang] = useState(false);

  const handleLanguageSwitch = async (nextLocale: SupportedLocale) => {
    if (nextLocale === locale || savingLang) return;
    setSavingLang(true);
    try {
      const res = await fetch("/api/auth/me/language", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: nextLocale }),
      });
      if (res.ok) {
        setOpen(false);
        reloadPage();
      }
    } catch {
      // keep UI usable on transient failure
    } finally {
      setSavingLang(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setOpen(false);
      router.push("/login");
      router.refresh();
    }
  };

  const linkClass =
    "flex items-center gap-2.5 min-h-[40px] px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t(locale, "shell.userMenuAria")}
          className={`w-full flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 hover:bg-muted/80 transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            collapsed ? "justify-center p-1.5 min-h-[44px]" : "px-2.5 py-2 min-h-[52px]"
          }`}
        >
          <Avatar
            src={user.avatarUrl}
            name={user.fullName}
            alt={user.fullName}
            size="sm"
          />
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-foreground truncate">
                  {user.fullName}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {roleLabel} · {contextLabel}
                </div>
              </div>
              <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            </>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align={collapsed ? "start" : "center"}
        sideOffset={8}
        className="w-72 p-1.5"
      >
        <div className="px-2.5 py-2 border-b border-border mb-1">
          <div className="text-sm font-semibold text-foreground truncate">
            {user.fullName}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {user.email}
          </div>
          <div className="text-xs text-primary font-medium truncate mt-0.5">
            {roleLabel} · {contextLabel}
          </div>
        </div>

        <nav className="space-y-0.5" aria-label={t(locale, "shell.userMenuAria")}>
          <Link
            href="/account?tab=profile"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={linkClass}
          >
            <User className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{t(locale, "account.tabProfile")}</span>
          </Link>

          <Link
            href="/account?tab=appearance"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={linkClass}
          >
            <Sliders className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{t(locale, "shell.accountSettings")}</span>
          </Link>

          <Link
            href="/account?tab=security"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={linkClass}
          >
            <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{t(locale, "shell.security")}</span>
          </Link>

          <Link
            href="/account?tab=notifications"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
            }}
            className={linkClass}
          >
            <Bell className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
            <span>{t(locale, "nav.notifications")}</span>
          </Link>

          {supportHref && (
            <Link
              href={supportHref}
              onClick={() => {
                setOpen(false);
                onNavigate?.();
              }}
              className={linkClass}
            >
              <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>{t(locale, "nav.support")}</span>
            </Link>
          )}
        </nav>

        <div className="my-1.5 border-t border-border" />

        {/* Language selector */}
        <div className="px-2.5 py-1.5 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Globe className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t(locale, "common.language")}</span>
          </span>
          <div className="inline-flex rounded-md border border-border bg-muted p-0.5">
            {(["ru", "uz-Latn"] as SupportedLocale[]).map((loc) => {
              const active = locale === loc;
              return (
                <button
                  key={loc}
                  type="button"
                  disabled={savingLang}
                  onClick={() => handleLanguageSwitch(loc)}
                  aria-pressed={active}
                  className={`min-h-[28px] px-2 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-card text-foreground shadow-xs border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {loc === "ru" ? "RU" : "Oʻz"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Theme selector */}
        <div className="px-2.5 py-1.5 space-y-1.5">
          <div className="text-xs text-muted-foreground">{t(locale, "theme.label")}</div>
          <div className="grid grid-cols-3 gap-1 rounded-md border border-border bg-muted p-0.5">
            {[
              { id: "light" as const, label: t(locale, "theme.shortLight"), Icon: Sun },
              { id: "dark" as const, label: t(locale, "theme.shortDark"), Icon: Moon },
              { id: "system" as const, label: t(locale, "theme.shortSystem"), Icon: Monitor },
            ].map(({ id, label, Icon }) => {
              const active = theme === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTheme(id)}
                  aria-pressed={active}
                  className={`min-h-[30px] px-1.5 rounded flex items-center justify-center gap-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    active
                      ? "bg-card text-foreground border border-border"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="my-1.5 border-t border-border" />

        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 min-h-[40px] px-2.5 py-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t(locale, "common.logout")}</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
