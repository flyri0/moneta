/**
 * Wraps an async handler so it runs one call at a time: a call while the last one is still
 * running is ignored (a double click, Enter pressed twice). An ignored submit event still has its
 * default prevented, so the page never reloads. `onPending` hears when a call starts and ends.
 */
export function oneAtATime<A extends unknown[]>(
	handler: (...args: A) => Promise<unknown>,
	onPending: (pending: boolean) => void
): (...args: A) => Promise<void> {
	let running = false;
	return async (...args: A) => {
		if (running) {
			const first = args[0];
			if (first instanceof Event) first.preventDefault();
			return;
		}
		running = true;
		onPending(true);
		try {
			await handler(...args);
		} finally {
			running = false;
			onPending(false);
		}
	};
}
