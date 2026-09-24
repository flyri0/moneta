import { DomainError } from './errors';
import { addDays, isDate } from './month';

export const FREQUENCIES = ['once', 'daily', 'weekly', 'monthly', 'yearly'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

/** Where an occurrence that falls on a Saturday or Sunday moves. */
export const WEEKEND_RULES = ['keep', 'before', 'after'] as const;
export type WeekendRule = (typeof WEEKEND_RULES)[number];

/** When a schedule repeats. Dates are 'YYYY-MM-DD'. */
export interface Rule {
	startDate: string;
	frequency: Frequency;
	/** Every `interval` days, weeks, months or years. Ignored for 'once'. */
	interval: number;
	/** The last date an occurrence may be scheduled on, before the weekend rule moves it. */
	endDate: string | null;
	/** How many occurrences there are in all. */
	endCount: number | null;
	/** Ignored for 'daily', where moved dates would repeat. */
	weekend: WeekendRule;
}

export interface Occurrence {
	index: number;
	date: string;
}

function parts(date: string): [number, number, number] {
	const [y, m, d] = date.split('-').map(Number);
	return [y, m, d];
}

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `date` moved by whole months, on the same day or on the last day of a shorter month. */
function addMonthsClamped(date: string, months: number): string {
	const [y, m, d] = parts(date);
	const index = y * 12 + (m - 1) + months;
	const year = Math.floor(index / 12);
	const month = (index % 12) + 1;
	const day = Math.min(d, daysInMonth(year, month));
	return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function weekday(date: string): number {
	const [y, m, d] = parts(date);
	return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

function moveOffWeekend(date: string, rule: WeekendRule): string {
	const day = weekday(date);
	if (rule === 'keep' || (day !== 0 && day !== 6)) return date;
	if (rule === 'before') return addDays(date, day === 6 ? -1 : -2);
	return addDays(date, day === 6 ? 2 : 1);
}

/** Occurrence `n` counted from the start date, so month ends never drift. */
function step(rule: Rule, n: number): string {
	const units = n * rule.interval;
	switch (rule.frequency) {
		case 'once':
			return rule.startDate;
		case 'daily':
			return addDays(rule.startDate, units);
		case 'weekly':
			return addDays(rule.startDate, 7 * units);
		case 'monthly':
			return addMonthsClamped(rule.startDate, units);
		case 'yearly':
			return addMonthsClamped(rule.startDate, 12 * units);
	}
}

/**
 * The date occurrence `n` (0 is the first) is scheduled on, before the weekend rule, or null when
 * the rule has no such occurrence: past its end, or past the years dates may use.
 */
export function scheduledDate(rule: Rule, n: number): string | null {
	if (!Number.isSafeInteger(n) || n < 0) return null;
	if (rule.frequency === 'once' && n > 0) return null;
	if (rule.endCount !== null && n >= rule.endCount) return null;
	const date = step(rule, n);
	if (!isDate(date)) return null;
	if (rule.endDate !== null && date > rule.endDate) return null;
	return date;
}

/**
 * Where the rule goes on at occurrence `n` if its end is lifted, before the weekend rule: the date
 * an edited schedule picks up from. A one-time schedule stays on its own date.
 */
export function resumeDate(rule: Rule, n: number): string | null {
	if (rule.frequency === 'once') return rule.startDate;
	const date = step(rule, n);
	return isDate(date) ? date : null;
}

/** The date occurrence `n` happens on: its scheduled date, moved off the weekend if asked. */
export function occurrenceDate(rule: Rule, n: number): string | null {
	const date = scheduledDate(rule, n);
	if (date === null || rule.frequency === 'daily') return date;
	return moveOffWeekend(date, rule.weekend);
}

/** The occurrences from index `from` on whose date is on or before `until`. */
export function occurrencesBetween(rule: Rule, from: number, until: string): Occurrence[] {
	const out: Occurrence[] = [];
	for (let n = from; ; n++) {
		const date = occurrenceDate(rule, n);
		if (date === null || date > until) return out;
		out.push({ index: n, date });
	}
}

/** Throws INVALID_INPUT unless the engine can follow `rule`. */
export function validateRule(rule: Rule): void {
	const fail = (message: string): never => {
		throw new DomainError('INVALID_INPUT', message);
	};
	if (!isDate(rule.startDate)) fail(`Invalid start date ${rule.startDate}`);
	if (!FREQUENCIES.includes(rule.frequency)) fail(`Invalid frequency ${rule.frequency}`);
	if (!Number.isSafeInteger(rule.interval) || rule.interval < 1)
		fail('Interval must be a whole number from 1');
	if (!WEEKEND_RULES.includes(rule.weekend)) fail(`Invalid weekend rule ${rule.weekend}`);
	if (rule.endDate !== null && (!isDate(rule.endDate) || rule.endDate < rule.startDate))
		fail(`Invalid end date ${rule.endDate}`);
	if (rule.endCount !== null && (!Number.isSafeInteger(rule.endCount) || rule.endCount < 1))
		fail('End count must be a whole number from 1');
}
