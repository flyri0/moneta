import { afterEach, describe, expect, it } from 'vitest';
import { clearFilters, period } from './period.svelte';

describe('clearFilters', () => {
	afterEach(() => {
		period.preset = null;
		period.flags = [];
	});

	it('widens the period to all time and drops the flags', () => {
		period.preset = 'last_month';
		period.flags = ['red'];
		clearFilters('this_month')?.();
		expect(period.preset).toBe('all');
		expect(period.flags).toEqual([]);
	});

	it('uses the page default until a period is picked', () => {
		expect(clearFilters('all')).toBeUndefined();
		expect(clearFilters('this_month')).toBeTypeOf('function');
	});

	it('offers nothing when nothing is filtered', () => {
		period.preset = 'all';
		expect(clearFilters('this_month')).toBeUndefined();
	});

	it('offers to drop the flags over all time', () => {
		period.preset = 'all';
		period.flags = ['red'];
		expect(clearFilters('this_month')).toBeTypeOf('function');
	});
});
