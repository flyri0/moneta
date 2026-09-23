import { describe, it, expect } from 'vitest';
import { fillMonths, lastMonths, savingsRate } from './cash-flow';

describe('lastMonths', () => {
	it('spans whole months, ending with the current one', () => {
		expect(lastMonths('2026-09-19', 6)).toEqual({
			months: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'],
			range: { from: '2026-04-01', to: '2026-09-30' }
		});
	});

	it('crosses a year', () => {
		expect(lastMonths('2026-02-01', 3).range).toEqual({ from: '2025-12-01', to: '2026-02-28' });
	});
});

describe('fillMonths', () => {
	it('gives every month a row, with zeros where nothing happened', () => {
		expect(
			fillMonths(
				[
					{ month: '2026-07', income: 100, spending: 50 },
					{ month: '2026-05', income: 0, spending: 20 }
				],
				['2026-05', '2026-06', '2026-07']
			)
		).toEqual([
			{ month: '2026-05', income: 0, spending: 20 },
			{ month: '2026-06', income: 0, spending: 0 },
			{ month: '2026-07', income: 100, spending: 50 }
		]);
	});
});

describe('savingsRate', () => {
	it('is the share of income left after spending, in percent', () => {
		expect(
			savingsRate([
				{ month: '2026-08', income: 1000, spending: 900 },
				{ month: '2026-09', income: 1000, spending: 600 }
			])
		).toBe(25);
		expect(savingsRate([{ month: '2026-09', income: 1000, spending: 1500 }])).toBe(-50);
	});

	it('is null without income to measure against', () => {
		expect(savingsRate([])).toBeNull();
		expect(savingsRate([{ month: '2026-09', income: 0, spending: 500 }])).toBeNull();
		expect(savingsRate([{ month: '2026-09', income: -100, spending: 0 }])).toBeNull();
	});
});
