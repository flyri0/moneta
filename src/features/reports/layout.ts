import { reportsLayoutKey, type KeyValueStore } from '$client/registry';

/** Every report on the overview, in the order a new budget shows them. */
export const REPORT_IDS = [
	'spending',
	'net-worth',
	'cash-flow',
	'payees',
	'category-trends',
	'accounts',
	'age-of-money'
] as const;

export type ReportId = (typeof REPORT_IDS)[number];

/** The overview's cards: every report once, in order, and the ones folded away. */
export interface ReportsLayout {
	order: ReportId[];
	hidden: ReportId[];
}

export const DEFAULT_LAYOUT: ReportsLayout = { order: [...REPORT_IDS], hidden: [] };

const KNOWN = new Set<string>(REPORT_IDS);

function ids(raw: unknown): ReportId[] {
	if (!Array.isArray(raw)) return [];
	return [...new Set(raw.filter((id): id is ReportId => typeof id === 'string' && KNOWN.has(id)))];
}

/**
 * A layout from whatever was stored: unknown and repeated ids dropped, and reports added since
 * it was saved appended at the end, shown.
 */
export function normalizeLayout(raw: unknown): ReportsLayout {
	const value = raw as Partial<Record<keyof ReportsLayout, unknown>> | null;
	if (typeof value !== 'object' || value === null || !Array.isArray(value.order))
		return { order: [...REPORT_IDS], hidden: [] };
	const order = ids(value.order);
	for (const id of REPORT_IDS) if (!order.includes(id)) order.push(id);
	return { order, hidden: ids(value.hidden) };
}

/** `file`'s layout. A convenience, so an unreadable store means the default one. */
export function loadLayout(store: KeyValueStore, file: string): ReportsLayout {
	try {
		return normalizeLayout(JSON.parse(store.getItem(reportsLayoutKey(file)) ?? 'null'));
	} catch {
		return normalizeLayout(null);
	}
}

/** Remembers `layout` for `file`. Storage can be full or blocked, so failures are ignored. */
export function saveLayout(store: KeyValueStore, file: string, layout: ReportsLayout): void {
	try {
		store.setItem(reportsLayoutKey(file), JSON.stringify(layout));
	} catch {
		// Only a convenience.
	}
}

/** Places a card at `index` (clamped). */
export function dropCard(layout: ReportsLayout, id: ReportId, index: number): ReportsLayout {
	const from = layout.order.indexOf(id);
	const to = Math.max(0, Math.min(index, layout.order.length - 1));
	if (from === -1 || from === to) return layout;
	const order = [...layout.order];
	order.splice(from, 1);
	order.splice(to, 0, id);
	return { ...layout, order };
}

/** Moves a card one step up or down. */
export function moveCard(layout: ReportsLayout, id: ReportId, delta: -1 | 1): ReportsLayout {
	const from = layout.order.indexOf(id);
	if (from === -1 || !layout.order[from + delta]) return layout;
	return dropCard(layout, id, from + delta);
}

/** Hides a card, or shows it again. */
export function toggleHidden(layout: ReportsLayout, id: ReportId): ReportsLayout {
	const hidden = layout.hidden.includes(id)
		? layout.hidden.filter((h) => h !== id)
		: [...layout.hidden, id];
	return { ...layout, hidden };
}

/** The cards shown on the overview, in order. */
export function visibleCards(layout: ReportsLayout): ReportId[] {
	return layout.order.filter((id) => !layout.hidden.includes(id));
}

/** The hidden cards, in the order they would take if shown. */
export function hiddenCards(layout: ReportsLayout): ReportId[] {
	return layout.order.filter((id) => layout.hidden.includes(id));
}
