export const CURRENCY_MIN = 0;
export const CURRENCY_MAX = 9999999.99;
export const RATIO_MIN = 0;
export const RATIO_MAX = 9999999;

export const getNumericDisplay = (formatter: Intl.NumberFormat, value: number) => {
	const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2;
	return formatter.format(value / Math.pow(10, decimals));
};

export const isNumber = (value: number) => !Number.isNaN(value) && Number.isFinite(value);

export const parseNumericFormat = (
	formatter: Intl.NumberFormat,
	value: string,
	min?: number,
	max?: number
) => {
	// Use formatter with 5 digits to get all known permutations of number formatting
	const parts = formatter.formatToParts(11111.1);
	for (const part of parts) {
		if (
			part.type === 'currency' ||
			part.type === 'group' ||
			part.type === 'literal' ||
			part.type === 'percentSign' ||
			part.type === 'unit'
		) {
			value = value.replace(new RegExp(`\\${part.value}`, 'g'), '');
		} else if (part.type === 'decimal') {
			value = value.replace(new RegExp(`\\${part.value}`), '.');
		}
	}
	const numericValue = Number(value);
	const isAboveMinimum =
		typeof min === 'undefined' || (typeof min === 'number' && numericValue >= min);
	const isUnderMaximum =
		typeof max === 'undefined' || (typeof max === 'number' && numericValue <= max);
	if (isNumber(numericValue) && isAboveMinimum && isUnderMaximum) {
		const decimals = formatter.resolvedOptions().maximumFractionDigits ?? 2;
		const factor = Math.pow(10, decimals);
		return Math.round(numericValue * factor) / factor;
	}
	return 0;
};
