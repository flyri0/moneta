import type { ClientApi } from '$lib/db/api';
import type { CreateAccountInput } from '$lib/db/repos/accounts';
import type { BudgetMeta, InitBudgetInput } from '$lib/db/repos/meta';
import {
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';

export type SessionApi = Pick<ClientApi, 'system' | 'meta' | 'accounts'>;

export type OpenResult = { kind: 'onboarding' } | { kind: 'ready'; file: string; meta: BudgetMeta };

/**
 * Opens the budget used last. The registry is repaired from the files that really exist:
 * unknown files get their name from their meta, and files left behind by an interrupted
 * onboarding (never initialized) are deleted.
 */
export async function openLastBudget(api: SessionApi, store: KeyValueStore): Promise<OpenResult> {
	const reconciled = reconcile(loadRegistry(store), await api.system.listFiles());
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
	saveRegistry(
		store,
		markOpened(upsertBudget(loadRegistry(store), { file, name: meta.name }), file)
	);
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
