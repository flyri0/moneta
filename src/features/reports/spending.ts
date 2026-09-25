import type { Table } from '$db/connection';
import type { SpendingRow } from '$db/repos/reports';
import type { TransactionRow } from '$db/repos/transactions';

/** What spending and cash flow read: a change to any of these can move a report. */
export const SPENDING_TABLES: Table[] = [
	'transactions',
	'transaction_splits',
	'categories',
	'category_groups',
	'accounts',
	'payees'
];

/** The fill for a segment's colour slot, or the muted one for the remainder. */
export function segmentClass(color: number | null): string {
	return (
		['bg-cat-1', 'bg-cat-2', 'bg-cat-3', 'bg-cat-4', 'bg-cat-5'][(color ?? 0) - 1] ??
		'bg-muted-foreground/40'
	);
}

/** How much of a transaction falls in a category: the amount, or its split lines there. */
export function amountInCategory(row: TransactionRow, categoryId: string): number {
	if (!row.isSplit) return row.amount;
	return row.splits
		.filter((s) => s.categoryId === categoryId)
		.reduce((sum, s) => sum + s.amount, 0);
}

/** The report's total, and each row's share of it in percent. */
export function withShares<T extends { amount: number }>(
	rows: T[]
): {
	total: number;
	rows: (T & { share: number })[];
} {
	const total = rows.reduce((sum, r) => sum + r.amount, 0);
	return { total, rows: rows.map((r) => ({ ...r, share: total ? (r.amount / total) * 100 : 0 })) };
}

/** A slice of the stacked bar. `color` is 1-based, into the `--cat-N` palette. */
export interface Segment {
	key: string;
	label: string;
	amount: number;
	share: number;
	color: number;
}

/** What the stacked bar and its legend are made from: a keyed, labelled amount. */
export interface Slice {
	key: string;
	label: string;
	amount: number;
}

export interface TopSegments {
	total: number;
	segments: Segment[];
	other: { count: number; amount: number; share: number } | null;
}

/**
 * The first `n` slices as coloured segments, and everything after them folded into one
 * remainder, so the bar still adds up to the total. Slices come largest first.
 */
export function topSlices(slices: Slice[], n = 5): TopSegments {
	const { total, rows: shared } = withShares(slices);
	const segments = shared.slice(0, n).map((r, i) => ({ ...r, color: i + 1 }));
	const rest = shared.slice(n);
	const amount = rest.reduce((sum, r) => sum + r.amount, 0);
	return {
		total,
		segments,
		other: rest.length ? { count: rest.length, amount, share: (amount / total) * 100 } : null
	};
}

/** `topSlices` over spending rows, one per category (or group). */
export function topSegments(rows: SpendingRow[], n = 5): TopSegments {
	return topSlices(
		rows.map((r) => ({ key: r.categoryId, label: r.name, amount: r.amount })),
		n
	);
}

/**
 * Spending summed per category group, in the same shape as a category row (the group's name
 * stands in for the id), largest first, then by name.
 */
export function byGroup(rows: SpendingRow[]): SpendingRow[] {
	const groups = new Map<string, number>();
	for (const r of rows) groups.set(r.groupName, (groups.get(r.groupName) ?? 0) + r.amount);
	return [...groups]
		.map(([name, amount]) => ({ categoryId: name, name, groupName: '', amount }))
		.sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name));
}
