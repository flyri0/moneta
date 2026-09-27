import type { CategoryMonth } from './budget-engine';
import { monthDiff, type Month } from './month';

/** `monthly`: assign the amount every month. `target`: build the balance up to it. */
export type GoalType = 'monthly' | 'target';

export const GOAL_TYPES: readonly GoalType[] = ['monthly', 'target'];

/** What a category aims for. `month` is when a `target` should be reached; `null` otherwise. */
export interface CategoryGoal {
	type: GoalType;
	amount: number;
	month: Month | null;
}

/**
 * What `goal` asks to be assigned in `month`. A target counts from the balance the month started
 * with, so the answer holds while money is assigned during the month; a dated one spreads what is
 * left over the months up to its own, rounded up so the last one never falls short.
 */
export function goalNeed(
	goal: CategoryGoal,
	month: Month,
	cm: Pick<CategoryMonth, 'carryover'>
): number {
	if (goal.type === 'monthly') return goal.amount;
	const remaining = Math.max(0, goal.amount - cm.carryover);
	if (goal.month === null) return remaining;
	const monthsLeft = Math.max(1, monthDiff(month, goal.month) + 1);
	return Math.ceil(remaining / monthsLeft);
}
