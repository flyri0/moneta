import type { BudgetCategoryView } from '$db/repos/budget';

/** How much of a category's envelope this month's spending has used up. */
export interface CategoryProgress {
	/** Money put in the envelope this month: last month's carryover plus what was assigned. */
	funded: number;
	/** Money spent out of it, as a positive number. Zero when the month's activity is an inflow. */
	spent: number;
	/** Money that came back in, as a positive number. Zero when the month's activity is spending. */
	inflow: number;
	/** Spending past `funded`, as a positive number. */
	overspent: number;
	/** How much of `funded` is spent, 0 to 100, for the bar's width. */
	percent: number;
}

/**
 * Splits a category's month into the envelope and what left it.
 * `funded` is derived from the two numbers the row already shows, so the bar and the Available
 * pill can never disagree.
 */
export function categoryProgress(
	category: Pick<BudgetCategoryView, 'activity' | 'available'>
): CategoryProgress {
	const funded = category.available - category.activity;
	const spent = category.activity < 0 ? -category.activity : 0;
	const inflow = category.activity > 0 ? category.activity : 0;
	const overspent = Math.max(0, spent - funded);
	const percent =
		funded > 0 ? Math.min(100, Math.round((spent / funded) * 100)) : spent > 0 ? 100 : 0;
	return { funded, spent, inflow, overspent, percent };
}
