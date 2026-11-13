// Reason: Exception: Platform finance helper operates on global models.
// eslint-disable-next-line no-restricted-imports
import { db } from "@/lib/db";

/**
 * Generates the next sequential invoice number in format INV-YYYY-XXXX (e.g. INV-2026-0001).
 */
export async function generateNextInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  const lastPayment = await db.platformPayment.findFirst({
    where: {
      invoiceNumber: {
        startsWith: prefix,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      invoiceNumber: true,
    },
  });

  let nextSequence = 1;
  if (lastPayment?.invoiceNumber) {
    const parts = lastPayment.invoiceNumber.split("-");
    const numPart = parseInt(parts[2] || "0", 10);
    if (!isNaN(numPart)) {
      nextSequence = numPart + 1;
    }
  }

  const padded = String(nextSequence).padStart(4, "0");
  return `${prefix}${padded}`;
}

/**
 * Calculates MRR (Monthly Recurring Revenue) in UZS for all active centers.
 */
export async function calculatePlatformMRR(): Promise<{
  mrr: number;
  arr: number;
  activeSubscriptionsCount: number;
  arpu: number;
}> {
  const activeSubscriptions = await db.subscription.findMany({
    where: {
      status: { in: ["ACTIVE", "TRIAL"] },
      center: {
        status: { in: ["ACTIVE", "TRIAL"] },
      },
    },
    include: {
      plan: {
        select: {
          priceMonthly: true,
        },
      },
    },
  });

  const mrr = activeSubscriptions.reduce((acc, sub) => {
    // Only paid plans contribute to MRR
    return acc + Math.round(sub.plan.priceMonthly || 0);
  }, 0);

  const arr = mrr * 12;
  const count = activeSubscriptions.length;
  const arpu = count > 0 ? Math.round(mrr / count) : 0;

  return {
    mrr,
    arr,
    activeSubscriptionsCount: count,
    arpu,
  };
}
