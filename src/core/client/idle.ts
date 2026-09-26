/** Calls `run` once, later; returns a function that cancels it. */
export type Schedule = (run: () => void) => () => void;

/** The browser's next idle period, or a short timeout where there is no `requestIdleCallback`. */
export const idleSchedule: Schedule = (run) => {
	if (typeof requestIdleCallback === 'function') {
		const handle = requestIdleCallback(run, { timeout: 3000 });
		return () => cancelIdleCallback(handle);
	}
	const timer = setTimeout(run, 200);
	return () => clearTimeout(timer);
};

/**
 * Runs `tasks` one after another, each in an idle period of its own, waiting for one that returns
 * a promise to settle. A task that fails is skipped. Returns a function that stops the rest.
 */
export function runWhenIdle(
	tasks: readonly (() => unknown)[],
	schedule: Schedule = idleSchedule
): () => void {
	let stopped = false;
	let cancel = () => {};
	const next = (i: number) => {
		if (stopped || i >= tasks.length) return;
		cancel = schedule(() => {
			let result: unknown;
			try {
				result = tasks[i]();
			} catch {
				// Nothing waits on these tasks: a failure only means the work is left for later.
			}
			void Promise.resolve(result).then(
				() => next(i + 1),
				() => next(i + 1)
			);
		});
	};
	next(0);
	return () => {
		stopped = true;
		cancel();
	};
}
