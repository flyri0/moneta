import { describe, expect, it } from 'vitest';
import { availableByCategory, budgetMonthFor } from './available';

describe('availableByCategory', () => {
	const groups = [
		{
			system: 'income' as const,
			categories: [{ id: 'salary', available: 0, carryoverOverspending: false }]
		},
		{
			system: null,
			categories: [
				{ id: 'groceries', available: 25000, carryoverOverspending: false },
				{ id: 'dining', available: -3000, carryoverOverspending: true }
			]
		},
		// A hidden category is still in its group's list: it shows when a picker offers it.
		{ system: null, categories: [{ id: 'hidden', available: 500, carryoverOverspending: false }] }
	];

	it('keys each category by id with what its pill needs', () => {
		const map = availableByCategory(groups);
		expect(map.get('groceries')).toEqual({ available: 25000, carryoverOverspending: false });
		expect(map.get('dining')).toEqual({ available: -3000, carryoverOverspending: true });
		expect(map.get('hidden')).toEqual({ available: 500, carryoverOverspending: false });
	});

	it('leaves out the income group, which has no Available', () => {
		expect(availableByCategory(groups).has('salary')).toBe(false);
	});
});

describe('budgetMonthFor', () => {
	it("gives a date's month", () => {
		expect(budgetMonthFor('2026-10-09')).toBe('2026-10');
	});

	it('gives null for an empty or malformed date, so nothing is requested', () => {
		expect(budgetMonthFor('')).toBeNull();
		expect(budgetMonthFor('2026-1')).toBeNull();
		expect(budgetMonthFor('not a date')).toBeNull();
	});
});
