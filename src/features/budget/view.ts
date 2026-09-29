import type { Table } from '$db/connection';
import type { BudgetCategoryView, BudgetGroupView, BudgetMonthView } from '$db/repos/budget';

/** Every table a budget month depends on. */
export const BUDGET_TABLES: readonly Table[] = [
	'budget_assignments',
	'transactions',
	'transaction_splits',
	'categories',
	'category_groups',
	'accounts'
];

/** The Available pill's color: green, neutral, red (overspent) or amber (carryover). */
export type AvailableTone = 'positive' | 'zero' | 'overspent' | 'carryover';

export function availableTone(
	category: Pick<BudgetCategoryView, 'available' | 'carryoverOverspending'>
): AvailableTone {
	if (category.available > 0) return 'positive';
	if (category.available === 0) return 'zero';
	return category.carryoverOverspending ? 'carryover' : 'overspent';
}

/** Spent past its envelope, with no choice to roll it over: next month pays for it. */
export function isOverspent(
	category: Pick<BudgetCategoryView, 'available' | 'carryoverOverspending'>
): boolean {
	return availableTone(category) === 'overspent';
}

/** How many of a group's categories are overspent. Income is never counted. */
export function overspentCount(group: BudgetGroupView): number {
	if (group.system === 'income') return 0;
	return group.categories.filter(isOverspent).length;
}

/**
 * Every overspent category in the order the grid shows them, the hidden section last: hidden
 * categories still cost next month's Ready to Assign.
 */
export function overspentCategories(model: GridModel): BudgetCategoryView[] {
	return [
		...model.groups.filter((g) => g.system !== 'income').flatMap((g) => g.categories),
		...model.hidden.filter((h) => h.group.system !== 'income').map((h) => h.category)
	].filter(isOverspent);
}

/**
 * How much of a category's overspending Ready to Assign can cover without going negative: covering
 * past it would only move the problem to Ready to Assign.
 */
export function coverableFromReady(
	category: Pick<BudgetCategoryView, 'available'>,
	readyToAssign: number
): number {
	return Math.max(0, Math.min(-category.available, readyToAssign));
}

/** Ready to Assign's state. Zero is the goal of a zero-based budget; anything else needs a look. */
export type RtaTone = 'assigned' | 'unassigned' | 'overassigned';

export function rtaTone(readyToAssign: number): RtaTone {
	if (readyToAssign > 0) return 'unassigned';
	return readyToAssign < 0 ? 'overassigned' : 'assigned';
}

/**
 * What the Ready to Assign card says. Below zero with funds already negative (say, a credit card's
 * starting debt in an income category), assigning too much isn't what put it there.
 */
export type RtaHint = RtaTone | 'negativeFunds';

export function rtaHint(view: Pick<BudgetMonthView, 'readyToAssign' | 'availableFunds'>): RtaHint {
	const tone = rtaTone(view.readyToAssign);
	return tone === 'overassigned' && view.availableFunds < 0 ? 'negativeFunds' : tone;
}

/** An amount's color, from its sign alone: income below zero must not look like money coming in. */
export type AmountTone = 'inflow' | 'zero' | 'outflow';

export function amountTone(amount: number): AmountTone {
	if (amount > 0) return 'inflow';
	return amount < 0 ? 'outflow' : 'zero';
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
 * A hidden group hides all its categories. The income group is left out while empty.
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

export interface CategoryChoiceGroup {
	id: string;
	name: string;
	system: BudgetGroupView['system'];
	categories: { id: string; name: string }[];
}

/**
 * Visible categories to move money to or from, by group, excluding `exceptId` and system groups.
 */
export function moveTargets(model: GridModel, exceptId: string): CategoryChoiceGroup[] {
	return model.groups
		.filter((g) => !g.system)
		.map((g) => ({
			id: g.id,
			name: g.name,
			system: g.system,
			categories: g.categories
				.filter((c) => c.id !== exceptId)
				.map((c) => ({ id: c.id, name: c.name }))
		}))
		.filter((g) => g.categories.length > 0);
}
