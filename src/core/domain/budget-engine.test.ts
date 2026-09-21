import { describe, it, expect } from 'vitest';
import {
	categoryMonth,
	computeBudget,
	firstNegativeMonthAfter,
	type EngineInput
} from './budget-engine';

describe('computeBudget (Actual Budget model)', () => {
	it('calculates income and ready to assign from income categories', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'groceries', kind: 'regular', carryoverOverspending: false }
			],
			entries: [
				{ categoryId: 'salary', date: '2026-01-05', order: '1', amount: 500000 },
				{ categoryId: 'groceries', date: '2026-01-10', order: '2', amount: -150000 }
			],
			assignments: [{ categoryId: 'groceries', month: '2026-01', assigned: 200000 }]
		};

		const comp = computeBudget(input, '2026-01');
		const m1 = comp.months.get('2026-01')!;

		expect(m1.income).toBe(500000);
		expect(m1.availableFunds).toBe(500000);
		expect(m1.assignedThisMonth).toBe(200000);
		expect(m1.readyToAssign).toBe(300000);

		const g = categoryMonth(comp, '2026-01', 'groceries');
		expect(g.carryover).toBe(0);
		expect(g.assigned).toBe(200000);
		expect(g.activity).toBe(-150000);
		expect(g.available).toBe(50000);

		const s = categoryMonth(comp, '2026-01', 'salary');
		expect(s.activity).toBe(500000);
	});

	// Review Focus Pin #2: Rolled-over negative balance with carryover enabled
	it('rolls over negative available balance when carryover is enabled without deducting from next month RTA', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'card-debt', kind: 'regular', carryoverOverspending: true }
			],
			entries: [
				{ categoryId: 'salary', date: '2026-01-01', order: '1', amount: 300000 },
				{ categoryId: 'card-debt', date: '2026-01-15', order: '2', amount: -200000 },
				{ categoryId: 'salary', date: '2026-02-01', order: '3', amount: 300000 }
			],
			assignments: [
				{ categoryId: 'card-debt', month: '2026-01', assigned: 0 },
				{ categoryId: 'card-debt', month: '2026-02', assigned: 50000 }
			]
		};

		const comp = computeBudget(input, '2026-02');
		const m1 = comp.months.get('2026-01')!;
		expect(m1.readyToAssign).toBe(300000);
		const c1 = categoryMonth(comp, '2026-01', 'card-debt');
		expect(c1.available).toBe(-200000);

		const m2 = comp.months.get('2026-02')!;
		expect(m2.overspentLastMonth).toBe(0); // NOT deducted from RTA
		expect(m2.availableFunds).toBe(600000); // 300000 prev RTA + 300000 income
		expect(m2.assignedThisMonth).toBe(50000);
		expect(m2.readyToAssign).toBe(550000);

		const c2 = categoryMonth(comp, '2026-02', 'card-debt');
		expect(c2.carryover).toBe(-200000);
		expect(c2.assigned).toBe(50000);
		expect(c2.activity).toBe(0);
		expect(c2.available).toBe(-150000);
	});

	// Review Focus Pin #3: Overspent negative balance with carryover disabled
	it('resets carryover to 0 and deducts overspending from next month RTA when carryover is disabled', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'dining', kind: 'regular', carryoverOverspending: false }
			],
			entries: [
				{ categoryId: 'salary', date: '2026-01-01', order: '1', amount: 300000 },
				{ categoryId: 'dining', date: '2026-01-15', order: '2', amount: -200000 },
				{ categoryId: 'salary', date: '2026-02-01', order: '3', amount: 300000 }
			],
			assignments: []
		};

		const comp = computeBudget(input, '2026-02');
		const m1 = comp.months.get('2026-01')!;
		expect(m1.readyToAssign).toBe(300000);
		const c1 = categoryMonth(comp, '2026-01', 'dining');
		expect(c1.available).toBe(-200000);

		const m2 = comp.months.get('2026-02')!;
		expect(m2.overspentLastMonth).toBe(200000); // Deducted from RTA
		expect(m2.availableFunds).toBe(600000); // 300000 prev RTA + 300000 income
		expect(m2.readyToAssign).toBe(400000); // 600000 - 200000

		const c2 = categoryMonth(comp, '2026-02', 'dining');
		expect(c2.carryover).toBe(0);
		expect(c2.available).toBe(0);
	});

	it('rolls positive balances forward across months', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'groceries', kind: 'regular', carryoverOverspending: false }
			],
			entries: [
				{ categoryId: 'salary', date: '2026-01-01', order: '1', amount: 100000 },
				{ categoryId: 'groceries', date: '2026-01-10', order: '2', amount: -12000 }
			],
			assignments: [{ categoryId: 'groceries', month: '2026-01', assigned: 30000 }]
		};

		const comp = computeBudget(input, '2026-02');
		expect(categoryMonth(comp, '2026-01', 'groceries')).toMatchObject({
			carryover: 0,
			assigned: 30000,
			activity: -12000,
			available: 18000
		});
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(70000);

		expect(categoryMonth(comp, '2026-02', 'groceries')).toMatchObject({
			carryover: 18000,
			assigned: 0,
			activity: 0,
			available: 18000
		});
		expect(comp.months.get('2026-02')).toMatchObject({
			income: 0,
			availableFunds: 70000,
			overspentLastMonth: 0,
			assignedThisMonth: 0,
			readyToAssign: 70000
		});
	});

	it('does not let future assignments reduce the current month ready to assign', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'food', kind: 'regular', carryoverOverspending: false },
				{ id: 'fun', kind: 'regular', carryoverOverspending: true }
			],
			entries: [{ categoryId: 'salary', date: '2026-01-01', order: '1', amount: 100000 }],
			assignments: [
				{ categoryId: 'food', month: '2026-02', assigned: 30000 },
				{ categoryId: 'fun', month: '2026-03', assigned: 150000 }
			]
		};

		const comp = computeBudget(input, '2026-01');
		expect(comp.last).toBe('2026-03');
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(100000);
		expect(comp.months.get('2026-02')?.readyToAssign).toBe(70000);
		expect(comp.months.get('2026-03')?.readyToAssign).toBe(-80000);
		expect(firstNegativeMonthAfter(comp, '2026-01')).toBe('2026-03');
		expect(firstNegativeMonthAfter(comp, '2026-03')).toBeNull();
	});

	it('orders same-day entries by order key and handles multiple entries in a month', () => {
		const input: EngineInput = {
			categories: [
				{ id: 'salary', kind: 'income', carryoverOverspending: false },
				{ id: 'food', kind: 'regular', carryoverOverspending: false }
			],
			entries: [
				{ categoryId: 'food', date: '2026-01-03', order: '000002', amount: -2000 },
				{ categoryId: 'food', date: '2026-01-03', order: '000001', amount: -3000 },
				{ categoryId: 'salary', date: '2026-01-01', order: '000003', amount: 20000 },
				{ categoryId: 'salary', date: '2026-01-15', order: '000004', amount: 10000 }
			],
			assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
		};

		const comp = computeBudget(input, '2026-01');
		const m1 = comp.months.get('2026-01')!;
		expect(m1.income).toBe(30000);
		expect(m1.readyToAssign).toBe(20000);

		const food = categoryMonth(comp, '2026-01', 'food');
		expect(food.activity).toBe(-5000);
		expect(food.available).toBe(5000);
	});

	it('returns default empty category and handles months without data', () => {
		const input: EngineInput = {
			categories: [],
			entries: [],
			assignments: []
		};

		const comp = computeBudget(input, '2026-05');
		expect(comp.first).toBe('2026-05');
		expect(comp.last).toBe('2026-05');
		expect(comp.months.get('2026-05')?.readyToAssign).toBe(0);
		expect(categoryMonth(comp, '2020-01', 'unknown')).toEqual({
			carryover: 0,
			assigned: 0,
			activity: 0,
			available: 0
		});
	});
});
