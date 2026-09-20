import { describe, it, expect } from 'vitest';
import {
	currencyChoices,
	formatBytes,
	formatDate,
	formatDateTime,
	formatMonth,
	formatMonthLong,
	formatMonthName,
	localeChoices,
	suggestCurrency
} from './formats';

describe('suggestCurrency', () => {
	it.each([
		['pt-BR', 'BRL'],
		['en-US', 'USD'],
		['en', 'USD'],
		['de-DE', 'EUR'],
		['pt-PT', 'EUR'],
		['ja-JP', 'JPY'],
		['en-GB', 'GBP'],
		['not a locale', 'USD']
	])('suggests a currency for %s', (locale, currency) => {
		expect(suggestCurrency(locale)).toBe(currency);
	});
});

describe('choices', () => {
	it('labels currencies in the UI language', () => {
		expect(currencyChoices('en')).toContainEqual({ value: 'BRL', label: 'Brazilian Real (BRL)' });
		expect(currencyChoices('pt-BR')).toContainEqual({
			value: 'USD',
			label: 'Dólar americano (USD)'
		});
	});

	it('offers common locales plus the browser one', () => {
		const values = localeChoices('en', 'nl-NL').map((c) => c.value);
		expect(values[0]).toBe('nl-NL');
		expect(values).toContain('pt-BR');
		expect(localeChoices('en', 'pt-BR').filter((c) => c.value === 'pt-BR')).toHaveLength(1);
	});
});

describe('dates', () => {
	it('formats months and dates in the UI language without time zone drift', () => {
		expect(formatMonth('2026-09', 'en')).toBe('Sep 2026');
		expect(formatMonth('2026-09', 'pt-BR')).toBe('set. de 2026');
		expect(formatMonthLong('2026-09', 'pt-BR')).toBe('setembro de 2026');
		expect(formatMonthName(9, 'en')).toBe('Sep');
		expect(formatMonthName(9, 'pt-BR')).toBe('set.');
		expect(formatMonthName(9, 'en', 'long')).toBe('September');
		expect(formatMonthName(9, 'pt-BR', 'long')).toBe('setembro');
		expect(formatDate('2026-09-05', 'en')).toBe('Sep 5, 2026');
		expect(formatDate('2026-01-01', 'pt-BR')).toBe('1 de jan. de 2026');
	});
});

describe('formatDateTime', () => {
	it('shows a timestamp with date and time', () => {
		expect(formatDateTime('2026-09-19T15:04:00Z', 'pt-BR', 'UTC')).toBe(
			'19 de set. de 2026, 15:04'
		);
	});
});

describe('formatBytes', () => {
	it('picks a readable unit, from kilobytes up', () => {
		expect(formatBytes(500, 'en-US')).toBe('0.5 kB');
		expect(formatBytes(1_234_567, 'en-US')).toBe('1.2 MB');
		expect(formatBytes(1_500_000, 'pt-BR')).toBe('1,5 MB');
		expect(formatBytes(5e9, 'pt-BR')).toBe('5 GB');
	});
});
