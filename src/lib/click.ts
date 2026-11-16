import crypto from "crypto";
import QRCode from "qrcode";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { comparePassword } from "./auth";
import { encryptSecret, decryptSecret } from "./crypto-cipher";
import { decryptTwoFactorSecret } from "./two-factor-cipher";
import { verifyTotpCode } from "./totp";
import { getClientIp } from "./ip";
import { getRawClickAllowlistEnv, isIpInAllowlist, parseClickIpAllowlist } from "./click-ip";
import {
  BillingError,
  type BillingPeriodMonths,
  computeNextPaidUntil,
  isSameUzsAmount,
  recordBillingPayment,
  resolveGroupPeriodPrice,
  roundUzs,
  validatePromoCodeEligibility,
} from "./billing";

export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  ORDER_NOT_FOUND: -5,
  TX_NOT_FOUND: -6,
  REQUEST_ERROR: -8,
  CANCELLED: -9,
} as const;

export function getClickCheckoutBaseUrl(): string {
  return process.env.CLICK_CHECKOUT_URL || "https://my.click.uz/services/pay";
}

export function isClickIpAllowed(req: Request): boolean {
  const rawList = getRawClickAllowlistEnv();
  if (!rawList) return true;
  const parsed = parseClickIpAllowlist(rawList);
  if (parsed.invalidEntries.length > 0 || parsed.entries.length === 0) {
    return false;
  }
  const ip = getClientIp(req);
  if (!ip || ip === "unknown") return false;
  return isIpInAllowlist(ip, parsed.entries);
}

export function maskSecretTail(secret: string): string {
  if (!secret || secret.length <= 4) return "****";
  return `****${secret.slice(-4)}`;
}

export function md5Hex(input: string): string {
  return crypto.createHash("md5").update(input, "utf8").digest("hex").toLowerCase();
}

export function computeClickPrepareSign(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  amount: string;
  action: string;
  signTime: string;
}): string {
  return md5Hex(
    `${params.clickTransId}${params.serviceId}${params.secretKey}${params.merchantTransId}${params.amount}${params.action}${params.signTime}`
  );
}

export function computeClickCompleteSign(params: {
  clickTransId: string;
  serviceId: string;
  secretKey: string;
  merchantTransId: string;
  merchantPrepareId: string;
  amount: string;
  action: string;
  signTime: string;
}): string {
  return md5Hex(
    `${params.clickTransId}${params.serviceId}${params.secretKey}${params.merchantTransId}${params.merchantPrepareId}${params.amount}${params.action}${params.signTime}`
  );
}

export function verifyClickSignature(expectedHex: string, receivedHex: string): boolean {
  if (!expectedHex || !receivedHex) return false;
  const a = Buffer.from(expectedHex.trim().toLowerCase(), "utf8");
  const b = Buffer.from(receivedHex.trim().toLowerCase(), "utf8");
  if (a.length === 0 || a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

const CLICK_SENSITIVE_FIELDS = new Set([
  "sign_string",
  "secret_key",
  "secretkey",
  "encryptedsecretkey",
  "authorization",
  "token",
]);

export function redactClickPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (CLICK_SENSITIVE_FIELDS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function buildClickPayUrl(params: {
  serviceId: string;
  merchantId: string;
  amount: number;
  merchantTransId: string;
  returnUrl?: string | null;
  merchantUserId?: string | null;
}): string {
  const url = new URL(getClickCheckoutBaseUrl());
  url.searchParams.set("service_id", params.serviceId);
  url.searchParams.set("merchant_id", params.merchantId);
  url.searchParams.set("amount", String(roundUzs(params.amount)));
  url.searchParams.set("transaction_param", params.merchantTransId);
  if (params.returnUrl) {
    url.searchParams.set("return_url", params.returnUrl);
  }
  if (params.merchantUserId) {
    url.searchParams.set("merchant_user_id", params.merchantUserId);
  }
  return url.toString();
}

export async function verifyDirectorReauth(params: {
  userId: string;
  currentPassword: string;
  totpCode?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await db.platformUser.findUnique({
    where: { id: params.userId },
    select: {
      id: true,
      passwordHash: true,
      twoFactorEnabled: true,
      twoFactorSecret: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive || !user.passwordHash) {
    return { ok: false, error: "Аккаунт не найден или неактивен" };
  }

  const pwdValid = await comparePassword(params.currentPassword, user.passwordHash);
  if (!pwdValid) {
    return { ok: false, error: "Неверный текущий пароль" };
  }

  if (user.twoFactorEnabled && user.twoFactorSecret) {
    if (!params.totpCode || !params.totpCode.trim()) {
      return { ok: false, error: "Требуется 6-значный код 2FA для изменения ключей мерчанта" };
    }
    const decrypted = decryptTwoFactorSecret(user.twoFactorSecret);
    const validTotp = verifyTotpCode(decrypted, params.totpCode.trim(), { window: 1 });
    if (!validTotp) {
      return { ok: false, error: "Неверный код 2FA" };
    }
  }

  return { ok: true };
}

export async function getCenterMerchantConfigSummary(centerId: string) {
  const cfg = await db.centerMerchantConfig.findUnique({
    where: { centerId_provider: { centerId, provider: "CLICK" } },
    include: {
      targetAccount: { select: { id: true, name: true, type: true } },
    },
  });

  if (!cfg) {
    return {
      configured: false,
      provider: "CLICK" as const,
      serviceId: null,
      merchantId: null,
      merchantUserId: null,
      secretKeyMasked: null,
      targetAccountId: null,
      targetAccount: null,
      isActive: false,
      isVerified: false,
      lastTestedAt: null,
      lastError: null,
    };
  }

  let secretKeyMasked = "****";
  try {
    const plain = decryptSecret(cfg.encryptedSecretKey, {
      requireEncrypted: false,
      purpose: "payment",
    });
    if (plain) secretKeyMasked = maskSecretTail(plain);
  } catch {
    secretKeyMasked = "****";
  }

  return {
    configured: true,
    provider: cfg.provider,
    serviceId: cfg.serviceId,
    merchantId: cfg.merchantId,
    merchantUserId: cfg.merchantUserId,
    secretKeyMasked,
    targetAccountId: cfg.targetAccountId,
    targetAccount: cfg.targetAccount,
    isActive: cfg.isActive,
    isVerified: cfg.isVerified,
    lastTestedAt: cfg.verifiedAt ? cfg.verifiedAt.toISOString() : null,
    lastError: null as string | null,
  };
}

export async function upsertCenterMerchantConfig(params: {
  centerId: string;
  serviceId: string;
  merchantId: string;
  merchantUserId?: string | null;
  secretKey?: string | null;
  targetAccountId?: string | null;
  isActive?: boolean;
  actorUserId: string;
}) {
  const existing = await db.centerMerchantConfig.findUnique({
    where: { centerId_provider: { centerId: params.centerId, provider: "CLICK" } },
  });

  if (!existing && (!params.secretKey || !params.secretKey.trim())) {
    throw new BillingError(400, "Укажите Secret Key мерчанта Click", "SECRET_KEY_REQUIRED");
  }

  if (params.targetAccountId) {
    const acc = await db.account.findFirst({
      where: { id: params.targetAccountId, centerId: params.centerId, isActive: true },
      select: { id: true },
    });
    if (!acc) {
      throw new BillingError(
        404,
        "Выбранный финансовый счёт не найден или неактивен в центре",
        "ACCOUNT_NOT_FOUND"
      );
    }
  }

  const trimmedServiceId = params.serviceId.trim();
  const trimmedMerchantId = params.merchantId.trim();
  const trimmedUserId = params.merchantUserId?.trim() || null;

  let encryptedSecretKey = existing?.encryptedSecretKey ?? "";
  let secretKeyMasked = "****";
  if (encryptedSecretKey) {
    try {
      const existingPlain = decryptSecret(encryptedSecretKey, {
        requireEncrypted: false,
        purpose: "payment",
      });
      if (existingPlain) secretKeyMasked = maskSecretTail(existingPlain);
    } catch {
      secretKeyMasked = "****";
    }
  }
  let credentialsChanged = false;

  if (params.secretKey && params.secretKey.trim()) {
    const plain = params.secretKey.trim();
    if (plain.length < 6) {
      throw new BillingError(400, "Secret Key слишком короткий (минимум 6 символов)", "SECRET_TOO_SHORT");
    }
    encryptedSecretKey = encryptSecret(plain, { purpose: "payment" });
    secretKeyMasked = maskSecretTail(plain);
    credentialsChanged = true;
  }

  if (
    !existing ||
    existing.serviceId !== trimmedServiceId ||
    existing.merchantId !== trimmedMerchantId
  ) {
    credentialsChanged = true;
  }

  const saved = await db.centerMerchantConfig.upsert({
    where: { centerId_provider: { centerId: params.centerId, provider: "CLICK" } },
    update: {
      serviceId: trimmedServiceId,
      merchantId: trimmedMerchantId,
      merchantUserId: trimmedUserId,
      encryptedSecretKey,
      targetAccountId: params.targetAccountId ?? existing?.targetAccountId ?? null,
      isActive: params.isActive ?? existing?.isActive ?? true,
      isVerified: credentialsChanged ? false : existing?.isVerified ?? false,
      verifiedAt: credentialsChanged ? null : existing?.verifiedAt ?? null,
    },
    create: {
      centerId: params.centerId,
      provider: "CLICK",
      serviceId: trimmedServiceId,
      merchantId: trimmedMerchantId,
      merchantUserId: trimmedUserId,
      encryptedSecretKey,
      targetAccountId: params.targetAccountId ?? null,
      isActive: params.isActive ?? true,
      isVerified: false,
    },
  });

  await db.auditLog.create({
    data: {
      centerId: params.centerId,
      actorUserId: params.actorUserId,
      action: "MERCHANT_CONFIG_SAVED",
      resource: "CenterMerchantConfig",
      resourceId: saved.id,
      detailsJson: JSON.stringify({
        provider: "CLICK",
        serviceId: saved.serviceId,
        merchantId: saved.merchantId,
        secretKeyMasked,
        targetAccountId: saved.targetAccountId,
        isActive: saved.isActive,
        isVerified: saved.isVerified,
      }),
    },
  });

  return getCenterMerchantConfigSummary(params.centerId);
}

export async function verifyCenterMerchantConnection(params: {
  centerId: string;
  actorUserId: string;
}) {
  const cfg = await db.centerMerchantConfig.findUnique({
    where: { centerId_provider: { centerId: params.centerId, provider: "CLICK" } },
  });

  if (!cfg) {
    throw new BillingError(404, "Настройки мерчанта Click не найдены", "MERCHANT_NOT_CONFIGURED");
  }

  try {
    const plainSecret = decryptSecret(cfg.encryptedSecretKey, {
      requireEncrypted: true,
      purpose: "payment",
    });
    if (!/^\d+$/.test(cfg.serviceId.trim())) {
      throw new Error("service_id должен содержать только цифры");
    }
    if (!/^\d+$/.test(cfg.merchantId.trim())) {
      throw new Error("merchant_id должен содержать только цифры");
    }
    if (!plainSecret || plainSecret.length < 6) {
      throw new Error("Secret Key недействителен");
    }
    if (cfg.targetAccountId) {
      const acc = await db.account.findFirst({
        where: { id: cfg.targetAccountId, centerId: params.centerId, isActive: true },
        select: { id: true },
      });
      if (!acc) {
        throw new Error("Привязанный счёт зачисления не найден или деактивирован");
      }
    }

    // Smoke-check deterministic sign calculation without external side-effect
    const sampleSign = computeClickPrepareSign({
      clickTransId: "1",
      serviceId: cfg.serviceId,
      secretKey: plainSecret,
      merchantTransId: "healthcheck",
      amount: "1000",
      action: "0",
      signTime: "2026-01-01 00:00:00",
    });
    if (sampleSign.length !== 32) {
      throw new Error("Ошибка проверки подписи MD5");
    }

    await db.centerMerchantConfig.update({
      where: { id: cfg.id },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
        verifiedByUserId: params.actorUserId,
      },
    });

    await db.auditLog.create({
      data: {
        centerId: params.centerId,
        actorUserId: params.actorUserId,
        action: "MERCHANT_CONFIG_VERIFIED",
        resource: "CenterMerchantConfig",
        resourceId: cfg.id,
        detailsJson: JSON.stringify({
          provider: "CLICK",
          serviceId: cfg.serviceId,
          merchantId: cfg.merchantId,
          verified: true,
        }),
      },
    });

    return getCenterMerchantConfigSummary(params.centerId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Ошибка проверки мерчанта";
    await db.centerMerchantConfig.update({
      where: { id: cfg.id },
      data: {
        isVerified: false,
        verifiedAt: new Date(),
        verifiedByUserId: params.actorUserId,
      },
    });
    throw new BillingError(400, msg, "MERCHANT_VERIFY_FAILED");
  }
}

export async function createClickPaymentIntent(params: {
  centerId: string;
  studentMembershipId: string;
  groupId?: string | null;
  chargeId?: string | null;
  periodMonths?: BillingPeriodMonths | null;
  promoCode?: string | null;
  returnUrl?: string | null;
  actorUserId: string;
  idempotencyKey?: string | null;
}) {
  const merchantCfg = await db.centerMerchantConfig.findUnique({
    where: { centerId_provider: { centerId: params.centerId, provider: "CLICK" } },
  });

  if (!merchantCfg || !merchantCfg.isActive || !merchantCfg.isVerified) {
    throw new BillingError(
      400,
      "Онлайн-оплата недоступна пока мерчант не проверен",
      "MERCHANT_NOT_VERIFIED"
    );
  }

  const now = new Date();
  const idempHash = params.idempotencyKey?.trim()
    ? `${params.centerId.slice(0, 8)}-${crypto
        .createHash("sha256")
        .update(`${params.centerId}:${params.studentMembershipId}:${params.idempotencyKey.trim()}`)
        .digest("hex")
        .slice(0, 24)}`
    : null;

  if (idempHash) {
    const existing = await db.paymentIntent.findUnique({
      where: { merchantTransId: idempHash },
    });
    if (existing && existing.status === "CREATED" && existing.expiresAt > now) {
      const clickUrl = buildClickPayUrl({
        serviceId: merchantCfg.serviceId,
        merchantId: merchantCfg.merchantId,
        amount: existing.amount,
        merchantTransId: existing.merchantTransId,
        returnUrl: params.returnUrl,
        merchantUserId: merchantCfg.merchantUserId,
      });
      const qrDataUrl = await QRCode.toDataURL(clickUrl, { width: 220, margin: 1 });
      return { intent: existing, clickUrl, qrDataUrl };
    }
  }

  const student = await db.centerMembership.findFirst({
    where: {
      id: params.studentMembershipId,
      centerId: params.centerId,
      role: "STUDENT",
    },
    select: { id: true },
  });
  if (!student) {
    throw new BillingError(404, "Ученик не найден в этом центре", "STUDENT_NOT_FOUND");
  }

  let originalAmount = 0;
  let discountAmount = 0;
  let payableAmount = 0;
  let resolvedGroupId: string | null = params.groupId ?? null;
  let resolvedEnrollmentId: string | null = null;
  let resolvedChargeId: string | null = null;
  let resolvedPeriodMonths: number = params.periodMonths ?? 1;
  let resolvedPromoCodeId: string | null = null;

  if (params.chargeId) {
    const charge = await db.charge.findFirst({
      where: { id: params.chargeId, centerId: params.centerId },
    });
    if (!charge) {
      throw new BillingError(404, "Счёт на оплату не найден", "CHARGE_NOT_FOUND");
    }
    if (charge.studentMembershipId !== student.id) {
      throw new BillingError(403, "Счёт принадлежит другому ученику", "CHARGE_STUDENT_MISMATCH");
    }
    if (charge.status === "CANCELLED" || charge.status === "REFUNDED" || charge.status === "PAID") {
      throw new BillingError(400, "Счёт уже оплачен или отменён", "CHARGE_NOT_PAYABLE");
    }
    const remaining = Math.max(0, charge.amount - charge.paidAmount);
    if (remaining <= 0) {
      throw new BillingError(409, "Счёт уже оплачен", "CHARGE_ALREADY_PAID");
    }
    originalAmount = remaining;
    discountAmount = 0;
    payableAmount = remaining;
    resolvedGroupId = charge.groupId;
    resolvedEnrollmentId = charge.enrollmentId;
    resolvedChargeId = charge.id;
    resolvedPeriodMonths = charge.periodMonths;
  } else if (params.groupId && params.periodMonths) {
    if (![1, 2, 3].includes(params.periodMonths)) {
      throw new BillingError(400, "Доступны периоды оплаты только 1, 2 или 3 месяца", "INVALID_PERIOD");
    }
    const enrollment = await db.enrollment.findFirst({
      where: {
        centerId: params.centerId,
        studentMembershipId: student.id,
        groupId: params.groupId,
        status: { in: ["ACTIVE", "FROZEN"] },
      },
      select: { id: true, groupId: true, paidUntil: true },
    });
    if (!enrollment) {
      throw new BillingError(404, "Активное зачисление в выбранную группу не найдено", "ENROLLMENT_NOT_FOUND");
    }
    resolvedEnrollmentId = enrollment.id;

    const pricing = await resolveGroupPeriodPrice(
      db,
      params.centerId,
      enrollment.groupId,
      params.periodMonths
    );
    originalAmount = pricing.price;

    if (params.promoCode && params.promoCode.trim()) {
      const promoCheck = await validatePromoCodeEligibility({
        txOrClient: db,
        centerId: params.centerId,
        code: params.promoCode,
        courseId: pricing.courseId,
        groupId: enrollment.groupId,
        subtotal: originalAmount,
        now,
      });
      discountAmount = promoCheck.discountAmount;
      resolvedPromoCodeId = promoCheck.promo.id;
    }

    payableAmount = Math.max(0, originalAmount - discountAmount);
    // Validate period calculation cleanly upfront
    computeNextPaidUntil(enrollment.paidUntil, now, params.periodMonths);
  } else {
    throw new BillingError(
      400,
      "Укажите chargeId либо groupId и periodMonths (1, 2 или 3)",
      "CHECKOUT_PARAMS_REQUIRED"
    );
  }

  if (!Number.isInteger(payableAmount) || payableAmount <= 0) {
    throw new BillingError(400, "Сумма для онлайн-оплаты должна быть больше 0 UZS", "ZERO_ONLINE_AMOUNT");
  }

  const intentId = crypto.randomUUID();
  const merchantTransId = idempHash || intentId;
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000); // 60 minutes TTL

  const intent = await db.paymentIntent.create({
    data: {
      id: intentId,
      centerId: params.centerId,
      provider: "CLICK",
      studentMembershipId: student.id,
      enrollmentId: resolvedEnrollmentId,
      groupId: resolvedGroupId,
      chargeId: resolvedChargeId,
      periodMonths: resolvedPeriodMonths,
      promoCodeId: resolvedPromoCodeId,
      originalAmount,
      discountAmount,
      amount: payableAmount,
      currency: "UZS",
      status: "CREATED",
      merchantTransId,
      createdByUserId: params.actorUserId,
      expiresAt,
    },
  });

  const clickUrl = buildClickPayUrl({
    serviceId: merchantCfg.serviceId,
    merchantId: merchantCfg.merchantId,
    amount: intent.amount,
    merchantTransId: intent.merchantTransId,
    returnUrl: params.returnUrl,
    merchantUserId: merchantCfg.merchantUserId,
  });

  const qrDataUrl = await QRCode.toDataURL(clickUrl, { width: 220, margin: 1 });

  await db.auditLog.create({
    data: {
      centerId: params.centerId,
      actorUserId: params.actorUserId,
      action: "CLICK_PAYMENT_INTENT_CREATED",
      resource: "PaymentIntent",
      resourceId: intent.id,
      detailsJson: JSON.stringify({
        amount: intent.amount,
        originalAmount: intent.originalAmount,
        discountAmount: intent.discountAmount,
        groupId: intent.groupId,
        periodMonths: intent.periodMonths,
      }),
    },
  });

  return { intent, clickUrl, qrDataUrl };
}

export interface ClickWebhookResponse {
  click_trans_id?: string | number;
  merchant_trans_id?: string;
  merchant_prepare_id?: string;
  merchant_confirm_id?: string;
  error: number;
  error_note: string;
}

async function logWebhookEvent(params: {
  centerId: string | null;
  paymentIntentId: string | null;
  clickTransId: string | null;
  action: number | null;
  status: "PROCESSED" | "REJECTED";
  errorCode: number;
  errorNote: string;
  rawPayload: Record<string, unknown>;
  ipAddress: string | null;
}) {
  try {
    const str = (k: string) =>
      params.rawPayload[k] !== undefined && params.rawPayload[k] !== null
        ? String(params.rawPayload[k]).trim() || null
        : null;
    const rawAmt = str("amount");
    const parsedAmt = rawAmt && Number.isFinite(Number(rawAmt)) ? roundUzs(Number(rawAmt)) : null;

    await db.paymentWebhookEvent.create({
      data: {
        centerId: params.centerId,
        provider: "CLICK",
        paymentIntentId: params.paymentIntentId,
        serviceId: str("service_id"),
        clickTransId: params.clickTransId,
        merchantTransId: str("merchant_trans_id"),
        action: params.action,
        amount: parsedAmt,
        signatureValid: params.errorCode !== CLICK_ERROR.SIGN_CHECK_FAILED && params.status === "PROCESSED",
        status: params.status,
        errorCode: params.errorCode,
        errorNote: params.errorNote,
        payloadRedactedJson: JSON.stringify(redactClickPayload(params.rawPayload)),
        ipAddress: params.ipAddress,
      },
    });
  } catch (logErr) {
    console.error("[click webhook audit log failed]", logErr);
  }
}

/**
 * Handles Click Shop API Prepare (action=0) and Complete (action=1) webhooks.
 * Always writes a sanitized PaymentWebhookEvent row regardless of outcome.
 */
export async function processClickWebhook(params: {
  payload: Record<string, unknown>;
  ipAddress: string | null;
}): Promise<ClickWebhookResponse> {
  const p = params.payload;
  const str = (key: string): string => {
    const v = p[key];
    if (v === undefined || v === null) return "";
    return String(v).trim();
  };

  const clickTransId = str("click_trans_id");
  const serviceId = str("service_id");
  const clickPaydocId = str("click_paydoc_id") || null;
  const merchantTransId = str("merchant_trans_id");
  const merchantPrepareId = str("merchant_prepare_id");
  const amountRaw = str("amount");
  const actionRaw = str("action");
  const incomingErrorRaw = str("error");
  const signTime = str("sign_time");
  const signString = str("sign_string");

  const parsedAction = actionRaw === "0" ? 0 : actionRaw === "1" ? 1 : Number(actionRaw);

  if (
    !clickTransId ||
    !serviceId ||
    !merchantTransId ||
    !amountRaw ||
    !signTime ||
    !signString ||
    (parsedAction !== 0 && parsedAction !== 1)
  ) {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId || undefined,
      merchant_trans_id: merchantTransId || undefined,
      error:
        parsedAction !== 0 && parsedAction !== 1 && actionRaw !== ""
          ? CLICK_ERROR.ACTION_NOT_FOUND
          : CLICK_ERROR.REQUEST_ERROR,
      error_note: "Invalid request parameters",
    };
    await logWebhookEvent({
      centerId: null,
      paymentIntentId: null,
      clickTransId: clickTransId || null,
      action: Number.isInteger(parsedAction) ? parsedAction : null,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  const intent = await db.paymentIntent.findUnique({
    where: { merchantTransId },
    include: {
      center: { select: { id: true, ownerId: true } },
      promoCode: { select: { id: true, code: true } },
    },
  });

  if (!intent) {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.ORDER_NOT_FOUND,
      error_note: "Order does not exist",
    };
    await logWebhookEvent({
      centerId: null,
      paymentIntentId: null,
      clickTransId,
      action: parsedAction,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  const config = await db.centerMerchantConfig.findUnique({
    where: { centerId_provider: { centerId: intent.centerId, provider: "CLICK" } },
  });

  // Strict cross-center check: merchant config serviceId MUST match payload service_id
  if (!config || !config.isActive || config.serviceId !== serviceId) {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.ORDER_NOT_FOUND,
      error_note: "Merchant service mismatch",
    };
    await logWebhookEvent({
      centerId: intent.centerId,
      paymentIntentId: intent.id,
      clickTransId,
      action: parsedAction,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  let plainSecret: string;
  try {
    plainSecret = decryptSecret(config.encryptedSecretKey, {
      requireEncrypted: true,
      purpose: "payment",
    });
  } catch {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.SIGN_CHECK_FAILED,
      error_note: "SIGN CHECK FAILED",
    };
    await logWebhookEvent({
      centerId: intent.centerId,
      paymentIntentId: intent.id,
      clickTransId,
      action: parsedAction,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  const expectedSign =
    parsedAction === 0
      ? computeClickPrepareSign({
          clickTransId,
          serviceId,
          secretKey: plainSecret,
          merchantTransId,
          amount: amountRaw,
          action: "0",
          signTime,
        })
      : computeClickCompleteSign({
          clickTransId,
          serviceId,
          secretKey: plainSecret,
          merchantTransId,
          merchantPrepareId,
          amount: amountRaw,
          action: "1",
          signTime,
        });

  if (!verifyClickSignature(expectedSign, signString)) {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.SIGN_CHECK_FAILED,
      error_note: "SIGN CHECK FAILED",
    };
    await logWebhookEvent({
      centerId: intent.centerId,
      paymentIntentId: intent.id,
      clickTransId,
      action: parsedAction,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  const cleanAmountStr = amountRaw.trim();
  const isIntegerAmountStr = /^\d+(?:\.0+)?$/.test(cleanAmountStr);
  const parsedAmount = Number(cleanAmountStr);
  if (
    !isIntegerAmountStr ||
    !Number.isSafeInteger(parsedAmount) ||
    parsedAmount <= 0 ||
    !isSameUzsAmount(parsedAmount, intent.amount)
  ) {
    const errResp: ClickWebhookResponse = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.INCORRECT_AMOUNT,
      error_note: "Incorrect parameter amount",
    };
    await logWebhookEvent({
      centerId: intent.centerId,
      paymentIntentId: intent.id,
      clickTransId,
      action: parsedAction,
      status: "REJECTED",
      errorCode: errResp.error,
      errorNote: errResp.error_note,
      rawPayload: p,
      ipAddress: params.ipAddress,
    });
    return errResp;
  }

  const now = new Date();
  const incomingErrNum = incomingErrorRaw ? Number(incomingErrorRaw) : 0;

  let txResp: ClickWebhookResponse;
  let eventStatus: "PROCESSED" | "REJECTED" = "PROCESSED";

  try {
    txResp = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const lockedRows = await tx.$queryRaw<
        Array<{
          id: string;
          centerId: string;
          studentMembershipId: string;
          groupId: string | null;
          chargeId: string | null;
          periodMonths: number | null;
          promoCodeId: string | null;
          amount: number;
          originalAmount: number;
          discountAmount: number;
          currency: string;
          status: string;
          createdByUserId: string | null;
          expiresAt: Date;
        }>
      >`
        SELECT "id", "centerId", "studentMembershipId", "groupId", "chargeId",
               "periodMonths", "promoCodeId", "amount", "originalAmount", "discountAmount",
               "currency"::text, "status"::text,
               "createdByUserId", "expiresAt"
        FROM "PaymentIntent"
        WHERE "id" = ${intent.id}
        FOR UPDATE
      `;
      const locked = lockedRows[0];
      if (!locked) {
        eventStatus = "REJECTED";
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          error: CLICK_ERROR.ORDER_NOT_FOUND,
          error_note: "Order not found",
        };
      }

      if (parsedAction === 0) {
        if (locked.status === "CONFIRMED") {
          return {
            click_trans_id: clickTransId,
            merchant_trans_id: merchantTransId,
            merchant_prepare_id: locked.id,
            error: CLICK_ERROR.ALREADY_PAID,
            error_note: "Already paid",
          };
        }
        if (locked.status === "CANCELLED" || locked.status === "FAILED") {
          eventStatus = "REJECTED";
          return {
            click_trans_id: clickTransId,
            merchant_trans_id: merchantTransId,
            error: CLICK_ERROR.CANCELLED,
            error_note: "Transaction cancelled",
          };
        }
        if (locked.status === "EXPIRED" || locked.expiresAt < now) {
          await tx.paymentIntent.update({
            where: { id: locked.id },
            data: { status: "EXPIRED", errorNote: "Intent expired before Prepare" },
          });
          eventStatus = "REJECTED";
          return {
            click_trans_id: clickTransId,
            merchant_trans_id: merchantTransId,
            error: CLICK_ERROR.CANCELLED,
            error_note: "Order expired",
          };
        }

        const prepareId = locked.id;
        await tx.paymentIntent.update({
          where: { id: locked.id },
          data: {
            status: "PREPARED",
            clickTransId,
            clickPaydocId,
            preparedAt: now,
          },
        });

        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_prepare_id: prepareId,
          error: CLICK_ERROR.SUCCESS,
          error_note: "Success",
        };
      }

      // action === 1 (Complete)
      if (locked.status === "CONFIRMED") {
        const existingPay = await tx.centerPayment.findUnique({
          where: { paymentIntentId: locked.id },
          select: { id: true },
        });
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_confirm_id: existingPay?.id || locked.id,
          error: CLICK_ERROR.ALREADY_PAID,
          error_note: "Already paid",
        };
      }

      if (Number.isFinite(incomingErrNum) && incomingErrNum < 0) {
        await tx.paymentIntent.update({
          where: { id: locked.id },
          data: {
            status: "CANCELLED",
            errorNote: str("error_note") || `Click cancelled (${incomingErrNum})`,
          },
        });
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          error: CLICK_ERROR.CANCELLED,
          error_note: "Transaction cancelled",
        };
      }

      if (
        locked.status !== "PREPARED" ||
        !merchantPrepareId ||
        merchantPrepareId !== locked.id
      ) {
        eventStatus = "REJECTED";
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          error: CLICK_ERROR.TX_NOT_FOUND,
          error_note: "Transaction does not exist",
        };
      }

      // Check existing CenterPayment in case of edge healing
      const alreadySettled = await tx.centerPayment.findUnique({
        where: { paymentIntentId: locked.id },
        select: { id: true },
      });
      if (alreadySettled) {
        await tx.paymentIntent.update({
          where: { id: locked.id },
          data: { status: "CONFIRMED", confirmedAt: now },
        });
        return {
          click_trans_id: clickTransId,
          merchant_trans_id: merchantTransId,
          merchant_confirm_id: alreadySettled.id,
          error: CLICK_ERROR.ALREADY_PAID,
          error_note: "Already paid",
        };
      }

      let promoToConsume: string | null = null;
      if (locked.promoCodeId && intent.promoCode?.code) {
        const promoRow = await tx.promoCode.findUnique({
          where: { id: locked.promoCodeId },
        });
        if (
          promoRow &&
          promoRow.isActive &&
          (!promoRow.validUntil || promoRow.validUntil >= now) &&
          (promoRow.maxUses === null || promoRow.usesCount < promoRow.maxUses)
        ) {
          promoToConsume = promoRow.code;
        }
      }

      const actorUserId = locked.createdByUserId || config.verifiedByUserId || intent.center.ownerId;
      const periodMonths =
        locked.periodMonths === 1 || locked.periodMonths === 2 || locked.periodMonths === 3
          ? locked.periodMonths
          : null;

      const settledPayment = await recordBillingPayment({
        centerId: locked.centerId,
        studentMembershipId: locked.studentMembershipId,
        groupId: locked.groupId,
        chargeId: locked.chargeId,
        periodMonths,
        amount: locked.amount,
        paymentMethod: "ONLINE",
        currency: "UZS",
        status: "PAID",
        promoCode: promoToConsume,
        externalTxId: clickTransId,
        paymentIntentId: locked.id,
        targetAccountId: config.targetAccountId,
        paymentDate: now,
        actorUserId,
        note: `Click онлайн-оплата #${clickTransId}`,
        tx,
      });

      await tx.paymentIntent.update({
        where: { id: locked.id },
        data: {
          status: "CONFIRMED",
          clickTransId,
          clickPaydocId,
          confirmedAt: now,
          errorNote: null,
        },
      });

      return {
        click_trans_id: clickTransId,
        merchant_trans_id: merchantTransId,
        merchant_confirm_id: settledPayment.id,
        error: CLICK_ERROR.SUCCESS,
        error_note: "Success",
      };
    });
  } catch {
    eventStatus = "REJECTED";
    txResp = {
      click_trans_id: clickTransId,
      merchant_trans_id: merchantTransId,
      error: CLICK_ERROR.REQUEST_ERROR,
      error_note: "Payment cannot be processed",
    };
  }

  await logWebhookEvent({
    centerId: intent.centerId,
    paymentIntentId: intent.id,
    clickTransId,
    action: parsedAction,
    status: eventStatus,
    errorCode: txResp.error,
    errorNote: txResp.error_note,
    rawPayload: p,
    ipAddress: params.ipAddress,
  });

  return txResp;
}

/**
 * Expires overdue CREATED intents and detects stale PREPARED (>30m) intents.
 */
export async function reconcileStaleClickIntents(centerId?: string) {
  const now = new Date();
  const staleThreshold = new Date(now.getTime() - 30 * 60 * 1000);

  const expiredCreated = await db.paymentIntent.updateMany({
    where: {
      ...(centerId ? { centerId } : {}),
      status: "CREATED",
      expiresAt: { lt: now },
    },
    data: {
      status: "EXPIRED",
      errorNote: "Checkout TTL expired",
    },
  });

  const stalePrepared = await db.paymentIntent.findMany({
    where: {
      ...(centerId ? { centerId } : {}),
      status: "PREPARED",
      preparedAt: { lt: staleThreshold },
    },
    include: {
      centerPayment: { select: { id: true } },
    },
    take: 200,
  });

  let healedCount = 0;
  let flaggedStaleCount = 0;

  for (const intent of stalePrepared) {
    if (intent.centerPayment) {
      await db.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: "CONFIRMED",
          confirmedAt: intent.confirmedAt ?? now,
          errorNote: null,
        },
      });
      healedCount += 1;
      continue;
    }

    if (intent.expiresAt < now) {
      await db.paymentIntent.update({
        where: { id: intent.id },
        data: {
          status: "EXPIRED",
          errorNote: "STALE_PREPARED_EXPIRED: Complete webhook not received",
        },
      });
    } else {
      await db.paymentIntent.update({
        where: { id: intent.id },
        data: {
          errorNote: "STALE_PREPARED_TIMEOUT: Complete webhook pending > 30m",
        },
      });
    }
    flaggedStaleCount += 1;
  }

  return {
    expiredCount: expiredCreated.count,
    healedCount,
    flaggedStaleCount,
  };
}
