import type { UpcomingOccurrence } from '$db/repos/schedules';

/** A displayed occurrence, including the total of the overdue ones it represents. */
export interface UpcomingRow {
	occurrence: UpcomingOccurrence;
	moreOverdue: number;
	amount: number;
	balance: number;
}

/** Groups overdue occurrences by schedule and projects balances in displayed order. */
export function collapseOverdue(
	occurrences: UpcomingOccurrence[],
	openingBalance: number
): UpcomingRow[] {
	const rows: UpcomingRow[] = [];
	const firstOverdue = new Map<string, UpcomingRow>();
	for (const occurrence of occurrences) {
		const first = occurrence.due ? firstOverdue.get(occurrence.scheduleId) : undefined;
		if (first) {
			first.moreOverdue++;
			first.amount += occurrence.amount;
			continue;
		}
		const row = { occurrence, moreOverdue: 0, amount: occurrence.amount, balance: 0 };
		if (occurrence.due) firstOverdue.set(occurrence.scheduleId, row);
		rows.push(row);
	}
	let balance = openingBalance;
	for (const row of rows) row.balance = balance += row.amount;
	return rows;
}
