import { describe, it, expect } from 'vitest';
import { m } from '$i18n/paraglide/messages';
import { ageOfMoneyChange, ageOfMoneyInRange, daysLabel } from './age-of-money';
import { presetRange } from './range';

const TODAY = '2026-09-19';

const SERIES = [
	{ month: '2026-04', days: null },
	{ month: '2026-05', days: null },
	{ month: '2026-06', days: 12 },
	{ month: '2026-07', days: 18 },
	{ month: '2026-08', days: 15 },
	{ month: '2026-09', days: 21 }
];

describe('ageOfMoneyInRange', () => {
	it('keeps the months the range covers that have a value', () => {
		expect(ageOfMoneyInRange(SERIES, presetRange('last_6_months', TODAY), TODAY)).toEqual([
			{ month: '2026-06', days: 12 },
			{ month: '2026-07', days: 18 },
			{ month: '2026-08', days: 15 },
			{ month: '2026-09', days: 21 }
		]);
		expect(ageOfMoneyInRange(SERIES, presetRange('last_month', TODAY), TODAY)).toEqual([
			{ month: '2026-08', days: 15 }
		]);
	});

	it('is empty when the range has no value yet', () => {
		expect(ageOfMoneyInRange(SERIES, { from: '2026-04-01', to: '2026-05-31' }, TODAY)).toEqual([]);
	});
});

describe('ageOfMoneyChange', () => {
	it('compares the last month with the first', () => {
		expect(
			ageOfMoneyChange([
				{ month: '2026-06', days: 12 },
				{ month: '2026-09', days: 21 }
			])
		).toEqual({ current: 21, change: 9, from: '2026-06', to: '2026-09', months: 2 });
	});

	it('is null without points', () => {
		expect(ageOfMoneyChange([])).toBeNull();
	});
});

describe('daysLabel', () => {
	it('says day for one and days otherwise', () => {
		expect(daysLabel(1)).toBe(m.reports_age_of_money_day());
		expect(daysLabel(0)).toBe(m.reports_age_of_money_days({ count: 0 }));
		expect(daysLabel(76)).toBe(m.reports_age_of_money_days({ count: 76 }));
	});
});
