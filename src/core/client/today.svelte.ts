import { todayIso } from '$domain/month';
import { msUntilTomorrow } from './today';

let current = $state(todayIso());

/**
 * Today's local date (`YYYY-MM-DD`). Read in a live query's fetch, before its first `await`, it
 * restarts the query when the day changes.
 */
export function today(): string {
	return current;
}

/** Keeps `today()` current: at midnight, and when the page shows again. Returns the cleanup. */
export function watchToday(): () => void {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const refresh = () => {
		current = todayIso();
		clearTimeout(timer);
		timer = setTimeout(refresh, msUntilTomorrow());
	};
	const onVisible = () => {
		if (document.visibilityState === 'visible') refresh();
	};
	refresh();
	document.addEventListener('visibilitychange', onVisible);
	return () => {
		clearTimeout(timer);
		document.removeEventListener('visibilitychange', onVisible);
	};
}
