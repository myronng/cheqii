import type { Cookies } from '@sveltejs/kit';

import localeStrings from '$lib/utils/common/localeStrings.json';

export type LocaleData = {
	master: LocalizedStrings;
	strings: LocalizedStrings;
};
export type LocaleString = keyof typeof localeStrings;
export type LocalizedStrings = Record<LocaleString, string>;
export type LocaleMaster = Record<AcceptedLocale, LocalizedStrings>;
export type AcceptedLocale = (typeof ACCEPTED_LOCALES_ARRAY)[number];

const ACCEPTED_LOCALES_ARRAY = ['en-CA'] as const;
export const DEFAULT_LOCALE = ACCEPTED_LOCALES_ARRAY[0];
export const ACCEPTED_LOCALES = new Set(ACCEPTED_LOCALES_ARRAY);
export const LOCALE_MASTER = {} as LocaleMaster;

// Initialize languages
ACCEPTED_LOCALES.forEach((locale) => (LOCALE_MASTER[locale] = {} as LocalizedStrings));

Object.entries(localeStrings).forEach(([key, value]) => {
	Object.entries(value).forEach((localizedStrings) => {
		LOCALE_MASTER[localizedStrings[0] as AcceptedLocale][key as keyof LocalizedStrings] =
			localizedStrings[1] || `@${key}@`;
	});
});

export const getLocaleStrings = (
	cookies: Cookies,
	request: Request,
	localeSubset?: LocaleString[]
) => {
	const locale = getSafeLocale(cookies, request);
	const result: LocaleData = {
		master: LOCALE_MASTER[locale],
		strings: {} as LocalizedStrings
	};
	localeSubset?.forEach((item) => {
		if (!isValidLocale(item)) {
			throw new Error('missingLocaleString', { cause: item });
		}
		const localeItem = localeStrings[item];
		result.strings[item] = localeItem?.[locale as keyof typeof localeItem] || `@${item}@`;
	});
	return result;
};

const getSafeLocale = (cookies: Cookies, request: Request) => {
	let locale = DEFAULT_LOCALE;
	const cookieLocale = cookies.get('locale');
	if (isAcceptedLocale(cookieLocale)) {
		locale = cookieLocale;
	} else {
		const languages = request.headers.get('accept-language')?.split(',');
		if (languages) {
			for (const language of languages) {
				if (isAcceptedLocale(language)) {
					locale = language;
					break;
				}
			}
		}
		cookies.set('locale', locale, { path: '/' });
	}
	return locale;
};

export const interpolateString = (
	str: string,
	interpolateObj: Record<string, string>,
	formatFn?: (interpolatedString: string, key: string) => string
) =>
	str?.replace(/\{([^{]+)\}/g, (match, key) => {
		const interpolatedString =
			typeof interpolateObj[key] !== 'undefined' ? interpolateObj[key] : `@${match}@`;
		// Format the interpolated values if callback provided
		return typeof formatFn === 'function' ? formatFn(interpolatedString, key) : interpolatedString;
	});

export const isAcceptedLocale = (unsafeLang?: string): unsafeLang is AcceptedLocale => {
	if (ACCEPTED_LOCALES.has(unsafeLang as AcceptedLocale)) {
		return true;
	}
	return false;
};

export const isValidLocale = (item: string): item is LocaleString => item in localeStrings;
