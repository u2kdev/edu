// Reason: Exception: Platform settings helper operates on global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

export interface SupportContactsSetting {
  email: string;
  phone: string;
  telegram: string;
}

export interface PlatformSeoSetting {
  metaTitleRu: string;
  metaDescRu: string;
  ogImageUrl: string;
  keywords: string;
}

export interface PlatformSettingsMap {
  "billing.gracePeriodDays": number;
  "billing.defaultTrialDays": number;
  "system.maintenanceMode": boolean;
  "system.maintenanceBannerText": string;
  "support.contacts": SupportContactsSetting;
  "platform.seo": PlatformSeoSetting;
  "security.require2faForStaff": boolean;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettingsMap = {
  "billing.gracePeriodDays": 3,
  "billing.defaultTrialDays": 14,
  "system.maintenanceMode": false,
  "system.maintenanceBannerText":
    "На платформе проводятся плановые технические работы. Приносим извинения за временные неудобства.",
  "support.contacts": {
    email: "support@e-darschi.uz",
    phone: "+998 71 200 00 00",
    telegram: "@edarschi_support",
  },
  "platform.seo": {
    metaTitleRu: "e-Darschi — Мультитенантная образовательная платформа для учебных центров",
    metaDescRu:
      "Управление курсами, группами, студентами, расписанием, посещаемостью и финансами учебного центра.",
    ogImageUrl: "https://e-darschi.uz/og-banner.png",
    keywords: "LMS, учебный центр, CRM для курсов, Узбекистан, образование",
  },
  "security.require2faForStaff": false,
};

/**
 * Gets a platform setting by key with fallback to defaults.
 */
export async function getPlatformSetting<K extends keyof PlatformSettingsMap>(
  key: K
): Promise<PlatformSettingsMap[K]>;
export async function getPlatformSetting<T>(key: string, defaultValue?: T): Promise<T>;
export async function getPlatformSetting(key: string, defaultValue?: unknown): Promise<unknown> {
  const row = await db.platformSetting.findUnique({ where: { key } });
  if (!row) {
    if (key in DEFAULT_PLATFORM_SETTINGS) {
      return DEFAULT_PLATFORM_SETTINGS[key as keyof PlatformSettingsMap];
    }
    return defaultValue;
  }
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

/**
 * Saves a platform setting by key.
 */
export async function setPlatformSetting(
  key: string,
  value: unknown,
  updatedBy?: string,
  description?: string
) {
  const serialized = typeof value === "string" ? value : JSON.stringify(value);
  return db.platformSetting.upsert({
    where: { key },
    update: {
      value: serialized,
      description: description || undefined,
      updatedBy: updatedBy || undefined,
    },
    create: {
      key,
      value: serialized,
      description,
      updatedBy,
    },
  });
}

/**
 * Retrieves all platform settings as a key-value dictionary.
 */
export async function getAllPlatformSettings(): Promise<Record<string, unknown>> {
  const rows = await db.platformSetting.findMany();
  const result: Record<string, unknown> = { ...DEFAULT_PLATFORM_SETTINGS };

  for (const r of rows) {
    try {
      result[r.key] = JSON.parse(r.value);
    } catch {
      result[r.key] = r.value;
    }
  }

  return result;
}
