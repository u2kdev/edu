import type { Language } from "@prisma/client";
import { DEFAULT_LOCALE, type SupportedLocale } from "@/i18n";

/**
 * Bridge between app locale codes (from `@/i18n`, e.g. "uz-Latn") and the Prisma
 * `Language` enum. The enum identifiers cannot contain a hyphen, so the DB values
 * are declared with `@map` in the schema; this module is the single conversion point.
 */
const LOCALE_TO_LANGUAGE: Record<string, Language> = {
  ru: "ru",
  "uz-Latn": "uz_Latn",
  "uz-Cyrl": "uz_Cyrl",
};

const LANGUAGE_TO_LOCALE: Record<Language, SupportedLocale> = {
  ru: "ru",
  uz_Latn: "uz-Latn",
  // The app UI ships ru + uz-Latn only; fall back to Russian for Cyrillic Uzbek.
  uz_Cyrl: "ru",
};

/** App locale → Prisma enum value (unknown locales become "ru"). */
export function localeToLanguage(locale: string | null | undefined): Language {
  if (!locale) return "ru";
  return LOCALE_TO_LANGUAGE[locale] ?? "ru";
}

/** Prisma enum value → app locale (unknown/unsupported values become the default locale). */
export function languageToLocale(lang: Language | null | undefined): SupportedLocale {
  if (!lang) return DEFAULT_LOCALE;
  return LANGUAGE_TO_LOCALE[lang] ?? DEFAULT_LOCALE;
}

/**
 * Any stored/legacy language code ("uz", "uz-Latn", "uz_Latn", …) → two-letter
 * email language used by templates.
 */
export function toEmailLang(value: string | null | undefined): "ru" | "uz" {
  return typeof value === "string" && value.toLowerCase().startsWith("uz") ? "uz" : "ru";
}
