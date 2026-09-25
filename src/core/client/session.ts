import type { BackupBudgetInfo, ClientApi, RestorePick } from '$db/api';
import { DomainError } from '$domain/errors';
import type { CreateAccountInput } from '$db/repos/accounts';
import type { BudgetMeta, InitBudgetInput, MetaPatch } from '$db/repos/meta';
import { endDemo, isDemoOpen, openDemo, sweepDemo } from './demo';
import {
	collapsedKey,
	LAST_ACCOUNT_KEY,
	loadRegistry,
	markOpened,
	newBudgetFile,
	pickBudget,
	reconcile,
	removeBudget,
	reportsLayoutKey,
	saveRegistry,
	upsertBudget,
	type KeyValueStore
} from './registry';

export type SessionApi = Pick<ClientApi, 'system' | 'meta' | 'accounts' | 'demo'>;

/** A budget file that couldn't be opened, and why. The file itself is left as it was. */
export interface UnreadableBudget {
	file: string;
	/** The budget's name, or the file name when the registry never learned it. */
	name: string;
	message: string;
}

export type OpenResult =
	| { kind: 'onboarding' }
	| { kind: 'ready'; file: string; meta: BudgetMeta; skipped?: UnreadableBudget[] }
	| { kind: 'unreadable'; budgets: UnreadableBudget[] };

/**
 * Whether a failure to open a file is about that file (damaged, not a database) rather than about
 * the storage, the worker or the app version, which no other file would fare better against.
 */
function isFileFailure(err: unknown): boolean {
	return startupError(err).code === 'INTERNAL';
}

/**
 * Opens the budget used last, or the demo when one is running. The registry is repaired from the
 * files that really exist: unknown files get their name from their meta, and files left behind by
 * an interrupted onboarding (never initialized) are deleted.
 *
 * A file that can't be read is skipped, never deleted: the next budget is opened and the file is
 * reported in `skipped`. When none can be opened but some were skipped, the result is
 * `unreadable` instead of onboarding, so the files can be restored or deleted deliberately.
 */
export async function openLastBudget(api: SessionApi, store: KeyValueStore): Promise<OpenResult> {
	const files = await api.system.listFiles();
	if (isDemoOpen(store)) return { kind: 'ready', ...(await openDemo(api, store)) };
	// The demo ended on the welcome page, which has no worker of its own to clean up with.
	await sweepDemo(api, files);
	const reconciled = reconcile(loadRegistry(store), files);
	let registry = reconciled.registry;
	const unreadable: UnreadableBudget[] = [];
	const skip = (file: string, name: string, err: unknown) => {
		if (!isFileFailure(err)) throw err;
		console.warn(`Moneta couldn't open ${file}`, err);
		unreadable.push({ file, name, message: startupError(err).message });
	};
	for (const file of reconciled.unnamed) {
		try {
			await api.system.open(file);
			if (await api.meta.isInitialized()) {
				registry = upsertBudget(registry, { file, name: (await api.meta.get()).name });
			} else {
				await api.system.deleteFile(file);
			}
		} catch (err) {
			skip(file, file, err);
			// Listed by file name so that Settings can still delete it.
			registry = upsertBudget(registry, { file, name: file });
		}
	}
	const failed = new Set(unreadable.map((u) => u.file));
	const remaining = registry.budgets.filter((b) => !failed.has(b.file));
	const first = pickBudget({ ...registry, budgets: remaining });
	const candidates = remaining
		.filter((b) => b.file === first)
		.concat(remaining.filter((b) => b.file !== first));
	for (const { file, name } of candidates) {
		try {
			await api.system.open(file);
			const meta = await api.meta.get();
			saveRegistry(store, markOpened(upsertBudget(registry, { file, name: meta.name }), file));
			return { kind: 'ready', file, meta, ...(unreadable.length > 0 && { skipped: unreadable }) };
		} catch (err) {
			skip(file, name, err);
		}
	}
	saveRegistry(store, registry);
	await api.system.close();
	return unreadable.length > 0
		? { kind: 'unreadable', budgets: unreadable }
		: { kind: 'onboarding' };
}

export interface NewBudget extends InitBudgetInput {
	/** Left out to start with no account. */
	account?: CreateAccountInput;
}

/** Creates a budget file with its categories and, optionally, a first account, and leaves it open. */
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
		if (account) await api.accounts.create(account);
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
 * onboarding when none is left; deleting another budget returns null. When no budget is open
 * because the file couldn't be opened, pass that file as `openFile` to go on to the next one.
 */
export async function deleteBudget(
	api: SessionApi,
	store: KeyValueStore,
	file: string,
	openFile: string
): Promise<OpenResult | null> {
	await api.system.deleteFile(file);
	saveRegistry(store, removeBudget(loadRegistry(store), file));
	forgetBudget(store, file, file === openFile);
	return file === openFile ? openLastBudget(api, store) : null;
}

/**
 * Drops what this device remembers about a budget file that is gone: its collapsed groups, its
 * report layout, and the last account used when it was the open budget. Only conveniences.
 */
function forgetBudget(store: KeyValueStore, file: string, wasOpen: boolean): void {
	try {
		store.removeItem(collapsedKey(file));
		store.removeItem(reportsLayoutKey(file));
		if (wasOpen) store.removeItem(LAST_ACCOUNT_KEY);
	} catch {
		// Blocked storage has nothing to forget.
	}
}

/** What the app keeps in localStorage beyond its `moneta.` keys: the language and the theme. */
const PREFERENCE_KEYS = ['PARAGLIDE_LOCALE', 'mode-watcher-mode', 'mode-watcher-theme'];

/**
 * Deletes everything Moneta keeps on this device: every budget file and saved copy, the backup
 * key, and what localStorage remembers (the budget list, conveniences, language and theme).
 */
export async function wipeDevice(
	api: Pick<SessionApi, 'system'>,
	store: KeyValueStore & Pick<Storage, 'length' | 'key'>
): Promise<void> {
	await api.system.wipe();
	try {
		const keys = Array.from({ length: store.length }, (_, i) => store.key(i));
		for (const key of keys)
			if (key && (key.startsWith('moneta.') || PREFERENCE_KEYS.includes(key)))
				store.removeItem(key);
	} catch {
		// Blocked storage holds nothing to delete.
	}
}

/** A budget of a backup, the file it will be restored into, and whether that file exists. */
export interface PlannedRestore extends RestorePick {
	name: string;
	replaces: boolean;
}

/**
 * Where each budget of a backup goes. A budget keeps its own file (`budget-<id>.sqlite3`): one
 * that exists is replaced when `replace` is set, else it is added under a new file, as are
 * budgets from legacy backups, which have no id.
 */
export function planRestore(
	budgets: BackupBudgetInfo[],
	existing: readonly string[],
	replace: boolean
): PlannedRestore[] {
	return budgets.map(({ index, id, name }) => {
		const own = id === null ? null : newBudgetFile(id);
		const exists = own !== null && existing.includes(own);
		if (own && exists && replace) return { index, file: own, name, replaces: true };
		return { index, file: own && !exists ? own : newBudgetFile(), name, replaces: false };
	});
}

/** The files a restore that stopped partway (RESTORE_PARTIAL) had already written. */
export function partlyRestored(err: unknown): string[] {
	const { code, details } = (err ?? {}) as { code?: unknown; details?: { restored?: unknown } };
	const restored = code === 'RESTORE_PARTIAL' ? details?.restored : undefined;
	return Array.isArray(restored) ? restored.filter((f): f is string => typeof f === 'string') : [];
}

/**
 * Restores budgets from a backup (its bytes, or the token `inspectBackup` gave for it) as
 * `planRestore` planned them, and opens one: `openFile` when it
 * was replaced, else the first restored. The worker checks the backup first, so an invalid one
 * changes nothing. If the budget to open can't be opened, the files that were added are deleted
 * and `openFile` is opened again.
 */
export async function restoreBackup(
	api: SessionApi,
	store: KeyValueStore,
	backup: Uint8Array | string,
	plan: PlannedRestore[],
	openFile?: string
): Promise<{ file: string; meta: BudgetMeta }> {
	if (plan.length === 0) throw new DomainError('INVALID_INPUT', 'Nothing to restore');
	const picks = plan.map(({ index, file }) => ({ index, file }));
	try {
		if (typeof backup === 'string') await api.system.restoreInspected(backup, picks);
		else await api.system.restoreBackup(backup, picks);
	} catch (err) {
		// Budgets written before a failure are there: list them, as startup would.
		const restored = partlyRestored(err);
		let registry = loadRegistry(store);
		for (const p of plan.filter((p) => restored.includes(p.file)))
			registry = upsertBudget(registry, { file: p.file, name: p.name });
		saveRegistry(store, registry);
		throw err;
	}
	const file = plan.find((p) => p.replaces && p.file === openFile)?.file ?? plan[0].file;
	let meta: BudgetMeta;
	try {
		await api.system.open(file);
		meta = await api.meta.get();
	} catch (err) {
		for (const added of plan.filter((p) => !p.replaces))
			await api.system.deleteFile(added.file).catch(() => {});
		if (openFile) await api.system.open(openFile).catch(() => {});
		throw err;
	}
	endDemo(store);
	let registry = loadRegistry(store);
	for (const p of plan) registry = upsertBudget(registry, { file: p.file, name: p.name });
	saveRegistry(store, markOpened(upsertBudget(registry, { file, name: meta.name }), file));
	return { file, meta };
}

/**
 * Restores every budget of a backup and opens the first. Budgets that exist are replaced only
 * with `replace`; otherwise they are added next to the ones there, which stay untouched.
 */
export async function restoreAll(
	api: SessionApi,
	store: KeyValueStore,
	bytes: Uint8Array,
	openFile?: string,
	replace: boolean = false
): Promise<{ file: string; meta: BudgetMeta }> {
	const { token, budgets } = await api.system.inspectBackup(bytes);
	const plan = planRestore(budgets, await api.system.listFiles(), replace);
	return restoreBackup(api, store, token, plan, openFile);
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
