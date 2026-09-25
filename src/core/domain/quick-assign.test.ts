import { describe, it, expect } from 'vitest';
import { computeBudget, type EngineInput } from './budget-engine';
import { quickAssignAmount } from './quick-assign';

const input: EngineInput = {
	categories: [
		{ id: 'inc', kind: 'income', carryoverOverspending: false },
		{ id: 'food', kind: 'regular', carryoverOverspending: false }
	],
	entries: [
		{ categoryId: 'food', month: '2026-01', amount: -9000 },
		{ categoryId: 'food', month: '2026-02', amount: -6000 },
		{ categoryId: 'food', month: '2026-03', amount: -3001 },
		{ categoryId: 'food', month: '2026-04', amount: -7000 }
	],
	assignments: [
		{ categoryId: 'food', month: '2026-03', assigned: 4000 },
		{ categoryId: 'food', month: '2026-04', assigned: 5000 }
	]
};
const comp = computeBudget(input, '2026-04');

describe('quickAssignAmount', () => {
	it("copies last month's assigned amount", () => {
		expect(quickAssignAmount(comp, '2026-04', 'food', 'last-month')).toBe(4000);
		expect(quickAssignAmount(comp, '2026-01', 'food', 'last-month')).toBe(0);
	});

	it('averages spending over previous months, counting empty months as zero', () => {
		expect(quickAssignAmount(comp, '2026-04', 'food', 'avg-3')).toBe(6000); // (9000+6000+3001)/3
		expect(quickAssignAmount(comp, '2026-04', 'food', 'avg-6')).toBe(3000); // 18001/6 = 3000.17
		expect(quickAssignAmount(comp, '2026-04', 'food', 'avg-12')).toBe(1500);
	});

	it('never suggests a negative average', () => {
		const refunds = computeBudget(
			{
				...input,
				entries: [{ categoryId: 'food', month: '2026-03', amount: 5000 }]
			},
			'2026-04'
		);
		expect(quickAssignAmount(refunds, '2026-04', 'food', 'avg-3')).toBe(0);
	});

	it('raises assigned just enough to cover overspending', () => {
		// March: 0 + 4000 - 3001 = 999. April: 999 + 5000 - 7000 = -1001 → assign 5000 + 1001
		expect(quickAssignAmount(comp, '2026-04', 'food', 'cover-overspending')).toBe(6001);
		expect(quickAssignAmount(comp, '2026-02', 'food', 'cover-overspending')).toBe(6000);
	});

	it('leaves assigned unchanged when nothing is overspent', () => {
		const funded = computeBudget(
			{
				...input,
				entries: [],
				assignments: [{ categoryId: 'food', month: '2026-04', assigned: 5000 }]
			},
			'2026-04'
		);
		expect(quickAssignAmount(funded, '2026-04', 'food', 'cover-overspending')).toBe(5000);
	});

	it('clears', () => {
		expect(quickAssignAmount(comp, '2026-04', 'food', 'clear')).toBe(0);
	});
});
