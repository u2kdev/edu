import crypto from "crypto";
import { db } from "./db";
import { sha256Hex } from "./crypto-cipher";

const DEV_RECEIPT_VERIFY_FALLBACK = "edarschi-dev-receipt-verify-secret-change-me";

function getReceiptVerifySecret(): string {
  const secret = process.env.RECEIPT_VERIFY_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("CRITICAL: RECEIPT_VERIFY_SECRET must be set in production");
    }
    return process.env.JWT_SECRET || DEV_RECEIPT_VERIFY_FALLBACK;
  }
  return secret;
}

/**
 * Generates an unguessable 32-char hex verification code bound to paymentId via HMAC-SHA256.
 * Deterministic per payment so re-downloading a receipt keeps already-printed QR codes valid.
 */
export function computeReceiptVerifyCode(paymentId: string): string {
  return crypto
    .createHmac("sha256", getReceiptVerifySecret())
    .update(`receipt:${paymentId}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Computes the SHA-256 hash stored on `CenterPayment.receiptVerifyHash` (safe at rest).
 */
export function computeReceiptVerifyHash(verifyCode: string): string {
  return sha256Hex(verifyCode);
}

export interface PublicReceiptVerificationResult {
  valid: boolean;
  receiptNumber?: string;
  centerName?: string;
  amount?: number;
  refundedAmount?: number;
  currency?: string;
  status?: string;
  paidAt?: string | null;
}

/**
 * Public zero-PII receipt verification lookup by 32-char HMAC code.
 */
export async function verifyReceiptByCode(code: string): Promise<PublicReceiptVerificationResult> {
  const normalized = code.trim().toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) {
    return { valid: false };
  }

  const hash = computeReceiptVerifyHash(normalized);
  const payment = await db.centerPayment.findUnique({
    where: { receiptVerifyHash: hash },
    select: {
      receiptNumber: true,
      amount: true,
      refundedAmount: true,
      currency: true,
      status: true,
      paidAt: true,
      deletedAt: true,
      center: { select: { name: true } },
    },
  });

  if (!payment || payment.deletedAt || !payment.receiptNumber) {
    return { valid: false };
  }

  return {
    valid: true,
    receiptNumber: payment.receiptNumber,
    centerName: payment.center.name,
    amount: payment.amount,
    refundedAmount: payment.refundedAmount,
    currency: payment.currency,
    status: payment.status,
    paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
  };
}
