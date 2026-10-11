import { oneAtATime } from './submit';

/**
 * A form's submit handler that runs one at a time (`oneAtATime`), with `pending` to disable its
 * button while it runs. Create it during component initialization.
 */
export function submitOnce<A extends unknown[]>(handler: (...args: A) => Promise<unknown>) {
	let pending = $state(false);
	const run = oneAtATime(handler, (p) => (pending = p));
	return {
		get pending() {
			return pending;
		},
		run
	};
}
