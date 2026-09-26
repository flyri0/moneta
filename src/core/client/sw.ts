import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { watchForUpdates } from './update-checks';

type Update = (reload?: boolean) => Promise<void>;

/** How long an update may take to take control before the page reloads anyway. */
const UPDATE_TIMEOUT = 10_000;

export interface ServiceWorkerDeps {
	register: (options: RegisterSWOptions) => Update;
	reload: () => void;
	later: (fn: () => void, ms: number) => void;
	/** Starts the periodic update checks for a registration. */
	watch: (registration: ServiceWorkerRegistration) => void;
	/** Whether a service worker controls the page, i.e. a new one would be an update. */
	controlled: () => boolean;
}

/** The service worker's registration and updates, over injectable browser calls. */
export function createServiceWorker(deps: ServiceWorkerDeps) {
	let update: Update | null = null;
	let registration: ServiceWorkerRegistration | undefined;
	let needRefresh: (() => void) | null = null;
	let needReload: (() => void) | null = null;

	function ensure(): void {
		update ??= deps.register({
			onNeedRefresh: () => needRefresh?.(),
			// A new version took control (from this tab or another): the app closes its database
			// before reloading, when it said how.
			onNeedReload: () => (needReload ?? deps.reload)(),
			onRegisteredSW: (_url, r) => {
				registration = r;
				if (!r) return;
				deps.watch(r);
				followInstalling(r);
			}
		});
	}

	/**
	 * The browser checks for a new version as the page loads, but Workbox only listens once the page
	 * has registered: a version that started installing before that and finishes after it would wait
	 * without a word until the next launch. Follow it here.
	 */
	function followInstalling(r: ServiceWorkerRegistration): void {
		const worker = r.installing;
		if (!worker || !deps.controlled()) return;
		const onChange = () => {
			if (worker.state === 'installing') return;
			worker.removeEventListener('statechange', onChange);
			if (worker.state === 'installed' && r.waiting === worker) needRefresh?.();
		};
		worker.addEventListener('statechange', onChange);
	}

	return {
		ensure,
		/** Runs `fn` whenever a new version is waiting. */
		onNeedRefresh(fn: () => void): void {
			needRefresh = fn;
			ensure();
		},
		/** Runs `fn` instead of a plain reload once a new version takes control. It must reload. */
		onNeedReload(fn: () => void): void {
			needReload = fn;
		},
		/**
		 * Activates the waiting version, which reloads every tab. With no version waiting any more
		 * (a newer one is installing), or if it doesn't take control in time, it just reloads.
		 */
		async apply(): Promise<void> {
			if (!update || !registration?.waiting) return deps.reload();
			deps.later(deps.reload, UPDATE_TIMEOUT);
			await update(true);
		}
	};
}

const serviceWorker = createServiceWorker({
	register: registerSW,
	reload: () => location.reload(),
	later: (fn, ms) => void setTimeout(fn, ms),
	watch: (registration) =>
		watchForUpdates(registration, { win: window, doc: document, nav: navigator }),
	controlled: () => navigator.serviceWorker.controller !== null
});

/**
 * Registers the service worker, once per page load. Both the welcome page and the app call it:
 * the welcome page because Chromium only offers to install a page whose worker is registered,
 * the app because that is how updates are found. It also checks for updates while the page
 * stays open (`watchForUpdates`), not only on navigations, and reports a version the page's own
 * load found but that was still installing when it registered.
 */
export const ensureServiceWorker = serviceWorker.ensure;

/** Runs `fn` whenever a new version is waiting. Only the app asks to be told. */
export const onNeedRefresh = serviceWorker.onNeedRefresh;

/** Runs `fn` (which must reload) instead of reloading when a new version takes control. */
export const onNeedReload = serviceWorker.onNeedReload;

/** Activates the waiting service worker, which reloads the page. */
export const applyServiceWorkerUpdate = serviceWorker.apply;
