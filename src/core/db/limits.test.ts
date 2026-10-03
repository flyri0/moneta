import { describe, expect, it } from 'vitest';
import { checkBackup } from './backup';
import { createDispatcher } from './dispatcher';
import { toImage } from './image';
import { categoryId, createBudgetDb, loadSqlite } from './testing';
import type { SystemApi } from './api';
import { createAccount } from './repos/accounts';

/** Half the largest safe integer, rounded up: two of them go past it. */
const HALF = 2 ** 52;

async function setUp() {
	const db = await createBudgetDb();
	const sqlite3 = await loadSqlite();
	const dispatch = createDispatcher({ system: {} as SystemApi, getDb: () => db, sqlite3 });
	const bank = createAccount(db, {
		name: 'Bank',
		type: 'checking',
		onBudget: true,
		startingBalance: 0,
		startingDate: '2026-01-01'
	});
	const income = categoryId(db, 'Salário');
	let id = 0;
	const call = (method: string, ...args: unknown[]) => dispatch({ id: ++id, method, args });
	const income5e15 = () =>
		call('transactions.create', {
			accountId: bank,
			date: '2026-01-05',
			amount: HALF,
			categoryId: income
		});
	return { db, sqlite3, call, income5e15 };
}

describe('the amount range', () => {
	it('refuses a write whose amounts would add up past the safe integer range', async () => {
		const { db, income5e15 } = await setUp();
		expect(await income5e15()).toMatchObject({ ok: true });
		expect(await income5e15()).toMatchObject({ ok: false, error: { code: 'AMOUNT_TOO_LARGE' } });
		expect(db.selectValue('SELECT COUNT(*) FROM transactions WHERE amount = ?', [HALF])).toBe(1);
	});

	it('counts assignments as well as transactions', async () => {
		const { db, call, income5e15 } = await setUp();
		await income5e15();
		const res = await call('budget.setAssigned', categoryId(db, 'Food'), '2026-01', HALF);
		expect(res).toMatchObject({ ok: false, error: { code: 'AMOUNT_TOO_LARGE' } });
	});

	it('keeps every budget the app writes restorable', async () => {
		const { db, sqlite3, call, income5e15 } = await setUp();
		await income5e15();
		await income5e15();
		await call('budget.setAssigned', categoryId(db, 'Food'), '2026-01', HALF);
		expect(() => checkBackup(sqlite3, toImage(sqlite3, db))).not.toThrow();
	});
});
