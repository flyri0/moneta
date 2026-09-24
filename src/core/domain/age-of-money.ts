import { daysBetween, monthOf, monthRange, type Month } from './month';

/** One movement of money into or out of the cash accounts. */
export interface CashFlowEntry {
	date: string; // YYYY-MM-DD
	id: string; // breaks ties within a day (UUIDv7, so creation order)
	amount: number; // minor units, negative = outflow
	opening: boolean; // a starting balance
}

export interface AgeOfMoneyPoint {
	month: Month;
	days: number | null; // null until there are enough outflows
}

/** How many of the latest outflows the figure averages, as YNAB does. */
export const AGE_OF_MONEY_OUTFLOWS = 10;

interface Bucket {
	date: string;
	left: number;
}

function compareFlows(a: CashFlowEntry, b: CashFlowEntry): number {
	if (a.date !== b.date) return a.date < b.date ? -1 : 1;
	const aOut = a.amount < 0;
	if (aOut !== b.amount < 0) return aOut ? 1 : -1;
	return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Age of Money at the end of each month (today, for the current one), from the first month with
 * an entry: the mean age of the last ten outflows. Inflows queue up as dated buckets and each
 * outflow drains the oldest first, its age weighted by how much it took from each bucket.
 *
 * Money spent that never came in (an overdraft) counts as zero days old and is owed back: the
 * next inflows repay it before they can be spent. A negative starting balance is owed the same
 * way, without counting as an outflow.
 */
export function ageOfMoneySeries(entries: CashFlowEntry[], today: string): AgeOfMoneyPoint[] {
	const flows = entries.filter((e) => e.date <= today).sort(compareFlows);
	if (flows.length === 0) return [];

	const buckets: Bucket[] = [];
	let head = 0;
	let owed = 0;
	const ages: number[] = [];
	const byMonth = new Map<Month, number | null>();

	for (const flow of flows) {
		if (flow.amount > 0) {
			const repaid = Math.min(owed, flow.amount);
			owed -= repaid;
			if (flow.amount > repaid) buckets.push({ date: flow.date, left: flow.amount - repaid });
		} else if (flow.opening) {
			owed -= flow.amount;
		} else {
			const total = -flow.amount;
			let need = total;
			let age = 0;
			while (need > 0 && head < buckets.length) {
				const bucket = buckets[head];
				const take = Math.min(need, bucket.left);
				age += (take / total) * daysBetween(bucket.date, flow.date);
				bucket.left -= take;
				need -= take;
				if (bucket.left === 0) head += 1;
			}
			owed += need;
			ages.push(age);
			if (ages.length > AGE_OF_MONEY_OUTFLOWS) ages.shift();
		}
		byMonth.set(
			monthOf(flow.date),
			ages.length < AGE_OF_MONEY_OUTFLOWS
				? null
				: Math.round(ages.reduce((sum, a) => sum + a, 0) / ages.length)
		);
	}

	let last: number | null = null;
	return monthRange(monthOf(flows[0].date), monthOf(today)).map((month) => {
		if (byMonth.has(month)) last = byMonth.get(month) ?? null;
		return { month, days: last };
	});
}
