import { describe, it, expect, vi } from 'vitest';
import { DomainError } from '$domain/errors';
import { createDispatcher } from './dispatcher';
import { createBudgetDb } from './testing';
import { run } from './connection';
import { api, type SystemApi } from './api';
import { getMeta } from './repos/meta';

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
			listCopies: () => [],
			readCopy: () => new Uint8Array(),
			exportBackup: async () => ({ bytes: new Uint8Array(), skipped: [], encrypted: false }),
			markBackedUp: () => {},
			inspectBackup: () => ({ token: 't', createdAt: null, budgets: [] }),
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
