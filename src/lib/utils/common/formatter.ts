export const CURRENCY_MIN = 0;
export const CURRENCY_MAX = 9999999.99;
export const SPLIT_MIN = 0;
export const SPLIT_MAX = 9999999;

export const CURRENCY_FORMATTER = new Intl.NumberFormat("en-CA", {
  currency: "CAD",
  currencyDisplay: "narrowSymbol",
  style: "currency",
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

export const getNumericDisplay = (
  formatter: Intl.NumberFormat,
  value: number,
) =>
  formatter.format(
    value /
      Math.pow(10, formatter.resolvedOptions().maximumFractionDigits ?? 2),
  );

export const isNumber = (value: number) =>
  !Number.isNaN(value) && Number.isFinite(value);

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
    const factor = Math.pow(
      10,
      formatter.resolvedOptions().maximumFractionDigits ?? 2,
    );
    const scaledValue = numericValue / factor;
    const isAboveMinimum =
      typeof min === "undefined" ||
      (typeof min === "number" && scaledValue >= min);
    const isUnderMaximum =
      typeof max === "undefined" ||
      (typeof max === "number" && scaledValue <= max);
    if (isAboveMinimum && isUnderMaximum) {
      return Math.round(numericValue * factor) / factor;
    }
  }
  return 0;
};
