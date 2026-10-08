import type { KeyValueStore } from './registry';

/** Where this device remembers whether amounts are hidden. */
export const HIDE_AMOUNTS_KEY = 'moneta.hideAmounts';

/** What a hidden amount shows instead. */
export const MASK = '••••';

export function readHideAmounts(store: KeyValueStore): boolean {
	try {
		return store.getItem(HIDE_AMOUNTS_KEY) === '1';
	} catch {
		// Blocked storage: amounts show.
		return false;
	}
}

export function writeHideAmounts(store: KeyValueStore, hidden: boolean): void {
	try {
		store.setItem(HIDE_AMOUNTS_KEY, hidden ? '1' : '0');
	} catch {
		// Storage can be full or blocked; the choice lasts until the page reloads.
	}
}
