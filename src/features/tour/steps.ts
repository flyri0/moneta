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
	| 'scheduled-tab'
	| 'month'
	| 'reports'
	| 'report-card'
	| 'settings'
	| 'backup'
	| 'about';

/** The screen a step shows on. */
export type TourRoute = 'budget' | 'scheduled' | 'reports' | 'settings';

/** Each screen's SvelteKit route id. */
export const TOUR_ROUTE_IDS = {
	budget: '/budget/[month]',
	scheduled: '/transactions/scheduled',
	reports: '/reports',
	settings: '/settings'
} as const satisfies Record<TourRoute, string>;

type StepId =
	| 'intro'
	| 'rta'
	| 'category'
	| 'add-transaction'
	| 'month'
	| 'accounts'
	| 'schedules-way'
	| 'schedules'
	| 'reports-way'
	| 'reports'
	| 'settings-way'
	| 'backup'
	| 'done';

/** Which text a step shows: its own, or one that fits the layout or the fallback it fell to. */
export type TourCopy =
	StepId | 'category-wide' | 'add-group' | 'schedules-way-phone' | 'backup-cloud';

export interface TourStep {
	id: StepId;
	route: TourRoute;
	target?: TourTarget;
	/** The guide's section on it, behind "Learn more". */
	topic?: GuideTopic;
	/** Used when the target isn't on the page, with its own text and section. */
	fallback?: { target: TourTarget; copy: TourCopy; topic?: GuideTopic };
	/** The screen the next step opens: this step lights the way there. */
	leadsTo?: TourRoute;
}

/**
 * The first-budget tour, in the guide's order: what Ready to Assign is, assigning it, recording
 * what happens, the months, the other accounts, then the screens around the budget (what repeats,
 * reports, backups), each first shown in the navigation and then opened. It ends in Settings,
 * where it can be taken again.
 */
export const TOUR_STEPS: readonly TourStep[] = [
	{ id: 'intro', route: 'budget' },
	{ id: 'rta', route: 'budget', target: 'rta', topic: 'readyToAssign' },
	{
		id: 'category',
		route: 'budget',
		target: 'category',
		topic: 'assigning',
		fallback: { target: 'add-group', copy: 'add-group', topic: 'categories' }
	},
	{ id: 'add-transaction', route: 'budget', target: 'add-transaction', topic: 'entering' },
	{ id: 'month', route: 'budget', target: 'month', topic: 'overspending' },
	{ id: 'accounts', route: 'budget', target: 'accounts', topic: 'accountKinds' },
	{
		id: 'schedules-way',
		route: 'budget',
		target: 'schedules',
		// Phones have no Schedules link: it is a tab inside Transactions.
		fallback: { target: 'transactions', copy: 'schedules-way-phone' },
		leadsTo: 'scheduled'
	},
	{
		id: 'schedules',
		route: 'scheduled',
		target: 'scheduled-tab',
		topic: 'installmentsUnderWay'
	},
	{ id: 'reports-way', route: 'scheduled', target: 'reports', leadsTo: 'reports' },
	{ id: 'reports', route: 'reports', target: 'report-card', topic: 'reports' },
	{ id: 'settings-way', route: 'reports', target: 'settings', leadsTo: 'settings' },
	{ id: 'backup', route: 'settings', target: 'backup', topic: 'backups' },
	{ id: 'done', route: 'settings', target: 'about' }
];

export interface ResolvedStep<E> {
	/** The element to spotlight; none shows the card in the middle of the screen. */
	element: E | null;
	copy: TourCopy;
	topic?: GuideTopic;
}

/** What a step's text depends on besides the page: the grid's inline column, cloud backups. */
export interface TourLayout {
	/** Whether the budget grid has its inline Assigned column. */
	wide: boolean;
	/** Whether this build offers automatic backups to the cloud. */
	cloud: boolean;
}

/** What a step shows on this page. `find` returns the visible element for a target, if any. */
export function resolveStep<E>(
	step: TourStep,
	find: (target: TourTarget) => E | null,
	layout: TourLayout
): ResolvedStep<E> {
	let copy: TourCopy = step.id;
	let topic = step.topic;
	if (step.id === 'category' && layout.wide) copy = 'category-wide';
	if (step.id === 'backup' && layout.cloud) [copy, topic] = ['backup-cloud', 'googleDrive'];
	if (!step.target) return { element: null, copy, topic };
	const element = find(step.target);
	if (element || !step.fallback) return { element, copy, topic };
	const other = find(step.fallback.target);
	if (!other) return { element: null, copy, topic };
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
