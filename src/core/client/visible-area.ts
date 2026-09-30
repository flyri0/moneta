/** A band of the layout viewport, in CSS pixels from its top. */
export interface Area {
	top: number;
	height: number;
}

/**
 * The part of the page the user can see. A phone's keyboard shrinks the visual viewport and the
 * browser may scroll it, while the layout viewport, which fixed elements follow, keeps its size.
 */
export function visibleArea(win: {
	innerHeight: number;
	visualViewport?: { offsetTop: number; height: number } | null;
}): Area {
	const viewport = win.visualViewport;
	if (!viewport) return { top: 0, height: win.innerHeight };
	return { top: viewport.offsetTop, height: viewport.height };
}
