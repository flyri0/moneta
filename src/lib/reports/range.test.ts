import { describe, it, expect } from 'vitest';
import { isDate, MAX_DATE, MIN_DATE } from '$lib/domain/month';
import { presetRange, RANGE_PRESETS } from './range';

describe('presetRange', () => {
	it.each([
		['this_month', '2026-09-01', '2026-09-30'],
		['last_month', '2026-08-01', '2026-08-31'],
		['last_3_months', '2026-07-01', '2026-09-30'],
		['last_12_months', '2025-10-01', '2026-09-30'],
		['this_year', '2026-01-01', '2026-12-31'],
		['all', MIN_DATE, MAX_DATE]
	] as const)('%s', (preset, from, to) => {
		expect(presetRange(preset, '2026-09-19')).toEqual({ from, to });
	});

	it('knows the end of February', () => {
		expect(presetRange('last_month', '2028-03-10')).toEqual({
			from: '2028-02-01',
			to: '2028-02-29'
		});
	});

	it('lists every preset', () => {
		expect(RANGE_PRESETS).toHaveLength(6);
	});

	it('gives every preset a valid, ordered range', () => {
		for (const preset of RANGE_PRESETS) {
			const { from, to } = presetRange(preset, '2026-09-19');
			expect(isDate(from)).toBe(true);
			expect(isDate(to)).toBe(true);
			expect(from <= to).toBe(true);
		}
	});
});
