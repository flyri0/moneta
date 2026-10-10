/** How long from `now` until just past the next local midnight, when the date changes. */
export function msUntilTomorrow(now: Date = new Date()): number {
	const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
	return next.getTime() - now.getTime() + 1000;
}
