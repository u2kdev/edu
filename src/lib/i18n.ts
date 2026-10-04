import ru from "../locales/ru.json";
import uz from "../locales/uz-Latn.json";

const locales: Record<string, Record<string, string>> = {
  ru,
  "uz-Latn": uz,
};

export function t(key: string, lang: string = "ru"): string {
  const dictionary = locales[lang] || locales["ru"];
  return dictionary[key] || key;
}
