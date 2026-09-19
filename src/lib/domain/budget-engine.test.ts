import { describe, it, expect } from 'vitest';
import {
	computeBudget,
	categoryMonth,
	firstNegativeMonthAfter,
	type EngineInput,
	type EngineCategory
} from './budget-engine';

const RTA: EngineCategory = {
	id: 'rta',
	kind: 'ready_to_assign',
	cardAccountId: null,
	carryoverOverspending: false
};
const FOOD: EngineCategory = {
	id: 'food',
	kind: 'regular',
	cardAccountId: null,
	carryoverOverspending: false
};
const FUN: EngineCategory = {
	id: 'fun',
	kind: 'regular',
	cardAccountId: null,
	carryoverOverspending: true
};
const CC: EngineCategory = {
	id: 'cc-visa',
	kind: 'cc_payment',
	cardAccountId: 'visa',
	carryoverOverspending: false
};

let seq = 0;
function entry(categoryId: string, date: string, amount: number, card: string | null = null) {
	seq += 1;
	return {
		categoryId,
		date,
		order: String(seq).padStart(6, '0'),
		amount,
		cardAccountId: card
	};
}

function input(partial: Partial<EngineInput>): EngineInput {
	return {
		categories: [RTA, FOOD, FUN, CC],
		entries: [],
		payments: [],
		assignments: [],
		...partial
	};
}

describe('computeBudget', () => {
	it('rolls positive balances forward and tracks Ready to Assign', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 100000), entry('food', '2026-01-10', -12000)],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 30000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			assigned: 30000,
			activity: -12000,
			available: 18000
		});
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(70000);
		expect(categoryMonth(comp, '2026-02', 'food')).toMatchObject({
			carryover: 18000,
			available: 18000
		});
		expect(comp.months.get('2026-02')).toMatchObject({
			availableFunds: 70000,
			overspentLastMonth: 0,
			assignedThisMonth: 0,
			readyToAssign: 70000
		});
	});

	it('carries balances across months without activity', () => {
		const comp = computeBudget(
			input({ assignments: [{ categoryId: 'food', month: '2026-01', assigned: 5000 }] }),
			'2026-04'
		);
		expect(categoryMonth(comp, '2026-04', 'food').available).toBe(5000);
	});

	it('deducts cash overspending from next month and resets the category', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 50000), entry('food', '2026-01-05', -15000)],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: -5000,
			cashOverspent: 5000,
			creditOverspent: 0
		});
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(40000);
		expect(categoryMonth(comp, '2026-02', 'food')).toMatchObject({ carryover: 0, available: 0 });
		expect(comp.months.get('2026-02')).toMatchObject({
			overspentLastMonth: 5000,
			readyToAssign: 35000
		});
	});

	it('carries overspending forward when the category toggle is on', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 50000), entry('fun', '2026-01-05', -15000)],
				assignments: [{ categoryId: 'fun', month: '2026-01', assigned: 10000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-02', 'fun')).toMatchObject({
			carryover: -5000,
			available: -5000
		});
		expect(comp.months.get('2026-02')).toMatchObject({
			overspentLastMonth: 0,
			readyToAssign: 40000
		});
	});

	it('moves funded card spending into the card payment category', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 100000), entry('food', '2026-01-03', -6000, 'visa')],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food').available).toBe(4000);
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({
			activity: 6000,
			available: 6000
		});
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(90000);
	});

	it('funds only the covered part of card spending; the rest is credit overspending', () => {
		const comp = computeBudget(
			input({
				entries: [
					entry('rta', '2026-01-01', 100000),
					entry('food', '2026-01-05', -3000),
					entry('food', '2026-01-06', -10000, 'visa')
				],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: -3000,
			cashOverspent: 0,
			creditOverspent: 3000
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa').available).toBe(7000);
		expect(comp.months.get('2026-02')).toMatchObject({
			overspentLastMonth: 0,
			readyToAssign: 90000
		});
		expect(categoryMonth(comp, '2026-02', 'food').available).toBe(0);
	});

	it('attributes mixed overspending in date order', () => {
		const comp = computeBudget(
			input({
				entries: [entry('food', '2026-01-04', -2000), entry('food', '2026-01-03', -8000, 'visa')],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 5000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: -5000,
			cashOverspent: 2000,
			creditOverspent: 3000
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa').available).toBe(5000);
		expect(comp.months.get('2026-02')?.overspentLastMonth).toBe(2000);
	});

	it('orders same-day entries by their order key', () => {
		const later = entry('food', '2026-01-03', -2000);
		const earlier = entry('food', '2026-01-03', -8000, 'visa');
		earlier.order = '000000';
		const comp = computeBudget(
			input({
				entries: [later, earlier],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 5000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			cashOverspent: 2000,
			creditOverspent: 3000
		});
	});

	it('moves card refunds back out of the card payment category', () => {
		const comp = computeBudget(
			input({
				entries: [
					entry('food', '2026-01-03', -6000, 'visa'),
					entry('food', '2026-01-04', 2000, 'visa')
				],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food').available).toBe(6000);
		expect(categoryMonth(comp, '2026-01', 'cc-visa').available).toBe(4000);
	});

	it("uses a card refund to reduce that card's credit overspending first", () => {
		const comp = computeBudget(
			input({
				entries: [
					entry('food', '2026-01-03', -8000, 'visa'),
					entry('food', '2026-01-04', 2000, 'visa')
				],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 5000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: -1000,
			creditOverspent: 1000
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa').available).toBe(5000);
	});

	it('funds the card when cash covers earlier credit overspending', () => {
		const comp = computeBudget(
			input({
				entries: [entry('food', '2026-01-03', -8000, 'visa'), entry('food', '2026-01-04', 3000)],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 5000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: 0,
			creditOverspent: 0
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa').available).toBe(8000);
	});

	it('records card payments as card payment category activity', () => {
		const comp = computeBudget(
			input({
				entries: [entry('food', '2026-01-03', -6000, 'visa')],
				payments: [{ cardAccountId: 'visa', date: '2026-01-20', amount: -6000 }],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 10000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({ activity: 0, available: 0 });
	});

	it('treats an overspent card payment category as cash overspending', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 100000)],
				payments: [{ cardAccountId: 'visa', date: '2026-01-20', amount: -20000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({
			available: -20000,
			cashOverspent: 20000
		});
		expect(comp.months.get('2026-02')?.readyToAssign).toBe(80000);
	});

	it('reduces the card payment category for Ready to Assign income on a card', () => {
		const comp = computeBudget(
			input({ entries: [entry('rta', '2026-01-02', 5000, 'visa')] }),
			'2026-01'
		);
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(5000);
		expect(categoryMonth(comp, '2026-01', 'cc-visa').activity).toBe(-5000);
	});

	it('does not let future assignments reduce the current month', () => {
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 100000)],
				assignments: [
					{ categoryId: 'food', month: '2026-02', assigned: 30000 },
					{ categoryId: 'fun', month: '2026-03', assigned: 150000 }
				]
			}),
			'2026-01'
		);
		expect(comp.last).toBe('2026-03');
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(100000);
		expect(comp.months.get('2026-02')?.readyToAssign).toBe(70000);
		expect(comp.months.get('2026-03')?.readyToAssign).toBe(-80000);
		expect(firstNegativeMonthAfter(comp, '2026-01')).toBe('2026-03');
		expect(firstNegativeMonthAfter(comp, '2026-03')).toBeNull();
	});

	it('returns zeros for categories and months without data', () => {
		const comp = computeBudget(input({}), '2026-05');
		expect(comp.first).toBe('2026-05');
		expect(comp.months.get('2026-05')?.readyToAssign).toBe(0);
		expect(categoryMonth(comp, '2020-01', 'food')).toMatchObject({ available: 0, assigned: 0 });
	});
});
