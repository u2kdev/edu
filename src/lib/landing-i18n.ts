import uzMessages from "../../messages/uz.json";
import ruMessages from "../../messages/ru.json";
import { LandingLocale } from "../types/landing";

export type LandingTranslations = typeof uzMessages;

const translations: Record<LandingLocale, LandingTranslations> = {
  uz: uzMessages,
  ru: ruMessages,
};

export function getLandingMessages(locale: LandingLocale): LandingTranslations {
  return translations[locale] || translations.uz;
}

export function formatPrice(amount: number, locale: LandingLocale): string {
  const formatter = new Intl.NumberFormat(locale === "uz" ? "uz-UZ" : "ru-RU", {
    style: "decimal",
    maximumFractionDigits: 0,
  });
  const formatted = formatter.format(amount);
  return locale === "uz" ? `${formatted} so'm` : `${formatted} сум`;
}
