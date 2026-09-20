import { addMonths, MAX_DATE, MIN_DATE, monthOf, type Month } from '$lib/domain/month';

export const RANGE_PRESETS = [
	'this_month',
	'last_month',
	'last_3_months',
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

/** The whole months a preset covers, relative to `today` (YYYY-MM-DD). */
export function presetRange(preset: RangePreset, today: string): DateRange {
	const month = monthOf(today);
	const span = (first: Month, last: Month) => ({ from: `${first}-01`, to: lastDay(last) });
	switch (preset) {
		case 'this_month':
			return span(month, month);
		case 'last_month':
			return span(addMonths(month, -1), addMonths(month, -1));
		case 'last_3_months':
			return span(addMonths(month, -2), month);
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
