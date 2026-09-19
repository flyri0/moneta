import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb, createTestDb } from '../testing';
import { run } from '../connection';
import { getMeta, initBudget, isInitialized, updateMeta } from './meta';
import { listCategoryTree } from './categories';

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
		const tree = listCategoryTree(db);
		expect(tree.map((g) => [g.name, g.system])).toEqual([
			['Income', 'income'],
			['Credit Card Payments', 'credit_card_payments'],
			['Everyday', null]
		]);
		expect(tree[0].categories.map((c) => [c.name, c.system])).toEqual([
			['Ready to Assign', 'ready_to_assign']
		]);
		expect(tree[2].categories.map((c) => c.name)).toEqual(['Food', 'Fun']);
	});

	it('refuses to initialize twice', async () => {
		const db = await createBudgetDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'BRL', locale: 'pt-BR', groups: [] })
		).toThrow(expect.objectContaining({ code: 'ALREADY_INITIALIZED' }));
	});

	it('rejects unknown currencies', async () => {
		const db = await createTestDb();
		expect(() =>
			initBudget(db, { name: 'x', currency: 'XX', locale: 'pt-BR', groups: [] })
		).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
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
			expect.objectContaining({ code: 'INVALID_INPUT' })
		);
	});
});
