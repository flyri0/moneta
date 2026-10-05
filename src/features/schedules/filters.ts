import type { ScheduleRow } from '$db/repos/schedules';
import type { MoneyFormat } from '$domain/money';
import { foldText, searchTerms, type SearchTerm } from '$domain/search';

/** Which schedules the status filter keeps: the list's sections. */
export type ScheduleStatusFilter = '' | 'due' | 'upcoming' | 'inactive';

/** Which schedules the type filter keeps. */
export type ScheduleKindFilter = '' | 'auto' | 'manual' | 'installments';

/** The schedules screen's filters apart from the search. */
export interface ScheduleFilterValues {
	/** The next dates to keep, as `'YYYY-MM-DD'`; `''` leaves an end open. */
	from: string;
	to: string;
	/** `''` for any account (its own or the one it transfers to), category or payee. */
	accountId: string;
	categoryId: string;
	payeeId: string;
	/** Bounds on the size of the amount, in minor units; `null` for none. */
	amountMin: number | null;
	amountMax: number | null;
	status: ScheduleStatusFilter;
	kind: ScheduleKindFilter;
}

export const NO_SCHEDULE_FILTERS: ScheduleFilterValues = {
	from: '',
	to: '',
	accountId: '',
	categoryId: '',
	payeeId: '',
	amountMin: null,
	amountMax: null,
	status: '',
	kind: ''
};

/** How many filters narrow the list: the period and the amount count once each. */
export function activeScheduleFilterCount(f: ScheduleFilterValues): number {
	return [
		f.from || f.to,
		f.accountId,
		f.categoryId,
		f.payeeId,
		f.amountMin !== null || f.amountMax !== null,
		f.status,
		f.kind
	].filter(Boolean).length;
}

const STATUSES: Record<Exclude<ScheduleStatusFilter, ''>, ScheduleRow['status'][]> = {
	due: ['due'],
	upcoming: ['active'],
	inactive: ['paused', 'ended']
};

function keeps(s: ScheduleRow, f: ScheduleFilterValues): boolean {
	if (f.from && (s.nextDate === null || s.nextDate < f.from)) return false;
	if (f.to && (s.nextDate === null || s.nextDate > f.to)) return false;
	if (f.accountId && s.accountId !== f.accountId && s.transferAccountId !== f.accountId)
		return false;
	if (
		f.categoryId &&
		s.categoryId !== f.categoryId &&
		!s.splits.some((l) => l.categoryId === f.categoryId)
	)
		return false;
	if (f.payeeId && s.payeeId !== f.payeeId) return false;
	const size = Math.abs(s.amount);
	if (f.amountMin !== null && size < f.amountMin) return false;
	if (f.amountMax !== null && size > f.amountMax) return false;
	if (f.status && !STATUSES[f.status].includes(s.status)) return false;
	if (f.kind === 'auto' && !s.autoEnter) return false;
	if (f.kind === 'manual' && s.autoEnter) return false;
	if (f.kind === 'installments' && s.installmentStart === null) return false;
	return true;
}

/** The folded texts a search looks in: names, categories and memos, split lines' too. */
function texts(s: ScheduleRow): string[] {
	return [
		s.payeeName,
		s.accountName,
		s.transferAccountName,
		s.categoryName,
		s.memo,
		...s.splits.flatMap((l) => [l.categoryName, l.memo])
	]
		.filter((t): t is string => !!t)
		.map(foldText);
}

function matches(s: ScheduleRow, folded: string[], term: SearchTerm): boolean {
	if (folded.some((t) => t.includes(term.text))) return true;
	if (term.amount === null) return false;
	return (
		Math.abs(s.amount) === term.amount || s.splits.some((l) => Math.abs(l.amount) === term.amount)
	);
}

/**
 * The schedules the search and the filters keep, in the same order. `search` splits into words
 * that must all match, each in any name, category or memo, ignoring case and accents; a word that
 * reads as an amount in the budget's format also matches that amount, of either sign.
 */
export function filterSchedules(
	rows: ScheduleRow[],
	search: string,
	filters: ScheduleFilterValues,
	money: MoneyFormat
): ScheduleRow[] {
	const terms = searchTerms(search, money);
	return rows.filter((s) => {
		if (!keeps(s, filters)) return false;
		if (terms.length === 0) return true;
		const folded = texts(s);
		return terms.every((term) => matches(s, folded, term));
	});
}
