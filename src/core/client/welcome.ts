import { loadRegistry, type KeyValueStore } from './registry';

/** Remembers that the welcome page was answered, so it doesn't come back mid-onboarding. */
export const WELCOME_KEY = 'moneta.welcome';

/**
 * Whether `/` should show the welcome page instead of going straight to the budget. It is a
 * first-run screen: an installed window, a browser that already holds a budget, and anyone who
 * already chose a way in all skip it.
 */
export function shouldShowWelcome(store: KeyValueStore, standalone: boolean): boolean {
	if (standalone) return false;
	if (loadRegistry(store).budgets.length > 0) return false;
	return store.getItem(WELCOME_KEY) !== 'done';
}

export function dismissWelcome(store: KeyValueStore): void {
	try {
		store.setItem(WELCOME_KEY, 'done');
	} catch {
		// Storage can be full or blocked; the worst case is seeing the page once more.
	}
}
