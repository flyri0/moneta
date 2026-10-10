/** How many months have income or spending: a chart of them needs two. */
export function monthsWithFlow(rows: readonly { income: number; spending: number }[]): number {
	return rows.filter((r) => r.income !== 0 || r.spending !== 0).length;
}

/** How many months have spending, from a trend's monthly totals. */
export function monthsWithSpending(totals: readonly number[]): number {
	return totals.filter((t) => t !== 0).length;
}
