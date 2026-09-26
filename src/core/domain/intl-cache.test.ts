import { describe, expect, it } from 'vitest';
import { dateTimeFormat, numberFormat } from './intl-cache';

describe('numberFormat', () => {
	it('reuses one formatter per locale and options', () => {
		const a = numberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
		expect(numberFormat('pt-BR', { style: 'currency', currency: 'BRL' })).toBe(a);
		expect(numberFormat('pt-BR', { style: 'currency', currency: 'USD' })).not.toBe(a);
		expect(numberFormat('en-US', { style: 'currency', currency: 'BRL' })).not.toBe(a);
	});

	it('keeps locales and options apart when used in turn', () => {
		const brl = () => numberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(1.5);
		const usd = () => numberFormat('en-US', { style: 'currency', currency: 'USD' }).format(1.5);
		const first = [brl(), usd()];
		expect([brl(), usd()]).toEqual(first);
		expect(first[0]).not.toBe(first[1]);
	});

	it('throws for a bad locale, as the constructor does', () => {
		expect(() => numberFormat('not a locale')).toThrow(RangeError);
	});
});

describe('dateTimeFormat', () => {
	it('reuses one formatter per locale and options', () => {
		const a = dateTimeFormat('en', { month: 'short', timeZone: 'UTC' });
		expect(dateTimeFormat('en', { month: 'short', timeZone: 'UTC' })).toBe(a);
		expect(dateTimeFormat('en', { month: 'long', timeZone: 'UTC' })).not.toBe(a);
	});

	it('tells an unset option from one set to undefined', () => {
		const date = new Date(Date.UTC(2026, 8, 1, 12));
		const unset = dateTimeFormat('en', { dateStyle: 'short' }).format(date);
		expect(dateTimeFormat('en', { dateStyle: 'short', timeZone: undefined }).format(date)).toBe(
			unset
		);
	});
});
