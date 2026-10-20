"use client";

import React from "react";
import Link from "next/link";
import { GraduationCap, MapPin, Phone, Mail, Send, Clock, Navigation } from "lucide-react";
import { LandingLocale } from "../../types/landing";
import { getLandingMessages } from "../../lib/landing-i18n";
import { LangSwitcher } from "./LangSwitcher";

interface FooterProps {
  locale: LandingLocale;
}

export const Footer: React.FC<FooterProps> = ({ locale }) => {
  const t = getLandingMessages(locale);

  const officeQuery = encodeURIComponent(`${t.footer.contacts.address}, ${t.footer.contacts.city}`);
  const mapEmbedSrc =
    "https://www.openstreetmap.org/export/embed.html?bbox=69.2710%2C41.3050%2C69.2900%2C41.3180&layer=mapnik&marker=41.3114%2C69.2804";

  return (
    <footer className="bg-gradient-to-b from-[color:var(--grad-b)] to-[color:var(--grad-base)] pb-12 pt-20 font-strict text-ink-muted">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top grid: brand, navigation, about, contacts */}
        <div className="mb-14 grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12 lg:gap-8">
          {/* Col 1: Brand & Description */}
          <div className="sm:col-span-2 lg:col-span-4">
            <Link href={locale === "uz" ? "/" : "/ru"} className="group mb-4 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_8px_20px_-8px_rgba(29,78,216,0.8)] ring-1 ring-inset ring-white/15 transition-transform duration-200 group-hover:scale-105">
                <GraduationCap className="h-5 w-5" />
              </div>
              <span className="flex items-center text-xl font-bold tracking-tight text-ink">
                e-darischi
                <span className="ml-2 rounded-md bg-[color:var(--brand-soft)] px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-[color:var(--brand-strong)]">
                  LMS
                </span>
              </span>
            </Link>

            <p className="mb-6 max-w-sm text-pretty text-sm leading-relaxed text-ink-muted">
              {t.footer.brandDescription}
            </p>

            <div className="flex items-center gap-3">
              <LangSwitcher currentLocale={locale} />
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div className="lg:col-span-2">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink">
              {t.footer.sections.product}
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#imkoniyatlar" className="transition-colors hover:text-[color:var(--brand)]">
                  {t.footer.links.features}
                </a>
              </li>
              <li>
                <a href="#nega-biz" className="transition-colors hover:text-[color:var(--brand)]">
                  {t.footer.links.whyUs}
                </a>
              </li>
              <li>
                <a href="#ilovalari" className="transition-colors hover:text-[color:var(--brand)]">
                  {t.footer.links.apps}
                </a>
              </li>
              <li>
                <a href="#tariflar" className="transition-colors hover:text-[color:var(--brand)]">
                  {t.footer.links.pricing}
                </a>
              </li>
              <li>
                <a href="#faq" className="transition-colors hover:text-[color:var(--brand)]">
                  {t.footer.links.faq}
                </a>
              </li>
            </ul>
          </div>

          {/* Col 3: About us */}
          <div className="lg:col-span-3">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink">
              {t.footer.aboutTitle}
            </h4>
            <p className="mb-5 text-pretty text-sm leading-relaxed text-ink-muted">
              {t.footer.aboutText}
            </p>
            <dl className="grid grid-cols-3 gap-3">
              {t.footer.stats.map((stat) => (
                <div key={stat.label} className="rounded-xl border border-[color:var(--line)] bg-[color:var(--surface-a70)] px-3 py-2.5">
                  <dt className="public-tabular text-base font-bold leading-none text-[color:var(--brand)]">
                    {stat.value}
                  </dt>
                  <dd className="mt-1 text-[10px] font-medium leading-tight text-ink-faint">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Col 4: Contacts */}
          <div className="lg:col-span-3">
            <h4 className="mb-4 text-xs font-bold uppercase tracking-[0.14em] text-ink">
              {t.footer.sections.contacts}
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                <span>
                  {t.footer.contacts.city}, {t.footer.contacts.address}
                </span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                <a
                  href={`tel:${t.footer.contacts.phone.replace(/\s+/g, "")}`}
                  className="transition-colors hover:text-[color:var(--brand)]"
                >
                  {t.footer.contacts.phone}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                <a
                  href={`mailto:${t.footer.contacts.email}`}
                  className="transition-colors hover:text-[color:var(--brand)]"
                >
                  {t.footer.contacts.email}
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Send className="h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                <a
                  href="https://t.me/edarschi_support"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="transition-colors hover:text-[color:var(--brand)]"
                >
                  {t.footer.contacts.telegram}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Office location block with a live map */}
        <div className="mb-12 overflow-hidden rounded-3xl border border-[color:var(--line)] bg-[color:var(--surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_60px_-36px_rgba(16,24,40,0.3)]">
          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Info side */}
            <div className="order-2 p-7 sm:p-9 lg:order-1">
              <span className="public-eyebrow mb-4">{t.footer.officeTitle}</span>
              <h3 className="mb-3 text-2xl font-bold tracking-tight text-ink">
                {t.footer.contacts.city}
              </h3>
              <p className="mb-6 flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                <span>{t.footer.contacts.address}</span>
              </p>

              <div className="mb-7 space-y-3 text-sm">
                <div className="flex items-center gap-2.5 text-ink-soft">
                  <Clock className="h-4 w-4 shrink-0 text-[color:var(--brand)]" />
                  <span>{t.footer.officeHours}</span>
                </div>
                <p className="text-xs leading-relaxed text-ink-faint">{t.footer.officeNote}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${officeQuery}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-[color:var(--brand-solid)] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_36px_-16px_rgba(29,78,216,0.8)] transition-all hover:bg-[color:var(--brand-strong)] active:scale-[0.98]"
                >
                  <Navigation className="h-4 w-4" />
                  <span>{t.footer.mapLink}</span>
                </a>
                <a
                  href={`tel:${t.footer.contacts.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--line-strong)] bg-[color:var(--surface)] px-5 py-3 text-sm font-semibold text-ink-soft transition-colors hover:text-ink"
                >
                  <Phone className="h-4 w-4" />
                  <span>{t.footer.contacts.phone}</span>
                </a>
              </div>
            </div>

            {/* Map side */}
            <div className="relative order-1 min-h-[260px] border-b border-[color:var(--line)] lg:order-2 lg:border-b-0 lg:border-l">
              <iframe
                title={t.footer.mapLabel}
                src={mapEmbedSrc}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
              {/* Soft brand tint so the map matches the light premium surface */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-[color:var(--brand-a04)]"
              />
            </div>
          </div>
        </div>

        {/* Bottom row: copyright + legal */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-[color:var(--line)] pt-8 text-xs sm:flex-row">
          <div>
            © {new Date().getFullYear()} e-darischi. {t.footer.rights}
          </div>
          <div className="flex items-center gap-6">
            <span className="cursor-pointer transition-colors hover:text-[color:var(--brand)]">
              {t.footer.links.terms}
            </span>
            <span className="cursor-pointer transition-colors hover:text-[color:var(--brand)]">
              {t.footer.links.privacy}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
};
