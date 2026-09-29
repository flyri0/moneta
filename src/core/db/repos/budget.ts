import {
	categoryMonth,
	computeBudget,
	firstNegativeMonthAfter,
	type BudgetComputation
} from '$domain/budget-engine';
import { DomainError } from '$domain/errors';
import { goalNeed, type CategoryGoal } from '$domain/goal';
import { isMonth, type Month } from '$domain/month';
import {
	quickAssignAmount,
	QUICK_ASSIGN_STRATEGIES,
	type QuickAssignStrategy
} from '$domain/quick-assign';
import { one, run, tx, type Db } from '../connection';
import { loadEngineInput } from './aggregates';
import { getCategory, getGroup, listCategoryTree, type GroupNode } from './categories';

export interface BudgetCategoryView {
	id: string;
	name: string;
	hidden: boolean;
	carryoverOverspending: boolean;
	goal: CategoryGoal | null;
	/** What the goal asks to be assigned this month; `null` without a goal. */
	goalNeed: number | null;
	carryover: number;
	assigned: number;
	activity: number;
	available: number;
}

export interface BudgetGroupView {
	id: string;
	name: string;
	hidden: boolean;
	system: GroupNode['system'];
	assigned: number;
	activity: number;
	available: number;
	categories: BudgetCategoryView[];
}

export interface BudgetMonthView {
	month: Month;
	readyToAssign: number;
	availableFunds: number;
	overspentLastMonth: number;
	assignedThisMonth: number;
	futureNegativeMonth: Month | null;
	groups: BudgetGroupView[];
}

function requireMonth(month: Month): void {
	if (!isMonth(month)) throw new DomainError('INVALID_INPUT', `Invalid month ${month}`);
}

function compute(db: Db, month: Month): BudgetComputation {
	return computeBudget(loadEngineInput(db), month);
}

export function getBudgetMonth(db: Db, month: Month): BudgetMonthView {
	requireMonth(month);
	const comp = compute(db, month);
	const result = comp.months.get(month)!;
	const groups = listCategoryTree(db).map((g) => {
		const categories = g.categories.map((c) => {
			const cm = categoryMonth(comp, month, c.id);
			return {
				id: c.id,
				name: c.name,
				hidden: c.hidden,
				carryoverOverspending: c.carryoverOverspending,
				goal: c.goal,
				goalNeed: c.goal ? goalNeed(c.goal, month, cm) : null,
				...cm
			};
		});
		const sum = (key: 'assigned' | 'activity' | 'available') =>
			categories.reduce((s, c) => s + c[key], 0);
		return {
			id: g.id,
			name: g.name,
			hidden: g.hidden,
			system: g.system,
			assigned: sum('assigned'),
			activity: sum('activity'),
			available: sum('available'),
			categories
		};
	});
	return {
		month,
		readyToAssign: result.readyToAssign,
		availableFunds: result.availableFunds,
		overspentLastMonth: result.overspentLastMonth,
		assignedThisMonth: result.assignedThisMonth,
		futureNegativeMonth: firstNegativeMonthAfter(comp, month),
		groups
	};
}

function requireAssignable(db: Db, categoryId: string): void {
	const category = getCategory(db, categoryId);
	const group = getGroup(db, category.groupId);
	if (group.system === 'income')
		throw new DomainError('CATEGORY_NOT_ALLOWED', 'Income categories cannot be assigned');
}

function writeAssigned(db: Db, categoryId: string, month: Month, amount: number): void {
	if (amount === 0) {
		run(db, 'DELETE FROM budget_assignments WHERE category_id = ? AND month = ?', [
			categoryId,
			month
		]);
	} else {
		run(
			db,
			`INSERT INTO budget_assignments (category_id, month, assigned) VALUES (?, ?, ?)
			 ON CONFLICT (category_id, month) DO UPDATE SET assigned = excluded.assigned`,
			[categoryId, month, amount]
		);
	}
}

function getAssigned(db: Db, categoryId: string, month: Month): number {
	return (
		one<{ assigned: number }>(
			db,
			'SELECT assigned FROM budget_assignments WHERE category_id = ? AND month = ?',
			[categoryId, month]
		)?.assigned ?? 0
	);
}

export function setAssigned(db: Db, categoryId: string, month: Month, amount: number): void {
	requireMonth(month);
	if (!Number.isSafeInteger(amount))
		throw new DomainError('INVALID_INPUT', 'Amount must be an integer');
	tx(db, () => {
		requireAssignable(db, categoryId);
		writeAssigned(db, categoryId, month, amount);
	});
}

export interface MoveMoneyInput {
	fromCategoryId: string;
	toCategoryId: string;
	month: Month;
	amount: number; // > 0
}

export function moveMoney(db: Db, input: MoveMoneyInput): void {
	requireMonth(input.month);
	if (!Number.isSafeInteger(input.amount) || input.amount <= 0)
		throw new DomainError('INVALID_INPUT', 'Amount must be a positive integer');
	if (input.fromCategoryId === input.toCategoryId)
		throw new DomainError('INVALID_INPUT', 'Choose two different categories');
	tx(db, () => {
		requireAssignable(db, input.fromCategoryId);
		requireAssignable(db, input.toCategoryId);
		writeAssigned(
			db,
			input.fromCategoryId,
			input.month,
			getAssigned(db, input.fromCategoryId, input.month) - input.amount
		);
		writeAssigned(
			db,
			input.toCategoryId,
			input.month,
			getAssigned(db, input.toCategoryId, input.month) + input.amount
		);
	});
}

export interface QuickAssignInput {
	month: Month;
	categoryIds: string[];
	strategy: QuickAssignStrategy;
}

/** Each category's assigned amount under `strategy`, and what it is now. */
function quickAssignAmounts(
	db: Db,
	comp: BudgetComputation,
	month: Month,
	categoryIds: string[],
	strategy: QuickAssignStrategy
): { id: string; current: number; next: number }[] {
	return categoryIds.map((id) => ({
		id,
		current: categoryMonth(comp, month, id).assigned,
		next: quickAssignAmount(comp, month, id, strategy, getCategory(db, id).goal)
	}));
}

export function applyQuickAssign(db: Db, input: QuickAssignInput): void {
	requireMonth(input.month);
	if (!QUICK_ASSIGN_STRATEGIES.includes(input.strategy))
		throw new DomainError('INVALID_INPUT', `Unknown strategy ${input.strategy}`);
	tx(db, () => {
		for (const id of input.categoryIds) requireAssignable(db, id);
		const comp = compute(db, input.month);
		for (const { id, next } of quickAssignAmounts(
			db,
			comp,
			input.month,
			input.categoryIds,
			input.strategy
		)) {
			writeAssigned(db, id, input.month, next);
		}
	});
}

/** A quick-assign strategy and the categories' assigned total it would leave. */
export interface QuickAssignOption {
	strategy: QuickAssignStrategy;
	assigned: number;
}

export interface QuickAssignPreview {
	/** The categories' assigned total now. */
	assigned: number;
	/** Only the strategies that would change some category, in `QUICK_ASSIGN_STRATEGIES` order. */
	options: QuickAssignOption[];
}

/** What each quick-assign strategy would leave assigned to `categoryIds` in `month`. */
export function previewQuickAssign(
	db: Db,
	input: { month: Month; categoryIds: string[] }
): QuickAssignPreview {
	requireMonth(input.month);
	for (const id of input.categoryIds) requireAssignable(db, id);
	const comp = compute(db, input.month);
	let assigned = 0;
	for (const id of input.categoryIds) assigned += categoryMonth(comp, input.month, id).assigned;
	const options: QuickAssignOption[] = [];
	for (const strategy of QUICK_ASSIGN_STRATEGIES) {
		const amounts = quickAssignAmounts(db, comp, input.month, input.categoryIds, strategy);
		if (amounts.every((a) => a.next === a.current)) continue;
		options.push({ strategy, assigned: amounts.reduce((sum, a) => sum + a.next, 0) });
	}
	return { assigned, options };
}
