import { beforeAll, describe, expect, it } from 'vitest';
import { buildDemo, type DemoCategoryNames } from '$features/demo/dataset';
import { currentMonth, todayIso } from '$domain/month';
import { defaultCategoryGroups, defaultIncomeCategories } from '$i18n/defaults';
import { demoBudget } from '$features/demo/content';
import type { Db } from '../connection';
import { createTestDb } from '../testing';
import { listAccounts } from './accounts';
import { getBudgetMonth } from './budget';
import { createDemo } from './demo';
import { listSchedules } from './schedules';
import { listTransactions } from './transactions';

const [bills, everyday, goals, fun] = defaultCategoryGroups('en');
const CATEGORIES: DemoCategoryNames = {
	salary: 'Salary',
	otherIncome: 'Other Income',
	rent: bills.categories[0],
	utilities: bills.categories[1],
	phone: bills.categories[2],
	insurance: bills.categories[3],
	groceries: everyday.categories[0],
	transport: everyday.categories[1],
	dining: everyday.categories[2],
	household: everyday.categories[3],
	emergencyFund: goals.categories[0],
	vacation: goals.categories[1],
	entertainment: fun.categories[0],
	hobbies: fun.categories[1]
};

async function demoDb(): Promise<Db> {
	const db = await createTestDb();
	createDemo(db, {
		init: {
			name: 'Demo',
			currency: 'USD',
			locale: 'en-US',
			income: defaultIncomeCategories('en'),
			groups: defaultCategoryGroups('en')
		},
		seed: buildDemo({
			today: todayIso(),
			scale: 100,
			accounts: { checking: 'Checking', savings: 'Savings', card: 'Credit Card' },
			payees: {
				salary: 'Paycheck',
				newEmployer: 'New Job Payroll',
				freelance: 'Freelance Client',
				benefits: 'Unemployment Benefits',
				landlord: 'Landlord',
				utility: 'City Utilities',
				telecom: 'Internet Provider',
				insurance: 'Insurance Co.',
				grocery: 'Corner Market',
				transport: 'Gas Station',
				coffee: 'Coffee Shop',
				restaurant: 'Restaurant',
				household: 'Home Store',
				streaming: 'Streaming Service',
				hobby: 'Bookshop',
				mechanic: 'Auto Repair Shop',
				airline: 'Airline',
				hotel: 'Hotel',
				pharmacy: 'Pharmacy',
				clinic: 'Dental Clinic'
			},
			categories: CATEGORIES
		})
	});
	return db;
}

describe('seedDemo', () => {
	let db: Db;
	beforeAll(async () => {
		db = await demoDb();
	});

	it('adds the schedules, none of them due yet', () => {
		expect(listSchedules(db, todayIso()).map((s) => s.status)).toEqual([
			'active',
			'active',
			'active'
		]);
	});

	it('opens the three accounts with money in them', () => {
		const accounts = listAccounts(db);
		expect(accounts.map((a) => a.name)).toEqual(['Checking', 'Savings', 'Credit Card']);
		expect(accounts[0].balance).toBeGreaterThan(0);
		expect(accounts[1].balance).toBeGreaterThan(0);
		expect(accounts[2].balance).toBeLessThanOrEqual(0);
	});

	it('records a year of history, most of it cleared', () => {
		const rows = listTransactions(db);
		expect(rows.length).toBeGreaterThan(200);
		expect(rows.filter((r) => r.cleared).length).toBeGreaterThan(rows.length / 2);
		expect(rows.some((r) => r.isSplit)).toBe(true);
		expect(rows.some((r) => r.transferAccountName === 'Credit Card')).toBe(true);
	});

	it("finds the card's own transactions, not only the transfers to it, by its name", () => {
		const rows = listTransactions(db, { search: 'credit card' });
		const card = rows.filter((r) => r.accountName === 'Credit Card');
		expect(card.some((r) => r.transferId === null)).toBe(true);
		expect(rows.some((r) => r.transferAccountName === 'Credit Card')).toBe(true);
		expect(rows).toEqual(
			listTransactions(db).filter(
				(r) => r.accountName === 'Credit Card' || r.transferAccountName === 'Credit Card'
			)
		);
	});

	it('names its payees', () => {
		const payees = new Set(listTransactions(db).map((r) => r.payeeName));
		expect(payees).toContain('Corner Market');
		expect(payees).toContain('Paycheck');
	});

	it('opens its accounts with starting balances that have no payee', () => {
		const openings = listTransactions(db).filter((r) => r.isOpening);
		expect(openings.map((r) => r.payeeName)).toEqual([null, null]);
	});

	it('leaves nothing to assign and nothing overspent', () => {
		const view = getBudgetMonth(db, currentMonth());
		expect(view.readyToAssign).toBe(0);
		const categories = view.groups.flatMap((g) => g.categories);
		expect(categories.filter((c) => c.available < 0)).toEqual([]);
		expect(view.assignedThisMonth).toBeGreaterThan(0);
	});

	it('seeds demo with credit card debt and income in Salary category without cc payment categories', async () => {
		const testDb = await createTestDb();
		const demo = demoBudget();
		createDemo(testDb, demo);

		const view = getBudgetMonth(testDb, currentMonth());
		const ccGroup = view.groups.find((g) => g.name === 'Credit Card Payments');
		expect(ccGroup).toBeUndefined();

		const incomeGroup = view.groups.find((g) => g.system === 'income')!;
		expect(incomeGroup).toBeDefined();
		expect(incomeGroup.activity).toBeGreaterThan(0);

		const card = listAccounts(testDb).find((a) => a.type === 'credit_card')!;
		expect(card.balance).toBeLessThanOrEqual(0);
	});
});
