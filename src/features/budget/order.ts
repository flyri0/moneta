import type { BudgetGroupView } from '$db/repos/budget';

/** The category order being edited: groups (system ones pinned first) and their categories. */
export interface OrderGroup {
	id: string;
	name: string;
	system: BudgetGroupView['system'];
	categories: { id: string; name: string }[];
}

export type OrderLayout = OrderGroup[];

export function toLayout(groups: BudgetGroupView[]): OrderLayout {
	return groups.map((g) => ({
		id: g.id,
		name: g.name,
		system: g.system,
		categories: g.categories.map((c) => ({ id: c.id, name: c.name }))
	}));
}

/** What saveCategoryOrder expects. */
export function toPayload(layout: OrderLayout): { groupId: string; categoryIds: string[] }[] {
	return layout.map((g) => ({ groupId: g.id, categoryIds: g.categories.map((c) => c.id) }));
}

/** Moves a user group up or down among user groups. System groups never move. */
export function moveGroup(layout: OrderLayout, groupId: string, delta: -1 | 1): OrderLayout {
	const from = layout.findIndex((g) => g.id === groupId);
	const to = from + delta;
	if (from === -1 || layout[from].system || !layout[to] || layout[to].system) return layout;
	const next = [...layout];
	[next[from], next[to]] = [next[to], next[from]];
	return next;
}

function locate(layout: OrderLayout, categoryId: string): [number, number] {
	for (let gi = 0; gi < layout.length; gi++) {
		const ci = layout[gi].categories.findIndex((c) => c.id === categoryId);
		if (ci !== -1) return [gi, ci];
	}
	return [-1, -1];
}

/**
 * Places a category at `index` in group `groupId`. Categories never enter or leave a system group,
 * so such moves return the layout unchanged.
 */
export function dropCategory(
	layout: OrderLayout,
	categoryId: string,
	groupId: string,
	index: number
): OrderLayout {
	const [gi, ci] = locate(layout, categoryId);
	const target = layout.findIndex((g) => g.id === groupId);
	if (gi === -1 || target === -1) return layout;
	if (gi !== target && (layout[gi].system || layout[target].system)) return layout;
	const next = layout.map((g) => ({ ...g, categories: [...g.categories] }));
	const [moved] = next[gi].categories.splice(ci, 1);
	const clamped = Math.max(0, Math.min(index, next[target].categories.length));
	next[target].categories.splice(clamped, 0, moved);
	return next;
}

/**
 * Moves a category one step. Past the top or bottom of its group it goes to the end of the
 * previous user group or the start of the next one.
 */
export function moveCategory(layout: OrderLayout, categoryId: string, delta: -1 | 1): OrderLayout {
	const [gi, ci] = locate(layout, categoryId);
	if (gi === -1) return layout;
	const group = layout[gi];
	const index = ci + delta;
	if (index >= 0 && index < group.categories.length)
		return dropCategory(layout, categoryId, group.id, index);
	const neighbor = layout[gi + delta];
	if (!neighbor || neighbor.system || group.system) return layout;
	return dropCategory(
		layout,
		categoryId,
		neighbor.id,
		delta === -1 ? neighbor.categories.length : 0
	);
}
