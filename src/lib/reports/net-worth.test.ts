import { describe, it, expect } from 'vitest';
import type { NetWorthPoint } from '$lib/domain/net-worth';
import { presetRange } from './range';
import { netWorthChange, netWorthThrough, pointsInRange } from './net-worth';

const TODAY = '2026-09-19';

const point = (month: string, netWorth: number): NetWorthPoint => ({
	month,
	assets: netWorth > 0 ? netWorth : 0,
	debts: netWorth < 0 ? netWorth : 0,
	netWorth
});

const SERIES = [
	point('2026-05', 100),
	point('2026-06', 200),
	point('2026-07', 300),
	point('2026-08', 400),
	point('2026-09', 500)
];

describe('netWorthThrough', () => {
	it('never reaches past the current month', () => {
		expect(netWorthThrough(presetRange('this_year', TODAY), TODAY)).toBe('2026-09');
		expect(netWorthThrough(presetRange('all', TODAY), TODAY)).toBe('2026-09');
		expect(netWorthThrough({ from: '2027-01-01', to: '2027-03-31' }, TODAY)).toBe('2026-09');
	});

	it('is the range’s last month when that is in the past', () => {
		expect(netWorthThrough(presetRange('last_month', TODAY), TODAY)).toBe('2026-08');
		expect(netWorthThrough({ from: '2026-07-01', to: '2026-07-31' }, TODAY)).toBe('2026-07');
	});
});

describe('pointsInRange', () => {
	it('keeps only the months the range covers', () => {
		const range = presetRange('last_3_months', TODAY); // 2026-07 .. 2026-09
		expect(pointsInRange(SERIES, range, TODAY).map((p) => p.month)).toEqual([
			'2026-07',
			'2026-08',
			'2026-09'
		]);
	});

	it('drops months past today even when the range runs on', () => {
		expect(pointsInRange(SERIES, presetRange('this_year', TODAY), TODAY)).toHaveLength(5);
	});

	it('keeps everything for all time', () => {
		expect(pointsInRange(SERIES, presetRange('all', TODAY), TODAY)).toEqual(SERIES);
	});

	it('is empty when the range holds no month with data', () => {
		expect(pointsInRange(SERIES, { from: '2025-01-01', to: '2025-03-31' }, TODAY)).toEqual([]);
		expect(pointsInRange([], presetRange('all', TODAY), TODAY)).toEqual([]);
	});
});

describe('netWorthChange', () => {
	it('is null without any month', () => {
		expect(netWorthChange([])).toBeNull();
	});

	it('has no change to report for a single month', () => {
		expect(netWorthChange([point('2026-09', 500)])).toEqual({
			current: 500,
			change: 0,
			from: '2026-09',
			to: '2026-09',
			months: 1
		});
	});

	it('measures the last month against the first', () => {
		expect(netWorthChange(SERIES)).toEqual({
			current: 500,
			change: 400,
			from: '2026-05',
			to: '2026-09',
			months: 5
		});
	});

	it('measures across zero', () => {
		const crossing = [point('2026-07', -500), point('2026-08', 0), point('2026-09', 1500)];
		expect(netWorthChange(crossing)).toMatchObject({ current: 1500, change: 2000 });
	});
});
