import { registerSW } from 'virtual:pwa-register';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { watchForUpdates } from './update-checks';

/**
 * Where the app stands with a new version: `downloading` while one installs, `ready` once it
 * waits to take over. `checking`, `current` and `failed` come from a check asked for by hand.
 */
export type UpdateStatus = 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'failed';

/** How long an update may take to take control before the page reloads anyway. */
const UPDATE_TIMEOUT = 10_000;

export interface ServiceWorkerDeps {
	register: (options: RegisterSWOptions) => unknown;
	reload: () => void;
	later: (fn: () => void, ms: number) => void;
	/**
	 * The registration as it stands, without waiting: `register()` queues behind an install in
	 * progress, so it only answers once a new version has finished downloading.
	 */
	lookUp: () => Promise<ServiceWorkerRegistration | undefined>;
	/** Starts the periodic update checks for a registration. */
	watch: (registration: ServiceWorkerRegistration) => void;
	/** `navigator.serviceWorker`: whether a worker controls the page, and `controllerchange`. */
	container: EventTarget & { readonly controller: unknown };
	/** The document, to look at the registration again when the app comes back into view. */
	doc: EventTarget & { readonly visibilityState: string };
}

/**
 * The service worker's registration and updates, over injectable browser calls. The update state
 * comes from the registration itself rather than from Workbox's events: Workbox starts listening
 * only once the page has loaded, and stops after the first update it thinks another tab started.
 */
export function createServiceWorker(deps: ServiceWorkerDeps) {
	let registered = false;
	let registration: ServiceWorkerRegistration | undefined;
	let status: UpdateStatus = 'idle';
	const listeners = new Set<(status: UpdateStatus) => void>();
	let needReload: (() => void) | null = null;
	let reloading = false;

	function set(next: UpdateStatus): void {
		if (next === status) return;
		status = next;
		for (const fn of listeners) fn(next);
	}

	/** Reads the state off the registration. Only an update counts: the first install doesn't. */
	function refresh(r: ServiceWorkerRegistration): void {
		if (!r.active) return;
		if (r.waiting) set('ready');
		else if (r.installing) set('downloading');
		else if (status === 'ready' || status === 'downloading') set('idle');
	}

	function follow(r: ServiceWorkerRegistration, worker: ServiceWorker | null): void {
		worker?.addEventListener('statechange', () => refresh(r));
		refresh(r);
	}

	// A new version took control (from this tab or another): the app closes its database before
	// reloading, when it said how. Workbox may report the same change: reload once.
	function reloadForUpdate(): void {
		if (reloading) return;
		reloading = true;
		(needReload ?? deps.reload)();
	}

	function ensure(): void {
		if (registered) return;
		registered = true;
		// Without a controller this is the first install, not an update: nothing to reload for.
		if (deps.container.controller) {
			deps.container.addEventListener('controllerchange', reloadForUpdate);
		}
		deps.register({
			onNeedReload: reloadForUpdate,
			onRegisteredSW: (_url, r) => {
				if (r) attach(r);
			}
		});
		deps
			.lookUp()
			.then((r) => r && attach(r))
			.catch(() => {});
	}

	/** Follows the registration, from whichever of `register()` and `lookUp()` answers first. */
	function attach(r: ServiceWorkerRegistration): void {
		if (registration) return;
		registration = r;
		deps.watch(r);
		follow(r, r.installing);
		r.addEventListener('updatefound', () => follow(r, r.installing));
		deps.doc.addEventListener('visibilitychange', () => {
			if (deps.doc.visibilityState === 'visible') refresh(r);
		});
	}

	return {
		ensure,
		/** Runs `fn` with the current update status, then on every change. Returns a stop. */
		onUpdateStatus(fn: (status: UpdateStatus) => void): () => void {
			listeners.add(fn);
			fn(status);
			ensure();
			return () => listeners.delete(fn);
		},
		/** Runs `fn` instead of a plain reload once a new version takes control. It must reload. */
		onNeedReload(fn: () => void): void {
			needReload = fn;
		},
		/** Asks the host for a new version now, reporting what it finds through the status. */
		async check(): Promise<void> {
			const r = registration;
			if (status === 'checking' || status === 'downloading' || status === 'ready') return;
			if (!r) return set('failed');
			set('checking');
			try {
				await r.update();
			} catch {
				return set('failed');
			}
			// `updatefound` may have moved it on meanwhile.
			if ((status as UpdateStatus) !== 'checking') return;
			set(r.waiting ? 'ready' : r.installing ? 'downloading' : 'current');
		},
		/** The current update status. */
		status: () => status,
		/**
		 * Activates the waiting version, which reloads every tab. With no version waiting any more
		 * (a newer one is installing), or if it doesn't take control in time, it just reloads. It
		 * messages the worker itself: Workbox only knows the registration once `register()` answers.
		 */
		async apply(): Promise<void> {
			const waiting = registration?.waiting;
			if (!waiting) return deps.reload();
			deps.later(deps.reload, UPDATE_TIMEOUT);
			waiting.postMessage({ type: 'SKIP_WAITING' });
		}
	};
}

const serviceWorker = createServiceWorker({
	register: registerSW,
	reload: () => location.reload(),
	later: (fn, ms) => void setTimeout(fn, ms),
	lookUp: async () => navigator.serviceWorker?.getRegistration(),
	watch: (registration) =>
		watchForUpdates(registration, { win: window, doc: document, nav: navigator }),
	// Read when first used, not on import: tests import this module without a DOM.
	get container() {
		return navigator.serviceWorker ?? Object.assign(new EventTarget(), { controller: null });
	},
	get doc() {
		return document;
	}
});

/**
 * Registers the service worker, once per page load. Both the welcome page and the app call it:
 * the welcome page because Chromium only offers to install a page whose worker is registered,
 * the app because that is how updates are found. It also checks for updates while the page
 * stays open (`watchForUpdates`), not only on navigations.
 */
export const ensureServiceWorker = serviceWorker.ensure;

/** Runs `fn` with the update status now and on every change. Only the app asks to be told. */
export const onUpdateStatus = serviceWorker.onUpdateStatus;

/** Runs `fn` (which must reload) instead of reloading when a new version takes control. */
export const onNeedReload = serviceWorker.onNeedReload;

/** Looks for a new version now, when the user asks. */
export const checkForUpdate = serviceWorker.check;

/** Activates the waiting service worker, which reloads the page. */
export const applyServiceWorkerUpdate = serviceWorker.apply;
