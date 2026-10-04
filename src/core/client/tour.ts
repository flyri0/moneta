import type { KeyValueStore } from './registry';

/**
 * The first-budget tour's state on this device: absent until a budget opens, then
 * `pending:<file>` for the budget it waits for, or `done` for good.
 */
export const TOUR_KEY = 'moneta.tour';

const DONE = 'done';
const PENDING = 'pending:';

function read(store: KeyValueStore): string | null {
	try {
		return store.getItem(TOUR_KEY);
	} catch {
		return DONE;
	}
}

function write(store: KeyValueStore, value: string): void {
	try {
		store.setItem(TOUR_KEY, value);
	} catch {
		// Storage can be full or blocked; the worst case is a tour that comes back once.
	}
}

/** Plans the tour for the first budget onboarding made here; no-op once anything was decided. */
export function planTour(store: KeyValueStore, file: string): void {
	if (read(store) === null) write(store, PENDING + file);
}

/** Whether the tour waits for this budget. */
export function tourPendingFor(store: KeyValueStore, file: string): boolean {
	return read(store) === PENDING + file;
}

/** Ends the tour for good on this device: taken, skipped, or never meant to be. */
export function settleTour(store: KeyValueStore): void {
	write(store, DONE);
}

/**
 * Settles the tour when the first budget this device opens wasn't planned for it: a restored
 * backup, or a budget from before the tour existed. The demo doesn't count.
 */
export function noteBudgetOpened(store: KeyValueStore, isDemo: boolean): void {
	if (!isDemo && read(store) === null) settleTour(store);
}
