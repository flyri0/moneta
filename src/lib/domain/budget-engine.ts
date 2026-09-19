import { addMonths, monthOf, monthRange, type Month } from './month';

export type CategoryKind = 'regular' | 'ready_to_assign' | 'cc_payment';

export interface EngineCategory {
	id: string;
	kind: CategoryKind;
	cardAccountId: string | null; // set when kind === 'cc_payment'
	carryoverOverspending: boolean;
}

/** One categorized amount on an on-budget account (a transaction or a split line). */
export interface EngineEntry {
	categoryId: string;
	date: string; // YYYY-MM-DD
	order: string; // tie-breaker within a date (UUIDv7 ids sort by creation time)
	amount: number; // minor units, negative = outflow
	cardAccountId: string | null; // set when the entry is on a credit card account
}

/** The non-card leg of a transfer between an on-budget cash account and a credit card. */
export interface EnginePayment {
	cardAccountId: string;
	date: string;
	amount: number; // negative = payment to the card, positive = cash advance
}

export interface EngineAssignment {
	categoryId: string;
	month: Month;
	assigned: number;
}

export interface EngineInput {
	categories: EngineCategory[];
	entries: EngineEntry[];
	payments: EnginePayment[];
	assignments: EngineAssignment[];
}

export interface CategoryMonth {
	carryover: number;
	assigned: number;
	activity: number;
	available: number;
	cashOverspent: number; // uncovered cash spending (deducted from next month's RTA unless carryover)
	creditOverspent: number; // uncovered card spending (becomes card debt)
}

export interface MonthResult {
	month: Month;
	categories: Map<string, CategoryMonth>;
	income: number; // Σ entries to Ready to Assign in this month
	availableFunds: number; // previous RTA + income
	overspentLastMonth: number; // Σ cash overspending of the previous month
	assignedThisMonth: number;
	readyToAssign: number;
}

export interface BudgetComputation {
	months: Map<Month, MonthResult>;
	first: Month;
	last: Month;
}

const CASH = '__cash__';

function compareEntries(a: EngineEntry, b: EngineEntry): number {
	if (a.date !== b.date) return a.date < b.date ? -1 : 1;
	return a.order < b.order ? -1 : a.order > b.order ? 1 : 0;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
	const map = new Map<string, T[]>();
	for (const item of items) {
		const k = key(item);
		const list = map.get(k);
		if (list) list.push(item);
		else map.set(k, [item]);
	}
	return map;
}

function carryoverFrom(prev: CategoryMonth | undefined, category: EngineCategory): number {
	if (!prev) return 0;
	if (prev.available > 0) return prev.available;
	if (prev.available < 0 && category.carryoverOverspending) return prev.available;
	return 0;
}

/**
 * Runs one regular category through a month in date order.
 * `debt` tracks uncovered (overspent) amounts per source: CASH or a card account id.
 * Invariant after every step: Σ debt === max(0, -running).
 */
function runCategory(
	start: number,
	entries: EngineEntry[],
	fund: (cardAccountId: string, amount: number) => void
): { activity: number; available: number; cashOverspent: number; creditOverspent: number } {
	let running = start;
	let activity = 0;
	const debt = new Map<string, number>();
	if (start < 0) debt.set(CASH, -start);

	for (const e of entries) {
		const source = e.cardAccountId ?? CASH;
		activity += e.amount;
		if (e.amount < 0) {
			const out = -e.amount;
			const covered = Math.min(out, Math.max(0, running));
			if (source !== CASH && covered > 0) fund(source, covered);
			const uncovered = out - covered;
			if (uncovered > 0) debt.set(source, (debt.get(source) ?? 0) + uncovered);
		} else {
			let remaining = e.amount;
			const order = [source, CASH, ...debt.keys()].filter((k, i, a) => a.indexOf(k) === i);
			for (const key of order) {
				if (remaining === 0) break;
				const pay = Math.min(debt.get(key) ?? 0, remaining);
				if (pay === 0) continue;
				debt.set(key, (debt.get(key) ?? 0) - pay);
				remaining -= pay;
				if (key !== CASH) fund(key, pay);
				if (source !== CASH) fund(source, -pay);
			}
			if (remaining > 0 && source !== CASH) fund(source, -remaining);
		}
		running += e.amount;
	}

	let cashOverspent = 0;
	let creditOverspent = 0;
	for (const [key, amount] of debt) {
		if (key === CASH) cashOverspent += amount;
		else creditOverspent += amount;
	}
	return { activity, available: running, cashOverspent, creditOverspent };
}

export function computeBudget(input: EngineInput, through: Month): BudgetComputation {
	const dataMonths = [
		...input.entries.map((e) => monthOf(e.date)),
		...input.payments.map((p) => monthOf(p.date)),
		...input.assignments.map((a) => a.month)
	];
	const first = dataMonths.reduce((min, m) => (m < min ? m : min), through);
	const last = dataMonths.reduce((max, m) => (m > max ? m : max), through);

	const rta = input.categories.find((c) => c.kind === 'ready_to_assign');
	const regular = input.categories.filter((c) => c.kind === 'regular');
	const ccCategories = input.categories.filter((c) => c.kind === 'cc_payment');

	const entriesByKey = groupBy(
		[...input.entries].sort(compareEntries),
		(e) => `${monthOf(e.date)}|${e.categoryId}`
	);
	const paymentsByKey = groupBy(input.payments, (p) => `${monthOf(p.date)}|${p.cardAccountId}`);
	const assigned = new Map(
		input.assignments.map((a) => [`${a.month}|${a.categoryId}`, a.assigned])
	);

	const months = new Map<Month, MonthResult>();
	let prev: MonthResult | undefined;

	for (const month of monthRange(first, last)) {
		const categories = new Map<string, CategoryMonth>();
		const funding = new Map<string, number>();
		const fund = (card: string, amount: number) =>
			funding.set(card, (funding.get(card) ?? 0) + amount);

		let income = 0;
		if (rta) {
			for (const e of entriesByKey.get(`${month}|${rta.id}`) ?? []) {
				income += e.amount;
				if (e.cardAccountId) fund(e.cardAccountId, -e.amount);
			}
		}

		for (const c of regular) {
			const carryover = carryoverFrom(prev?.categories.get(c.id), c);
			const a = assigned.get(`${month}|${c.id}`) ?? 0;
			const r = runCategory(carryover + a, entriesByKey.get(`${month}|${c.id}`) ?? [], fund);
			categories.set(c.id, { carryover, assigned: a, ...r });
		}

		for (const c of ccCategories) {
			const carryover = carryoverFrom(prev?.categories.get(c.id), c);
			const a = assigned.get(`${month}|${c.id}`) ?? 0;
			const payments = (paymentsByKey.get(`${month}|${c.cardAccountId}`) ?? []).reduce(
				(sum, p) => sum + p.amount,
				0
			);
			const activity = (funding.get(c.cardAccountId ?? '') ?? 0) + payments;
			const available = carryover + a + activity;
			categories.set(c.id, {
				carryover,
				assigned: a,
				activity,
				available,
				cashOverspent: available < 0 ? -available : 0,
				creditOverspent: 0
			});
		}

		let overspentLastMonth = 0;
		if (prev) {
			for (const c of input.categories) {
				const p = prev.categories.get(c.id);
				if (p && !c.carryoverOverspending) overspentLastMonth += p.cashOverspent;
			}
		}
		let assignedThisMonth = 0;
		for (const cm of categories.values()) assignedThisMonth += cm.assigned;
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
	available: 0,
	cashOverspent: 0,
	creditOverspent: 0
};

export function categoryMonth(
	comp: BudgetComputation,
	month: Month,
	categoryId: string
): CategoryMonth {
	return comp.months.get(month)?.categories.get(categoryId) ?? EMPTY_CATEGORY;
}

/** First month after `month` whose Ready to Assign is negative, or null. */
export function firstNegativeMonthAfter(comp: BudgetComputation, month: Month): Month | null {
	for (let m = addMonths(month, 1); m <= comp.last; m = addMonths(m, 1)) {
		const r = comp.months.get(m);
		if (r && r.readyToAssign < 0) return m;
	}
	return null;
}
