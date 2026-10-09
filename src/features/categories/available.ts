import type { BudgetCategoryView } from '$db/repos/budget';
import { isDate, monthOf, type Month } from '$domain/month';

/** What a picker row needs to draw a category's Available pill. */
export type CategoryAvailable = Pick<BudgetCategoryView, 'available' | 'carryoverOverspending'>;

/** A month's group as far as Available goes: a month view's or the grid model's groups fit. */
export interface AvailableGroup {
	system: 'income' | null;
	categories: readonly (CategoryAvailable & { id: string })[];
}

/** Each category's Available in a month, keyed by id, leaving out the income group's. */
export function availableByCategory(
	groups: readonly AvailableGroup[]
): Map<string, CategoryAvailable> {
	const map = new Map<string, CategoryAvailable>();
	for (const group of groups) {
		if (group.system === 'income') continue;
		for (const c of group.categories) {
			map.set(c.id, { available: c.available, carryoverOverspending: c.carryoverOverspending });
		}
	}
	return map;
}

/** The budget month of a form's date, or null while the date is empty or malformed. */
export function budgetMonthFor(date: string): Month | null {
	return isDate(date) ? monthOf(date) : null;
}
