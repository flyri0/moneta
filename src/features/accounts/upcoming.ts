import type { UpcomingOccurrence } from '$db/repos/schedules';

/** An upcoming occurrence as the list shows it. */
export interface UpcomingRow {
	occurrence: UpcomingOccurrence;
	/** Where the last occurrence it stands for is in the full list, for the balance after it. */
	position: number;
	/** How many more overdue occurrences of its schedule the list leaves out. */
	moreOverdue: number;
}

/**
 * The occurrences to list: each schedule's first overdue one stands for the others, which are
 * counted instead of listed. A start date typed years back would otherwise list them all.
 */
export function collapseOverdue(occurrences: UpcomingOccurrence[]): UpcomingRow[] {
	const rows: UpcomingRow[] = [];
	const firstOverdue = new Map<string, UpcomingRow>();
	occurrences.forEach((occurrence, position) => {
		const first = occurrence.due ? firstOverdue.get(occurrence.scheduleId) : undefined;
		if (first) {
			first.moreOverdue++;
			first.position = position;
			return;
		}
		const row = { occurrence, position, moreOverdue: 0 };
		if (occurrence.due) firstOverdue.set(occurrence.scheduleId, row);
		rows.push(row);
	});
	// A collapsed row stands at its last occurrence: each balance then counts the rows above it.
	return rows.sort((a, b) => a.position - b.position);
}
