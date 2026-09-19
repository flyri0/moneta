import type { Table } from '$lib/db/connection';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$lib/db/repos/budget';

/** Every table a budget month depends on. */
export const BUDGET_TABLES: readonly Table[] = [
	'budget_assignments',
	'transactions',
	'transaction_splits',
	'categories',
	'category_groups',
	'accounts'
];

/** The Available pill's color: green, neutral, yellow (card spending not covered) or red. */
export type AvailableTone = 'positive' | 'zero' | 'credit' | 'overspent';

export function availableTone(
	category: Pick<BudgetCategoryView, 'available' | 'cashOverspent'>
): AvailableTone {
	if (category.available > 0) return 'positive';
	if (category.available === 0) return 'zero';
	return category.cashOverspent > 0 ? 'overspent' : 'credit';
}

export interface HiddenCategory {
	group: BudgetGroupView;
	category: BudgetCategoryView;
}

export interface GridModel {
	groups: BudgetGroupView[];
	hidden: HiddenCategory[];
}

/**
 * Splits the month view into what the grid shows and the collapsible hidden section.
 * A hidden group hides all its categories. The card payments group is left out while empty.
 */
export function gridModel(view: BudgetMonthView): GridModel {
	const groups: BudgetGroupView[] = [];
	const hidden: HiddenCategory[] = [];
	for (const group of view.groups) {
		const visible = group.categories.filter((c) => !group.hidden && !c.hidden);
		for (const category of group.categories)
			if (group.hidden || category.hidden) hidden.push({ group, category });
		if (group.hidden || (group.system && visible.length === 0)) continue;
		groups.push({ ...group, categories: visible });
	}
	return { groups, hidden };
}

export interface CategoryChoice {
	id: string;
	name: string;
	group: Pick<BudgetGroupView, 'name' | 'system'>;
}

/** Visible categories to move money to or from, excluding `exceptId`. */
export function moveTargets(model: GridModel, exceptId: string): CategoryChoice[] {
	return model.groups.flatMap((g) =>
		g.categories
			.filter((c) => c.id !== exceptId)
			.map((c) => ({ id: c.id, name: c.name, group: { name: g.name, system: g.system } }))
	);
}
