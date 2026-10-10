import type { BudgetCategoryView } from '$db/repos/budget';

/** Where a category stands against this month's goal, in the bar's terms. */
export interface GoalProgress {
	/** What is still to be assigned to meet it, as a positive number. Zero once it is met. */
	toGo: number;
	/** How much of the bar is funded, 0 to 100. */
	funded: number;
	/** Where the goal's tick sits on the bar, 0 to 100. */
	at: number;
}

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
	/** How much of the bar is spent, 0 to 100, for the fill's width. */
	percent: number;
	/** `null` without a goal, or once a target needs nothing more this month. */
	goal: GoalProgress | null;
}

const share = (part: number, whole: number) =>
	Math.min(100, Math.max(0, Math.round((part / whole) * 100)));

/** Whether the month has anything to show: money funded, spent or received. */
export function showsSpending(p: CategoryProgress): boolean {
	return p.funded !== 0 || p.spent !== 0 || p.inflow !== 0;
}

/**
 * Splits a category's month into the envelope and what left it.
 * `funded` is derived from the two numbers the row already shows, so the bar and the Available
 * pill can never disagree. The bar spans what is funded, or the goal's line when that is further:
 * the carryover plus what the goal needs this month.
 */
export function categoryProgress(
	category: Pick<BudgetCategoryView, 'activity' | 'available' | 'assigned' | 'goalNeed'>
): CategoryProgress {
	const funded = category.available - category.activity;
	const spent = category.activity < 0 ? -category.activity : 0;
	const inflow = category.activity > 0 ? category.activity : 0;
	const overspent = Math.max(0, spent - funded);
	const need = category.goalNeed ?? 0;
	const goalLine = need > 0 ? funded - category.assigned + need : null;
	const scale = Math.max(funded, goalLine ?? 0);
	const percent = scale > 0 ? share(spent, scale) : spent > 0 ? 100 : 0;
	const goal =
		goalLine === null
			? null
			: {
					toGo: Math.max(0, goalLine - funded),
					funded: scale > 0 ? share(funded, scale) : 0,
					at: scale > 0 ? share(goalLine, scale) : 0
				};
	return { funded, spent, inflow, overspent, percent, goal };
}
