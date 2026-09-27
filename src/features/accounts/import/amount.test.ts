import { describe, expect, it } from 'vitest';
import { detectDecimal, parseStatementAmount } from './amount';

describe('parseStatementAmount', () => {
	it('reads amounts with either decimal separator', () => {
		expect(parseStatementAmount('1.234,56', ',', 2)).toBe(123456);
		expect(parseStatementAmount('-12,5', ',', 2)).toBe(-1250);
		expect(parseStatementAmount('1,234.56', '.', 2)).toBe(123456);
		expect(parseStatementAmount('-0.99', '.', 2)).toBe(-99);
		expect(parseStatementAmount('150', ',', 2)).toBe(15000);
	});

	it('ignores currency symbols and spaces, and reads other signs', () => {
		expect(parseStatementAmount('R$ 1.234,56', ',', 2)).toBe(123456);
		expect(parseStatementAmount('- R$ 10,00', ',', 2)).toBe(-1000);
		expect(parseStatementAmount('(12.50)', '.', 2)).toBe(-1250);
		expect(parseStatementAmount('150,00 D', ',', 2)).toBe(-15000);
		expect(parseStatementAmount('150,00 C', ',', 2)).toBe(15000);
		expect(parseStatementAmount('+5', '.', 2)).toBe(500);
		expect(parseStatementAmount('12.50−', '.', 2)).toBe(-1250);
	});

	it('rounds extra decimals and follows the currency digits', () => {
		expect(parseStatementAmount('1.005', '.', 2)).toBe(101);
		expect(parseStatementAmount('-1.004', '.', 2)).toBe(-100);
		expect(parseStatementAmount('1.234', ',', 0)).toBe(1234);
		expect(parseStatementAmount('500', '.', 0)).toBe(500);
	});

	it('refuses what is not an amount', () => {
		for (const text of ['', 'abc', '1,2,3,4', '12..5', '--5', '1.2.3,4.5', '12a'])
			expect(parseStatementAmount(text, ',', 2)).toBeNull();
	});
});

describe('detectDecimal', () => {
	it('picks the separator followed by one or two digits', () => {
		expect(detectDecimal(['1.234,56', '-10,00', '5'], '.')).toBe(',');
		expect(detectDecimal(['1,234.56', '-10.5'], ',')).toBe('.');
	});

	it('falls back when nothing tells', () => {
		expect(detectDecimal(['1.234', '100'], ',')).toBe(',');
		expect(detectDecimal([], '.')).toBe('.');
	});
});
