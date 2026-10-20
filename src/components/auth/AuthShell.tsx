"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";

interface AuthShellProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  /** Restrict the card width for compact flows (tokens, confirmations). */
  wide?: boolean;
}

/**
 * Shared premium shell for the public auth flows (password reset, email
 * confirmation, invite acceptance). Keeps the light, deep-blue public design
 * language consistent with the landing, login and register pages.
 */
export function AuthShell({ children, title, subtitle, wide = false }: AuthShellProps) {
  return (
    <div data-theme="light" className="public-shell mesh-gradient-light relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-10 font-strict sm:px-6">
      {/* Ambient single-hue light */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-tr from-blue-500/12 via-transparent to-transparent blur-[140px]" />

      <div className={`relative z-10 w-full ${wide ? "max-w-lg" : "max-w-md"}`}>
        <div className="mb-6 flex justify-center">
          <Link href="/" className="group flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_8px_20px_-8px_rgba(29,78,216,0.8)] ring-1 ring-inset ring-white/15 transition-transform duration-200 group-hover:scale-105">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold tracking-tight text-slate-900">e-darischi</span>
          </Link>
        </div>

        <div className="rounded-3xl border border-slate-200/90 bg-white p-8 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_30px_70px_-34px_rgba(16,24,40,0.35)] sm:p-10">
          {(title || subtitle) && (
            <div className="mb-6 text-center">
              {title && (
                <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
              )}
              {subtitle && <p className="mt-2 text-pretty text-sm text-ink-muted">{subtitle}</p>}
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
