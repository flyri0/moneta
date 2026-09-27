import { get, type Readable } from 'svelte/store';

/** How a screen change animates: not at all, a fade between tabs, or a slide into or out of a detail. */
export type NavigationKind = 'none' | 'fade' | 'forward' | 'back';

function segments(routeId: string): string[] {
	return routeId.split('/').filter(Boolean);
}

/**
 * The animation for going from one route id to another. Staying on a route (a new month of the
 * budget) doesn't animate: the screen is the same, and redrawing it whole would be costly.
 */
export function navigationKind(
	from: string | null | undefined,
	to: string | null | undefined
): NavigationKind {
	if (!from || !to || from === to) return 'none';
	const a = segments(from);
	const b = segments(to);
	if (a[0] !== b[0] || a.length === b.length) return 'fade';
	return b.length > a.length ? 'forward' : 'back';
}

/**
 * Waits until `count` (the loads under way) reaches zero, for at most `maxMs`, so a screen change
 * animates to the new screen's content rather than its placeholders. True when the loads ended.
 */
export function loadsSettled(count: Readable<number>, maxMs: number): Promise<boolean> {
	if (get(count) === 0) return Promise.resolve(true);
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			unsubscribe();
			resolve(false);
		}, maxMs);
		// The first call (on subscribing) sees a load under way, so this is set before it ends.
		const unsubscribe = count.subscribe((n) => {
			if (n !== 0) return;
			clearTimeout(timer);
			unsubscribe();
			resolve(true);
		});
	});
}
