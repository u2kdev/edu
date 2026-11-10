import { describe, it, expect } from "vitest";

import hierarchicalRu from "../src/i18n/locales/ru.json";
import hierarchicalUz from "../src/i18n/locales/uz-Latn.json";
import { t } from "../src/i18n";

function getDeepKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  let keys: string[] = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    const val = obj[k];
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      keys = keys.concat(getDeepKeys(val as Record<string, unknown>, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

describe("i18n", () => {
  it("should have matching recursive keys in src/i18n/locales ru.json and uz-Latn.json", () => {
    const ruKeys = getDeepKeys(hierarchicalRu).sort();
    const uzKeys = getDeepKeys(hierarchicalUz).sort();

    const missingInUz = ruKeys.filter((k) => !uzKeys.includes(k));
    const missingInRu = uzKeys.filter((k) => !ruKeys.includes(k));

    expect(missingInUz).toEqual([]);
    expect(missingInRu).toEqual([]);
    expect(ruKeys).toEqual(uzKeys);
  });

  it("resolves nested keys in both locales", () => {
    expect(t("ru", "profile.myDevices")).toBe("Мои устройства");
    expect(t("uz-Latn", "profile.myDevices")).toBe("Mening qurilmalarim");
    expect(t("ru", "auth.confirm.title")).toBe("Подтверждение почты");
    expect(t("uz-Latn", "auth.forgot.title")).toBe("Parolni tiklash");
    expect(t("ru", "common.error")).toBe("Ошибка");
  });

  it("resolves dotted keys stored as a single nested key (validation messages)", () => {
    // These are used as zod messages, e.g. z.string().min(8, "auth.password.min_8").
    expect(t("ru", "auth.password.min_8")).not.toBe("auth.password.min_8");
    expect(t("ru", "auth.password.min_8")).toContain("8");
    expect(t("ru", "auth.email.invalid")).not.toBe("auth.email.invalid");
    expect(t("ru", "auth.token.required")).not.toBe("auth.token.required");
  });

  it("falls back to the key itself for unknown keys", () => {
    expect(t("ru", "does.not.exist")).toBe("does.not.exist");
  });

  it("ACC-1b Item 8: includes ACC-3 platform finance keys (MRR, center subscriptions, tariffs, platform expenses) and MOBILE-FIN keys in ru and uz-Latn", () => {
    expect(t("ru", "finance.platformFinance")).toBe("Финансы платформы");
    expect(t("uz-Latn", "finance.platformFinance")).toBe("Platforma moliyasi");
    expect(t("ru", "finance.mrr")).toContain("MRR");
    expect(t("uz-Latn", "finance.mrr")).toContain("MRR");
    expect(t("ru", "finance.centerSubscriptions")).toBe("Оплаты подписок центров");
    expect(t("uz-Latn", "finance.centerSubscriptions")).toBe("Markazlar obuna to'lovlari");
    expect(t("ru", "finance.platformTariffs")).toBe("Тарифные планы платформы");
    expect(t("uz-Latn", "finance.platformTariffs")).toBe("Platforma tarif rejalari");
    expect(t("ru", "finance.platformExpenses")).toBe("Расходы платформы");
    expect(t("uz-Latn", "finance.platformExpenses")).toBe("Platforma xarajatlari");
    expect(t("ru", "finance.mobileFinance")).toBe("Мобильный финансовый кабинет");
    expect(t("uz-Latn", "finance.mobileFinance")).toBe("Mobil moliyaviy kabinet");
  });
});
