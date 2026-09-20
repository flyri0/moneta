import { compareMonths, currentMonth, monthOf, type Month } from '$lib/domain/month';
import type { NetWorthPoint } from '$lib/domain/net-worth';
import type { DateRange } from './range';

/** The month to ask the repo for: the range's last month, never past the current one. */
export function netWorthThrough(range: DateRange, today: string): Month {
	const now = currentMonth(new Date(`${today}T00:00:00Z`));
	const last = monthOf(range.to);
	return compareMonths(last, now) > 0 ? now : last;
}

/** The points a range covers: whole months from its first month through `netWorthThrough`. */
export function pointsInRange(
	points: NetWorthPoint[],
	range: DateRange,
	today: string
): NetWorthPoint[] {
	const first = monthOf(range.from);
	const last = netWorthThrough(range, today);
	return points.filter((p) => p.month >= first && p.month <= last);
}

export interface NetWorthChange {
	current: number;
	/** The last month's net worth minus the first's. Money, never a percentage: net worth
	 * crosses zero and goes negative, so a percentage of it means nothing. */
	change: number;
	from: Month;
	to: Month;
	months: number;
}

/** The stat tile's numbers, or null when the range holds no month with data. */
export function netWorthChange(points: NetWorthPoint[]): NetWorthChange | null {
	if (points.length === 0) return null;
	const first = points[0];
	const last = points[points.length - 1];
	return {
		current: last.netWorth,
		change: last.netWorth - first.netWorth,
		from: first.month,
		to: last.month,
		months: points.length
	};
}
