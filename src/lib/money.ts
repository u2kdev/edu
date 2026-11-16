/**
 * Shared integer UZS money rounding & comparison helpers.
 * Converts legacy Float monetary values (CenterPayment.amount, Course.priceMonthly,
 * FinanceTransaction.amount, SubscriptionPlan.priceMonthly) consistently to integer tiyin-free UZS sums.
 */

export function roundUzs(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  const rounded = value >= 0 ? Math.round(value) : -Math.round(-value);
  return rounded === 0 ? 0 : rounded;
}

export function isSameUzsAmount(
  a: number | null | undefined,
  b: number | null | undefined
): boolean {
  return roundUzs(a) === roundUzs(b);
}

/**
 * Normalizes numeric grouping to a plain integer string separated by ASCII spaces.
 * E.g. 1250000 -> "1 250 000", -4500 -> "-4 500".
 */
export function formatIntegerSpaces(value: number | bigint | null | undefined): string {
  if (typeof value === "bigint") {
    const negative = value < BigInt(0);
    const digits = (negative ? -value : value).toString();
    const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return negative && digits !== "0" ? `-${grouped}` : grouped;
  }
  const rounded = roundUzs(value);
  const negative = rounded < 0;
  const digits = Math.abs(rounded).toString();
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return negative ? `-${grouped}` : grouped;
}

export interface FormatUzsOptions {
  /** Locale: "ru" (default) or "uz-Latn". */
  locale?: string;
  /** Append currency unit ("сум" / "soʻm" / "UZS"). Defaults to true. */
  showCurrency?: boolean;
  /** Use localized currency word ("сум" / "soʻm") or ISO code ("UZS"). Defaults to "word". */
  currencyStyle?: "word" | "code";
  /** Compact format for chart axes (e.g. "12.5 млн", "450 тыс"). */
  compact?: boolean;
}

/**
 * Single shared integer UZS currency formatter using space thousands separators.
 * Guarantees deterministic integer formatting (no decimal tiyins) across UI panels, tables and charts.
 */
export function formatUzs(
  amount: number | bigint | null | undefined,
  options: FormatUzsOptions = {}
): string {
  const { locale = "ru", showCurrency = true, currencyStyle = "word", compact = false } = options;
  const isUz = locale === "uz-Latn";

  if (compact) {
    const numeric = typeof amount === "bigint" ? Number(amount) : roundUzs(amount);
    const sign = numeric < 0 ? "-" : "";
    const abs = Math.abs(numeric);
    let body: string;
    if (abs >= 1_000_000_000) {
      const val = Math.round((abs / 1_000_000_000) * 10) / 10;
      body = `${sign}${val} ${isUz ? "mlrd" : "млрд"}`;
    } else if (abs >= 1_000_000) {
      const val = Math.round((abs / 1_000_000) * 10) / 10;
      body = `${sign}${val} ${isUz ? "mln" : "млн"}`;
    } else if (abs >= 10_000) {
      const val = Math.round(abs / 1_000);
      body = `${sign}${val} ${isUz ? "ming" : "тыс"}`;
    } else {
      body = `${sign}${formatIntegerSpaces(abs)}`;
    }
    if (!showCurrency) return body;
    const suffix = currencyStyle === "code" ? "UZS" : isUz ? "soʻm" : "сум";
    return `${body} ${suffix}`;
  }

  const formattedNumber = formatIntegerSpaces(amount);
  if (!showCurrency) return formattedNumber;
  const unit = currencyStyle === "code" ? "UZS" : isUz ? "soʻm" : "сум";
  return `${formattedNumber} ${unit}`;
}

export function formatNumber(value: number | bigint | null | undefined): string {
  return formatIntegerSpaces(value);
}
