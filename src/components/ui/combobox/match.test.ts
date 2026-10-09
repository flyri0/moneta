import { describe, expect, it } from 'vitest';
import { hasExactMatch } from './match';

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
