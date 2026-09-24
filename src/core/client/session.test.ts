import { describe, it, expect, afterEach } from 'vitest';
import { createTestDb } from '$db/testing';
import { DomainError } from '$domain/errors';
import { DEMO_FILE, isDemoOpen, openDemo, requestDemo } from './demo';
import { collapsedKey, isBudgetFile, loadRegistry, newBudgetFile } from './registry';
import { RpcError } from './rpc';
import {
	createBudget,
	deleteBudget,
	openLastBudget,
	planRestore,
	restoreAll,
	restoreBackup,
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

	it('opens the demo while one is running, without registering it', async () => {
		const { api, store } = await setup();
		requestDemo(store);
		const result = await openLastBudget(api, store);
		expect(result).toMatchObject({ kind: 'ready', file: DEMO_FILE });
		expect(loadRegistry(store).budgets).toEqual([]);
	});

	it('deletes the demo file once the demo has ended', async () => {
		const { api, store, files } = await setup();
		requestDemo(store);
		await openLastBudget(api, store);
		// Leaving for the welcome page only clears the flag; the file goes on the next start.
		store.removeItem('moneta.demo');

		expect(await openLastBudget(api, store)).toEqual({ kind: 'onboarding' });
		expect([...files.keys()]).not.toContain(DEMO_FILE);
	});
});

describe('leaving the demo', () => {
	it('is what creating a real budget does', async () => {
		const { api, store } = await setup();
		await openDemo(api, store);
		await createBudget(api, store, HOME);
		expect(isDemoOpen(store)).toBe(false);
	});

	it('is what switching to a real budget does', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		requestDemo(store);
		await openLastBudget(api, store);

		await switchBudget(api, store, file);
		expect(isDemoOpen(store)).toBe(false);
	});
});

describe('createBudget', () => {
	it('creates a budget without an account', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, { ...HOME, account: undefined });
		expect(await api.accounts.list()).toEqual([]);
		expect(loadRegistry(store).budgets).toEqual([{ file, name: 'Home' }]);
	});

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

	it("forgets the deleted budget's collapsed groups and nothing else", async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		store.setItem(collapsedKey(home.file), '["g1"]');
		store.setItem(collapsedKey(work.file), '["g2"]');
		await deleteBudget(api, store, home.file, work.file);
		expect(store.getItem(collapsedKey(home.file))).toBeNull();
		expect(store.getItem(collapsedKey(work.file))).toBe('["g2"]');
	});
});

/** The open budget file as a `.moneta` backup. */
async function backUp(api: SessionApi, file: string): Promise<Uint8Array> {
	return (await api.system.exportBackup([file])).bytes;
}

describe('planRestore', () => {
	const ID = '0190a000-0000-7000-8000-00000000000a';
	const FILE = newBudgetFile(ID);

	it('replaces budgets that exist when asked to, and adds the others under their own ids', () => {
		const budgets = [
			{ index: 0, id: ID, name: 'Home' },
			{ index: 1, id: '0190a000-0000-7000-8000-00000000000b', name: 'Trip' }
		];
		expect(planRestore(budgets, [FILE], true)).toEqual([
			{ index: 0, file: FILE, name: 'Home', replaces: true },
			{ index: 1, file: newBudgetFile(budgets[1].id), name: 'Trip', replaces: false }
		]);
	});

	it('adds budgets that exist as new files when not replacing, and legacy ones always', () => {
		const [home, legacy] = planRestore(
			[
				{ index: 0, id: ID, name: 'Home' },
				{ index: 1, id: null, name: 'Old' }
			],
			[FILE],
			false
		);
		expect(home).toMatchObject({ index: 0, name: 'Home', replaces: false });
		expect(legacy).toMatchObject({ index: 1, name: 'Old', replaces: false });
		expect(new Set([home.file, legacy.file, FILE]).size).toBe(3);
		expect([home.file, legacy.file].every(isBudgetFile)).toBe(true);
	});
});

describe('restoreBackup', () => {
	it('replaces the open budget with its backup, keeping it as a saved copy', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const backup = await backUp(api, file);
		await api.meta.update({ name: 'Changed' });
		const { budgets } = await api.system.inspectBackup(backup);
		const plan = planRestore(budgets, await api.system.listFiles(), true);
		const restored = await restoreBackup(api, store, backup, plan, file);
		expect(restored).toMatchObject({ file, meta: { name: 'Home' } });
		expect([...files.keys()].filter(isBudgetFile)).toEqual([file]);
		expect(loadRegistry(store)).toEqual({ budgets: [{ file, name: 'Home' }], lastOpened: file });
		const [copy] = await api.system.listCopies(file);
		const undone = await restoreAll(api, store, await api.system.readCopy(copy.name));
		expect(undone.meta.name).toBe('Changed');
		expect(undone.file).not.toBe(file);
	});

	it('adds budgets and opens the first one', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const backup = (await api.system.exportBackup([home.file, work.file])).bytes;
		await deleteBudget(api, store, home.file, work.file);
		await deleteBudget(api, store, work.file, work.file);

		const restored = await restoreAll(api, store, backup);
		expect(restored).toMatchObject({ file: home.file, meta: { name: 'Home' } });
		expect(loadRegistry(store)).toEqual({
			budgets: [
				{ file: home.file, name: 'Home' },
				{ file: work.file, name: 'Work' }
			],
			lastOpened: home.file
		});
		const [account] = await api.accounts.list();
		expect(account).toMatchObject({ name: 'Checking', balance: 150000 });
	});

	it('restores a legacy .sqlite backup as a new budget', async () => {
		const { api, store } = await setup();
		const { file } = await createBudget(api, store, HOME);
		// A saved copy is a plain .sqlite file, like a backup made before .moneta.
		const legacy = await api.system.readCopy((await saveCopyOf(api, store, file)).name);
		const restored = await restoreAll(api, store, legacy, file);
		expect(restored.file).not.toBe(file);
		expect(loadRegistry(store).budgets.map((b) => b.file)).toEqual([file, restored.file]);
	});

	it('leaves everything alone when the backup is invalid', async () => {
		const { api, store, files } = await setup();
		const { file } = await createBudget(api, store, HOME);
		const err = await restoreAll(api, store, new Uint8Array(512), file).catch((e) => e);
		expect(err).toMatchObject({ code: 'BACKUP_NOT_RECOGNIZED' });
		expect([...files.keys()]).toEqual([file]);
		expect((await api.meta.get()).name).toBe('Home');
	});

	it('reopens the open budget and removes added files if the restored one cannot be opened', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const backup = await backUp(api, work.file);
		await deleteBudget(api, store, work.file, home.file);
		await switchBudget(api, store, home.file);
		const failing: SessionApi = {
			meta: api.meta,
			accounts: api.accounts,
			demo: api.demo,
			system: {
				...pick(api.system),
				open: (name: string) =>
					name === home.file ? api.system.open(name) : Promise.reject(new Error('disk error'))
			}
		};
		await expect(restoreAll(failing, store, backup, home.file)).rejects.toThrow('disk error');
		expect([...files.keys()]).toEqual([home.file]);
		expect((await api.meta.get()).name).toBe('Home');
	});
});

/** Saves a copy of `file` by replacing it with its own backup, and returns that copy. */
async function saveCopyOf(api: SessionApi, store: ReturnType<typeof memoryStore>, file: string) {
	const backup = await backUp(api, file);
	const { budgets } = await api.system.inspectBackup(backup);
	await restoreBackup(api, store, backup, planRestore(budgets, [file], true), file);
	const [copy] = await api.system.listCopies(file);
	return copy;
}

/** An api whose `open` fails like a file that isn't a database, for the files in `damaged`. */
function withDamaged(api: SessionApi, damaged: Set<string>): SessionApi {
	return {
		meta: api.meta,
		accounts: api.accounts,
		demo: api.demo,
		system: {
			...pick(api.system),
			open: (name: string) =>
				damaged.has(name)
					? Promise.reject(new RpcError('INTERNAL', 'SQLITE_NOTADB: file is not a database'))
					: api.system.open(name)
		}
	};
}

describe('openLastBudget with damaged files', () => {
	it('skips a damaged file it does not know and opens the next one', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const fresh = memoryStore();

		const result = await openLastBudget(withDamaged(api, new Set([home.file])), fresh);
		expect(result).toMatchObject({
			kind: 'ready',
			file: work.file,
			skipped: [{ file: home.file, message: expect.stringContaining('NOTADB') }]
		});
		expect(files.has(home.file)).toBe(true);
		// The damaged file stays listed, under its file name, so Settings can still delete it.
		expect(loadRegistry(fresh)).toEqual({
			budgets: [
				{ file: home.file, name: home.file },
				{ file: work.file, name: 'Work' }
			],
			lastOpened: work.file
		});
	});

	it('falls back to another budget when the one used last is damaged', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });

		const result = await openLastBudget(withDamaged(api, new Set([work.file])), store);
		expect(result).toMatchObject({
			kind: 'ready',
			file: home.file,
			skipped: [{ file: work.file, name: 'Work' }]
		});
		expect(loadRegistry(store).lastOpened).toBe(home.file);
		expect(loadRegistry(store).budgets).toContainEqual({ file: work.file, name: 'Work' });
	});

	it('reports the damaged files, and deletes none, when no budget can be opened', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const damaged = new Set([home.file, work.file]);

		const result = await openLastBudget(withDamaged(api, damaged), store);
		expect(result).toMatchObject({
			kind: 'unreadable',
			budgets: [
				{ file: work.file, name: 'Work' },
				{ file: home.file, name: 'Home' }
			]
		});
		expect(files.size).toBe(2);
	});

	it('never deletes a file it could not read just to tell whether it was initialized', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);

		const result = await openLastBudget(withDamaged(api, new Set([home.file])), memoryStore());
		expect(result).toMatchObject({ kind: 'unreadable', budgets: [{ file: home.file }] });
		expect(files.has(home.file)).toBe(true);
	});

	it('still stops for failures that are not about one file', async () => {
		const { api, store } = await setup();
		await createBudget(api, store, HOME);
		const failing: SessionApi = {
			meta: api.meta,
			accounts: api.accounts,
			demo: api.demo,
			system: {
				...pick(api.system),
				open: () => Promise.reject(new RpcError('STORAGE_UNAVAILABLE', 'no OPFS'))
			}
		};
		await expect(openLastBudget(failing, store)).rejects.toMatchObject({
			code: 'STORAGE_UNAVAILABLE'
		});
	});

	it('lets damaged files be deleted one by one', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const broken = withDamaged(api, new Set([home.file, work.file]));
		expect(await openLastBudget(broken, store)).toMatchObject({ kind: 'unreadable' });

		// Nothing is open, so the file being deleted stands in for the open one.
		expect(await deleteBudget(broken, store, work.file, work.file)).toMatchObject({
			kind: 'unreadable',
			budgets: [{ file: home.file }]
		});
		expect([...files.keys()]).toEqual([home.file]);
		expect(await deleteBudget(broken, store, home.file, home.file)).toEqual({ kind: 'onboarding' });
		expect(files.size).toBe(0);
	});

	it('opens the next budget once a damaged one is deleted', async () => {
		const { api, store } = await setup();
		const home = await createBudget(api, store, HOME);
		const work = await createBudget(api, store, { ...HOME, name: 'Work' });
		const broken = withDamaged(api, new Set([work.file]));

		expect(await deleteBudget(broken, store, work.file, work.file)).toMatchObject({
			kind: 'ready',
			file: home.file
		});
	});

	it('restores a backup next to damaged budgets, never over them', async () => {
		const { api, store, files } = await setup();
		const home = await createBudget(api, store, HOME);
		const backup = await backUp(api, home.file);
		const broken = withDamaged(api, new Set([home.file]));
		expect(await openLastBudget(broken, store)).toMatchObject({ kind: 'unreadable' });

		const restored = await restoreAll(broken, store, backup);
		expect(restored.meta.name).toBe('Home');
		expect(files.size).toBe(2);
		expect(loadRegistry(store).lastOpened).toBe(restored.file);
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
		listCopies: system.listCopies,
		readCopy: system.readCopy,
		exportBackup: system.exportBackup,
		markBackedUp: system.markBackedUp,
		inspectBackup: system.inspectBackup,
		restoreBackup: system.restoreBackup,
		backupEncryption: system.backupEncryption,
		setBackupEncryption: system.setBackupEncryption,
		clearBackupEncryption: system.clearBackupEncryption,
		checkBackupPassword: system.checkBackupPassword,
		isEncryptedBackup: system.isEncryptedBackup,
		unlockBackup: system.unlockBackup
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
