/**
 * Money helpers. All amounts elsewhere are integer **minor units** (e.g. cents);
 * this is the only module that knows about currency scale and human formatting.
 * The minor-unit exponent is derived per ISO-4217 currency (most 2, JPY 0, some 3)
 * so the allocation/settlement math stays currency-agnostic integer arithmetic.
 * See docs/allocation-spec.md §1.
 */

const digitsCache = new Map<string, number>();

/** Number of minor-unit digits for a currency (2 for USD/CAD, 0 for JPY, 3 for KWD…). */
export function minorUnitDigits(currency: string): number {
  const key = currency.toUpperCase();
  const cached = digitsCache.get(key);
  if (cached !== undefined) return cached;
  let digits = 2; // sensible default if the runtime doesn't know the currency
  try {
    digits =
      new Intl.NumberFormat("en", {
        style: "currency",
        currency: key,
      }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    // Unknown/invalid currency code — fall back to 2.
  }
  digitsCache.set(key, digits);
  return digits;
}

/** Minor units per major unit: 100 for cents, 1 for JPY, 1000 for KWD. */
export function scale(currency: string): number {
  return 10 ** minorUnitDigits(currency);
}

/** Format an integer minor-unit amount as a localized currency string. */
export function format(amountMinor: number, currency: string, locale = "en"): string {
  const key = currency.toUpperCase();
  const major = amountMinor / scale(key);
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: key }).format(major);
  } catch {
    // Unknown currency: format the number and suffix the raw code.
    return `${new Intl.NumberFormat(locale, {
      minimumFractionDigits: minorUnitDigits(key),
      maximumFractionDigits: minorUnitDigits(key),
    }).format(major)} ${key}`;
  }
}

/**
 * Parse a user-entered major-unit string (e.g. "12.34") into integer minor units.
 * Returns null when the input isn't a finite number. Rounds to the nearest minor
 * unit so floating point can't leak fractional cents into stored amounts.
 */
export function parse(input: string, currency: string): number | null {
  const cleaned = input.replace(/[^0-9.-]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return null;
  const major = Number(cleaned);
  if (!Number.isFinite(major)) return null;
  return Math.round(major * scale(currency));
}
