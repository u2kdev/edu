import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { backfillBillingData } from "../src/lib/backfill-billing";

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadLocalEnv();

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const centerIdx = args.findIndex((a) => a === "--center");
  const centerId = centerIdx >= 0 ? args[centerIdx + 1] : undefined;

  console.log(
    `[backfill-billing] Starting (dryRun=${dryRun}${centerId ? `, centerId=${centerId}` : ""})...`
  );

  const result = await backfillBillingData({ dryRun, centerId });
  for (const c of result.centers) {
    console.log(
      `[backfill-billing] Center "${c.centerName}" (${c.centerId}): debtBefore=${c.debtBeforeUzs} UZS -> debtAfter=${c.debtAfterUzs} UZS (delta=${c.debtDeltaUzs >= 0 ? "+" : ""}${c.debtDeltaUzs} UZS) | plans=${c.pricingPlansToCreate}, enrollments=${c.enrollmentsToUpdatePaidUntil}, charges=${c.chargesToCreate}, allocations=${c.allocationsToCreate}, receipts=${c.paymentsToBackfillReceipt}`
    );
  }
  console.log(
    `[backfill-billing] Totals: debtBefore=${result.totals.totalDebtBeforeUzs} UZS -> debtAfter=${result.totals.totalDebtAfterUzs} UZS`
  );
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((err) => {
    console.error("[backfill-billing] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
