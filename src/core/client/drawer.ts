/** Past this speed (px/ms) letting go is a flick, which counts however short the drag. */
const FLICK = 0.5;
/** A flick shorter than this (px) is a tap that wobbled. */
const MIN_FLICK = 10;
/** How far (px) a slow drag must go to grow or shrink a drawer. */
const RESIZE = 48;

/** A drag of a drawer, at the moment it's let go. */
export interface DrawerDrag {
	/** How far it moved, in px: positive down, negative up. */
	offset: number;
	/** How fast it was moving, in px/ms, signed like `offset`. */
	velocity: number;
	/** The drawer's height when the drag began, in px. */
	height: number;
	/** Whether it fills the screen. */
	expanded: boolean;
	/** Whether it has more to show than fits, so filling the screen is worth it. */
	expandable: boolean;
}

/** What letting go does: close the drawer, fill the screen, go back to its height, or nothing. */
export type DrawerRelease = 'close' | 'expand' | 'collapse' | 'stay';

/**
 * At its own height, a drawer closes when dragged down past a quarter of it or flicked down, and
 * fills the screen when dragged or flicked up. Filling the screen, it goes back to its height
 * when dragged or flicked down, and closes when dragged past half of it.
 */
export function drawerRelease(drag: DrawerDrag): DrawerRelease {
	const { offset, velocity, height, expanded, expandable } = drag;
	const distance = Math.abs(offset);
	const flicked = Math.abs(velocity) > FLICK && Math.sign(velocity) === Math.sign(offset);
	const moved = distance > MIN_FLICK && (distance > RESIZE || flicked);
	if (offset > 0) {
		if (expanded) {
			if (offset > height / 2) return 'close';
			return moved ? 'collapse' : 'stay';
		}
		return offset > height / 4 || (flicked && distance > MIN_FLICK) ? 'close' : 'stay';
	}
	if (offset < 0 && !expanded && expandable && moved) return 'expand';
	return 'stay';
}
