import { NextResponse } from "next/server";
import { requireTenantAccess, TenantAccessError } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { z } from "zod";

const updateSettingsSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100).optional(),
  address: z.string().max(255).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  email: z.string().email().nullable().or(z.literal("")).optional(),
  inn: z.string().max(50).nullable().optional(),
  legalName: z.string().max(200).nullable().optional(),
  contactPerson: z.string().max(100).nullable().optional(),
  logoUrl: z.string().max(500).nullable().optional(),
  brandingConfig: z.union([z.string(), z.record(z.string(), z.unknown())]).nullable().optional(),
  defaultLanguage: z.enum(["ru", "uz_Latn", "uz-Latn", "uz_Cyrl", "uz-Cyrl"]).transform((v) => (v === "uz-Latn" ? "uz_Latn" : v === "uz-Cyrl" ? "uz_Cyrl" : v) as "ru" | "uz_Latn" | "uz_Cyrl").optional(),
  timeZone: z.string().min(1).max(100).optional(),
  gradingScale: z.enum(["PERCENT_100", "POINTS_5", "PASS_FAIL"]).optional(),
  organizationKind: z.enum(["LEARNING_CENTER", "KINDERGARTEN", "SCHOOL", "TRAINING_CENTER"]).optional(),
  centerType: z.enum(["ONLINE", "OFFLINE", "HYBRID"]).optional(),
  allowAdminDiscount: z.boolean().optional(),
  partialPaymentExtendsPeriod: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  smsDailyLimit: z.number().int().min(0).max(100000).optional(),
  paymentReminderEnabled: z.boolean().optional(),
  paymentReminderDays: z.array(z.number().int().min(-30).max(60)).max(10).optional(),
  quietHoursStart: z.number().int().min(0).max(23).optional(),
  quietHoursEnd: z.number().int().min(0).max(23).optional(),
  reminderTemplateRu: z.string().max(1000).nullable().optional(),
  reminderTemplateUz: z.string().max(1000).nullable().optional(),
});

function parseReminderDaysJson(raw?: string | null): number[] {
  if (!raw) return [-3, 0, 3, 7];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      const nums = parsed.filter((n): n is number => typeof n === "number" && Number.isInteger(n));
      if (nums.length > 0) return nums;
    }
  } catch {}
  return [-3, 0, 3, 7];
}

function stripLegacyChannelFlagsFromBranding(raw: string | Record<string, unknown> | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return typeof raw === "string" ? raw : JSON.stringify(raw);
    }
    const cleaned = { ...(parsed as Record<string, unknown>) };
    delete cleaned.enableSms;
    delete cleaned.enableEmail;
    return Object.keys(cleaned).length > 0 ? JSON.stringify(cleaned) : null;
  } catch {
    return typeof raw === "string" ? raw : null;
  }
}

export async function GET(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!hasPermission("settings.read", tenantCtx.session.user.platformRole, tenantCtx.role)) {
      return NextResponse.json({ error: "Forbidden: No permission to read center settings" }, { status: 403 });
    }
    const center = await tenantCtx.getTenantDb().learningCenter.findUnique({
      where: { id: tenantCtx.center.id },
      include: {
        subscriptions: {
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    if (!center) {
      return NextResponse.json({ error: "Center not found" }, { status: 404 });
    }

    return NextResponse.json({
      center: {
        id: center.id,
        name: center.name,
        slug: center.slug,
        organizationKind: center.organizationKind,
        centerType: center.centerType,
        status: center.status,
        address: center.address,
        phone: center.phone,
        email: center.email,
        inn: center.inn,
        legalName: center.legalName,
        contactPerson: center.contactPerson,
        logoUrl: center.logoUrl,
        brandingConfig: center.brandingConfig,
        defaultLanguage: center.defaultLanguage,
        timeZone: center.timeZone,
        gradingScale: center.gradingScale,
        allowAdminDiscount: center.allowAdminDiscount,
        partialPaymentExtendsPeriod: center.partialPaymentExtendsPeriod,
        smsEnabled: center.smsEnabled,
        emailEnabled: center.emailEnabled,
        smsDailyLimit: center.smsDailyLimit,
        paymentReminderEnabled: center.paymentReminderEnabled,
        paymentReminderDays: parseReminderDaysJson(center.paymentReminderDaysJson),
        quietHoursStart: center.quietHoursStart,
        quietHoursEnd: center.quietHoursEnd,
        reminderTemplateRu: center.reminderTemplateRu,
        reminderTemplateUz: center.reminderTemplateUz,
        createdAt: center.createdAt,
        subscription: center.subscriptions[0]
          ? {
              status: center.subscriptions[0].status,
              planName: center.subscriptions[0].plan.name,
              currentPeriodEndsAt: center.subscriptions[0].currentPeriodEndsAt,
              trialEndsAt: center.subscriptions[0].trialEndsAt,
            }
          : null,
      },
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[GET /api/tenant/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const tenantCtx = await requireTenantAccess(req);
    if (!hasPermission("settings.manage", tenantCtx.session.user.platformRole, tenantCtx.role)) {
      return NextResponse.json({ error: "Forbidden: No permission to manage center settings" }, { status: 403 });
    }
    const body = await req.json();

    // Director cannot change status, slug, ownerId, or subscriptions
    // Explicitly reject if attempting privilege escalation
    if (body.status || body.slug || body.ownerId || body.planId) {
      return NextResponse.json(
        { error: "Forbidden: Center status, slug, and subscription are managed by platform superadmin only" },
        { status: 403 }
      );
    }

    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email === "" ? null : data.email;
    if (data.inn !== undefined) updateData.inn = data.inn;
    if (data.legalName !== undefined) updateData.legalName = data.legalName;
    if (data.contactPerson !== undefined) updateData.contactPerson = data.contactPerson;
    if (data.logoUrl !== undefined) updateData.logoUrl = data.logoUrl;
    if (data.defaultLanguage !== undefined) updateData.defaultLanguage = data.defaultLanguage;
    if (data.timeZone !== undefined) updateData.timeZone = data.timeZone;
    if (data.gradingScale !== undefined) updateData.gradingScale = data.gradingScale;
    if (data.organizationKind !== undefined) updateData.organizationKind = data.organizationKind;
    if (data.centerType !== undefined) updateData.centerType = data.centerType;
    if (data.allowAdminDiscount !== undefined) updateData.allowAdminDiscount = data.allowAdminDiscount;
    if (data.partialPaymentExtendsPeriod !== undefined) {
      updateData.partialPaymentExtendsPeriod = data.partialPaymentExtendsPeriod;
    }
    if (data.smsEnabled !== undefined) updateData.smsEnabled = data.smsEnabled;
    if (data.emailEnabled !== undefined) updateData.emailEnabled = data.emailEnabled;
    if (data.smsDailyLimit !== undefined) updateData.smsDailyLimit = data.smsDailyLimit;
    if (data.paymentReminderEnabled !== undefined) updateData.paymentReminderEnabled = data.paymentReminderEnabled;
    if (data.paymentReminderDays !== undefined) {
      const normalizedDays = Array.from(new Set(data.paymentReminderDays)).sort((a, b) => a - b);
      updateData.paymentReminderDaysJson = JSON.stringify(normalizedDays);
    }
    if (data.quietHoursStart !== undefined) updateData.quietHoursStart = data.quietHoursStart;
    if (data.quietHoursEnd !== undefined) updateData.quietHoursEnd = data.quietHoursEnd;
    if (data.reminderTemplateRu !== undefined) updateData.reminderTemplateRu = data.reminderTemplateRu;
    if (data.reminderTemplateUz !== undefined) updateData.reminderTemplateUz = data.reminderTemplateUz;

    if (data.brandingConfig !== undefined) {
      // Preserve/migrate any legacy enableSms/enableEmail only if explicit top-level column wasn't sent
      try {
        const parsedCfg =
          typeof data.brandingConfig === "string"
            ? JSON.parse(data.brandingConfig)
            : data.brandingConfig;
        if (parsedCfg && typeof parsedCfg === "object") {
          const rec = parsedCfg as Record<string, unknown>;
          if (data.smsEnabled === undefined && typeof rec.enableSms === "boolean") {
            updateData.smsEnabled = rec.enableSms;
          }
          if (data.emailEnabled === undefined && typeof rec.enableEmail === "boolean") {
            updateData.emailEnabled = rec.enableEmail;
          }
        }
      } catch {}
      updateData.brandingConfig = stripLegacyChannelFlagsFromBranding(data.brandingConfig);
    }

    const updated = await tenantCtx.getTenantDb().learningCenter.update({
      where: { id: tenantCtx.center.id },
      data: updateData,
    });

    await tenantCtx.getTenantDb().auditLog.create({
      data: {
        centerId: tenantCtx.center.id,
        actorUserId: tenantCtx.session.user.id,
        action: "CENTER_SETTINGS_UPDATED",
        resource: "LearningCenter",
        resourceId: tenantCtx.center.id,
        detailsJson: JSON.stringify({
          updatedFields: Object.keys(updateData),
        }),
      },
    });

    return NextResponse.json({
      success: true,
      center: updated,
    });
  } catch (err: unknown) {
    if (err instanceof TenantAccessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error("[GET /api/tenant/settings]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
