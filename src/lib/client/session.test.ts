import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '$lib/db/testing';
import { DomainError } from '$lib/domain/errors';
import { loadRegistry, newBudgetFile } from './registry';
import { RpcError } from './rpc';
import {
	createBudget,
	deleteBudget,
	openLastBudget,
	restoreBudget,
	startupError,
	switchBudget,
	updateBudget,
	type NewBudget,
	type SessionApi
} from './session';
import { createTestClient, memoryStore } from './testing';

const clients: { close(): void }[] = [];
afterEach(() => {
	for (const c of clients.splice(0)) c.close();
});

async function setup() {
	const test = await createTestClient();
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
		const { api, store } = await setup();
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
	});

	it('reopens the budget created last', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		await api.system.close();
		const result = await openLastBudget(api, store);
		expect(result).toMatchObject({ kind: 'ready', file, meta: { name: 'Home', currency: 'BRL' } });
		expect(loadRegistry(store)).toEqual({ budgets: [{ file, name: 'Home' }], lastOpened: file });
	});

	it('rebuilds a lost registry from the budget files', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const fresh = memoryStore();
		expect(await openLastBudget(api, fresh)).toMatchObject({ kind: 'ready', file });
		expect(loadRegistry(fresh).budgets).toEqual([{ file, name: 'Home' }]);
	});

	it('deletes files left behind by an interrupted onboarding', async () => {
		const { api, store, files } = await setup();
		files.set(newBudgetFile(), await createTestDb());
		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
		expect(files.size).toBe(0);
	});
});

describe('createBudget', () => {
	it('creates the budget, its categories and its first account', async () => {
		const { api, store } = await setup();
		const { file, meta } = await createBudget(api, store, HOME);
		expect(meta.name).toBe('Home');
		expect(loadRegistry(store).lastOpened).toBe(file);
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
		const tree = await api.categories.tree();
		expect(tree.map((g) => g.name)).toContain('Everyday');
	});

	it('removes the new file when setup fails', async () => {
		const { api, store, files } = await setup();
		const err = await createBudget(api, store, { ...HOME, currency: 'XYZ' }).catch((e) => e);
		expect(err).toMatchObject({ code: 'INVALID_INPUT' });
		expect(files.size).toBe(0);
		expect(loadRegistry(store).budgets).toEqual([]);
	});
});

describe('switchBudget / updateBudget', () => {
	it('opens another budget and remembers it', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await switchBudget(api, store, home.file)).toMatchObject({
			file: home.file,
			meta: { name: 'Home' }
		});
		expect(loadRegistry(store).lastOpened).toBe(home.file);
	});

	it('renames the open budget in its file and in the registry', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		await updateBudget(api, store, file, { name: 'House', locale: 'en-US' });
		expect(await api.meta.get()).toMatchObject({ name: 'House', locale: 'en-US' });
		expect(loadRegistry(store).budgets).toEqual([{ file, name: 'House' }]);
	});
});

describe('deleteBudget', () => {
	it('deletes another budget and keeps the open one', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await deleteBudget(api, store, home.file, work.file)).toBeNull();
		expect([...files.keys()]).toEqual([work.file]);
		expect(loadRegistry(store).budgets).toEqual([{ file: work.file, name: 'Work' }]);
		expect((await api.meta.get()).name).toBe('Work');
	});

	it('opens the next budget after deleting the open one, or onboarding after the last', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		expect(await deleteBudget(api, store, work.file, work.file)).toMatchObject({
			kind: 'ready',
			file: home.file
		});
		expect(await deleteBudget(api, store, home.file, home.file)).toEqual({ kind: 'onboarding' });
	});
});

describe('restoreBudget', () => {
	it('replaces the open budget with a backup', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const backup = await api.system.exportFile();
		await api.meta.update({ name: 'Changed' });
		const restored = await restoreBudget(api, store, backup, file, true);
		expect(restored.file).not.toBe(file);
		expect(restored.meta.name).toBe('Home');
		expect([...files.keys()]).toEqual([restored.file]);
		expect(loadRegistry(store)).toEqual({
			budgets: [{ file: restored.file, name: 'Home' }],
			lastOpened: restored.file
		});
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
	});

	it('imports a backup as a new budget', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const restored = await restoreBudget(api, store, await api.system.exportFile(), file, false);
		expect(files.size).toBe(2);
		expect(loadRegistry(store).budgets.map((b) => b.file)).toEqual([file, restored.file]);
		expect(loadRegistry(store).lastOpened).toBe(restored.file);
	});

	it('leaves the open budget alone when the backup is invalid', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const err = await restoreBudget(api, store, new Uint8Array(512), file, true).catch((e) => e);
		expect(err).toMatchObject({ code: 'BACKUP_NOT_SQLITE' });
		expect([...files.keys()]).toEqual([file]);
		expect((await api.meta.get()).name).toBe('Home');
	});

	it('reopens the open budget if the restored one cannot be opened', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const backup = await api.system.exportFile();
		const failing: SessionApi = {
			meta: api.meta,
			accounts: api.accounts,
			system: {
				...pick(api.system),
				open: (name: string) =>
					name === file ? api.system.open(name) : Promise.reject(new Error('disk error'))
			}
		};
		await expect(restoreBudget(failing, store, backup, file, true)).rejects.toThrow('disk error');
		expect([...files.keys()]).toEqual([file]);
		expect((await api.meta.get()).name).toBe('Home');
	});
});

/** Copies the system calls off the RPC proxy (a proxy has no own keys to spread). */
function pick(system: SessionApi['system']): SessionApi['system'] {
	return {
		open: system.open,
		close: system.close,
		listFiles: system.listFiles,
		deleteFile: system.deleteFile,
		release: system.release,
		exportFile: system.exportFile,
		importFile: system.importFile
	};
}

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
