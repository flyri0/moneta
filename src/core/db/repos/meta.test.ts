import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb, createTestDb } from '../testing';
import { all, run, type Db } from '../connection';
import {
	ensureStartingBalanceCategory,
	getMeta,
	initBudget,
	isInitialized,
	startingBalanceCategoryId,
	updateMeta
} from './meta';
import { createCategory, deleteCategory, listCategoryTree, updateCategory } from './categories';

function incomeNames(db: Db): string[] {
	return all<{ name: string }>(
		db,
		`SELECT c.name FROM categories c
		 JOIN category_groups g ON g.id = c.group_id
		 WHERE g.system = 'income'
		 ORDER BY c.sort_order`
	).map((c) => c.name);
}

describe('initBudget', () => {
	it('creates meta, system groups and the starting categories', async () => {
		const db = await createTestDb();
		expect(isInitialized(db)).toBe(false);
		initBudget(db, {
			name: ' Casa ',
			currency: 'BRL',
			locale: 'pt-BR',
			income: ['Salário', 'Outras receitas', 'Saldo inicial'],
			groups: [{ name: 'Everyday', categories: ['Food', 'Fun'] }]
		});
		expect(isInitialized(db)).toBe(true);
		expect(getMeta(db)).toMatchObject({
			name: 'Casa',
			currency: 'BRL',
			locale: 'pt-BR',
			lastBackupAt: null
		});
		const groups = all<{ name: string; system: string | null }>(
			db,
			'SELECT name, system FROM category_groups ORDER BY sort_order'
		);
		expect(groups.map((g) => [g.name, g.system])).toEqual([
			['Income', 'income'],
			['Everyday', null]
		]);
		const categories = all<{ groupName: string; name: string }>(
			db,
			`SELECT g.name AS groupName, c.name
			 FROM categories c JOIN category_groups g ON g.id = c.group_id
			 ORDER BY g.sort_order, c.sort_order`
		);
		expect(categories.map((c) => [c.groupName, c.name])).toEqual([
			['Income', 'Salário'],
			['Income', 'Outras receitas'],
			['Income', 'Saldo inicial'],
			['Everyday', 'Food'],
			['Everyday', 'Fun']
		]);
	});

	it('creates Income group with starter income categories and no credit card payments group', async () => {
		const db = await createBudgetDb();
		const groups = listCategoryTree(db);
		const income = groups.find((g) => g.system === 'income');
		expect(income).toBeDefined();
		expect(income!.categories.length).toBeGreaterThanOrEqual(1);
		const cards = groups.find((g) => g.name === 'Credit Card Payments');
		expect(cards).toBeUndefined();
	});

	it('creates the picked income categories in order, trimmed, blanks skipped', async () => {
		const db = await createTestDb();
		initBudget(db, {
			name: 'Home',
			currency: 'USD',
			locale: 'en-US',
			income: [' Salary ', '', 'Starting Balance'],
			groups: []
		});
		expect(incomeNames(db)).toEqual(['Salary', 'Starting Balance']);
		expect(startingBalanceCategoryId(db)).toBe(categoryId(db, 'Starting Balance'));
	});

	it('always creates the Income group, even with no income categories', async () => {
		const db = await createTestDb();
		initBudget(db, { name: 'Home', currency: 'USD', locale: 'en-US', income: [], groups: [] });
		const income = listCategoryTree(db).find((g) => g.system === 'income');
		expect(income?.categories).toEqual([]);
		expect(startingBalanceCategoryId(db)).toBeNull();
	});

	it('refuses to initialize twice', async () => {
		const db = await createBudgetDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'BRL', locale: 'pt-BR', income: [], groups: [] })
		).toThrow(expect.objectContaining({ code: 'ALREADY_INITIALIZED' }));
	});

	it('rejects invalid locale tags on init and update', async () => {
		const db = await createTestDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'BRL', locale: 'not a locale', income: [], groups: [] })
		).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
		expect(isInitialized(db)).toBe(false);
		const budget = await createBudgetDb();
		expect(() => updateMeta(budget, { locale: 'en_US!' })).toThrow(
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
		expect(getMeta(budget).locale).toBe('pt-BR');
	});

	it('rejects unknown currencies', async () => {
		const db = await createTestDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'XX', locale: 'pt-BR', income: [], groups: [] })
		).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
	});
});

describe('ensureStartingBalanceCategory', () => {
	const incomeGroupId = (db: Db) => listCategoryTree(db).find((g) => g.system === 'income')!.id;

	it('is created with the budget and recorded', async () => {
		const db = await createBudgetDb();
		const id = startingBalanceCategoryId(db);
		expect(id).toBe(categoryId(db, 'Saldo inicial'));
		expect(ensureStartingBalanceCategory(db)).toBe(id);
	});

	it('keeps following the category after a rename', async () => {
		const db = await createBudgetDb();
		const id = ensureStartingBalanceCategory(db);
		updateCategory(db, id, { name: 'Abertura' });
		expect(ensureStartingBalanceCategory(db)).toBe(id);
		expect(startingBalanceCategoryId(db)).toBe(id);
	});

	it('creates it again once deleted, even with no other income category', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		for (const cat of income.categories) deleteCategory(db, cat.id);
		expect(startingBalanceCategoryId(db)).toBeNull();
		const id = ensureStartingBalanceCategory(db);
		expect(startingBalanceCategoryId(db)).toBe(id);
		expect(listCategoryTree(db).find((g) => g.system === 'income')!.categories).toEqual([
			expect.objectContaining({ id, name: 'Saldo inicial' })
		]);
	});

	it('adopts an income category with the same name instead of adding another', async () => {
		const db = await createBudgetDb();
		deleteCategory(db, ensureStartingBalanceCategory(db));
		const own = createCategory(db, { groupId: incomeGroupId(db), name: ' starting balance ' });
		expect(ensureStartingBalanceCategory(db)).toBe(own);
		expect(startingBalanceCategoryId(db)).toBe(own);
	});

	it('names it in the budget language', async () => {
		const db = await createTestDb();
		initBudget(db, { name: 'Home', currency: 'USD', locale: 'en-US', income: [], groups: [] });
		expect(startingBalanceCategoryId(db)).toBeNull();
		const id = ensureStartingBalanceCategory(db);
		expect(id).toBe(categoryId(db, 'Starting Balance'));
		expect(startingBalanceCategoryId(db)).toBe(id);
	});
});

describe('updateMeta', () => {
	it('updates name, locale and last backup', async () => {
		const db = await createBudgetDb();
		updateMeta(db, { name: 'Renamed', locale: 'en-US', lastBackupAt: '2026-09-19T10:00:00Z' });
		expect(getMeta(db)).toMatchObject({
			name: 'Renamed',
			locale: 'en-US',
			lastBackupAt: '2026-09-19T10:00:00Z'
		});
	});

	it('locks the currency once a schedule holds an amount, even with no transaction yet', async () => {
		const db = await createBudgetDb();
		run(
			db,
			"INSERT INTO accounts (id, name, type, on_budget, created_at) VALUES ('a1', 'Bank', 'checking', 1, '2026-01-01')"
		);
		run(
			db,
			`INSERT INTO schedules (id, account_id, amount, category_id, start_date, frequency, created_at)
			 VALUES ('s1', 'a1', -123456, ?, '2026-02-01', 'monthly', '2026-01-01')`,
			[categoryId(db, 'Rent')]
		);
		expect(() => updateMeta(db, { currency: 'JPY' })).toThrow(
			expect.objectContaining({ code: 'CURRENCY_LOCKED' })
		);
	});

	it('allows currencies with the same minor units once data exists', async () => {
		const db = await createBudgetDb();
		run(
			db,
			"INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, '2026-01', 100)",
			[categoryId(db, 'Food')]
		);
		updateMeta(db, { currency: 'USD' });
		expect(getMeta(db).currency).toBe('USD');
		expect(() => updateMeta(db, { currency: 'JPY' })).toThrow(
			expect.objectContaining({ code: 'CURRENCY_LOCKED' })
		);
	});
});
