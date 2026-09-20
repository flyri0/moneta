import { describe, expect, it } from 'vitest';
import { addMonths, isDate, monthOf } from '$domain/month';
import { buildDemo, type DemoInput } from './dataset';
import { READY_TO_ASSIGN } from './seed';

const CATEGORIES = {
	rent: 'Rent',
	utilities: 'Utilities',
	phone: 'Phone',
	insurance: 'Insurance',
	groceries: 'Groceries',
	transport: 'Transport',
	dining: 'Dining',
	household: 'Household',
	emergencyFund: 'Emergency',
	vacation: 'Vacation',
	entertainment: 'Fun',
	hobbies: 'Hobbies'
};

function input(today: string, scale = 100): DemoInput {
	return {
		today,
		scale,
		accounts: { checking: 'Checking', savings: 'Savings', card: 'Card' },
		payees: {
			salary: 'Paycheck',
			landlord: 'Landlord',
			utility: 'Utility',
			telecom: 'Telecom',
			insurance: 'Insurer',
			grocery: 'Market',
			transport: 'Gas',
			coffee: 'Coffee',
			restaurant: 'Restaurant',
			household: 'Home Store',
			streaming: 'Streaming',
			hobby: 'Bookshop'
		},
		categories: CATEGORIES
	};
}

describe('buildDemo', () => {
	const today = '2026-09-20';
	const seed = buildDemo(input(today));

	it('is deterministic', () => {
		expect(buildDemo(input(today))).toEqual(seed);
	});

	it('opens three accounts, one of them a credit card', () => {
		expect(seed.accounts.map((a) => a.type)).toEqual(['checking', 'savings', 'credit_card']);
		expect(seed.accounts.every((a) => a.onBudget)).toBe(true);
		expect(seed.accounts.every((a) => Number.isSafeInteger(a.startingBalance))).toBe(true);
	});

	it('covers this month and the two before it, never past today', () => {
		const dates = seed.transactions.map((t) => t.date);
		expect(dates.length).toBeGreaterThan(40);
		expect(dates.every(isDate)).toBe(true);
		expect(Math.min(...dates.map((d) => Date.parse(d)))).toBe(
			Date.parse(`${addMonths(monthOf(today), -2)}-01`)
		);
		expect(dates.every((d) => d <= today)).toBe(true);
		expect(dates.some((d) => monthOf(d) === monthOf(today))).toBe(true);
	});

	it('leaves the last few days waiting to clear', () => {
		expect(seed.transactions.some((t) => t.cleared === false)).toBe(true);
		expect(seed.transactions.filter((t) => t.date < '2026-09-01').every((t) => t.cleared)).toBe(
			true
		);
	});

	it('writes whole minor units, negative for outflows', () => {
		const amounts = seed.transactions.map((t) => t.amount);
		expect(amounts.every(Number.isSafeInteger)).toBe(true);
		expect(amounts.filter((a) => a > 0).length).toBe(3); // one paycheck a month
	});

	it('categorises every row that needs it and splits that add up', () => {
		for (const t of seed.transactions) {
			if (t.transferAccountKey) {
				expect(t.categoryName ?? null).toBeNull();
				continue;
			}
			if (t.splits) {
				expect(t.categoryName ?? null).toBeNull();
				expect(t.splits.length).toBeGreaterThanOrEqual(2);
				expect(t.splits.reduce((sum, s) => sum + s.amount, 0)).toBe(t.amount);
				continue;
			}
			expect(t.categoryName).toBeTruthy();
		}
	});

	it('pays the card with a transfer, never a plain outflow', () => {
		const payments = seed.transactions.filter((t) => t.transferAccountKey === 'card');
		expect(payments.length).toBe(2); // nothing was charged before the first month
		expect(payments.every((t) => t.amount < 0)).toBe(true);
	});

	it('assigns every paycheck down to the last cent, opening balances included', () => {
		const income = seed.transactions
			.filter((t) => t.categoryName === READY_TO_ASSIGN)
			.reduce((sum, t) => sum + t.amount, 0);
		const opening = seed.accounts
			.filter((a) => a.type !== 'credit_card')
			.reduce((sum, a) => sum + a.startingBalance, 0);
		const assigned = seed.assignments.reduce((sum, a) => sum + a.amount, 0);
		expect(assigned).toBe(income + opening);
	});

	it('never assigns to Ready to Assign', () => {
		expect(seed.assignments.some((a) => a.categoryName === READY_TO_ASSIGN)).toBe(false);
	});

	it('scales to a currency with no minor units', () => {
		const yen = buildDemo(input(today, 1));
		expect(yen.transactions.every((t) => Number.isSafeInteger(t.amount))).toBe(true);
		const paycheck = yen.transactions.find((t) => t.categoryName === READY_TO_ASSIGN);
		expect(paycheck?.amount).toBe(3800);
	});

	it('shrinks the current month when the month has barely started', () => {
		const early = buildDemo(input('2026-09-02'));
		const inMonth = early.transactions.filter((t) => t.date.startsWith('2026-09'));
		expect(inMonth.every((t) => t.date <= '2026-09-02')).toBe(true);
		expect(inMonth.length).toBeGreaterThan(0);
	});
});
