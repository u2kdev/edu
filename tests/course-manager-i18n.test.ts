import { describe, it, expect } from "vitest";
import { t } from "../src/i18n";

describe("CourseManager i18n Localization (Block 7)", () => {
  it("provides valid Russian localization keys for course management", () => {
    expect(t("ru", "courses.addNewCourse")).toBe("Добавить Новый Курс");
    expect(t("ru", "courses.noCoursesYet")).toBe("В этом учебном центре пока нет добавленных курсов.");
    expect(t("ru", "courses.published")).toBe("Опубликован");
    expect(t("ru", "courses.curriculum")).toBe("Учебная Программа (Модули)");
    expect(t("ru", "courses.minutes")).toBe("минут");
    expect(t("ru", "courses.modulesCount", { count: 3 })).toBe("Модулей: 3");
    expect(t("ru", "courses.groupsCount", { count: 2 })).toBe("Групп: 2");
  });

  it("provides natural Uzbek Latin localization keys for course management", () => {
    expect(t("uz-Latn", "courses.addNewCourse")).toBe("Yangi kurs qoʻshish");
    expect(t("uz-Latn", "courses.noCoursesYet")).toBe("Ushbu oʻquv markazida hozircha kurslar qoʻshilmagan.");
    expect(t("uz-Latn", "courses.published")).toBe("Chop etilgan");
    expect(t("uz-Latn", "courses.curriculum")).toBe("Oʻquv dasturi (Modullar)");
    expect(t("uz-Latn", "courses.minutes")).toBe("daqiqa");
    expect(t("uz-Latn", "courses.modulesCount", { count: 3 })).toBe("Modullar: 3");
    expect(t("uz-Latn", "courses.groupsCount", { count: 2 })).toBe("Guruhlar: 2");
  });
});
