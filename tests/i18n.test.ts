import { describe, it, expect } from "vitest";
import ru from "../src/locales/ru.json";
import uz from "../src/locales/uz-Latn.json";

import hierarchicalRu from "../src/i18n/locales/ru.json";
import hierarchicalUz from "../src/i18n/locales/uz-Latn.json";

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
  it("should have matching keys in flat ru.json and uz-Latn.json", () => {
    const ruKeys = Object.keys(ru).sort();
    const uzKeys = Object.keys(uz).sort();

    expect(ruKeys).toEqual(uzKeys);
  });

  it("should have matching recursive keys in src/i18n/locales ru.json and uz-Latn.json", () => {
    const ruKeys = getDeepKeys(hierarchicalRu).sort();
    const uzKeys = getDeepKeys(hierarchicalUz).sort();

    const missingInUz = ruKeys.filter((k) => !uzKeys.includes(k));
    const missingInRu = uzKeys.filter((k) => !ruKeys.includes(k));

    expect(missingInUz).toEqual([]);
    expect(missingInRu).toEqual([]);
    expect(ruKeys).toEqual(uzKeys);
  });
});
