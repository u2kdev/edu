import ruTranslations from "./locales/ru.json";
import uzLatnTranslations from "./locales/uz-Latn.json";

// Supported locales
export const SUPPORTED_LOCALES = ["ru", "uz-Latn"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Locale metadata for UI display
export const LOCALE_META: Record<
  SupportedLocale,
  { label: string; nativeLabel: string; flag: string; dir: "ltr" | "rtl" }
> = {
  ru: { label: "Русский", nativeLabel: "Русский", flag: "🇷🇺", dir: "ltr" },
  "uz-Latn": {
    label: "Oʻzbekcha (Lotin)",
    nativeLabel: "Oʻzbekcha",
    flag: "🇺🇿",
    dir: "ltr",
  },
};

export const DEFAULT_LOCALE: SupportedLocale = "ru";

// All translations indexed by locale
const translations: Record<SupportedLocale, Record<string, unknown>> = {
  ru: ruTranslations as Record<string, unknown>,
  "uz-Latn": uzLatnTranslations as Record<string, unknown>,
};

/**
 * Get a translation string by dot-separated key path.
 * Supports parameter substitution with {paramName} syntax.
 *
 * @example
 * t("ru", "dashboard.welcome", { name: "Алексей" })
 * // => "Здравствуйте, Алексей! 👋"
 *
 * t("uz-Latn", "auth.inviteWelcome", { centerName: "IT Academy" })
 * // => "Xush kelibsiz! Sizga «IT Academy» oʻquv markaziga kirish huquqi berildi"
 */
export function t(
  locale: string,
  key: string,
  params?: Record<string, string | number>
): string {
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const localeData = translations[validLocale];

  // Navigate the nested object by key path
  const parts = key.split(".");
  let value: unknown = localeData;

  for (const part of parts) {
    if (value && typeof value === "object" && part in value) {
      value = (value as Record<string, unknown>)[part];
    } else {
      // Fallback to Russian if key not found in current locale
      if (validLocale !== "ru") {
        return t("ru", key, params);
      }
      // Return key itself if not found in any locale
      console.warn(`[i18n] Missing translation key: "${key}" for locale "${validLocale}"`);
      return key;
    }
  }

  if (typeof value !== "string") {
    console.warn(`[i18n] Translation key "${key}" resolved to non-string value`);
    return key;
  }

  // Substitute parameters: {paramName} → value
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, paramName) => {
      return paramName in params ? String(params[paramName]) : `{${paramName}}`;
    });
  }

  return value;
}

/**
 * Check if a locale string is valid/supported.
 */
export function isValidLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}

/**
 * Get all translation keys for a specific namespace.
 * Useful for rendering lists of options, role names, etc.
 *
 * @example
 * getNamespace("ru", "roles")
 * // => { SUPERADMIN: "Суперадмин", PLATFORM_ADMIN: "Админ платформы", ... }
 */
export function getNamespace(
  locale: string,
  namespace: string
): Record<string, string> {
  const validLocale = isValidLocale(locale) ? locale : DEFAULT_LOCALE;
  const localeData = translations[validLocale];

  if (namespace in localeData && typeof localeData[namespace] === "object") {
    return localeData[namespace] as Record<string, string>;
  }

  // Fallback to Russian
  if (validLocale !== "ru") {
    return getNamespace("ru", namespace);
  }

  return {};
}

/**
 * Format a date according to locale conventions.
 */
export function formatDateLocalized(
  date: Date | string | null | undefined,
  locale: string,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!date) return "—";

  const localeMap: Record<string, string> = {
    ru: "ru-RU",
    "uz-Latn": "uz-Latn-UZ",
  };

  const intlLocale = localeMap[locale] || "ru-RU";

  return new Date(date).toLocaleDateString(
    intlLocale,
    options || {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

/**
 * Format currency according to locale and currency code.
 */
export function formatCurrencyLocalized(
  amount: number,
  locale: string,
  currency: string = "UZS"
): string {
  const localeMap: Record<string, string> = {
    ru: "ru-RU",
    "uz-Latn": "uz-Latn-UZ",
  };

  const intlLocale = localeMap[locale] || "ru-RU";

  return new Intl.NumberFormat(intlLocale, {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(amount);
}
