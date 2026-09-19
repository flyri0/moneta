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

	it('funds the card when a later assignment covers carried credit overspending', () => {
		const comp = computeBudget(
			input({
				entries: [entry('fun', '2026-01-05', -10000, 'visa')],
				assignments: [
					{ categoryId: 'fun', month: '2026-01', assigned: 5000 },
					{ categoryId: 'fun', month: '2026-02', assigned: 5000 }
				]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'fun')).toMatchObject({
			available: -5000,
			cashOverspent: 0,
			creditOverspent: 5000
		});
		expect(categoryMonth(comp, '2026-02', 'fun')).toMatchObject({
			carryover: -5000,
			available: 0,
			creditOverspent: 0
		});
		expect(categoryMonth(comp, '2026-02', 'cc-visa')).toMatchObject({
			activity: 5000,
			available: 10000
		});
		expect(comp.months.get('2026-02')?.readyToAssign).toBe(-10000);
	});

	it('keeps carried credit overspending tied to its card when a refund arrives', () => {
		const comp = computeBudget(
			input({
				entries: [
					entry('fun', '2026-01-05', -10000, 'visa'),
					entry('fun', '2026-02-03', 2000, 'visa')
				],
				assignments: [{ categoryId: 'fun', month: '2026-01', assigned: 5000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-02', 'fun')).toMatchObject({
			available: -3000,
			cashOverspent: 0,
			creditOverspent: 3000
		});
		expect(categoryMonth(comp, '2026-02', 'cc-visa').available).toBe(5000);
	});

	it('conserves money: Ready to Assign plus all available equals cash on hand', () => {
		// cash accounts: +100000 income, -20000 food (cash), -15000 card payment = 65000
		const comp = computeBudget(
			input({
				entries: [
					entry('rta', '2026-01-01', 100000),
					entry('food', '2026-01-03', -20000),
					entry('food', '2026-01-04', -30000, 'visa'),
					entry('fun', '2026-01-05', -8000, 'visa'),
					entry('fun', '2026-02-02', 1000, 'visa')
				],
				payments: [{ cardAccountId: 'visa', date: '2026-01-25', amount: -15000 }],
				assignments: [
					{ categoryId: 'food', month: '2026-01', assigned: 40000 },
					{ categoryId: 'fun', month: '2026-01', assigned: 5000 },
					{ categoryId: 'fun', month: '2026-02', assigned: 3000 }
				]
			}),
			'2026-03'
		);
		for (const month of ['2026-02', '2026-03']) {
			const r = comp.months.get(month)!;
			let available = 0;
			for (const cm of r.categories.values()) available += cm.available;
			expect(r.readyToAssign + available).toBe(65000);
		}
	});

	it('repays debt from its own source, then cash, then other cards in debt order', () => {
		const AMEX: EngineCategory = {
			id: 'cc-amex',
			kind: 'cc_payment',
			cardAccountId: 'amex',
			carryoverOverspending: false
		};
		// food starts at 1000 (assigned).
		// 01-03 visa -3000: 1000 covered -> fund visa 1000; debt {visa 2000}; running -2000
		// 01-04 amex -4000: nothing covered; debt {visa 2000, amex 4000}; running -6000
		// 01-05 cash +1500: order [cash, visa, amex]; visa went into debt first, so it takes
		//   all 1500 -> fund visa 1500; debt {visa 500, amex 4000}; running -4500
		// 01-06 amex +1000 refund: order [amex, cash, visa]; amex repays itself: fund amex +1000
		//   for the repaid debt and -1000 for the refund, net 0; debt {visa 500, amex 3000}
		// => food -3500, all credit; cc-visa 1000 + 1500 = 2500; cc-amex 0
		const comp = computeBudget(
			input({
				categories: [RTA, FOOD, FUN, CC, AMEX],
				entries: [
					entry('food', '2026-01-03', -3000, 'visa'),
					entry('food', '2026-01-04', -4000, 'amex'),
					entry('food', '2026-01-05', 1500),
					entry('food', '2026-01-06', 1000, 'amex')
				],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 1000 }]
			}),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: -3500,
			cashOverspent: 0,
			creditOverspent: 3500
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({
			activity: 2500,
			available: 2500
		});
		expect(categoryMonth(comp, '2026-01', 'cc-amex')).toMatchObject({
			activity: 0,
			available: 0
		});
	});

	it('lets a card refund repay cash overspending, de-funding that card', () => {
		// food starts at 1000 (assigned).
		// 01-03 cash -3000: 1000 covered; debt {cash 2000}; running -2000
		// 01-04 visa +2000 refund: order [visa, cash]; visa has no debt; cash debt repaid 2000,
		//   and the refund's source is visa, so fund visa -2000; running 0
		// => food 0, no overspending; cc-visa activity -2000; nothing deducted in February
		const comp = computeBudget(
			input({
				entries: [
					entry('rta', '2026-01-01', 10000),
					entry('food', '2026-01-03', -3000),
					entry('food', '2026-01-04', 2000, 'visa')
				],
				assignments: [{ categoryId: 'food', month: '2026-01', assigned: 1000 }]
			}),
			'2026-02'
		);
		expect(categoryMonth(comp, '2026-01', 'food')).toMatchObject({
			available: 0,
			cashOverspent: 0,
			creditOverspent: 0
		});
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({
			activity: -2000,
			available: -2000
		});
		// RTA: Jan 10000 - 1000 assigned = 9000; Feb 9000 - 0 food overspending - 2000 cc-visa
		// (its negative available is cash overspending) = 7000
		expect(comp.months.get('2026-02')).toMatchObject({
			overspentLastMonth: 2000,
			readyToAssign: 7000
		});
	});

	it('adds a cash advance to the card payment category', () => {
		// A cash advance is a positive payment: cash arrives from the card, so it is money
		// already set aside for that card. cc-visa activity = 0 funding + 5000 = 5000.
		const comp = computeBudget(
			input({ payments: [{ cardAccountId: 'visa', date: '2026-01-10', amount: 5000 }] }),
			'2026-01'
		);
		expect(categoryMonth(comp, '2026-01', 'cc-visa')).toMatchObject({
			activity: 5000,
			available: 5000,
			cashOverspent: 0
		});
		expect(comp.months.get('2026-01')?.readyToAssign).toBe(0);
	});

	it('treats a negative assignment below zero as cash overspending', () => {
		// Jan: income 10000, food assigned 1000 -> RTA 9000, food 1000.
		// Feb: food assigned -3000 applied as a cash outflow from 1000: 1000 covered, 2000 is
		//   cash debt -> food -2000, cashOverspent 2000. RTA 9000 + 3000 = 12000.
		// Mar: toggle off, so food resets to 0 and RTA = 12000 - 2000 = 10000 (= the cash).
		const comp = computeBudget(
			input({
				entries: [entry('rta', '2026-01-01', 10000)],
				assignments: [
					{ categoryId: 'food', month: '2026-01', assigned: 1000 },
					{ categoryId: 'food', month: '2026-02', assigned: -3000 }
				]
			}),
			'2026-03'
		);
		expect(categoryMonth(comp, '2026-02', 'food')).toMatchObject({
			carryover: 1000,
			available: -2000,
			cashOverspent: 2000,
			creditOverspent: 0
		});
		expect(comp.months.get('2026-02')?.readyToAssign).toBe(12000);
		expect(categoryMonth(comp, '2026-03', 'food')).toMatchObject({ carryover: 0, available: 0 });
		expect(comp.months.get('2026-03')).toMatchObject({
			overspentLastMonth: 2000,
			readyToAssign: 10000
		});
	});

	it('returns zeros for categories and months without data', () => {
		const comp = computeBudget(input({}), '2026-05');
		expect(comp.first).toBe('2026-05');
		expect(comp.months.get('2026-05')?.readyToAssign).toBe(0);
		expect(categoryMonth(comp, '2020-01', 'food')).toMatchObject({ available: 0, assigned: 0 });
	});
});
