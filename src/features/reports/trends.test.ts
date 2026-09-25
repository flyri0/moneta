import { describe, it, expect } from 'vitest';
import type { CategoryMonthRow } from '$db/repos/reports';
import { categoryTrends } from './trends';

const row = (
	categoryId: string,
	month: string,
	amount: number,
	income = false
): CategoryMonthRow => ({
	month,
	categoryId,
	name: categoryId.toUpperCase(),
	groupId: 'g',
	groupName: 'G',
	income,
	amount
});

const MONTHS = ['2026-07', '2026-08', '2026-09'];

describe('categoryTrends', () => {
	const rows = [
		row('rent', '2026-07', -1000),
		row('rent', '2026-08', -1000),
		row('rent', '2026-09', -1000),
		row('food', '2026-08', -600),
		row('food', '2026-09', -300),
		row('fun', '2026-09', -200),
		row('gym', '2026-07', -100),
		row('salary', '2026-09', 5000, true)
	];

	it('keeps the biggest categories over the period, largest first, and folds the rest', () => {
		const trends = categoryTrends(rows, MONTHS, 2);
		expect(trends.series.map((s) => [s.key, s.color, s.values])).toEqual([
			['rent', 1, [1000, 1000, 1000]],
			['food', 2, [0, 600, 300]],
			['__other', null, [100, 0, 200]]
		]);
		expect(trends.series[2].label).toBeNull();
		expect(trends.totals).toEqual([1100, 1600, 1500]);
	});

	it('averages each series over the months', () => {
		const food = categoryTrends(rows, MONTHS, 2).series[1];
		expect(food.total).toBe(900);
		expect(food.average).toBe(300);
	});

	it('compares the last month with the average of the months before it', () => {
		const trends = categoryTrends(rows, MONTHS, 2);
		expect(trends.series[0].before).toBe(1000);
		expect(trends.series[1].before).toBe(300);
		expect(trends.average).toBe(1400);
	});

	it('averages only from the first month with spending, not the empty ones before it', () => {
		const trends = categoryTrends(rows, ['2026-05', '2026-06', ...MONTHS], 2);
		expect(trends.start).toBe(2);
		expect(trends.series[0].average).toBe(1000);
		expect(trends.series[0].before).toBe(1000);
		expect(trends.average).toBe(1400);
	});

	it('has nothing to compare against when spending starts in the last month', () => {
		const trends = categoryTrends(
			[row('rent', '2026-09', -1000)],
			['2026-07', '2026-08', '2026-09']
		);
		expect(trends.series[0].average).toBe(1000);
		expect(trends.series[0].before).toBeNull();
	});

	it('leaves out income, and the remainder when nothing is left over', () => {
		const trends = categoryTrends(rows, MONTHS, 4);
		expect(trends.series.map((s) => s.key)).toEqual(['rent', 'food', 'fun', 'gym']);
	});

	it('lists every expense category by total for the table', () => {
		expect(categoryTrends(rows, MONTHS, 1).categories.map((c) => c.key)).toEqual([
			'rent',
			'food',
			'fun',
			'gym'
		]);
	});
});
