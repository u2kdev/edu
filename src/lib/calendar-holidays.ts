export interface DefaultHoliday {
  name: string;
  nameUz: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export function getUzbekistanOfficialHolidays(year: number = new Date().getFullYear()): DefaultHoliday[] {
  return [
    {
      name: `Новый год (${year})`,
      nameUz: `Yangi yil bayrami (${year})`,
      startDate: `${year}-01-01`,
      endDate: `${year}-01-02`,
    },
    {
      name: "Международный женский день",
      nameUz: "Xotin-qizlar kuni",
      startDate: `${year}-03-08`,
      endDate: `${year}-03-08`,
    },
    {
      name: "Праздник Навруз",
      nameUz: "Navro'z bayrami",
      startDate: `${year}-03-21`,
      endDate: `${year}-03-22`,
    },
    {
      name: "День памяти и почестей",
      nameUz: "Xotira va qadrlash kuni",
      startDate: `${year}-05-09`,
      endDate: `${year}-05-09`,
    },
    {
      name: "День независимости Республики Узбекистан",
      nameUz: "O'zbekiston Respublikasi Mustaqillik kuni",
      startDate: `${year}-09-01`,
      endDate: `${year}-09-02`,
    },
    {
      name: "День учителей и наставников",
      nameUz: "O'qituvchi va murabbiylar kuni",
      startDate: `${year}-10-01`,
      endDate: `${year}-10-01`,
    },
    {
      name: "День Конституции Республики Узбекистан",
      nameUz: "O'zbekiston Respublikasi Konstitutsiyasi kuni",
      startDate: `${year}-12-08`,
      endDate: `${year}-12-08`,
    },
    {
      name: "Руза хайит (Ийд ал-Фитр)",
      nameUz: "Ro'za hayiti (Iyd al-Fitr)",
      startDate: `${year}-03-31`,
      endDate: `${year}-04-01`,
    },
    {
      name: "Курбан хайит (Ийд ал-Адха)",
      nameUz: "Qurbon hayiti (Iyd al-Adha)",
      startDate: `${year}-06-06`,
      endDate: `${year}-06-07`,
    },
  ];
}
