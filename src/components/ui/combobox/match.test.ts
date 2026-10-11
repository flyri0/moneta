import { describe, expect, it } from 'vitest';
import { hasExactMatch, pickerFilter } from './match';

describe('hasExactMatch', () => {
	const items = [
		{ value: 'Whole Foods', label: 'Whole Foods' },
		{ value: '0192-account-id', label: 'Transfer: Visa' }
	];

	it('matches a value, ignoring case and surrounding space', () => {
		expect(hasExactMatch(items, '  whole foods ')).toBe(true);
	});

	it('matches a label whose value differs, such as a transfer', () => {
		expect(hasExactMatch(items, 'transfer: visa')).toBe(true);
	});

	it('does not match a partial name or an empty query', () => {
		expect(hasExactMatch(items, 'Transfer')).toBe(false);
		expect(hasExactMatch(items, '')).toBe(false);
	});
});

describe('pickerFilter', () => {
	const long = 'A very long category name that goes on and on to test truncation in every layout';

	it('never matches scattered letters', () => {
		expect(pickerFilter(`${long} 0192-id`, 'Salary', [long])).toBe(0);
	});

	it('ranks exact, then prefix, then word prefix, then anywhere', () => {
		expect(pickerFilter('x', 'rent', ['Rent'])).toBe(1);
		expect(pickerFilter('x', 'ren', ['Rent'])).toBe(0.9);
		expect(pickerFilter('x', 'mort', ['Rent or Mortgage'])).toBe(0.8);
		expect(pickerFilter('x', 'ortg', ['Rent or Mortgage'])).toBe(0.6);
		expect(pickerFilter('x', 'rent', ['Parents'])).toBe(0.6);
	});

	it('ignores case and accents', () => {
		expect(pickerFilter('x', 'eletricidade', ['Eletricidade'])).toBe(1);
		expect(pickerFilter('x', 'agua', ['Água e luz'])).toBe(0.9);
	});

	it('scores the value when there are no keywords, and matches an empty search', () => {
		expect(pickerFilter('US Dollar (USD)', 'usd')).toBe(0.8);
		expect(pickerFilter('Anything', '')).toBe(1);
	});

	it('takes the best keyword', () => {
		expect(pickerFilter('x', 'visa', ['Transfer: Visa', 'Visa'])).toBe(1);
	});
});
