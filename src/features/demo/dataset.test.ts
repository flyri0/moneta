import { describe, expect, it } from 'vitest';
import { computeBudget, type EngineInput } from '$domain/budget-engine';
import { addMonths, isDate, monthOf, type Month } from '$domain/month';
import { buildDemo, type DemoInput } from './dataset';
import type { DemoSeed } from './seed';

const CATEGORIES = {
	salary: 'Salary',
	otherIncome: 'Other Income',
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

/** Where the repos put opening balances: an income category of its own. */
const STARTING = 'Starting balance';
const INCOME = new Set([CATEGORIES.salary, CATEGORIES.otherIncome, STARTING]);

function input(today: string, scale = 100): DemoInput {
	return {
		today,
		scale,
		accounts: { checking: 'Checking', savings: 'Savings', card: 'Card' },
		payees: {
			salary: 'Paycheck',
			newEmployer: 'New Job',
			freelance: 'Freelance',
			benefits: 'Benefits',
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
			hobby: 'Bookshop',
			mechanic: 'Mechanic',
			airline: 'Airline',
			hotel: 'Hotel',
			pharmacy: 'Pharmacy',
			clinic: 'Clinic'
		},
		categories: CATEGORIES
	};
}

/** The demo as the budget screen sees it, through the real engine. */
function budgetOf(seed: DemoSeed, through: Month) {
	const entries: EngineInput['entries'] = [];
	for (const a of seed.accounts) {
		if (a.startingBalance !== 0) {
			entries.push({
				categoryId: STARTING,
				month: monthOf(a.startingDate),
				amount: a.startingBalance
			});
		}
	}
	for (const t of seed.transactions) {
		if (t.transferAccountKey) continue;
		const month = monthOf(t.date);
		if (t.splits) {
			for (const s of t.splits)
				entries.push({ categoryId: s.categoryName, month, amount: s.amount });
		} else {
			entries.push({ categoryId: t.categoryName!, month, amount: t.amount });
		}
	}
	return computeBudget(
		{
			categories: [...Object.values(CATEGORIES), STARTING].map((id) => ({
				id,
				kind: INCOME.has(id) ? 'income' : 'regular',
				carryoverOverspending: false
			})),
			entries,
			assignments: seed.assignments.map((a) => ({
				categoryId: a.categoryName,
				month: a.month,
				assigned: a.amount
			}))
		},
		through
	);
}

/** Each account's balance at the end of every day that has a transaction. */
function dailyBalances(seed: DemoSeed): Map<string, [string, number][]> {
	const moves: { account: string; date: string; amount: number }[] = [];
	for (const t of seed.transactions) {
		moves.push({ account: t.accountKey, date: t.date, amount: t.amount });
		if (t.transferAccountKey) {
			moves.push({ account: t.transferAccountKey, date: t.date, amount: -t.amount });
		}
	}
	moves.sort((a, b) => a.date.localeCompare(b.date));
	const result = new Map<string, [string, number][]>();
	for (const account of seed.accounts) {
		let balance = account.startingBalance;
		const days: [string, number][] = [];
		for (const move of moves.filter((m) => m.account === account.key)) {
			balance += move.amount;
			if (days.at(-1)?.[0] === move.date) days[days.length - 1][1] = balance;
			else days.push([move.date, balance]);
		}
		result.set(account.key, days);
	}
	return result;
}

/** An account's balance at the end of `month`. */
function balanceAt(seed: DemoSeed, account: string, month: Month): number {
	const start = seed.accounts.find((a) => a.key === account)!.startingBalance;
	const days = dailyBalances(seed)
		.get(account)!
		.filter(([date]) => monthOf(date) <= month);
	return days.at(-1)?.[1] ?? start;
}

function netWorthAt(seed: DemoSeed, month: Month): number {
	return seed.accounts.reduce((sum, a) => sum + balanceAt(seed, a.key, month), 0);
}

function incomeIn(seed: DemoSeed, month: Month): number {
	return seed.transactions
		.filter((t) => !t.transferAccountKey && t.amount > 0 && monthOf(t.date) === month)
		.reduce((sum, t) => sum + t.amount, 0);
}

function spendingIn(seed: DemoSeed, month: Month): number {
	return -seed.transactions
		.filter((t) => !t.transferAccountKey && t.amount < 0 && monthOf(t.date) === month)
		.reduce((sum, t) => sum + t.amount, 0);
}

describe('buildDemo', () => {
	const today = '2026-09-20';
	const current = monthOf(today);
	const seed = buildDemo(input(today));
	/** The demo's months, oldest first: 0-4 the good times, 5-7 the hard ones, 8-11 the way back. */
	const months = Array.from({ length: 12 }, (_, i) => addMonths(current, i - 11));

	it('is deterministic', () => {
		expect(buildDemo(input(today))).toEqual(seed);
	});

	it('opens three accounts, one of them a credit card', () => {
		expect(seed.accounts.map((a) => a.type)).toEqual(['checking', 'savings', 'credit_card']);
		expect(seed.accounts.every((a) => a.onBudget)).toBe(true);
		expect(seed.accounts.every((a) => Number.isSafeInteger(a.startingBalance))).toBe(true);
	});

	it('covers this month and the eleven before it, never past today', () => {
		const dates = seed.transactions.map((t) => t.date);
		expect(dates.length).toBeGreaterThan(200);
		expect(dates.every(isDate)).toBe(true);
		expect(Math.min(...dates.map((d) => Date.parse(d)))).toBe(Date.parse(`${months[0]}-01`));
		expect(dates.every((d) => d <= today)).toBe(true);
		expect(months.every((m) => dates.some((d) => monthOf(d) === m))).toBe(true);
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
		expect(amounts.every((a) => a !== 0)).toBe(true);
		expect(seed.transactions.every((t) => t.splits?.every((s) => s.amount < 0) ?? true)).toBe(true);
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

	it('schedules the next paycheck, rent and card payment, after today', () => {
		expect(
			seed.schedules.map((s) => [s.startDate, s.autoEnter, s.transferAccountKey ?? null])
		).toEqual([
			['2026-10-01', true, null],
			['2026-10-03', false, null],
			['2026-10-05', false, 'card']
		]);
		expect(seed.schedules[0].payeeName).toBe('New Job');
		expect(seed.schedules.every((s) => s.amount !== 0)).toBe(true);
		const early = buildDemo(input('2026-09-02'));
		expect(early.schedules.map((s) => s.startDate)).toEqual([
			'2026-10-01',
			'2026-09-03',
			'2026-09-05'
		]);
	});

	it('pays the card with transfers, never a plain outflow', () => {
		const payments = seed.transactions.filter((t) => t.transferAccountKey === 'card');
		expect(payments.length).toBe(11); // nothing was charged before the first month
		expect(payments.every((t) => t.amount < 0 && t.accountKey === 'checking')).toBe(true);
	});

	it('files income under Salary or Other Income, never anything else', () => {
		const income = seed.transactions.filter((t) => t.amount > 0 && !t.transferAccountKey);
		expect(
			income.every(
				(t) => t.categoryName === CATEGORIES.salary || t.categoryName === CATEGORIES.otherIncome
			)
		).toBe(true);
		expect(income.some((t) => t.categoryName === CATEGORIES.otherIncome)).toBe(true);
		expect(income.every((t) => t.accountKey === 'checking')).toBe(true);
	});

	it('assigns every paycheck down to the last cent, opening balances included', () => {
		const income = seed.transactions
			.filter(
				(t) => t.categoryName === CATEGORIES.salary || t.categoryName === CATEGORIES.otherIncome
			)
			.reduce((sum, t) => sum + t.amount, 0);
		const opening = seed.accounts
			.filter((a) => a.type !== 'credit_card')
			.reduce((sum, a) => sum + a.startingBalance, 0);
		const assigned = seed.assignments.reduce((sum, a) => sum + a.amount, 0);
		expect(assigned).toBe(income + opening);
	});

	it('never assigns to income categories', () => {
		expect(seed.assignments.some((a) => INCOME.has(a.categoryName))).toBe(false);
	});

	it('closes every month with nothing to assign and nothing overspent', () => {
		const budget = budgetOf(seed, current);
		for (const month of months) {
			const result = budget.months.get(month)!;
			expect(result.readyToAssign, month).toBe(0);
			const overspent = [...result.categories].filter(([, c]) => c.available < 0);
			expect(overspent, month).toEqual([]);
		}
	});

	it('never takes the checking or savings account below zero', () => {
		for (const key of ['checking', 'savings']) {
			const days = dailyBalances(seed).get(key)!;
			expect(
				days.filter(([, balance]) => balance < 0),
				key
			).toEqual([]);
		}
	});

	it('varies from month to month', () => {
		const spending = months.slice(0, 11).map((m) => spendingIn(seed, m));
		expect(new Set(spending).size).toBe(11);
	});

	it('tells a story: a rise, a hard stretch and a slow recovery', () => {
		const income = months.map((m) => incomeIn(seed, m));
		const spending = months.map((m) => spendingIn(seed, m));
		const netWorth = months.map((m) => netWorthAt(seed, m));
		const average = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

		// The good times: income climbs and net worth with it.
		expect(income[4]).toBeGreaterThan(income[0]);
		expect(netWorth[4]).toBeGreaterThan(netWorth[0]);
		// The hard stretch: less coming in than going out, and net worth falls.
		expect(average(income.slice(5, 8))).toBeLessThan(average(income.slice(0, 5)));
		expect(spending[6]).toBeGreaterThan(income[6]);
		expect(spending[7]).toBeGreaterThan(income[7]);
		expect(netWorth[7]).toBeLessThan(netWorth[4]);
		// The way back: income returns, below its peak, and net worth grows again.
		expect(income[9]).toBeGreaterThan(income[7]);
		expect(Math.max(...income.slice(9))).toBeLessThan(Math.max(...income.slice(0, 5)));
		expect(netWorth[10]).toBeGreaterThan(netWorth[7]);
	});

	it('carries a card balance out of the hard stretch and pays it down slowly', () => {
		const card = months.map((m) => balanceAt(seed, 'card', m));
		expect(card[7]).toBeLessThan(card[4]);
		expect(card[8]).toBeGreaterThan(card[7]);
		expect(card[9]).toBeGreaterThan(card[8]);
		expect(card[10]).toBeGreaterThan(card[9]);
		expect(card[10]).toBeLessThan(0);
	});

	it('leans on the emergency fund when times are hard', () => {
		const budget = budgetOf(seed, current);
		const fund = (i: number) =>
			budget.months.get(months[i])!.categories.get(CATEGORIES.emergencyFund)!.available;
		expect(fund(4)).toBeGreaterThan(fund(0));
		expect(fund(7)).toBeLessThan(fund(4));
		expect(fund(11)).toBeGreaterThan(fund(8));
	});

	it('scales to a currency with no minor units', () => {
		const yen = buildDemo(input(today, 1));
		expect(yen.transactions.every((t) => Number.isSafeInteger(t.amount))).toBe(true);
		const paycheck = yen.transactions.find((t) => t.categoryName === CATEGORIES.salary);
		expect(paycheck?.amount).toBe(3800);
		expect(budgetOf(yen, current).months.get(current)!.readyToAssign).toBe(0);
	});

	it('shrinks the current month when the month has barely started', () => {
		const early = buildDemo(input('2026-09-02'));
		const inMonth = early.transactions.filter((t) => t.date.startsWith('2026-09'));
		expect(inMonth.every((t) => t.date <= '2026-09-02')).toBe(true);
		expect(inMonth.length).toBeGreaterThan(0);
	});

	for (const day of ['2026-09-01', '2026-01-31', '2026-03-31', '2027-01-15']) {
		it(`holds together when today is ${day}`, () => {
			const demo = buildDemo(input(day));
			expect(demo.transactions.every((t) => isDate(t.date) && t.date <= day)).toBe(true);
			const budget = budgetOf(demo, monthOf(day));
			expect([...budget.months.values()].every((m) => m.readyToAssign === 0)).toBe(true);
			for (const key of ['checking', 'savings']) {
				expect(
					dailyBalances(demo)
						.get(key)!
						.every(([, b]) => b >= 0)
				).toBe(true);
			}
		});
	}
});
