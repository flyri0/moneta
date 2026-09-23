import { addMonths, monthOf, monthRange, type Month } from '$domain/month';
import type { CashFlowRow } from '$db/repos/reports';
import { type DateRange, span } from './range';

/** The last `n` whole months through the current one, and the dates they cover. */
export function lastMonths(today: string, n: number): { months: Month[]; range: DateRange } {
	const last = monthOf(today);
	const first = addMonths(last, -(n - 1));
	return { months: monthRange(first, last), range: span(first, last) };
}

/** One row per month in `months`, with zeros for the months the repo had nothing for. */
export function fillMonths(rows: CashFlowRow[], months: Month[]): CashFlowRow[] {
	const byMonth = new Map(rows.map((r) => [r.month, r]));
	return months.map((month) => byMonth.get(month) ?? { month, income: 0, spending: 0 });
}

/**
 * The share of income not spent, in percent (negative when spending outran it), or null when
 * there was no income to measure against.
 */
export function savingsRate(rows: CashFlowRow[]): number | null {
	const income = rows.reduce((sum, r) => sum + r.income, 0);
	if (income <= 0) return null;
	const spending = rows.reduce((sum, r) => sum + r.spending, 0);
	return ((income - spending) / income) * 100;
}
