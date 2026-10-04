import { describe, it, expect } from "vitest";
import ru from "../src/locales/ru.json";
import uz from "../src/locales/uz-Latn.json";

describe("i18n", () => {
  it("should have matching keys in ru.json and uz-Latn.json", () => {
    const ruKeys = Object.keys(ru).sort();
    const uzKeys = Object.keys(uz).sort();

    expect(ruKeys).toEqual(uzKeys);
  });
});
