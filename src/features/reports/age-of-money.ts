import type { AgeOfMoneyPoint } from '$domain/age-of-money';
import type { Month } from '$domain/month';
import type { Table } from '$db/connection';
import { m } from '$i18n/paraglide/messages';
import { pointsInRange } from './net-worth';
import type { DateRange } from './range';

/** What Age of Money reads: the transactions, the accounts they sit in and the starting-balance payee. */
export const AGE_OF_MONEY_TABLES: Table[] = ['transactions', 'accounts', 'payees'];

export interface AgeOfMoneyValue {
	month: Month;
	days: number;
}

/**
 * The months a range covers, never past the current one, that have a figure. Only the first
 * months of a budget lack one (it takes ten outflows), so dropping them leaves no gaps.
 */
export function ageOfMoneyInRange(
	points: AgeOfMoneyPoint[],
	range: DateRange,
	today: string
): AgeOfMoneyValue[] {
	return pointsInRange(points, range, today).filter((p): p is AgeOfMoneyValue => p.days !== null);
}

export interface AgeOfMoneyChange {
	current: number;
	change: number; // days, the last month's figure minus the first's
	from: Month;
	to: Month;
	months: number;
}

/** The stat tile's numbers, or null when there is no point to show. */
export function ageOfMoneyChange(points: AgeOfMoneyValue[]): AgeOfMoneyChange | null {
	if (points.length === 0) return null;
	const first = points[0];
	const last = points[points.length - 1];
	return {
		current: last.days,
		change: last.days - first.days,
		from: first.month,
		to: last.month,
		months: points.length
	};
}

/** A number of days, as a figure the reader sees. */
export function daysLabel(days: number): string {
	return days === 1 ? m.reports_age_of_money_day() : m.reports_age_of_money_days({ count: days });
}
