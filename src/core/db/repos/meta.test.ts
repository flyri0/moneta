import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb, createTestDb } from '../testing';
import { all, run } from '../connection';
import { defaultIncomeCategoryId, getMeta, initBudget, isInitialized, updateMeta } from './meta';
import { deleteCategory, listCategoryTree } from './categories';

describe('initBudget', () => {
	it('creates meta, system groups and the starting categories', async () => {
		const db = await createTestDb();
		expect(isInitialized(db)).toBe(false);
		initBudget(db, {
			name: ' Casa ',
			currency: 'BRL',
			locale: 'pt-BR',
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

	it('seeds English starter income categories when locale is en', async () => {
		const db = await createTestDb();
		initBudget(db, {
			name: 'Home',
			currency: 'USD',
			locale: 'en-US',
			groups: []
		});
		const categories = all<{ name: string }>(
			db,
			`SELECT c.name FROM categories c
			 JOIN category_groups g ON g.id = c.group_id
			 WHERE g.system = 'income'
			 ORDER BY c.sort_order`
		);
		expect(categories.map((c) => c.name)).toEqual(['Salary', 'Other Income']);
	});

	it('refuses to initialize twice', async () => {
		const db = await createBudgetDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'BRL', locale: 'pt-BR', groups: [] })
		).toThrow(expect.objectContaining({ code: 'ALREADY_INITIALIZED' }));
	});

	it('rejects invalid locale tags on init and update', async () => {
		const db = await createTestDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'BRL', locale: 'not a locale', groups: [] })
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
			initBudget(db, { name: 'x', currency: 'XX', locale: 'pt-BR', groups: [] })
		).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
	});
});

describe('defaultIncomeCategoryId', () => {
	it('returns the first income category id', async () => {
		const db = await createBudgetDb();
		const defaultId = defaultIncomeCategoryId(db);
		const tree = listCategoryTree(db);
		const income = tree.find((g) => g.system === 'income')!;
		expect(defaultId).toBe(income.categories[0].id);
	});

	it('throws NOT_FOUND when no income category exists', async () => {
		const db = await createBudgetDb();
		const income = listCategoryTree(db).find((g) => g.system === 'income')!;
		for (const cat of income.categories) {
			deleteCategory(db, cat.id);
		}
		expect(() => defaultIncomeCategoryId(db)).toThrow(
			expect.objectContaining({ code: 'NOT_FOUND' })
		);
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
