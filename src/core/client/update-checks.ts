const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** The part of a ServiceWorkerRegistration the checks use. */
export interface UpdateRegistration {
	readonly installing: unknown;
	update(): Promise<unknown>;
}

export interface UpdateCheckOptions {
	win: EventTarget;
	doc: EventTarget & { readonly visibilityState: string };
	nav: { readonly onLine: boolean };
	/** Checks this often while the app stays open. */
	interval?: number;
	/** Never checks more often than this. */
	minGap?: number;
}

/**
 * Asks the service worker registration to look for a new version at the moments one is likely to
 * be waiting: every hour, when the app comes back into view and when the connection comes back.
 * The browser only checks on navigations, which an installed app left open rarely does. Returns
 * a function that stops watching.
 */
export function watchForUpdates(
	registration: UpdateRegistration,
	{ win, doc, nav, interval = HOUR, minGap = MINUTE }: UpdateCheckOptions
): () => void {
	let last = Number.NEGATIVE_INFINITY;

	const check = () => {
		if (!nav.onLine || registration.installing) return;
		const now = Date.now();
		if (now - last < minGap) return;
		last = now;
		// Offline after all, or the host is mid-deploy: the next check tries again.
		registration.update().catch(() => {});
	};
	const onVisible = () => {
		if (doc.visibilityState === 'visible') check();
	};

	const timer = setInterval(check, interval);
	doc.addEventListener('visibilitychange', onVisible);
	win.addEventListener('online', check);
	return () => {
		clearInterval(timer);
		doc.removeEventListener('visibilitychange', onVisible);
		win.removeEventListener('online', check);
	};
}
