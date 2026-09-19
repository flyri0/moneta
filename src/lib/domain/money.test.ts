import { describe, it, expect } from 'vitest';
import { currencyDigits, formatMoney, parseAmount } from './money';

const BRL = { currency: 'BRL', locale: 'pt-BR' };
const USD = { currency: 'USD', locale: 'en-US' };
const JPY = { currency: 'JPY', locale: 'ja-JP' };
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('currencyDigits', () => {
	it('knows minor unit digits', () => {
		expect(currencyDigits('BRL')).toBe(2);
		expect(currencyDigits('JPY')).toBe(0);
	});
});

describe('formatMoney', () => {
	it('formats minor units in the budget locale', () => {
		expect(norm(formatMoney(123456, BRL))).toBe('R$ 1.234,56');
		expect(formatMoney(-123450, USD)).toBe('-$1,234.50');
		expect(formatMoney(1234, JPY)).toBe('￥1,234');
	});
});

describe('parseAmount', () => {
	it.each([
		['1.234,56', BRL, 123456],
		['12,5', BRL, 1250],
		['12.50', BRL, 1250],
		['1.234', BRL, 123400],
		['1,234.56', USD, 123456],
		['12.5', USD, 1250],
		['1,234', USD, 123400],
		['R$ 10', BRL, 1000],
		['120+35', USD, 15500],
		['100 - 20,5', BRL, 7950],
		['3*1.10', USD, 330],
		['(10+5)/2', USD, 750],
		['-12.345', USD, -1235],
		['.5', USD, 50],
		['1500', JPY, 1500],
		['0', USD, 0]
	])('parses %s', (input, fmt, expected) => {
		expect(parseAmount(input, fmt)).toBe(expected);
	});

	it.each(['', 'abc', '1+', '(1', '1/0', '1..2.3,4'])('rejects %s', (input) => {
		expect(parseAmount(input, USD)).toBeNull();
	});
});
