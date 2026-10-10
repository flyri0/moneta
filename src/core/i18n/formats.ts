import type { Month } from '$domain/month';
import { dateTimeFormat, numberFormat } from '$domain/intl-cache';

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

/** `text` with its first letter capitalized and the rest left alone ("Outubro de 2026"). */
export function capitalizeFirst(text: string, locale: string): string {
	return text.charAt(0).toLocaleUpperCase(locale) + text.slice(1);
}

/** Number/date formats to offer for a budget, the browser's own locale first. */
export function localeChoices(uiLocale: string, browserLocale?: string): Choice[] {
	const names = new Intl.DisplayNames(uiLocale, { type: 'language' });
	let values = [...COMMON_LOCALES];
	if (browserLocale) {
		try {
			const first = Intl.getCanonicalLocales(browserLocale)[0];
			values = [first, ...values.filter((v) => v !== first)];
		} catch {
			// ignore an invalid browser locale
		}
	}
	return values.map((value) => ({
		value,
		label: `${capitalizeFirst(names.of(value) ?? value, uiLocale)} (${value})`
	}));
}

function utc(date: string): Date {
	const [y, m, d] = date.split('-').map(Number);
	return new Date(Date.UTC(y, m - 1, d ?? 1));
}

/** "Sep 2026" / "set. de 2026". */
export function formatMonth(month: Month, locale: string): string {
	return dateTimeFormat(locale, {
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "September 2026" / "setembro de 2026". */
export function formatMonthLong(month: Month, locale: string): string {
	return dateTimeFormat(locale, {
		month: 'long',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(month));
}

/** "Sep" / "set." or "September" / "setembro" for a 1-based month number. */
export function formatMonthName(
	monthNumber: number,
	locale: string,
	length: 'short' | 'long' = 'short'
): string {
	const date = new Date(Date.UTC(2026, monthNumber - 1, 1));
	return dateTimeFormat(locale, {
		month: length,
		timeZone: 'UTC'
	}).format(date);
}

/** "Sep 5, 2026" / "5 de set. de 2026". */
export function formatDate(date: string, locale: string): string {
	return dateTimeFormat(locale, {
		day: 'numeric',
		month: 'short',
		year: 'numeric',
		timeZone: 'UTC'
	}).format(utc(date));
}

/** "19 de set. de 2026, 15:04" for an ISO timestamp, in the device's time zone by default. */
export function formatDateTime(iso: string, locale: string, timeZone?: string): string {
	return dateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short',
		timeZone
	}).format(new Date(iso));
}

const BYTE_UNITS = ['kilobyte', 'megabyte', 'gigabyte', 'terabyte'] as const;

/** "1.2 MB": decimal units (1 kB = 1000 bytes), as browsers report storage. */
export function formatBytes(bytes: number, locale: string): string {
	let value = bytes / 1000;
	let unit = 0;
	while (value >= 1000 && unit < BYTE_UNITS.length - 1) {
		value /= 1000;
		unit++;
	}
	return numberFormat(locale, {
		style: 'unit',
		unit: BYTE_UNITS[unit],
		maximumFractionDigits: 1
	}).format(value);
}
