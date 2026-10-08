import { FLAG_COLORS, type FlagColor, type FlagFilter } from '$domain/flag';
import type { FlagRow } from '$db/repos/flags';
import { m } from '$i18n/paraglide/messages';

/** Each color's name, shown until the user names the flag. */
export const FLAG_COLOR_NAMES: Record<FlagColor, () => string> = {
	red: m.flag_red,
	orange: m.flag_orange,
	yellow: m.flag_yellow,
	green: m.flag_green,
	blue: m.flag_blue,
	purple: m.flag_purple
};

/** The classes that paint a flag icon its color, light and dark. */
export const FLAG_CLASSES: Record<FlagColor, string> = {
	red: 'text-red-500 fill-red-500',
	orange: 'text-orange-500 fill-orange-500',
	yellow: 'text-yellow-400 fill-yellow-400',
	green: 'text-green-600 fill-green-600 dark:text-green-500 dark:fill-green-500',
	blue: 'text-blue-500 fill-blue-500',
	purple: 'text-purple-500 fill-purple-500'
};

/** A flag's name: the one the user gave it, or its color's. */
export function flagLabel(color: FlagColor, flags: readonly FlagRow[] | undefined): string {
	return flags?.find((f) => f.color === color)?.name ?? FLAG_COLOR_NAMES[color]();
}

/** What a flag filter keeps, in a few words: any flag, the one picked, or how many. */
export function flagFilterLabel(filter: FlagFilter, flags: readonly FlagRow[] | undefined): string {
	if (filter.length === 0) return m.flag_filter_any();
	if (filter.length > 1) return m.flag_filter_count({ count: filter.length });
	return filter[0] === 'none' ? m.flag_none() : flagLabel(filter[0], flags);
}

/** A filter as a query takes it: a plain copy, or nothing when it keeps every transaction. */
export function flagQuery(filter: FlagFilter): FlagFilter | undefined {
	return filter.length > 0 ? [...filter] : undefined;
}

/** `filter` with `value` added or taken out, always in the order the choices are shown. */
export function toggleFlag(filter: FlagFilter, value: FlagColor | 'none'): FlagFilter {
	const next = new Set(filter);
	if (next.has(value)) next.delete(value);
	else next.add(value);
	return (['none', ...FLAG_COLORS] as const).filter((f) => next.has(f));
}

/**
 * The names in `after` that differ from `before`: what a rename sends, so a field left as it
 * was (even one drawn before the names loaded) never clears a flag's name.
 */
export function changedFlagNames(
	before: Record<FlagColor, string>,
	after: Record<FlagColor, string>
): Partial<Record<FlagColor, string>> {
	return Object.fromEntries(
		FLAG_COLORS.filter((c) => after[c] !== before[c]).map((c) => [c, after[c]])
	);
}
