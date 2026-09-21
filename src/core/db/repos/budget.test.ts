import { describe, it, expect, beforeEach } from 'vitest';
import { categoryId, createBudgetDb } from '../testing';
import { all, type Db } from '../connection';
import { createAccount } from './accounts';
import { defaultIncomeCategoryId } from './meta';
import { createTransaction } from './transactions';
import {
	applyQuickAssign,
	getBudgetMonth,
	moveMoney,
	setAssigned,
	type BudgetMonthView
} from './budget';

const code = (c: string) => expect.objectContaining({ code: c });
const cat = (view: BudgetMonthView, name: string) =>
	view.groups.flatMap((g) => g.categories).find((c) => c.name === name)!;

let db: Db;
let bank: string;
let visa: string;
let broker: string;
let food: string;
let rent: string;

beforeEach(async () => {
	db = await createBudgetDb();
	const base = { onBudget: true, startingDate: '2026-01-01' };
	bank = createAccount(db, { ...base, name: 'Bank', type: 'checking', startingBalance: 300000 });
	visa = createAccount(db, { ...base, name: 'Visa', type: 'credit_card', startingBalance: 0 });
	broker = createAccount(db, {
		...base,
		name: 'Broker',
		type: 'investment',
		onBudget: false,
		startingBalance: 999999
	});
	food = categoryId(db, 'Food');
	rent = categoryId(db, 'Rent');
});

describe('amount validation', () => {
	it('rejects amounts beyond the safe integer range', () => {
		const unsafe = 2 ** 53;
		expect(() => setAssigned(db, food, '2026-01', unsafe)).toThrow(code('INVALID_INPUT'));
		expect(() =>
			moveMoney(db, { fromCategoryId: food, toCategoryId: rent, month: '2026-01', amount: unsafe })
		).toThrow(code('INVALID_INPUT'));
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-05',
				amount: -unsafe,
				categoryId: food
			})
		).toThrow(code('INVALID_INPUT'));
		expect(() =>
			createTransaction(db, {
				accountId: bank,
				date: '2026-01-05',
				amount: -1,
				splits: [
					{ categoryId: food, amount: unsafe },
					{ categoryId: rent, amount: -unsafe - 1 }
				]
			})
		).toThrow(code('INVALID_INPUT'));
		expect(all(db, 'SELECT 1 FROM budget_assignments')).toEqual([]);
	});
});

describe('getBudgetMonth', () => {
	it('shows income as Ready to Assign and excludes off-budget money', () => {
		const view = getBudgetMonth(db, '2026-01');
		expect(view).toMatchObject({
			readyToAssign: 300000,
			availableFunds: 300000,
			futureNegativeMonth: null
		});
		expect(view.groups.map((g) => g.name)).toEqual(['Income', 'Bills', 'Everyday']);
	});

	it('includes Income group in getBudgetMonth with income activity', () => {
		const view = getBudgetMonth(db, '2026-01');
		const incomeGroup = view.groups.find((g) => g.system === 'income');
		expect(incomeGroup).toBeDefined();
		expect(incomeGroup!.categories.length).toBeGreaterThan(0);
		expect(incomeGroup!.activity).toBe(300000);
	});

	it('computes assigned, activity and available with group totals', () => {
		setAssigned(db, food, '2026-01', 50000);
		setAssigned(db, rent, '2026-01', 120000);
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -12000,
			categoryId: food
		});
		const view = getBudgetMonth(db, '2026-01');
		expect(view.readyToAssign).toBe(130000);
		expect(cat(view, 'Food')).toMatchObject({
			assigned: 50000,
			activity: -12000,
			available: 38000
		});
		expect(view.groups.find((g) => g.name === 'Everyday')).toMatchObject({
			assigned: 50000,
			activity: -12000,
			available: 38000
		});
	});

	it('handles card spending and transfers between on-budget accounts', () => {
		setAssigned(db, food, '2026-01', 50000);
		createTransaction(db, {
			accountId: visa,
			date: '2026-01-10',
			amount: -20000,
			categoryId: food
		});
		let view = getBudgetMonth(db, '2026-01');
		expect(cat(view, 'Food')).toMatchObject({
			assigned: 50000,
			activity: -20000,
			available: 30000
		});
		expect(view.readyToAssign).toBe(250000);

		createTransaction(db, {
			accountId: bank,
			date: '2026-01-25',
			amount: -20000,
			transferAccountId: visa
		});
		view = getBudgetMonth(db, '2026-01');
		expect(cat(view, 'Food')).toMatchObject({
			assigned: 50000,
			activity: -20000,
			available: 30000
		});
		expect(view.readyToAssign).toBe(250000);
	});

	it('counts split lines per category', () => {
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -10000,
			splits: [
				{ categoryId: food, amount: -6000 },
				{ categoryId: rent, amount: -4000 }
			]
		});
		const view = getBudgetMonth(db, '2026-01');
		expect(cat(view, 'Food').activity).toBe(-6000);
		expect(cat(view, 'Rent').activity).toBe(-4000);
	});

	it('treats a categorized transfer to an off-budget account as spending', () => {
		createTransaction(db, {
			accountId: bank,
			date: '2026-01-10',
			amount: -5000,
			transferAccountId: broker,
			categoryId: food
		});
		expect(cat(getBudgetMonth(db, '2026-01'), 'Food').activity).toBe(-5000);
	});

	it('flags a future month with negative Ready to Assign', () => {
		setAssigned(db, rent, '2026-03', 400000);
		expect(getBudgetMonth(db, '2026-01').futureNegativeMonth).toBe('2026-03');
	});

	it('rejects invalid months', () => {
		expect(() => getBudgetMonth(db, '2026-13')).toThrow(code('INVALID_INPUT'));
	});
});

describe('assigning money', () => {
	it('upserts and clears assignments', () => {
		setAssigned(db, food, '2026-01', 100);
		setAssigned(db, food, '2026-01', 200);
		expect(all(db, 'SELECT assigned FROM budget_assignments')).toEqual([{ assigned: 200 }]);
		setAssigned(db, food, '2026-01', 0);
		expect(all(db, 'SELECT * FROM budget_assignments')).toEqual([]);
	});

	it('rejects assigning money directly to an income category', () => {
		const incomeId = defaultIncomeCategoryId(db);
		expect(() => setAssigned(db, incomeId, '2026-01', 5000)).toThrow(code('CATEGORY_NOT_ALLOWED'));
	});

	it('moves money between categories', () => {
		setAssigned(db, food, '2026-01', 10000);
		moveMoney(db, { fromCategoryId: food, toCategoryId: rent, month: '2026-01', amount: 4000 });
		const view = getBudgetMonth(db, '2026-01');
		expect(cat(view, 'Food').assigned).toBe(6000);
		expect(cat(view, 'Rent').assigned).toBe(4000);
		expect(() =>
			moveMoney(db, { fromCategoryId: food, toCategoryId: rent, month: '2026-01', amount: 0 })
		).toThrow(code('INVALID_INPUT'));
	});

	it('applies quick-assign strategies to several categories at once', () => {
		setAssigned(db, food, '2026-01', 30000);
		setAssigned(db, rent, '2026-01', 120000);
		applyQuickAssign(db, { month: '2026-02', categoryIds: [food, rent], strategy: 'last-month' });
		let view = getBudgetMonth(db, '2026-02');
		expect(cat(view, 'Food').assigned).toBe(30000);
		expect(cat(view, 'Rent').assigned).toBe(120000);

		createTransaction(db, {
			accountId: bank,
			date: '2026-02-10',
			amount: -80000,
			categoryId: food
		});
		applyQuickAssign(db, { month: '2026-02', categoryIds: [food], strategy: 'cover-overspending' });
		view = getBudgetMonth(db, '2026-02');
		expect(cat(view, 'Food')).toMatchObject({ assigned: 50000, available: 0 }); // 30000 carryover + 50000 - 80000

		applyQuickAssign(db, { month: '2026-02', categoryIds: [food, rent], strategy: 'clear' });
		view = getBudgetMonth(db, '2026-02');
		expect(cat(view, 'Rent').assigned).toBe(0);
	});
});
