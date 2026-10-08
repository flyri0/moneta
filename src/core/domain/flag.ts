import { DomainError } from './errors';

/** The colors a transaction can be flagged with, in the order they are offered. */
export const FLAG_COLORS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple'] as const;

export type FlagColor = (typeof FLAG_COLORS)[number];

/** Which flags a filter keeps: colors, and `'none'` for transactions without a flag. */
export type FlagFilter = (FlagColor | 'none')[];

export function isFlagColor(value: unknown): value is FlagColor {
	return typeof value === 'string' && (FLAG_COLORS as readonly string[]).includes(value);
}

/** `flag` when it is a flag color, null for none. Throws on anything else. */
export function validateFlag(flag: unknown): FlagColor | null {
	if (flag === null || flag === undefined) return null;
	if (!isFlagColor(flag)) throw new DomainError('INVALID_INPUT', `Invalid flag ${String(flag)}`);
	return flag;
}

/** `filter` when it lists only flag colors and `'none'`. Throws on anything else. */
export function validateFlagFilter(filter: unknown): FlagFilter {
	if (!Array.isArray(filter) || !filter.every((f) => f === 'none' || isFlagColor(f)))
		throw new DomainError('INVALID_INPUT', 'Invalid flag filter');
	return filter as FlagFilter;
}
