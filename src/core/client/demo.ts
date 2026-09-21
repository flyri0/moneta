import type { ClientApi } from '$db/api';
import type { BudgetMeta } from '$db/repos/meta';
import { demoBudget } from '$features/demo/content';
import type { DemoBudgetSeed } from '$features/demo/seed';
import { getLocale } from '$i18n/paraglide/runtime';
import type { KeyValueStore } from './registry';

/**
 * The demo budget: a real file, but named so that the registry (`isBudgetFile`) never sees it. It
 * can therefore never become the last opened budget, show up in Settings, or stand in for a real
 * budget on the welcome page. `DEMO_KEY` is what survives a reload; leaving the welcome page
 * clears it, and the next start deletes the file.
 */
export const DEMO_FILE = 'demo.sqlite3';
export const DEMO_KEY = 'moneta.demo';

export type DemoApi = Pick<ClientApi, 'system' | 'meta' | 'demo'>;

export function isDemoFile(file: string): boolean {
	return file === DEMO_FILE;
}

export function isDemoOpen(store: KeyValueStore): boolean {
	return store.getItem(DEMO_KEY) === 'on';
}

/** Asks the next start to open the demo. Called before entering the app, which has no worker yet. */
export function requestDemo(store: KeyValueStore): void {
	try {
		store.setItem(DEMO_KEY, 'on');
	} catch {
		// Storage can be full or blocked; the worst case is landing on onboarding instead.
	}
}

export function endDemo(store: KeyValueStore): void {
	try {
		store.removeItem(DEMO_KEY);
	} catch {
		// Same as above: the sweep on the next start is what really removes the demo.
	}
}

/**
 * Opens the demo, building it the first time. Seeding is one transaction, so a file that was left
 * behind uninitialized is simply filled in again. The registry is never touched.
 */
export async function openDemo(
	api: DemoApi,
	store: KeyValueStore,
	budget: DemoBudgetSeed = demoBudget(getLocale())
): Promise<{ file: string; meta: BudgetMeta }> {
	await api.system.open(DEMO_FILE);
	if (!(await api.meta.isInitialized())) {
		try {
			await api.demo.create(budget);
		} catch (err) {
			await api.system.deleteFile(DEMO_FILE).catch(() => {});
			endDemo(store);
			throw err;
		}
	}
	requestDemo(store);
	return { file: DEMO_FILE, meta: await api.meta.get() };
}

/** Removes the demo file once the demo is over, or after a start that never finished one. */
export async function sweepDemo(api: DemoApi, files: string[]): Promise<void> {
	if (files.includes(DEMO_FILE)) await api.system.deleteFile(DEMO_FILE);
}
