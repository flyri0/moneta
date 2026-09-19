import { describe, it, expect } from 'vitest';
import { createDispatcher } from './dispatcher';
import { createBudgetDb } from './testing';
import type { SystemApi } from './api';

function fakeSystem(): { system: SystemApi; opened: string[] } {
	const opened: string[] = [];
	return {
		opened,
		system: {
			open: (name) => void opened.push(name),
			close: () => {},
			listFiles: () => ['a.sqlite3'],
			deleteFile: () => {}
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
		for (const method of ['nope.x', 'meta.nope', 'meta.toString', 'system.nope']) {
			const res = await dispatch({ id: 5, method, args: [] });
			expect(res).toMatchObject({ ok: false, error: { code: 'UNKNOWN_METHOD' } });
		}
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
});
