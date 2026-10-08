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
