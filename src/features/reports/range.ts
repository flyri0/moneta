import {
	addMonths,
	compareMonths,
	MAX_DATE,
	MIN_DATE,
	monthOf,
	monthRange,
	type Month
} from '$domain/month';

export const RANGE_PRESETS = [
	'this_month',
	'last_month',
	'last_3_months',
	'last_6_months',
	'last_12_months',
	'this_year',
	'all'
] as const;

export type RangePreset = (typeof RANGE_PRESETS)[number];

export interface DateRange {
	from: string; // YYYY-MM-DD
	to: string;
}

function lastDay(month: Month): string {
	const [y, m] = month.split('-').map(Number);
	const day = new Date(Date.UTC(y, m, 0)).getUTCDate();
	return `${month}-${String(day).padStart(2, '0')}`;
}

/** The dates from the first day of `first` through the last day of `last`. */
export function span(first: Month, last: Month): DateRange {
	return { from: `${first}-01`, to: lastDay(last) };
}

/** The whole months a preset covers, relative to `today` (YYYY-MM-DD). */
export function presetRange(preset: RangePreset, today: string): DateRange {
	const month = monthOf(today);
	switch (preset) {
		case 'this_month':
			return span(month, month);
		case 'last_month':
			return span(addMonths(month, -1), addMonths(month, -1));
		case 'last_3_months':
			return span(addMonths(month, -2), month);
		case 'last_6_months':
			return span(addMonths(month, -5), month);
		case 'last_12_months':
			return span(addMonths(month, -11), month);
		case 'this_year':
			return span(`${today.slice(0, 4)}-01`, `${today.slice(0, 4)}-12`);
		// Every date the schema allows, so a transaction dated next month still counts. The
		// net-worth report clamps the future away for itself.
		case 'all':
			return { from: MIN_DATE, to: MAX_DATE };
	}
}

/**
 * How many months a range touches, the future left out, or null when that means nothing: all
 * time has no length to average over, and a range wholly ahead has not started.
 */
export function monthsCovered(range: DateRange, today: string): number | null {
	if (range.from === MIN_DATE) return null;
	const now = monthOf(today);
	const last = compareMonths(monthOf(range.to), now) > 0 ? now : monthOf(range.to);
	const first = monthOf(range.from);
	return compareMonths(first, last) > 0 ? null : monthRange(first, last).length;
}

/**
 * The months a report over `range` shows, the future left out. All time starts at the first month
 * that has data (`dataMonths`, in any order), so it has nothing to show without any.
 */
export function reportMonths(range: DateRange, today: string, dataMonths: Month[]): Month[] {
	const now = monthOf(today);
	const last = compareMonths(monthOf(range.to), now) > 0 ? now : monthOf(range.to);
	let first = monthOf(range.from);
	if (range.from === MIN_DATE) {
		const earliest = [...dataMonths].sort(compareMonths)[0];
		if (!earliest) return [];
		first = earliest;
	}
	return compareMonths(first, last) > 0 ? [] : monthRange(first, last);
}
