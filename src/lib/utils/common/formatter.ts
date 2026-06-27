export const AMOUNT_MIN = 0;
export const AMOUNT_MAX = 9999999.99;
export const SPLIT_MIN = 0;
export const SPLIT_MAX = 9999999;

/** Minor-unit scale for all amounts. Cheques are currency-agnostic: plain numbers
 *  with two decimal places, stored as integer minor units (×100). */
export const AMOUNT_SCALE = 100;

/** Currency-agnostic amount formatter: a plain decimal with two fraction digits
 *  (no currency symbol). Cheques no longer carry a currency code. */
export const AMOUNT_FORMATTER = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
  style: "decimal",
});

export const DATE_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export const INTEGER_FORMATTER = new Intl.NumberFormat("en-CA", {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  style: "decimal",
});

export const DATETIME_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const MONTH_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", { day: "numeric", month: "short" });
const MONTH_DAY_YEAR_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Compact relative time for listing meta: "Just now", "5m ago", "2h ago",
 *  "Yesterday", "3d ago", then an absolute date ("Jun 21" / "Jun 21, 2025").
 *  `now` is injectable for testing. (English literals — single-locale for now;
 *  move to localeStrings if/when we add locales.) */
export const formatRelativeTime = (value: Date | string, now: Date = new Date()): string => {
  const date = typeof value === "string" ? new Date(value) : value;
  const minutes = Math.round((now.getTime() - date.getTime()) / 60000);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  const formatter =
    date.getFullYear() === now.getFullYear() ? MONTH_DAY_FORMATTER : MONTH_DAY_YEAR_FORMATTER;
  return formatter.format(date);
};

export const getNumericDisplay = (formatter: Intl.NumberFormat, value: number) =>
  formatter.format(value / Math.pow(10, formatter.resolvedOptions().maximumFractionDigits ?? 2));

export const isNumber = (value: number) => !Number.isNaN(value) && Number.isFinite(value);

export const parseNumericFormat = (
  formatter: Intl.NumberFormat,
  value: string,
  min?: number,
  max?: number,
) => {
  // Use formatter with 5 digits to get all known permutations of number formatting
  const parts = formatter.formatToParts(11111.1);
  for (const part of parts) {
    if (
      part.type === "currency" ||
      part.type === "group" ||
      part.type === "literal" ||
      part.type === "percentSign" ||
      part.type === "unit"
    ) {
      value = value.replace(new RegExp(`\\${part.value}`, "g"), "");
    } else if (part.type === "decimal") {
      value = value.replace(new RegExp(`\\${part.value}`), ".");
    }
  }
  const numericValue = Number(value);
  if (isNumber(numericValue)) {
    const factor = Math.pow(10, formatter.resolvedOptions().maximumFractionDigits ?? 2);
    const scaledValue = numericValue / factor;
    const isAboveMinimum =
      typeof min === "undefined" || (typeof min === "number" && scaledValue >= min);
    const isUnderMaximum =
      typeof max === "undefined" || (typeof max === "number" && scaledValue <= max);
    if (isAboveMinimum && isUnderMaximum) {
      return Math.round(numericValue * factor) / factor;
    }
  }
  return 0;
};
