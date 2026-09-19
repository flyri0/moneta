import {
	categoryMonth,
	computeBudget,
	firstNegativeMonthAfter,
	type BudgetComputation
} from '$lib/domain/budget-engine';
import { DomainError } from '$lib/domain/errors';
import { isMonth, type Month } from '$lib/domain/month';
import {
	quickAssignAmount,
	QUICK_ASSIGN_STRATEGIES,
	type QuickAssignStrategy
} from '$lib/domain/quick-assign';
import { one, run, tx, type Db } from '../connection';
import { loadEngineInput } from './aggregates';
import { getCategory, listCategoryTree, type GroupNode } from './categories';

export interface BudgetCategoryView {
	id: string;
	name: string;
	hidden: boolean;
	carryoverOverspending: boolean;
	ccAccountId: string | null;
	carryover: number;
	assigned: number;
	activity: number;
	available: number;
	cashOverspent: number;
	creditOverspent: number;
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
	groups: BudgetGroupView[]; // excludes the Income group
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
	const groups = listCategoryTree(db)
		.filter((g) => g.system !== 'income')
		.map((g) => {
			const categories = g.categories.map((c) => ({
				id: c.id,
				name: c.name,
				hidden: c.hidden,
				carryoverOverspending: c.carryoverOverspending,
				ccAccountId: c.ccAccountId,
				...categoryMonth(comp, month, c.id)
			}));
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
	if (getCategory(db, categoryId).system)
		throw new DomainError('CATEGORY_NOT_ALLOWED', 'Ready to Assign cannot be assigned');
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

export function applyQuickAssign(db: Db, input: QuickAssignInput): void {
	requireMonth(input.month);
	if (!QUICK_ASSIGN_STRATEGIES.includes(input.strategy))
		throw new DomainError('INVALID_INPUT', `Unknown strategy ${input.strategy}`);
	tx(db, () => {
		for (const id of input.categoryIds) requireAssignable(db, id);
		const comp = compute(db, input.month);
		for (const id of input.categoryIds) {
			writeAssigned(db, id, input.month, quickAssignAmount(comp, input.month, id, input.strategy));
		}
	});
}
