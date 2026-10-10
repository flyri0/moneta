import { untrack } from 'svelte';

/** How many bottom drawers and full-screen pickers are open, for where toasts go. */
export const overlays = $state({ drawers: 0, pickers: 0 });

/**
 * Counts an open overlay until the returned cleanup runs (an effect's teardown). The count is
 * read untracked: the calling effect must not depend on what it writes.
 */
export function trackOverlay(kind: 'drawers' | 'pickers'): () => void {
	untrack(() => overlays[kind]++);
	return () => {
		overlays[kind]--;
	};
}
