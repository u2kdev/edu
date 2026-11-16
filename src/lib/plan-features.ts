// Reason: Exception: Plan feature entitlement checks query the center subscription plan globally by centerId.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";
import { z } from "zod";

export const PLAN_FEATURE_KEYS = [
  "onlinePaymentsClick",
  "telegramBot",
  "smsReminders",
  "broadcasts",
  "advancedReports",
  "mobileApp",
  "pdfReceipts",
  "promoCodes",
  "financeAccounting",
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

export const PlanFeaturesSchema = z
  .object({
    onlinePaymentsClick: z.boolean().default(true),
    telegramBot: z.boolean().default(true),
    smsReminders: z.boolean().default(true),
    broadcasts: z.boolean().default(true),
    advancedReports: z.boolean().default(true),
    mobileApp: z.boolean().default(true),
    pdfReceipts: z.boolean().default(true),
    promoCodes: z.boolean().default(true),
    financeAccounting: z.boolean().default(true),
  })
  .strict();

export type PlanFeatures = z.infer<typeof PlanFeaturesSchema>;

export const FULL_PLAN_FEATURES: PlanFeatures = {
  onlinePaymentsClick: true,
  telegramBot: true,
  smsReminders: true,
  broadcasts: true,
  advancedReports: true,
  mobileApp: true,
  pdfReceipts: true,
  promoCodes: true,
  financeAccounting: true,
};

export const PLAN_PRESETS: Record<"start" | "growth" | "pro", PlanFeatures> = {
  start: {
    onlinePaymentsClick: false,
    telegramBot: true,
    smsReminders: false,
    broadcasts: false,
    advancedReports: false,
    mobileApp: true,
    pdfReceipts: true,
    promoCodes: false,
    financeAccounting: false,
  },
  growth: {
    onlinePaymentsClick: true,
    telegramBot: true,
    smsReminders: true,
    broadcasts: true,
    advancedReports: true,
    mobileApp: true,
    pdfReceipts: true,
    promoCodes: true,
    financeAccounting: false,
  },
  pro: { ...FULL_PLAN_FEATURES },
};

export const PLAN_FEATURE_LABELS: Record<
  PlanFeatureKey,
  { ru: string; uz: string }
> = {
  onlinePaymentsClick: {
    ru: "Онлайн-оплата через Click",
    uz: "Click orqali onlayn to'lov",
  },
  telegramBot: {
    ru: "Telegram-бот и привязка аккаунтов",
    uz: "Telegram-bot va hisobni ulash",
  },
  smsReminders: {
    ru: "Автонапоминания об оплате по SMS",
    uz: "To'lov bo'yicha avtomatik SMS eslatmalar",
  },
  broadcasts: {
    ru: "Массовые рассылки и шаблоны",
    uz: "Ommaviy xabarnomalar va shablonlar",
  },
  advancedReports: {
    ru: "Расширенные финансовые отчёты",
    uz: "Kengaytirilgan moliyaviy hisobotlar",
  },
  mobileApp: {
    ru: "Мобильное приложение и push",
    uz: "Mobil ilova va push-xabarnomalar",
  },
  pdfReceipts: {
    ru: "PDF-квитанции с QR-кодом",
    uz: "QR-kodli PDF kvitansiyalar",
  },
  promoCodes: {
    ru: "Промокоды и скидки",
    uz: "Promokodlar va chegirmalar",
  },
  financeAccounting: {
    ru: "Финансовый учёт и зарплата",
    uz: "Moliya hisobi va ish haqi",
  },
};

export class PlanFeatureLockedError extends Error {
  public readonly status = 403;
  public readonly code = "PLAN_FEATURE_LOCKED" as const;
  public readonly featureKey: PlanFeatureKey;
  public readonly upgradeUrl = "/center/upgrade";

  constructor(featureKey: PlanFeatureKey, planName?: string | null) {
    const label = PLAN_FEATURE_LABELS[featureKey]?.ru ?? featureKey;
    super(
      planName
        ? `Функция «${label}» недоступна на текущем тарифе «${planName}». Перейдите на более высокий тариф.`
        : `Функция «${label}» недоступна на текущем тарифе. Перейдите на более высокий тариф.`
    );
    this.name = "PlanFeatureLockedError";
    this.featureKey = featureKey;
  }
}

export function formatPlanFeatureLockedPayload(err: PlanFeatureLockedError) {
  return {
    error: err.message,
    code: err.code,
    featureKey: err.featureKey,
    upgradeUrl: err.upgradeUrl,
  };
}

/**
 * Parses `SubscriptionPlan.featuresJson` into typed PlanFeatures booleans.
 * Preserves full access when legacy `featuresJson` is null, empty, an array,
 * or an old untyped key-value object without new PlanFeatureKey fields.
 */
export function parsePlanFeatures(featuresJson?: string | null): PlanFeatures {
  if (!featuresJson || !featuresJson.trim()) {
    return { ...FULL_PLAN_FEATURES };
  }

  try {
    const parsed: unknown = JSON.parse(featuresJson);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ...FULL_PLAN_FEATURES };
    }

    const record = parsed as Record<string, unknown>;
    const hasKnownKey = PLAN_FEATURE_KEYS.some((k) => k in record);
    if (!hasKnownKey) {
      return { ...FULL_PLAN_FEATURES };
    }

    const result: PlanFeatures = { ...PLAN_PRESETS.start };
    for (const key of PLAN_FEATURE_KEYS) {
      if (typeof record[key] === "boolean") {
        result[key] = record[key] as boolean;
      }
    }
    return result;
  } catch {
    return { ...FULL_PLAN_FEATURES };
  }
}

export interface CenterPlanContext {
  planId: string | null;
  planName: string | null;
  subscriptionStatus: string | null;
  features: PlanFeatures;
  hasSubscription: boolean;
}

export async function getCenterPlanFeatures(centerId: string): Promise<CenterPlanContext> {
  const activeSub = await db.subscription.findFirst({
    where: {
      centerId,
      status: { not: "CANCELLED" },
    },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
          featuresJson: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (activeSub?.plan) {
    return {
      planId: activeSub.plan.id,
      planName: activeSub.plan.name,
      subscriptionStatus: activeSub.status,
      features: parsePlanFeatures(activeSub.plan.featuresJson),
      hasSubscription: true,
    };
  }

  const cancelledSub = await db.subscription.findFirst({
    where: { centerId, status: "CANCELLED" },
    include: { plan: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });

  if (cancelledSub) {
    return {
      planId: cancelledSub.plan.id,
      planName: cancelledSub.plan.name,
      subscriptionStatus: cancelledSub.status,
      features: { ...PLAN_PRESETS.start },
      hasSubscription: true,
    };
  }

  // Legacy/test center without any Subscription record preserves backwards-compatible access
  return {
    planId: null,
    planName: null,
    subscriptionStatus: null,
    features: { ...FULL_PLAN_FEATURES },
    hasSubscription: false,
  };
}

export async function requirePlanFeature(
  centerId: string,
  featureKey: PlanFeatureKey
): Promise<CenterPlanContext> {
  const ctx = await getCenterPlanFeatures(centerId);
  if (!ctx.features[featureKey]) {
    throw new PlanFeatureLockedError(featureKey, ctx.planName);
  }
  return ctx;
}
