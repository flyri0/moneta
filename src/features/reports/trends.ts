import type { Month } from '$domain/month';
import type { CategoryMonthRow } from '$db/repos/reports';

/** One category's spending per month. `color` is 1-based into `--cat-N`, null for the rest. */
export interface TrendSeries {
	key: string;
	/** Null for the remainder of smaller categories. */
	label: string | null;
	color: number | null;
	values: number[];
	total: number;
	/** A month on average, from the first month with any spending on. */
	average: number;
	/** A month on average over those months before the last, or null when there are none. */
	before: number | null;
}

export const OTHER_KEY = '__other';

function mean(values: number[]): number | null {
	return values.length ? Math.round(values.reduce((sum, v) => sum + v, 0) / values.length) : null;
}

function series(
	key: string,
	label: string | null,
	color: number | null,
	values: number[],
	start: number
): TrendSeries {
	return {
		key,
		label,
		color,
		values,
		total: values.reduce((sum, v) => sum + v, 0),
		average: mean(values.slice(start)) ?? 0,
		before: mean(values.slice(start, -1))
	};
}

/**
 * Spending per month for the `n` biggest categories over the months, largest first, with the rest
 * folded into one remainder. `categories` lists every expense category by total, for the table.
 * Averages start at the first month with any spending (`start`): the empty months before a budget
 * began would drag them down and make every change look huge.
 */
export function categoryTrends(
	rows: CategoryMonthRow[],
	months: Month[],
	n = 4
): {
	months: Month[];
	start: number;
	series: TrendSeries[];
	categories: TrendSeries[];
	totals: number[];
	average: number;
} {
	const column = new Map(months.map((m, i) => [m, i]));
	const byCategory = new Map<string, { name: string; values: number[] }>();
	for (const row of rows) {
		const i = column.get(row.month);
		if (row.income || i === undefined) continue;
		let entry = byCategory.get(row.categoryId);
		if (!entry) {
			entry = { name: row.name, values: months.map(() => 0) };
			byCategory.set(row.categoryId, entry);
		}
		entry.values[i] -= row.amount;
	}
	const spent = months.map((_, i) => [...byCategory.values()].some((c) => c.values[i] !== 0));
	const start = Math.max(0, spent.indexOf(true));
	const categories = [...byCategory]
		.map(([key, { name, values }]) => series(key, name, null, values, start))
		.sort((a, b) => b.total - a.total || (a.label ?? '').localeCompare(b.label ?? ''));
	const top = categories.slice(0, n).map((s, i) => ({ ...s, color: i + 1 }));
	const rest = categories.slice(n);
	const all = rest.length
		? [
				...top,
				series(
					OTHER_KEY,
					null,
					null,
					months.map((_, i) => rest.reduce((sum, s) => sum + s.values[i], 0)),
					start
				)
			]
		: top;
	const totals = months.map((_, i) => categories.reduce((sum, s) => sum + s.values[i], 0));
	return {
		months,
		start,
		series: all,
		categories,
		totals,
		average: mean(totals.slice(start)) ?? 0
	};
}
