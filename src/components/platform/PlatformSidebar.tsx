"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CreditCard,
  FileText,
  HelpCircle,
  Shield,
  Eye,
  Menu,
  X,
  ChevronRight,
  Sparkles,
  ArrowLeft,
} from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import LogoutButton from "@/components/LogoutButton";
import { t } from "@/i18n";

interface PlatformSidebarProps {
  user: {
    fullName: string;
    email: string;
    platformRole: string;
  };
  locale: string;
}

export default function PlatformSidebar({ user, locale }: PlatformSidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile drawer whenever route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  const navItems = [
    {
      href: "/platform-admin",
      icon: BarChart3,
      label: t(locale, "platform.analytics"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
      exact: true,
    },
    {
      href: "/platform-admin/centers",
      icon: Building2,
      label: t(locale, "platform.centerManagement"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS"],
    },
    {
      href: "/platform-admin/plans",
      icon: CreditCard,
      label: t(locale, "platform.plans"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN"],
    },
    {
      href: "/platform-admin/subscriptions",
      icon: FileText,
      label: t(locale, "platform.subscriptions"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN"],
    },
    {
      href: "/platform-admin/support",
      icon: HelpCircle,
      label: t(locale, "platform.support") || t(locale, "support.title"),
      roles: ["SUPERADMIN", "PLATFORM_ADMIN", "FULL_ACCESS", "PLATFORM_SUPPORT"],
    },
    {
      href: "/platform-admin/audit",
      icon: Shield,
      label: t(locale, "platform.auditLog"),
      roles: ["SUPERADMIN"],
    },
    {
      href: "/platform-admin/impersonate",
      icon: Eye,
      label: t(locale, "platform.impersonate"),
      roles: ["SUPERADMIN", "PLATFORM_SUPPORT"],
    },
  ];

  const visibleNav = navItems.filter((item) =>
    item.roles.includes(user.platformRole)
  );

  const isActive = (item: typeof navItems[0]) => {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  };

  const navContent = (
    <div className="flex flex-col h-full bg-white text-slate-800">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
        <Link
          href="/platform-admin"
          className="flex items-center gap-3 group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-xl"
        >
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-bold tracking-tight text-slate-900">
                e-darischi
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-blue-100 text-blue-700 rounded-md">
                Admin
              </span>
            </div>
            <span className="block text-[11px] font-medium text-slate-500 uppercase tracking-wider">
              {t(locale, "roles." + user.platformRole)}
            </span>
          </div>
        </Link>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen(false)}
          className="md:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Закрыть меню"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {t(locale, "platform.title")}
        </div>
        {visibleNav.map((item) => {
          const active = isActive(item);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 cursor-pointer group ${
                active
                  ? "bg-blue-50 text-blue-700 font-semibold border-l-4 border-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-medium"
              }`}
            >
              <Icon
                className={`w-4.5 h-4.5 transition-colors ${
                  active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-700"
                }`}
              />
              <span className="flex-1">{item.label}</span>
              <ChevronRight
                className={`w-4 h-4 transition-transform ${
                  active ? "text-blue-600 opacity-100" : "text-slate-300 opacity-0 group-hover:opacity-100"
                }`}
              />
            </Link>
          );
        })}
      </nav>

      {/* Bottom Footer Section */}
      <div className="p-4 border-t border-slate-200/80 space-y-3 bg-slate-50/50">
        {/* Link back to Center LMS */}
        <Link
          href="/center"
          className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-white rounded-lg border border-slate-200/60 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Вернуться в учебный центр</span>
        </Link>

        {/* Language switcher */}
        <div className="pt-1">
          <LanguageSwitcher currentLocale={locale} />
        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 px-2 py-1.5 bg-white rounded-xl border border-slate-200/60 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-sm">
            {user.fullName.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {user.fullName}
            </div>
            <div className="text-[11px] text-slate-500 truncate">
              {user.email}
            </div>
          </div>
        </div>

        <LogoutButton />
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Navbar with Hamburger */}
      <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Открыть меню навигации"
        >
          <Menu className="w-6 h-6" />
        </button>

        <Link href="/platform-admin" className="flex items-center gap-2 font-bold text-slate-900 text-base">
          <div className="h-7 w-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <span>e-darischi</span>
        </Link>

        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs">
          {user.fullName.charAt(0).toUpperCase()}
        </div>
      </header>

      {/* Mobile Drawer (Slide-out) */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer content */}
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Sidebar */}
      <aside className="hidden md:flex w-72 min-h-screen bg-white border-r border-slate-200 flex-col sticky top-0 h-screen overflow-y-auto shrink-0 shadow-sm z-20">
        {navContent}
      </aside>
    </>
  );
}
