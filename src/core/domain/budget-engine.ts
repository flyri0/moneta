import { groupBy } from './group-by';
import { addMonths, monthRange, type Month } from './month';

export type CategoryKind = 'regular' | 'income';

export interface EngineCategory {
	id: string;
	kind: CategoryKind;
	carryoverOverspending: boolean;
}

/**
 * Categorized money on on-budget accounts (transactions and split lines): a category's total for
 * a month, or any part of it (the engine adds entries of the same month and category up).
 */
export interface EngineEntry {
	categoryId: string;
	month: Month;
	amount: number; // minor units, negative = outflow
}

export interface EngineAssignment {
	categoryId: string;
	month: Month;
	assigned: number;
}

export interface EngineInput {
	categories: EngineCategory[];
	entries: EngineEntry[];
	assignments: EngineAssignment[];
}

export interface CategoryMonth {
	carryover: number;
	assigned: number;
	activity: number;
	available: number;
}

export interface MonthResult {
	month: Month;
	categories: Map<string, CategoryMonth>;
	income: number; // Σ entries to Income categories in this month
	availableFunds: number; // previous RTA + income
	overspentLastMonth: number; // Σ negative available of regular categories without carryover
	assignedThisMonth: number;
	readyToAssign: number;
}

export interface BudgetComputation {
	months: Map<Month, MonthResult>;
	first: Month;
	last: Month;
}

function carryoverFrom(prev: CategoryMonth | undefined, category: EngineCategory): number {
	if (!prev) return 0;
	if (prev.available > 0) return prev.available;
	if (prev.available < 0 && category.carryoverOverspending) return prev.available;
	return 0;
}

export function computeBudget(input: EngineInput, through: Month): BudgetComputation {
	const dataMonths = [
		...input.entries.map((e) => e.month),
		...input.assignments.map((a) => a.month)
	];
	const first = dataMonths.reduce((min, m) => (m < min ? m : min), through);
	const last = dataMonths.reduce((max, m) => (m > max ? m : max), through);

	const regular = input.categories.filter((c) => c.kind === 'regular');
	const incomeCategories = input.categories.filter((c) => c.kind === 'income');

	const entriesByKey = groupBy(input.entries, (e) => `${e.month}|${e.categoryId}`);
	const assigned = new Map(
		input.assignments.map((a) => [`${a.month}|${a.categoryId}`, a.assigned])
	);

	const months = new Map<Month, MonthResult>();
	let prev: MonthResult | undefined;

	for (const month of monthRange(first, last)) {
		const categories = new Map<string, CategoryMonth>();

		let income = 0;
		for (const ic of incomeCategories) {
			const entries = entriesByKey.get(`${month}|${ic.id}`) ?? [];
			const activity = entries.reduce((sum, e) => sum + e.amount, 0);
			income += activity;
			categories.set(ic.id, {
				carryover: 0,
				assigned: 0,
				activity,
				available: 0
			});
		}

		for (const c of regular) {
			const carryover = carryoverFrom(prev?.categories.get(c.id), c);
			const a = assigned.get(`${month}|${c.id}`) ?? 0;
			const entries = entriesByKey.get(`${month}|${c.id}`) ?? [];
			const activity = entries.reduce((sum, e) => sum + e.amount, 0);
			const available = carryover + a + activity;
			categories.set(c.id, {
				carryover,
				assigned: a,
				activity,
				available
			});
		}

		let overspentLastMonth = 0;
		if (prev) {
			for (const c of regular) {
				const p = prev.categories.get(c.id);
				if (p && p.available < 0 && !c.carryoverOverspending) {
					overspentLastMonth += -p.available;
				}
			}
		}

		let assignedThisMonth = 0;
		for (const c of regular) {
			assignedThisMonth += categories.get(c.id)?.assigned ?? 0;
		}
		const availableFunds = (prev?.readyToAssign ?? 0) + income;

		const result: MonthResult = {
			month,
			categories,
			income,
			availableFunds,
			overspentLastMonth,
			assignedThisMonth,
			readyToAssign: availableFunds - overspentLastMonth - assignedThisMonth
		};
		months.set(month, result);
		prev = result;
	}

	return { months, first, last };
}

const EMPTY_CATEGORY: CategoryMonth = {
	carryover: 0,
	assigned: 0,
	activity: 0,
	available: 0
};

export function categoryMonth(
	comp: BudgetComputation,
	month: Month,
	categoryId: string
): CategoryMonth {
	return comp.months.get(month)?.categories.get(categoryId) ?? EMPTY_CATEGORY;
}

export function firstNegativeMonthAfter(comp: BudgetComputation, month: Month): Month | null {
	for (let m = addMonths(month, 1); m <= comp.last; m = addMonths(m, 1)) {
		const r = comp.months.get(m);
		if (r && r.readyToAssign < 0) return m;
	}
	return null;
}
