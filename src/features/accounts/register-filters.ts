import type { FlagFilter } from '$domain/flag';

/** Which transactions the status filter keeps. */
export type StatusFilter = '' | 'cleared' | 'uncleared';

/** The register's filters apart from the search. */
export interface FilterValues {
	/** The period, as `'YYYY-MM-DD'`; `''` leaves an end open. */
	from: string;
	to: string;
	/** `''` for any category or payee. */
	categoryId: string;
	payeeId: string;
	/** Bounds on the size of the amount, in minor units; `null` for none. */
	amountMin: number | null;
	amountMax: number | null;
	status: StatusFilter;
	/** The flags to keep, `'none'` for no flag; empty for any. */
	flags: FlagFilter;
}

export const NO_FILTERS: FilterValues = {
	from: '',
	to: '',
	categoryId: '',
	payeeId: '',
	amountMin: null,
	amountMax: null,
	status: '',
	flags: []
};

/** How many filters narrow the list: the period and the amount count once each. */
export function activeFilterCount(f: FilterValues): number {
	return [
		f.from || f.to,
		f.categoryId,
		f.payeeId,
		f.amountMin !== null || f.amountMax !== null,
		f.status,
		f.flags.length > 0
	].filter(Boolean).length;
}
