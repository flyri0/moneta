import { describe, it, expect } from 'vitest';
import {
	currencyChoices,
	formatDate,
	formatMonth,
	formatMonthLong,
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
		expect(formatDate('2026-09-05', 'en')).toBe('Sep 5, 2026');
		expect(formatDate('2026-01-01', 'pt-BR')).toBe('1 de jan. de 2026');
	});
});
