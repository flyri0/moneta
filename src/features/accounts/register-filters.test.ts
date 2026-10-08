import { describe, expect, it } from 'vitest';
import { activeFilterCount, NO_FILTERS } from './register-filters';

describe('activeFilterCount', () => {
	it('is zero with no filters', () => {
		expect(activeFilterCount(NO_FILTERS)).toBe(0);
	});

	it('counts the period once, whichever ends are set', () => {
		expect(activeFilterCount({ ...NO_FILTERS, from: '2026-01-01' })).toBe(1);
		expect(activeFilterCount({ ...NO_FILTERS, to: '2026-02-01' })).toBe(1);
		expect(activeFilterCount({ ...NO_FILTERS, from: '2026-01-01', to: '2026-02-01' })).toBe(1);
	});

	it('counts the amount once, and a bound of zero as set', () => {
		expect(activeFilterCount({ ...NO_FILTERS, amountMin: 0 })).toBe(1);
		expect(activeFilterCount({ ...NO_FILTERS, amountMin: 100, amountMax: 500 })).toBe(1);
	});

	it('counts each of the others', () => {
		expect(
			activeFilterCount({
				from: '2026-01-01',
				to: '',
				categoryId: 'c',
				payeeId: 'p',
				amountMin: null,
				amountMax: 500,
				status: 'cleared',
				flags: ['red', 'none']
			})
		).toBe(6);
	});
});
