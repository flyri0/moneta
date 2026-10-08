import { todayIso } from '$domain/month';
import { type DateRange, presetRange, type RangePreset } from './range';

/**
 * The period the report pages share, kept for the session. `preset` stays null until someone
 * picks one: until then each page opens on the slice its card on the overview showed.
 */
export const period = $state<{ preset: RangePreset | 'custom' | null; custom: DateRange }>({
	preset: null,
	custom: presetRange('this_month', todayIso())
});

/** The range in force on a page whose own default is `fallback`. */
export function periodRange(fallback: RangePreset, today: string): DateRange {
	const preset = period.preset ?? fallback;
	return preset === 'custom' ? period.custom : presetRange(preset, today);
}

/**
 * Widens the reports to all time, for an empty report to offer; undefined when they already
 * show all of it, so nothing is filtered.
 */
export function showAllTime(fallback: RangePreset): (() => void) | undefined {
	if ((period.preset ?? fallback) === 'all') return undefined;
	return () => (period.preset = 'all');
}
