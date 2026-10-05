import type { GuideTopic } from '$client/guide';

/** Where a step points: the `data-tour` value of the element it spotlights. */
export type TourTarget =
	| 'rta'
	| 'category'
	| 'add-group'
	| 'add-transaction'
	| 'accounts'
	| 'schedules'
	| 'transactions'
	| 'month'
	| 'settings';

/** Which text a step shows: its own, or one that fits the layout or the fallback it fell to. */
export type TourCopy =
	| 'intro'
	| 'rta'
	| 'category'
	| 'category-wide'
	| 'add-group'
	| 'add-transaction'
	| 'accounts'
	| 'schedules'
	| 'schedules-phone'
	| 'month'
	| 'done';

export interface TourStep {
	id:
		'intro' | 'rta' | 'category' | 'add-transaction' | 'accounts' | 'schedules' | 'month' | 'done';
	target?: TourTarget;
	/** The guide's section on it, behind "Learn more". */
	topic?: GuideTopic;
	/** Used when the target isn't on the page, with its own text and section. */
	fallback?: { target: TourTarget; copy: TourCopy; topic: GuideTopic };
}

/**
 * The first-budget tour, in the guide's order: what Ready to Assign is, assigning it, recording
 * what happens, the other accounts, what repeats (installments too), the months, and where the
 * guide is.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{ id: 'intro' },
	{ id: 'rta', target: 'rta', topic: 'readyToAssign' },
	{
		id: 'category',
		target: 'category',
		topic: 'assigning',
		fallback: { target: 'add-group', copy: 'add-group', topic: 'categories' }
	},
	{ id: 'add-transaction', target: 'add-transaction', topic: 'entering' },
	{ id: 'accounts', target: 'accounts', topic: 'accountKinds' },
	{
		id: 'schedules',
		target: 'schedules',
		topic: 'installmentsUnderWay',
		// Phones have no Schedules link: it is a tab inside Transactions.
		fallback: { target: 'transactions', copy: 'schedules-phone', topic: 'installmentsUnderWay' }
	},
	{ id: 'month', target: 'month', topic: 'overspending' },
	{ id: 'done', target: 'settings' }
];

export interface ResolvedStep<E> {
	/** The element to spotlight; none shows the card in the middle of the screen. */
	element: E | null;
	copy: TourCopy;
	topic?: GuideTopic;
}

/**
 * What a step shows on this page. `find` returns the visible element for a target, if any;
 * `wide` is whether the budget grid has its inline Assigned column.
 */
export function resolveStep<E>(
	step: TourStep,
	find: (target: TourTarget) => E | null,
	wide: boolean
): ResolvedStep<E> {
	const copy: TourCopy = step.id === 'category' && wide ? 'category-wide' : step.id;
	if (!step.target) return { element: null, copy, topic: step.topic };
	const element = find(step.target);
	if (element || !step.fallback) return { element, copy, topic: step.topic };
	const other = find(step.fallback.target);
	if (!other) return { element: null, copy, topic: step.topic };
	return { element: other, copy: step.fallback.copy, topic: step.fallback.topic };
}

export interface Box {
	x: number;
	y: number;
	width: number;
	height: number;
}

/** Space between the card and the window's edges, and between the card and its target. */
const MARGIN = 16;

/**
 * Where the card goes. On a phone it spans the width, on the side of the target with more room;
 * on a wider screen it goes below, above or beside the target, whichever fits first (beside
 * first for something on the left edge, like the sidebar). Always inside the window.
 */
export function placeCard(
	target: Box | null,
	card: { width: number; height: number },
	viewport: { width: number; height: number },
	phone: boolean
): { x: number; y: number } {
	const clampX = (x: number) => Math.max(MARGIN, Math.min(x, viewport.width - MARGIN - card.width));
	const clampY = (y: number) =>
		Math.max(MARGIN, Math.min(y, viewport.height - MARGIN - card.height));
	if (!target) {
		return {
			x: Math.max(MARGIN, (viewport.width - card.width) / 2),
			y: Math.max(MARGIN, (viewport.height - card.height) / 2)
		};
	}
	const below = target.y + target.height + MARGIN;
	const above = target.y - MARGIN - card.height;
	if (phone) {
		const inTopHalf = target.y + target.height / 2 < viewport.height / 2;
		return { x: MARGIN, y: clampY(inTopHalf ? below : above) };
	}
	const right = target.x + target.width + MARGIN;
	const left = target.x - MARGIN - card.width;
	const fitsBelow = below + card.height <= viewport.height - MARGIN;
	const fitsAbove = above >= MARGIN;
	const fitsRight = right + card.width <= viewport.width - MARGIN;
	const fitsLeft = left >= MARGIN;
	const besideFirst = target.x + target.width < viewport.width * 0.3;
	const options: [boolean, () => { x: number; y: number }][] = [
		[fitsBelow, () => ({ x: clampX(target.x), y: below })],
		[fitsAbove, () => ({ x: clampX(target.x), y: above })],
		[fitsRight, () => ({ x: right, y: clampY(target.y) })],
		[fitsLeft, () => ({ x: left, y: clampY(target.y) })]
	];
	if (besideFirst) options.unshift(options[2]);
	const fit = options.find(([fits]) => fits);
	return fit ? fit[1]() : { x: clampX(target.x), y: clampY(below) };
}
