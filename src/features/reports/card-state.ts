/** How many months have income or spending: a card with none is empty. */
export function monthsWithFlow(rows: readonly { income: number; spending: number }[]): number {
	return rows.filter((r) => r.income !== 0 || r.spending !== 0).length;
}

/**
 * Whether the only month with data is the latest one (the current month): a chart of it has to
 * wait for the next. One older month still draws, as a bar or a line from there.
 */
export function chartWaitsForNextMonth(months: readonly boolean[]): boolean {
	return months.filter(Boolean).length === 1 && months.at(-1) === true;
}

/** Which months have income or spending. */
export function flowMonths(rows: readonly { income: number; spending: number }[]): boolean[] {
	return rows.map((r) => r.income !== 0 || r.spending !== 0);
}
