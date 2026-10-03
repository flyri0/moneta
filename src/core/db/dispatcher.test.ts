import { describe, it, expect, vi } from 'vitest';
import { DomainError } from '$domain/errors';
import { createDispatcher } from './dispatcher';
import { categoryId, createBudgetDb, loadSqlite } from './testing';
import { run } from './connection';
import { api, type SystemApi } from './api';
import { createAccount } from './repos/accounts';
import { getMeta } from './repos/meta';
import { createTransaction } from './repos/transactions';

function fakeSystem(): { system: SystemApi; opened: string[] } {
	const opened: string[] = [];
	return {
		opened,
		system: {
			open: async (name) => void opened.push(name),
			close: () => {},
			listFiles: () => ['a.sqlite3'],
			deleteFile: () => {},
			release: () => {},
			wipe: async () => {},
			listCopies: () => [],
			readCopy: () => new Uint8Array(),
			exportBackup: async () => ({ bytes: new Uint8Array(), skipped: [], encrypted: false }),
			markBackedUp: () => {},
			inspectBackup: async () => ({ token: 't', createdAt: null, budgets: [] }),
			restoreBackup: async () => {},
			restoreInspected: async () => {},
			backupEncryption: async () => ({ on: false }),
			setBackupEncryption: async () => {},
			clearBackupEncryption: async () => {},
			checkBackupPassword: async () => false,
			isEncryptedBackup: () => false,
			unlockBackup: async () => new Uint8Array()
		}
	};
}

describe('createDispatcher', () => {
	it('runs read handlers without reporting changes', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({ id: 1, method: 'meta.get', args: [] });
		expect(res).toMatchObject({ id: 1, ok: true, changed: [], data: { name: 'Test Budget' } });
	});

	it('runs write handlers and reports changed tables', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({
			id: 2,
			method: 'accounts.create',
			args: [
				{
					name: 'Bank',
					type: 'checking',
					onBudget: true,
					startingBalance: 0,
					startingDate: '2026-01-01'
				}
			]
		});
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(typeof res.data).toBe('string');
			expect(res.changed).toContain('accounts');
		}
	});

	it('maps domain errors to typed error payloads', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({ id: 3, method: 'budget.month', args: ['bad'] });
		expect(res).toEqual({
			id: 3,
			ok: false,
			error: expect.objectContaining({ code: 'INVALID_INPUT' })
		});
	});

	it('maps unexpected errors to INTERNAL', async () => {
		const db = await createBudgetDb();
		db.exec('DROP TABLE budget_assignments');
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({ id: 4, method: 'budget.month', args: ['2026-01'] });
		expect(res).toMatchObject({ ok: false, error: { code: 'INTERNAL' } });
	});

	it('rejects unknown methods, including prototype keys', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		for (const method of [
			'nope.x',
			'meta.nope',
			'meta.toString',
			'system.nope',
			'constructor.name',
			'__proto__.x',
			'__proto__.hasOwnProperty'
		]) {
			const res = await dispatch({ id: 5, method, args: [] });
			expect(res).toMatchObject({ ok: false, error: { code: 'UNKNOWN_METHOD' } });
		}
	});

	it('rejects arguments of the wrong shape as INVALID_INPUT without running the handler', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const spy = vi.spyOn(api.transactions.create, 'fn');
		try {
			for (const args of [['texto'], [null], [[]], [], [{}, 'extra']]) {
				const res = await dispatch({ id: 10, method: 'transactions.create', args });
				expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
			}
			const notArray = { id: 11, method: 'meta.get', args: 'x' as unknown as unknown[] };
			expect(await dispatch(notArray)).toMatchObject({
				ok: false,
				error: { code: 'INVALID_INPUT' }
			});
			expect(spy).not.toHaveBeenCalled();
		} finally {
			spy.mockRestore();
		}
	});

	it('accepts calls that leave optional arguments out', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		expect(await dispatch({ id: 12, method: 'transactions.list', args: [] })).toMatchObject({
			ok: true
		});
		expect(
			await dispatch({ id: 13, method: 'transactions.list', args: [undefined] })
		).toMatchObject({ ok: true });
	});

	it('rejects system calls with arguments of the wrong shape', async () => {
		const { system, opened } = fakeSystem();
		const dispatch = createDispatcher({ system, getDb: () => null });
		for (const [method, args] of [
			['system.open', [42]],
			['system.open', []],
			['system.inspectBackup', ['not bytes']],
			['system.restoreBackup', [new Uint8Array(), 'not an array']],
			['system.listFiles', ['extra']]
		] as const) {
			const res = await dispatch({ id: 14, method, args: [...args] });
			expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
		}
		expect(opened).toEqual([]);
	});

	it('describes the arguments of every handler', () => {
		for (const group of Object.values(api)) {
			for (const handler of Object.values(group)) {
				expect(handler.args.length).toBeGreaterThanOrEqual(handler.fn.length - 1);
			}
		}
	});

	it('runs each write call as one SQL transaction', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		// A write handler that changes a row and then fails must leave nothing behind.
		const spy = vi.spyOn(api.meta.update, 'fn').mockImplementation((d) => {
			run(d, "UPDATE meta SET value = 'Half-written' WHERE key = 'name'");
			throw new DomainError('INVALID_INPUT');
		});
		try {
			const res = await dispatch({ id: 7, method: 'meta.update', args: [{}] });
			expect(res).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
		} finally {
			spy.mockRestore();
		}
		expect(getMeta(db).name).toBe('Test Budget');
	});

	it('reports no changes for a write that changed no row', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({ id: 8, method: 'schedules.enterDue', args: ['2026-01-01'] });
		expect(res).toMatchObject({ ok: true, changed: [] });
	});

	it('requires an open database for data methods', async () => {
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => null });
		const res = await dispatch({ id: 6, method: 'meta.get', args: [] });
		expect(res).toMatchObject({ ok: false, error: { code: 'NO_DATABASE_OPEN' } });
	});

	it('routes system methods and reports that everything changed on open', async () => {
		const { system, opened } = fakeSystem();
		const dispatch = createDispatcher({ system, getDb: () => null });
		const res = await dispatch({ id: 7, method: 'system.open', args: ['b.sqlite3'] });
		expect(opened).toEqual(['b.sqlite3']);
		expect(res).toMatchObject({ ok: true, data: null });
		if (res.ok) expect(res.changed).toContain('transactions');
		expect(await dispatch({ id: 8, method: 'system.listFiles', args: [] })).toMatchObject({
			ok: true,
			data: ['a.sqlite3'],
			changed: []
		});
	});

	it('routes release, which changes no tables', async () => {
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => null });
		expect(await dispatch({ id: 9, method: 'system.release', args: [] })).toMatchObject({
			ok: true,
			changed: []
		});
	});
});

describe('undo', () => {
	async function setUp() {
		const db = await createBudgetDb();
		const sqlite3 = await loadSqlite();
		const { system } = fakeSystem();
		const dispatch = createDispatcher({ system, getDb: () => db, sqlite3 });
		const move = (id: number, amount: number) =>
			dispatch({
				id,
				method: 'budget.moveMoney',
				args: [
					{
						fromCategoryId: categoryId(db, 'Food'),
						toCategoryId: categoryId(db, 'Fun'),
						month: '2026-01',
						amount
					}
				]
			});
		const assigned = () =>
			db.selectValue(
				'SELECT COALESCE(SUM(assigned), 0) FROM budget_assignments WHERE category_id = ?',
				[categoryId(db, 'Fun')]
			);
		const undo = (id: number, token: unknown) =>
			dispatch({ id, method: 'undo.apply', args: [token] });
		return { db, dispatch, move, assigned, undo };
	}

	it('returns a token for undoable writes only, and takes the write back with it', async () => {
		const { dispatch, move, assigned, undo } = await setUp();
		const plain = await dispatch({ id: 1, method: 'meta.update', args: [{ name: 'Home' }] });
		expect(plain).not.toHaveProperty('undo');

		const res = await move(2, 500);
		expect(assigned()).toBe(500);
		if (!res.ok) throw new Error('move failed');
		expect(typeof res.undo).toBe('string');

		expect(await undo(3, res.undo)).toEqual({
			id: 3,
			ok: true,
			data: null,
			changed: ['budget_assignments']
		});
		expect(assigned()).toBe(0);
		// Once taken back, it can't be taken back again.
		expect(await undo(4, res.undo)).toMatchObject({
			ok: false,
			error: { code: 'UNDO_UNAVAILABLE' }
		});
	});

	it('keeps only the latest undoable write', async () => {
		const { move, assigned, undo } = await setUp();
		const first = await move(1, 500);
		const second = await move(2, 300);
		if (!first.ok || !second.ok) throw new Error('move failed');
		expect(await undo(3, first.undo)).toMatchObject({ error: { code: 'UNDO_UNAVAILABLE' } });
		expect(await undo(4, second.undo)).toMatchObject({ ok: true });
		expect(assigned()).toBe(500);
	});

	it('forgets it when another budget opens', async () => {
		const { dispatch, move, undo } = await setUp();
		const res = await move(1, 500);
		if (!res.ok) throw new Error('move failed');
		await dispatch({ id: 2, method: 'system.open', args: ['b.sqlite3'] });
		expect(await undo(3, res.undo)).toMatchObject({ error: { code: 'UNDO_UNAVAILABLE' } });
	});

	it('refuses to bring a transaction back into an account closed since', async () => {
		const { db, dispatch } = await setUp();
		const account = createAccount(db, {
			name: 'Wallet',
			type: 'cash',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		const spent = createTransaction(db, {
			accountId: account,
			date: '2026-01-05',
			amount: -500,
			categoryId: categoryId(db, 'Food')
		});
		const deleted = await dispatch({ id: 1, method: 'transactions.delete', args: [spent] });
		if (!deleted.ok) throw new Error('delete failed');
		// Its balance is zero without the transaction, so the account closes.
		await dispatch({ id: 2, method: 'accounts.close', args: [account] });
		expect(await dispatch({ id: 3, method: 'undo.apply', args: [deleted.undo] })).toMatchObject({
			ok: false,
			error: { code: 'UNDO_CONFLICT' }
		});
		expect(
			db.selectValue('SELECT COUNT(*) FROM transactions WHERE account_id = ?', [account])
		).toBe(0);
	});

	it('refuses to take back what a later write depends on through a cascade', async () => {
		const { db, dispatch } = await setUp();
		const account = createAccount(db, {
			name: 'Bank',
			type: 'checking',
			onBudget: true,
			startingBalance: 0,
			startingDate: '2026-01-01'
		});
		const line = {
			importId: 'csv:x:1',
			date: '2026-01-05',
			amount: -100,
			payeeName: 'ACME NEW',
			memo: '',
			categoryId: categoryId(db, 'Food'),
			matchId: null
		};
		const imported = await dispatch({
			id: 1,
			method: 'imports.commit',
			args: [account, { lines: [line] }]
		});
		if (!imported.ok) throw new Error('import failed');
		// The rule is written after the import, and deleting its payee would delete it too.
		const rule = { payeeName: 'ACME NEW', kind: 'contains', text: 'acme', categoryId: null };
		expect(await dispatch({ id: 2, method: 'payeeRules.create', args: [rule] })).toMatchObject({
			ok: true
		});
		expect(await dispatch({ id: 3, method: 'undo.apply', args: [imported.undo] })).toMatchObject({
			ok: false,
			error: { code: 'UNDO_CONFLICT' }
		});
		expect(db.selectValue('SELECT COUNT(*) FROM payee_rules')).toBe(1);
		expect(db.selectValue('SELECT COUNT(*) FROM transactions WHERE import_id IS NOT NULL')).toBe(1);
	});

	it('returns no token without the SQLite module', async () => {
		const db = await createBudgetDb();
		const dispatch = createDispatcher({ system: fakeSystem().system, getDb: () => db });
		const res = await dispatch({
			id: 1,
			method: 'budget.moveMoney',
			args: [
				{
					fromCategoryId: categoryId(db, 'Food'),
					toCategoryId: categoryId(db, 'Fun'),
					month: '2026-01',
					amount: 500
				}
			]
		});
		expect(res).toMatchObject({ ok: true });
		expect(res).not.toHaveProperty('undo');
	});
});
