import type { Month } from '$lib/domain/month';

const EURO_REGIONS = new Set(
	'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK'.split(' ')
);
const REGION_CURRENCY: Record<string, string> = {
	BR: 'BRL',
	US: 'USD',
	GB: 'GBP',
	CA: 'CAD',
	AU: 'AUD',
	NZ: 'NZD',
	JP: 'JPY',
	MX: 'MXN',
	AR: 'ARS',
	CL: 'CLP',
	CO: 'COP',
	PE: 'PEN',
	UY: 'UYU',
	IN: 'INR',
	CH: 'CHF',
	SE: 'SEK',
	NO: 'NOK',
	DK: 'DKK',
	PL: 'PLN',
	ZA: 'ZAR',
	AO: 'AOA',
	MZ: 'MZN'
};

/** A sensible default currency for a locale such as 'pt-BR' or 'de'. Falls back to USD. */
export function suggestCurrency(locale: string): string {
	let region: string | undefined;
	try {
		region = new Intl.Locale(locale).maximize().region;
	} catch {
		return 'USD';
	}
	if (!region) return 'USD';
	return EURO_REGIONS.has(region) ? 'EUR' : (REGION_CURRENCY[region] ?? 'USD');
}

export interface Choice {
	value: string;
	label: string;
}

/** Every currency Intl knows, labelled in the UI language, e.g. "Brazilian Real (BRL)". */
export function currencyChoices(uiLocale: string): Choice[] {
	const names = new Intl.DisplayNames(uiLocale, { type: 'currency' });
	return Intl.supportedValuesOf('currency')
		.map((code) => ({ value: code, label: `${names.of(code) ?? code} (${code})` }))
		.sort((a, b) => a.label.localeCompare(b.label, uiLocale));
}

const COMMON_LOCALES = [
	'pt-BR',
	'pt-PT',
	'en-US',
	'en-GB',
	'es-ES',
	'es-MX',
	'es-AR',
	'fr-FR',
	'de-DE',
	'it-IT',
	'ja-JP'
];

/** Number/date formats to offer for a budget, including the browser's own locale. */
export function localeChoices(uiLocale: string, browserLocale?: string): Choice[] {
	const names = new Intl.DisplayNames(uiLocale, { type: 'language' });
	const values = [...COMMON_LOCALES];
	if (browserLocale && !values.includes(browserLocale)) {
		try {
			values.unshift(Intl.getCanonicalLocales(browserLocale)[0]);
		} catch {
			// ignore an invalid browser locale
		}
	}
	return values.map((value) => ({ value, label: `${names.of(value) ?? value} (${value})` }));
}

function utc(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d ?? 1));
}

/** "Sep 2026" / "set. de 2026". */
export function formatMonth(month: Month, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "September 2026" / "setembro de 2026". */
export function formatMonthLong(month: Month, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "Sep 5, 2026" / "5 de set. de 2026". */
export function formatDate(date: string, locale: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(date));
}
