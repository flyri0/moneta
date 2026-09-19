import { describe, it, expect } from 'vitest';
import { categoryId, createBudgetDb, createTestDb } from '../testing';
import { all, run } from '../connection';
import { getMeta, initBudget, isInitialized, updateMeta } from './meta';

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
			['Credit Card Payments', 'credit_card_payments'],
			['Everyday', null]
		]);
		const categories = all<{ groupName: string; name: string; system: string | null }>(
			db,
			`SELECT g.name AS groupName, c.name, c.system
			 FROM categories c JOIN category_groups g ON g.id = c.group_id
			 ORDER BY g.sort_order, c.sort_order`
		);
		expect(categories.map((c) => [c.groupName, c.name, c.system])).toEqual([
			['Income', 'Ready to Assign', 'ready_to_assign'],
			['Everyday', 'Food', null],
			['Everyday', 'Fun', null]
		]);
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
			expect.objectContaining({ code: 'CURRENCY_LOCKED' })
		);
	});
});
