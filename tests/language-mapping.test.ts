import { describe, it, expect } from "vitest";
import { localeToLanguage, languageToLocale, toEmailLang } from "../src/lib/language";

describe("language locale <-> Prisma enum mapping", () => {
  it("maps app locales to Prisma Language values", () => {
    expect(localeToLanguage("ru")).toBe("ru");
    expect(localeToLanguage("uz-Latn")).toBe("uz_Latn");
    expect(localeToLanguage("uz-Cyrl")).toBe("uz_Cyrl");
    expect(localeToLanguage("xx")).toBe("ru");
    expect(localeToLanguage(null)).toBe("ru");
    expect(localeToLanguage(undefined)).toBe("ru");
  });

  it("maps Prisma Language values back to app locales", () => {
    expect(languageToLocale("ru")).toBe("ru");
    expect(languageToLocale("uz_Latn")).toBe("uz-Latn");
    // Cyrillic Uzbek is not shipped by the UI — falls back to the default locale.
    expect(languageToLocale("uz_Cyrl")).toBe("ru");
    expect(languageToLocale(null)).toBe("ru");
    expect(languageToLocale(undefined)).toBe("ru");
  });

  it("detects the Uzbek email language from any stored code", () => {
    expect(toEmailLang("uz")).toBe("uz");
    expect(toEmailLang("uz-Latn")).toBe("uz");
    expect(toEmailLang("uz_Latn")).toBe("uz");
    expect(toEmailLang("uz-Cyrl")).toBe("uz");
    expect(toEmailLang("ru")).toBe("ru");
    expect(toEmailLang(null)).toBe("ru");
    expect(toEmailLang(undefined)).toBe("ru");
  });
});
