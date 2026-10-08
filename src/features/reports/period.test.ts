import { afterEach, describe, expect, it } from 'vitest';
import { period, showAllTime } from './period.svelte';

describe('showAllTime', () => {
	afterEach(() => {
		period.preset = null;
	});

	it('widens the period to all time', () => {
		period.preset = 'last_month';
		showAllTime('this_month')?.();
		expect(period.preset).toBe('all');
	});

	it('uses the page default until a period is picked', () => {
		expect(showAllTime('all')).toBeUndefined();
		expect(showAllTime('this_month')).toBeTypeOf('function');
	});

	it('offers nothing when the period is already all time', () => {
		period.preset = 'all';
		expect(showAllTime('this_month')).toBeUndefined();
	});
});
