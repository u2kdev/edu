import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ru from "./locales/ru.json";
import uz from "./locales/uz.json";

export const resources = {
  ru: { translation: ru },
  uz: { translation: uz },
} as const;

export type SupportedLanguage = "ru" | "uz";

let detectedLanguage: SupportedLanguage = "uz";
try {
  const Localization = require("expo-localization");
  const locales = Localization.getLocales();
  if (locales && locales.length > 0) {
    const langCode = locales[0].languageCode;
    if (langCode === "ru") {
      detectedLanguage = "ru";
    }
  }
} catch {
  // outside native environment
}

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: detectedLanguage,
    fallbackLng: "uz",
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
