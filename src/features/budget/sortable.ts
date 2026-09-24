/**
 * Auto-scroll speed while dragging, in pixels per frame: negative within `zone` of the `top`
 * limit, positive within `zone` of the `bottom` one, faster closer to the edge, 0 elsewhere.
 */
export function edgeScrollSpeed(
	y: number,
	top: number,
	bottom: number,
	zone = 72,
	max = 18
): number {
	const ramp = (depth: number) => (Math.min(depth, zone) / zone) * max;
	if (y < top + zone) return -ramp(top + zone - y);
	if (y > bottom - zone) return ramp(y - (bottom - zone));
	return 0;
}

/**
 * Whether the item at `from` should take the place of the item at `over`, under the pointer:
 * moving down once the pointer passes the middle of a later item, up once it passes the middle
 * of an earlier one. The direction keeps items of different heights from swapping back and forth.
 */
export function shouldMove(
	from: number,
	over: number,
	pointerY: number,
	overRect: { top: number; height: number }
): boolean {
	const middle = overRect.top + overRect.height / 2;
	if (from < over) return pointerY > middle;
	if (from > over) return pointerY < middle;
	return false;
}
