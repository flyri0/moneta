import { categoryMonth, type BudgetComputation } from './budget-engine';
import { goalNeed, type CategoryGoal } from './goal';
import { addMonths, type Month } from './month';

export type QuickAssignStrategy =
	'goals' | 'last-month' | 'avg-3' | 'avg-6' | 'avg-12' | 'cover-overspending' | 'clear';

export const QUICK_ASSIGN_STRATEGIES: readonly QuickAssignStrategy[] = [
	'goals',
	'last-month',
	'avg-3',
	'avg-6',
	'avg-12',
	'cover-overspending',
	'clear'
];

/**
 * The new assigned amount for `categoryId` in `month` under `strategy`. `goals` raises it to what
 * the category's `goal` needs, never lowers it, and leaves a category without one as it is.
 */
export function quickAssignAmount(
	comp: BudgetComputation,
	month: Month,
	categoryId: string,
	strategy: QuickAssignStrategy,
	goal: CategoryGoal | null = null
): number {
	const current = categoryMonth(comp, month, categoryId);
	switch (strategy) {
		case 'goals':
			return goal ? Math.max(current.assigned, goalNeed(goal, month, current)) : current.assigned;
		case 'last-month':
			return categoryMonth(comp, addMonths(month, -1), categoryId).assigned;
		case 'avg-3':
		case 'avg-6':
		case 'avg-12': {
			const n = Number(strategy.slice(4));
			let activity = 0;
			for (let i = 1; i <= n; i++) {
				activity += categoryMonth(comp, addMonths(month, -i), categoryId).activity;
			}
			return Math.max(0, Math.round(-activity / n));
		}
		case 'cover-overspending':
			return current.available < 0 ? current.assigned - current.available : current.assigned;
		case 'clear':
			return 0;
	}
}
