import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '$lib/db/testing';
import { DomainError } from '$lib/domain/errors';
import { loadRegistry, newBudgetFile } from './registry';
import { RpcError } from './rpc';
import { createBudget, openLastBudget, startupError, type NewBudget } from './session';
import { createTestClient, memoryStore } from './testing';

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

function setup() {
	const test = createTestClient();
	clients.push(test);
	return { ...test, api: test.client.api, store: memoryStore() };
}

const HOME: NewBudget = {
	name: 'Home',
	currency: 'BRL',
	locale: 'pt-BR',
	groups: [{ name: 'Everyday', categories: ['Food'] }],
	account: {
		name: 'Checking',
		type: 'checking',
		onBudget: true,
		startingBalance: 150000,
		startingDate: '2026-09-01'
	}
};

describe('openLastBudget', () => {
	it('starts onboarding when there is no budget yet', async () => {
		const { api, store } = setup();
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
	});

	it('reopens the budget created last', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
		await api.system.close();
		const result = await openLastBudget(api, store);
		expect(result).toMatchObject({ kind: 'ready', file, meta: { name: 'Home', currency: 'BRL' } });
		expect(loadRegistry(store)).toEqual({ budgets: [{ file, name: 'Home' }], lastOpened: file });
	});

	it('rebuilds a lost registry from the budget files', async () => {
		const { api, store } = setup();
		const { file } = await createBudget(api, store, HOME);
		const fresh = memoryStore();
		expect(await openLastBudget(api, fresh)).toMatchObject({ kind: 'ready', file });
		expect(loadRegistry(fresh).budgets).toEqual([{ file, name: 'Home' }]);
	});

	it('deletes files left behind by an interrupted onboarding', async () => {
		const { api, store, files } = setup();
		files.set(newBudgetFile(), await createTestDb());
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
		expect(files.size).toBe(0);
	});
});

describe('createBudget', () => {
	it('creates the budget, its categories and its first account', async () => {
		const { api, store } = setup();
		const { file, meta } = await createBudget(api, store, HOME);
		expect(meta.name).toBe('Home');
		expect(loadRegistry(store).lastOpened).toBe(file);
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
		const tree = await api.categories.tree();
		expect(tree.map((g) => g.name)).toContain('Everyday');
	});

	it('removes the new file when setup fails', async () => {
		const { api, store, files } = setup();
		const err = await createBudget(api, store, { ...HOME, currency: 'XYZ' }).catch((e) => e);
		expect(err).toMatchObject({ code: 'INVALID_INPUT' });
		expect(files.size).toBe(0);
		expect(loadRegistry(store).budgets).toEqual([]);
	});
});

describe('startupError', () => {
	it('maps failures to the full-screen startup messages', () => {
		expect(startupError(new RpcError('STORAGE_UNAVAILABLE', 'no OPFS')).code).toBe(
			'STORAGE_UNAVAILABLE'
		);
		expect(startupError(new DomainError('SCHEMA_TOO_NEW')).code).toBe('SCHEMA_TOO_NEW');
		expect(startupError(new RpcError('INTERNAL', 'QuotaExceededError: full')).code).toBe(
			'QUOTA_EXCEEDED'
		);
		expect(startupError(new Error('boom'))).toEqual({ code: 'INTERNAL', message: 'boom' });
	});
});
