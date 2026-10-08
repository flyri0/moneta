import type { FlagFilter } from '$domain/flag';
import { todayIso } from '$domain/month';
import { type DateRange, presetRange, type RangePreset } from './range';

/**
 * The period the report pages share, kept for the session. `preset` stays null until someone
 * picks one: until then each page opens on the slice its card on the overview showed. `flags`
 * narrows the reports of money spent and earned to those flags; empty keeps every transaction.
 */
export const period = $state<{
	preset: RangePreset | 'custom' | null;
	custom: DateRange;
	flags: FlagFilter;
}>({
	preset: null,
	custom: presetRange('this_month', todayIso()),
	flags: []
});

/** The range in force on a page whose own default is `fallback`. */
export function periodRange(fallback: RangePreset, today: string): DateRange {
	const preset = period.preset ?? fallback;
	return preset === 'custom' ? period.custom : presetRange(preset, today);
}

/**
 * Clears the reports' filters (all time, every flag), for an empty report to offer; undefined
 * when nothing is filtered.
 */
export function clearFilters(fallback: RangePreset): (() => void) | undefined {
	if ((period.preset ?? fallback) === 'all' && period.flags.length === 0) return undefined;
	return () => {
		period.preset = 'all';
		period.flags = [];
	};
}
