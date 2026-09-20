import { describe, it, expect } from 'vitest';
import {
	currencyDigits,
	formatAmountInput,
	formatMoney,
	formatMoneyCompact,
	parseAmount
} from './money';

const BRL = { currency: 'BRL', locale: 'pt-BR' };
const USD = { currency: 'USD', locale: 'en-US' };
const JPY = { currency: 'JPY', locale: 'ja-JP' };
const norm = (s: string) => s.replace(/\s/g, ' ');

describe('currencyDigits', () => {
	it('knows minor unit digits', () => {
		expect(currencyDigits('BRL')).toBe(2);
		expect(currencyDigits('JPY')).toBe(0);
	});

	it('rejects unknown and malformed currencies', () => {
		expect(() => currencyDigits('XYZ')).toThrow(RangeError);
		expect(() => currencyDigits('AB')).toThrow(RangeError);
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
		['R$1.234,56', BRL, 123456],
		['BRL 10', BRL, 1000],
		['$12.50', USD, 1250],
		['1.234.567', BRL, 123456700],
		['120+35', USD, 15500],
		['100 - 20,5', BRL, 7950],
		['3*1.10', USD, 330],
		['(10+5)/2', USD, 750],
		['-12.34', USD, -1234],
		['−12,34', BRL, -1234],
		['.5', USD, 50],
		['1500', JPY, 1500],
		['0', USD, 0]
	])('parses %s', (input, fmt, expected) => {
		expect(parseAmount(input, fmt)).toBe(expected);
	});

	it.each(['', 'abc', '1+', '(1', '1/0', '1..2.3,4'])('rejects %s', (input) => {
		expect(parseAmount(input, USD)).toBeNull();
	});

	it.each([
		['1e5', USD],
		['12a3', USD],
		['US$ 5', BRL],
		['1.234,567', USD],
		['-12.345', USD],
		['1,23,456', USD],
		['1.234.56', BRL],
		['1.2,34', BRL],
		['12.5', JPY]
	])('rejects ambiguous or mistyped %s', (input, fmt) => {
		expect(parseAmount(input, fmt)).toBeNull();
	});
});

describe('formatAmountInput', () => {
	it.each([
		[123456, BRL, '1234,56'],
		[-1250, USD, '-12.50'],
		[1500, JPY, '1500'],
		[-1250, { currency: 'SEK', locale: 'sv-SE' }, '-12,50']
	])('formats %i for editing and parses back', (minor, fmt, text) => {
		expect(formatAmountInput(minor, fmt)).toBe(text);
		expect(parseAmount(text, fmt)).toBe(minor);
	});
});

describe('formatMoneyCompact', () => {
	it('abbreviates large amounts for chart axes', () => {
		expect(formatMoneyCompact(123456789, USD)).toBe('$1.2M');
		expect(norm(formatMoneyCompact(150000, BRL))).toBe('R$ 1,5 mil');
		expect(formatMoneyCompact(-25000, USD)).toBe('-$250');
		expect(norm(formatMoneyCompact(1500, JPY))).toBe('￥1500');
	});
});
