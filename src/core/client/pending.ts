import { writable, type Readable } from 'svelte/store';

const count = writable(0);

/** How many loads the screen is waiting on, e.g. live queries with no result yet for their arguments. */
export const pendingLoads: Readable<number> = { subscribe: count.subscribe };

/** Counts one load as under way. Call the returned function when it ends; later calls do nothing. */
export function startLoad(): () => void {
	count.update((n) => n + 1);
	let ended = false;
	return () => {
		if (ended) return;
		ended = true;
		count.update((n) => n - 1);
	};
}
