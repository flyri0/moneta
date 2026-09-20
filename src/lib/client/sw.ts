import { registerSW } from 'virtual:pwa-register';

type Update = (reload?: boolean) => Promise<void>;

let update: Update | null = null;
let needRefresh: (() => void) | null = null;

/**
 * Registers the service worker, once per page load. Both the welcome page and the app call it:
 * the welcome page because Chromium only offers to install a page whose worker is registered,
 * the app because that is how updates are found.
 */
export function ensureServiceWorker(): void {
	update ??= registerSW({ onNeedRefresh: () => needRefresh?.() });
}

/** Runs `fn` whenever a new version is waiting. Only the app asks to be told. */
export function onNeedRefresh(fn: () => void): void {
	needRefresh = fn;
	ensureServiceWorker();
}

/** Activates the waiting service worker, which reloads the page. */
export function applyServiceWorkerUpdate(): Promise<void> {
	return update?.(true) ?? Promise.resolve();
}
