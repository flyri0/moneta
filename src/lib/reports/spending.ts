import type { SpendingRow } from '$lib/db/repos/reports';
import type { TransactionRow } from '$lib/db/repos/transactions';

/** How much of a transaction falls in a category: the amount, or its split lines there. */
export function amountInCategory(row: TransactionRow, categoryId: string): number {
	if (!row.isSplit) return row.amount;
	return row.splits
		.filter((s) => s.categoryId === categoryId)
		.reduce((sum, s) => sum + s.amount, 0);
}

/** The report's total, and each category's share of it in percent. */
export function withShares(rows: SpendingRow[]): {
	total: number;
	rows: (SpendingRow & { share: number })[];
} {
	const total = rows.reduce((sum, r) => sum + r.amount, 0);
	return { total, rows: rows.map((r) => ({ ...r, share: total ? (r.amount / total) * 100 : 0 })) };
}
