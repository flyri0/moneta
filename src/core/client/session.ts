import type { ClientApi } from '$db/api';
import type { CreateAccountInput } from '$db/repos/accounts';
import type { BudgetMeta, InitBudgetInput, MetaPatch } from '$db/repos/meta';
import { endDemo, isDemoOpen, openDemo, sweepDemo } from './demo';
import {
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	removeBudget,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';

export type SessionApi = Pick<ClientApi, 'system' | 'meta' | 'accounts' | 'demo'>;

export type OpenResult = { kind: 'onboarding' } | { kind: 'ready'; file: string; meta: BudgetMeta };

/**
 * Opens the budget used last, or the demo when one is running. The registry is repaired from the
 * files that really exist: unknown files get their name from their meta, and files left behind by
 * an interrupted onboarding (never initialized) are deleted.
 */
export async function openLastBudget(api: SessionApi, store: KeyValueStore): Promise<OpenResult> {
	const files = await api.system.listFiles();
	if (isDemoOpen(store)) return { kind: 'ready', ...(await openDemo(api, store)) };
	// The demo ended on the welcome page, which has no worker of its own to clean up with.
	await sweepDemo(api, files);
	const reconciled = reconcile(loadRegistry(store), files);
	let registry = reconciled.registry;
	for (const file of reconciled.unnamed) {
		await api.system.open(file);
		if (await api.meta.isInitialized()) {
			registry = upsertBudget(registry, { file, name: (await api.meta.get()).name });
		} else {
			await api.system.deleteFile(file);
		}
	}
	const file = pickBudget(registry);
	if (!file) {
		saveRegistry(store, registry);
		await api.system.close();
		return { kind: 'onboarding' };
	}
	await api.system.open(file);
	const meta = await api.meta.get();
	saveRegistry(store, markOpened(upsertBudget(registry, { file, name: meta.name }), file));
	return { kind: 'ready', file, meta };
}

export interface NewBudget extends InitBudgetInput {
	account: CreateAccountInput;
}

/** Creates a budget file with its categories and first account, and leaves it open. */
export async function createBudget(
	api: SessionApi,
	store: KeyValueStore,
	input: NewBudget,
	file: string = newBudgetFile()
): Promise<{ file: string; meta: BudgetMeta }> {
	await api.system.open(file);
	try {
		const { account, ...init } = input;
		await api.meta.init(init);
		await api.accounts.create(account);
	} catch (err) {
		await api.system.deleteFile(file).catch(() => {});
		throw err;
	}
	const meta = await api.meta.get();
	endDemo(store);
	saveRegistry(
		store,
		markOpened(upsertBudget(loadRegistry(store), { file, name: meta.name }), file)
	);
	return { file, meta };
}

/** Opens another budget file and remembers it as the last one opened. */
export async function switchBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string
): Promise<{ file: string; meta: BudgetMeta }> {
	await api.system.open(file);
	const meta = await api.meta.get();
	endDemo(store);
	saveRegistry(
		store,
		markOpened(upsertBudget(loadRegistry(store), { file, name: meta.name }), file)
	);
	return { file, meta };
}

/** Changes the open budget's name, currency or locale, keeping the registry's name in step. */
export async function updateBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string,
	patch: MetaPatch
): Promise<void> {
	await api.meta.update(patch);
	const { name } = await api.meta.get();
	saveRegistry(store, upsertBudget(loadRegistry(store), { file, name }));
}

/**
 * Deletes a budget file. Deleting the open budget (`openFile`) opens the next one, or returns
 * onboarding when none is left; deleting another budget returns null.
 */
export async function deleteBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string,
	openFile: string
): Promise<OpenResult | null> {
	await api.system.deleteFile(file);
	saveRegistry(store, removeBudget(loadRegistry(store), file));
	return file === openFile ? openLastBudget(api, store) : null;
}

/**
 * Restores a `.sqlite` backup as a new budget file and opens it. The worker checks the backup
 * first, so an invalid one changes nothing. With `replace`, the open budget (`openFile`) is
 * deleted once the restored one is open. If that fails, `openFile` is opened again.
 */
export async function restoreBudget(
	api: SessionApi,
	store: KeyValueStore,
	bytes: Uint8Array,
	openFile?: string,
	replace: boolean = false
): Promise<{ file: string; meta: BudgetMeta }> {
	const file = newBudgetFile();
	await api.system.importFile(file, bytes);
	let meta: BudgetMeta;
	try {
		await api.system.open(file);
		meta = await api.meta.get();
	} catch (err) {
		await api.system.deleteFile(file).catch(() => {});
		if (openFile) await api.system.open(openFile).catch(() => {});
		throw err;
	}
	endDemo(store);
	let registry = upsertBudget(loadRegistry(store), { file, name: meta.name });
	if (replace && openFile) {
		await api.system.deleteFile(openFile);
		registry = removeBudget(registry, openFile);
	}
	saveRegistry(store, markOpened(registry, file));
	return { file, meta };
}

export type StartupErrorCode =
	'STORAGE_UNAVAILABLE' | 'SCHEMA_TOO_NEW' | 'QUOTA_EXCEEDED' | 'WORKER_FAILED' | 'INTERNAL';

const STARTUP_CODES = new Set<string>(['STORAGE_UNAVAILABLE', 'SCHEMA_TOO_NEW', 'WORKER_FAILED']);

/** Which full-screen message a failure while opening the database deserves. */
export function startupError(err: unknown): { code: StartupErrorCode; message: string } {
	const code = (err as { code?: unknown } | null)?.code;
	const message = err instanceof Error ? err.message : String(err);
	if (typeof code === 'string' && STARTUP_CODES.has(code))
		return { code: code as StartupErrorCode, message };
	if (/quota/i.test(message)) return { code: 'QUOTA_EXCEEDED', message };
	return { code: 'INTERNAL', message };
}
