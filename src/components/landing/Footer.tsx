"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, MapPin, Phone, Mail, Send } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { LangSwitcher } from "./LangSwitcher";
import { ThemeToggle } from "./ThemeToggle";

interface FooterProps {
  locale: LandingLocale;
}

export const Footer: React.FC<FooterProps> = ({ locale }) => {
  const t = getLandingMessages(locale);

  return (
    <footer className="bg-slate-50 dark:bg-[#070D1F] border-t border-slate-200 dark:border-white/10 pt-16 pb-12 text-slate-600 dark:text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8 mb-12">
          {/* Col 1: Brand & Description */}
          <div className="lg:col-span-5">
            <Link href={locale === "uz" ? "/" : "/ru"} className="flex items-center gap-2.5 mb-4 group">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/25">
                <GraduationCap className="w-5 h-5" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                e-darschi
                <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  LMS
                </span>
              </span>
            </Link>

            <p className="text-sm leading-relaxed max-w-sm mb-6 text-slate-600 dark:text-slate-400">
              {t.footer.brandDescription}
            </p>

            {/* Quick Language & Theme Controls in footer */}
            <div className="flex items-center gap-3">
              <LangSwitcher currentLocale={locale} />
              <ThemeToggle />
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-3">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              {t.footer.sections.product}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#imkoniyatlar" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  {t.footer.links.features}
                </a>
              </li>
              <li>
                <a href="#nega-biz" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  {t.whyUs.badge}
                </a>
              </li>
              <li>
                <a href="#ilovalari" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  {t.footer.links.apps}
                </a>
              </li>
              <li>
                <a href="#tariflar" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  {t.footer.links.pricing}
                </a>
              </li>
              <li>
                <a href="#faq" className="hover:text-blue-600 dark:hover:text-white transition-colors">
                  {t.footer.links.faq}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: Contacts in Tashkent */}
          <div className="lg:col-span-4">
            <h4 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white mb-4">
              {t.footer.sections.contacts}
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <span>
                  {t.footer.contacts.city}, {t.footer.contacts.address}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <a href={`tel:${t.footer.contacts.phone.replace(/\s+/g, "")}`} className="hover:text-blue-600 dark:hover:text-white">
                  {t.footer.contacts.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <a href={`mailto:${t.footer.contacts.email}`} className="hover:text-blue-600 dark:hover:text-white">
                  {t.footer.contacts.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Send className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <a
                  href="https://t.me/edarschi_support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-blue-600 dark:hover:text-white"
                >
                  {t.footer.contacts.telegram}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom row: copyright */}
        <div className="pt-8 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div>
            © {new Date().getFullYear()} e-darschi. {t.footer.rights}
          </div>
          <div className="flex items-center gap-6">
            <span className="hover:text-blue-600 dark:hover:text-white cursor-pointer">
              {t.footer.links.terms}
            </span>
            <span className="hover:text-blue-600 dark:hover:text-white cursor-pointer">
              {t.footer.links.privacy}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
